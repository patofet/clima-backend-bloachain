const { Mutex } = require("async-mutex");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TransactionQueue {
  /**
   * Manages transaction sending with manual nonce control via mutex.
   * This replaces ethers' NonceManager which can desync under load.
   *
   * How it works:
   * 1. Mutex ensures only one transaction is being SENT at a time
   * 2. Before each send, we query the blockchain for the REAL confirmed nonce
   * 3. We override the tx nonce with this value
   * 4. Confirmation (tx.wait) happens OUTSIDE the mutex for parallelism
   *
   * @param {object} signer - ethers Wallet (NOT a NonceManager)
   * @param {object} provider - ethers Provider for querying nonce
   * @param {Object} options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 5)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1500)
   */
  constructor(signer, provider, options = {}) {
    this.mutex = new Mutex();
    this.signer = signer;
    this.provider = provider;
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 1500;
    this.signerAddress = signer.address;

    // Internal nonce tracker: starts as null, gets set on first tx
    // We track it ourselves to avoid querying the blockchain every time
    // but we RESET it from the blockchain on any error
    this._nextNonce = null;

    // Stats for debugging
    this._txCount = 0;
    this._errorCount = 0;

    console.log(`[TxQueue] Inicializada para signer: ${this.signerAddress}`);
    console.log(`[TxQueue] Config: maxRetries=${this.maxRetries}, retryDelay=${this.retryDelay}ms`);
  }

  /**
   * Get the next nonce to use. On first call or after error, queries blockchain.
   * Otherwise uses the tracked internal counter.
   */
  async _getNonce(forceRefresh = false) {
    if (this._nextNonce === null || forceRefresh) {
      const reason = this._nextNonce === null ? "primer uso / reset" : "forzado por retry";
      console.log(`[TxQueue] 🔄 Consultando nonce de blockchain (reason: ${reason})...`);
      const onChainNonce = await this.provider.getTransactionCount(this.signerAddress, "latest");
      console.log(`[TxQueue] 📊 Nonce on-chain (latest): ${onChainNonce} | Nonce interno anterior: ${this._nextNonce}`);
      this._nextNonce = onChainNonce;
    } else {
      console.log(`[TxQueue] 📊 Usando nonce interno: ${this._nextNonce} (sin consultar blockchain)`);
    }
    return this._nextNonce;
  }

  /**
   * Checks if an error is nonce-related
   */
  _isNonceError(error) {
    const nonceErrorCodes = ["NONCE_EXPIRED"];
    const nonceErrorMessages = [
      "nonce has already been used",
      "nonce too low",
      "Transaction nonce is too distant",
      "replacement transaction underpriced",
    ];
    return nonceErrorCodes.includes(error.code) || nonceErrorMessages.some((msg) => error.message?.includes(msg));
  }

  /**
   * Send a transaction through the mutex queue with manual nonce management.
   *
   * @param {Function} txFunction - Function that accepts a nonce override object and sends tx.
   *                                Example: (overrides) => contract.certify(arg1, arg2, overrides)
   * @returns {Promise<{tx: object}>} - The sent transaction object
   * @throws {Error} - If all retries are exhausted
   */
  async send(txFunction) {
    let attempt = 0;
    const txId = ++this._txCount;
    const queuedAt = Date.now();
    console.log(`[TxQueue] 📥 Tx #${txId} encolada. Esperando mutex...`);

    while (attempt < this.maxRetries) {
      const waitStart = Date.now();
      const release = await this.mutex.acquire();
      const waitMs = Date.now() - waitStart;

      if (waitMs > 50) {
        console.log(`[TxQueue] 🔒 Tx #${txId} adquirió mutex tras esperar ${waitMs}ms`);
      } else {
        console.log(`[TxQueue] 🔒 Tx #${txId} adquirió mutex (sin espera)`);
      }

      try {
        const nonce = await this._getNonce(attempt > 0); // force refresh on retries
        console.log(`[TxQueue] 🚀 Tx #${txId} | Intento ${attempt + 1}/${this.maxRetries} | Nonce: ${nonce} | Enviando...`);

        const sendStart = Date.now();
        const tx = await txFunction({ nonce });
        const sendMs = Date.now() - sendStart;

        // Success - increment our internal nonce tracker
        this._nextNonce = nonce + 1;
        const totalMs = Date.now() - queuedAt;
        console.log(`[TxQueue] ✅ Tx #${txId} enviada OK | Hash: ${tx.hash} | Nonce: ${nonce} | Envío: ${sendMs}ms | Total: ${totalMs}ms`);
        console.log(`[TxQueue] 📊 Próximo nonce: ${this._nextNonce} | Stats: ${this._txCount} enviadas, ${this._errorCount} errores`);

        // Release BEFORE wait() so other txs can be sent while this confirms
        release();
        return { tx };
      } catch (error) {
        // Reset internal nonce on any error
        const prevNonce = this._nextNonce;
        this._nextNonce = null;
        this._errorCount++;
        release();

        attempt++;
        const isNonce = this._isNonceError(error);
        const errorType = isNonce ? "NONCE" : error.code === "CALL_EXCEPTION" ? "REVERT" : "UNKNOWN";
        console.error(`[TxQueue] ❌ Tx #${txId} | Intento ${attempt}/${this.maxRetries} | Tipo: ${errorType} | Nonce era: ${prevNonce}`);
        console.error(`[TxQueue] ❌ Error: ${error.message}`);
        if (error.code) console.error(`[TxQueue] ❌ Code: ${error.code} | Reason: ${error.reason || "N/A"}`);

        if (isNonce) {
          if (attempt >= this.maxRetries) {
            console.error(`[TxQueue] 💀 Tx #${txId} | Agotados ${this.maxRetries} reintentos por error de nonce`);
            throw new Error(`Error de nonce persistente tras ${this.maxRetries} reintentos: ${error.message}`);
          }
          console.warn(`[TxQueue] 🔄 Tx #${txId} | Esperando ${this.retryDelay}ms antes de reintentar con nonce fresco...`);
          await sleep(this.retryDelay);
          continue;
        } else if (error.code === "CALL_EXCEPTION") {
          console.error(`[TxQueue] 🚫 Tx #${txId} | Transacción revertida on-chain, NO se reintenta`);
          const err = new Error(`Transacción revertida on-chain: ${error.message}`);
          err.code = error.code;
          err.reason = error.reason;
          throw err;
        } else {
          console.error(`[TxQueue] 💥 Tx #${txId} | Error desconocido, NO se reintenta`);
          throw error;
        }
      }
    }
    throw new Error(`Se alcanzó el límite de ${this.maxRetries} reintentos sin éxito.`);
  }

  /**
   * Send a transaction and wait for confirmation.
   * For /certify - returns full receipt info.
   */
  async sendAndWait(txFunction) {
    const { tx } = await this.send(txFunction);
    console.log(`[TxQueue] ⏳ Esperando confirmación de tx: ${tx.hash}...`);
    const waitStart = Date.now();
    const receipt = await tx.wait();
    const confirmMs = Date.now() - waitStart;
    console.log(`[TxQueue] ✅ Tx confirmada: ${tx.hash} | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()} | Confirmación: ${confirmMs}ms`);
    return { tx, receipt };
  }

  /**
   * Send a transaction without waiting for confirmation.
   * For /certify-async - returns tx hash immediately.
   */
  async sendOnly(txFunction) {
    const result = await this.send(txFunction);
    console.log(`[TxQueue] 🔥 Tx enviada sin esperar confirmación: ${result.tx.hash}`);
    return result;
  }
}

module.exports = TransactionQueue;
