const { Mutex } = require("async-mutex");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TransactionQueue {
  /**
   * @param {Function} restartNonceManager - Function to reset the NonceManager nonce
   * @param {Object} options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 5)
   * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
   */
  constructor(restartNonceManager, options = {}) {
    this.mutex = new Mutex();
    this.restartNonceManager = restartNonceManager;
    this.maxRetries = options.maxRetries || 5;
    this.retryDelay = options.retryDelay || 1000;
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
   * Send a transaction through the mutex queue.
   * The mutex ensures only one transaction is being SENT at a time (nonce assignment).
   * Confirmation (tx.wait) happens outside the mutex for parallelism.
   *
   * @param {Function} txFunction - Async function that sends the transaction.
   *                                Must return a transaction response (tx).
   *                                Example: () => contract.certify(arg1, arg2, ...)
   * @returns {Promise<{tx: object}>} - The sent transaction object
   * @throws {Error} - If all retries are exhausted
   */
  async send(txFunction) {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      // Acquire mutex - only one tx can be sent at a time
      const release = await this.mutex.acquire();
      try {
        console.log(`[TxQueue] Intento ${attempt + 1}/${this.maxRetries}: Enviando transacción...`);
        const tx = await txFunction();
        console.log(`[TxQueue] Transacción enviada, hash: ${tx.hash}`);
        // Release mutex BEFORE waiting for confirmation
        // This allows other transactions to be sent while this one confirms
        release();
        return { tx };
      } catch (error) {
        // Reset nonce on ANY error since the NonceManager may have incremented
        this.restartNonceManager();
        release();

        attempt++;
        console.error(`[TxQueue] Intento ${attempt} falló: ${error.message}`);

        if (this._isNonceError(error)) {
          if (attempt >= this.maxRetries) {
            throw new Error(`Error de nonce persistente tras ${this.maxRetries} reintentos: ${error.message}`);
          }
          console.warn(`[TxQueue] Error de nonce detectado. Esperando ${this.retryDelay}ms antes de reintentar...`);
          await sleep(this.retryDelay);
          continue;
        } else if (error.code === "CALL_EXCEPTION") {
          // On-chain revert - don't retry, the transaction will always fail
          const err = new Error(`Transacción revertida on-chain: ${error.message}`);
          err.code = error.code;
          err.reason = error.reason;
          throw err;
        } else {
          // Unknown error - don't retry
          throw error;
        }
      }
    }
    throw new Error(`Se alcanzó el límite de ${this.maxRetries} reintentos sin éxito.`);
  }

  /**
   * Send a transaction and wait for confirmation.
   * Use for /certify endpoint - returns full receipt info.
   *
   * @param {Function} txFunction - Async function that sends the transaction
   * @returns {Promise<{tx: object, receipt: object}>}
   */
  async sendAndWait(txFunction) {
    const { tx } = await this.send(txFunction);
    const receipt = await tx.wait();
    return { tx, receipt };
  }

  /**
   * Send a transaction without waiting for confirmation.
   * Use for /certify-async endpoint - returns tx hash immediately.
   *
   * @param {Function} txFunction - Async function that sends the transaction
   * @returns {Promise<{tx: object}>}
   */
  async sendOnly(txFunction) {
    return this.send(txFunction);
  }
}

module.exports = TransactionQueue;
