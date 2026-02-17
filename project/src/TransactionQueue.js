const { Mutex } = require("async-mutex");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Promise that rejects after a timeout
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${ms}ms esperando: ${label}`)), ms)
    ),
  ]);
}

class TransactionQueue {
  /**
   * Manages transaction sending with manual nonce control via mutex.
   *
   * @param {object} signer - ethers Wallet (NOT a NonceManager)
   * @param {object} provider - ethers Provider for querying nonce
   * @param {Object} options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 5)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1500)
   * @param {number} options.confirmTimeout - Max ms to wait for tx confirmation (default: 60000)
   */
  constructor(signer, provider, options = {}) {
    this.mutex = new Mutex();
    this.signer = signer;
    this.provider = provider;
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 1500;
    this.confirmTimeout = options.confirmTimeout || 90000;
    this.signerAddress = signer.address;

    this._nextNonce = null;
    this._txCount = 0;
    this._errorCount = 0;

    console.log(`[TxQueue] Inicializada para signer: ${this.signerAddress}`);
    console.log(`[TxQueue] Config: maxRetries=${this.maxRetries}, retryDelay=${this.retryDelay}ms, confirmTimeout=${this.confirmTimeout}ms`);
  }

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
        const nonce = await this._getNonce(attempt > 0);
        console.log(`[TxQueue] 🚀 Tx #${txId} | Intento ${attempt + 1}/${this.maxRetries} | Nonce: ${nonce} | Enviando...`);

        const sendStart = Date.now();
        const tx = await txFunction({ nonce });
        const sendMs = Date.now() - sendStart;

        // Guard: ethers can return null under heavy load if tx drops from mempool
        if (!tx || !tx.hash) {
          this._nextNonce = null;
          this._errorCount++;
          release();
          attempt++;
          console.warn(`[TxQueue] ⚠️ Tx #${txId} | Intento ${attempt}/${this.maxRetries} | tx response es null, reintentando...`);
          if (attempt >= this.maxRetries) {
            throw new Error(`Tx response null tras ${this.maxRetries} intentos`);
          }
          await sleep(this.retryDelay);
          continue;
        }

        this._nextNonce = nonce + 1;
        const totalMs = Date.now() - queuedAt;
        console.log(`[TxQueue] ✅ Tx #${txId} enviada OK | Hash: ${tx.hash} | Nonce: ${nonce} | Envío: ${sendMs}ms | Total: ${totalMs}ms`);
        console.log(`[TxQueue] 📊 Próximo nonce: ${this._nextNonce} | Stats: ${this._txCount} enviadas, ${this._errorCount} errores`);

        release();
        return { tx };
      } catch (error) {
        const prevNonce = this._nextNonce;
        this._nextNonce = null;
        this._errorCount++;
        release();

        attempt++;
        const isNonce = this._isNonceError(error);
        const isRevert = error.code === "CALL_EXCEPTION";
        const errorType = isNonce ? "NONCE" : isRevert ? "REVERT" : "UNKNOWN";
        console.error(`[TxQueue] ❌ Tx #${txId} | Intento ${attempt}/${this.maxRetries} | Tipo: ${errorType} | Nonce era: ${prevNonce}`);
        console.error(`[TxQueue] ❌ Error: ${error.message}`);
        if (error.code) console.error(`[TxQueue] ❌ Code: ${error.code} | Reason: ${error.reason || "N/A"}`);

        if (isNonce || isRevert) {
          if (attempt >= this.maxRetries) {
            console.error(`[TxQueue] 💀 Tx #${txId} | Agotados ${this.maxRetries} reintentos por error de ${errorType}`);
            const err = new Error(isRevert
              ? `Transacción revertida on-chain: ${error.message}`
              : `Error de nonce persistente tras ${this.maxRetries} reintentos: ${error.message}`);
            err.code = error.code;
            err.reason = error.reason;
            throw err;
          }
          const delay = isRevert ? this.retryDelay * 2 : this.retryDelay;
          console.warn(`[TxQueue] 🔄 Tx #${txId} | Esperando ${delay}ms antes de reintentar (${errorType})...`);
          await sleep(delay);
          continue;
        } else {
          console.error(`[TxQueue] 💥 Tx #${txId} | Error desconocido, NO se reintenta`);
          throw error;
        }
      }
    }
    throw new Error(`Se alcanzó el límite de ${this.maxRetries} reintentos sin éxito.`);
  }

  /**
   * Send a transaction and wait for confirmation WITH TIMEOUT.
   * For /certify - returns full receipt info.
   */
  async sendAndWait(txFunction) {
    const { tx } = await this.send(txFunction);
    console.log(`[TxQueue] ⏳ Esperando confirmación de tx: ${tx.hash} (timeout: ${this.confirmTimeout}ms)...`);
    const waitStart = Date.now();

    try {
      const receipt = await withTimeout(
        tx.wait(),
        this.confirmTimeout,
        `confirmación tx ${tx.hash}`
      );
      const confirmMs = Date.now() - waitStart;
      console.log(`[TxQueue] ✅ Tx confirmada: ${tx.hash} | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()} | Confirmación: ${confirmMs}ms`);
      return { tx, receipt };
    } catch (error) {
      const elapsedMs = Date.now() - waitStart;
      console.warn(`[TxQueue] ⏰ tx.wait() falló tras ${elapsedMs}ms para ${tx.hash}: ${error.message}`);

      // Fallback: query receipt manually — tx might have been mined but tx.wait() missed it
      console.log(`[TxQueue] 🔍 Verificando receipt manualmente para ${tx.hash}...`);
      try {
        const receipt = await this.provider.getTransactionReceipt(tx.hash);
        if (receipt && receipt.blockNumber) {
          console.log(`[TxQueue] ✅ Tx SÍ fue minada (fallback): ${tx.hash} | Block: ${receipt.blockNumber} | Gas: ${receipt.gasUsed.toString()}`);
          return { tx, receipt };
        }
      } catch (fallbackErr) {
        console.warn(`[TxQueue] ⚠️ Fallback getTransactionReceipt falló: ${fallbackErr.message}`);
      }

      // If we still don't have receipt, reset nonce and fail
      console.error(`[TxQueue] ❌ Tx ${tx.hash} NO confirmada tras ${elapsedMs}ms ni en fallback`);
      this._nextNonce = null;
      throw error;
    }
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
