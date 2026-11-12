/**
 * EcoSDK — client léger pour la plateforme EcoMarketplace.
 *
 * Objectifs de conception (réduire la friction développeur / TTFC) :
 *  - initialisation en une ligne : new EcoSDK({ apiKey })
 *  - authentification automatique (header X-API-Key injecté partout)
 *  - retry avec backoff exponentiel + jitter (réseau, 5xx, 429) ; jamais sur 4xx
 *  - timeout par requête, pour ne jamais bloquer le site marchand
 *  - mode "fire and forget" (track) : l'achat n'attend pas la plateforme
 *  - version de l'API figée dans le SDK (protège des breaking changes)
 *
 * Aucune dépendance : utilise fetch (Node >= 18 ou navigateur).
 */

const SDK_VERSION = "1.0.0";

class EcoSDKError extends Error {
  constructor(message, { status = null, code = "ECO_ERROR", cause } = {}) {
    super(message);
    this.name = "EcoSDKError";
    this.status = status;
    this.code = code; // AUTH_ERROR | VALIDATION_ERROR | RATE_LIMITED | SERVER_ERROR | NETWORK_ERROR | TIMEOUT
    if (cause) this.cause = cause;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class EcoSDK {
  /**
   * @param {object} options
   * @param {string} options.apiKey            Clé API marchand (obligatoire)
   * @param {string} [options.baseUrl]         URL de la plateforme
   * @param {string} [options.apiVersion]      Version d'API ciblée (figée : "v1")
   * @param {number} [options.maxRetries]      Nombre de nouvelles tentatives (défaut 3)
   * @param {number} [options.retryBaseMs]     Délai de base du backoff (défaut 300 ms)
   * @param {number} [options.timeoutMs]       Timeout par tentative (défaut 5000 ms)
   * @param {function} [options.onError]       Callback pour les erreurs du mode non bloquant
   */
  constructor({
    apiKey,
    baseUrl = "http://localhost:8000",
    apiVersion = "v1",
    maxRetries = 3,
    retryBaseMs = 300,
    timeoutMs = 5000,
    onError = null,
  } = {}) {
    if (!apiKey || typeof apiKey !== "string") {
      throw new EcoSDKError("apiKey est obligatoire : new EcoSDK({ apiKey })", {
        code: "AUTH_ERROR",
      });
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiVersion = apiVersion;
    this.maxRetries = maxRetries;
    this.retryBaseMs = retryBaseMs;
    this.timeoutMs = timeoutMs;
    this.onError = onError;
  }

  // ---------------------------------------------------------------- API publique

  /** Envoie un achat et attend la réponse (avec retry automatique). */
  async trackPurchase({ orderId, items } = {}) {
    this._validatePurchase({ orderId, items });
    return this._request("POST", "/events/purchase", { orderId, items });
  }

  /** Alias utilisé dans l'énoncé du TP. */
  trackCarbon(payload) {
    return this.trackPurchase(payload);
  }

  /**
   * Version non bloquante : retourne immédiatement, l'envoi et les retries se
   * font en arrière-plan. Les échecs finaux sont remontés via onError.
   */
  track(payload) {
    this.trackPurchase(payload).catch((err) => {
      if (this.onError) this.onError(err);
    });
  }

  /** Statistiques du marchand authentifié. */
  async getAnalytics() {
    return this._request("GET", "/analytics/merchant");
  }

  // ---------------------------------------------------------------- interne

  _validatePurchase({ orderId, items }) {
    if (!orderId) {
      throw new EcoSDKError("orderId est obligatoire", { code: "VALIDATION_ERROR" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new EcoSDKError("items doit être un tableau non vide", { code: "VALIDATION_ERROR" });
    }
    for (const it of items) {
      if (!it || typeof it.category !== "string" || typeof it.weightKg !== "number" || it.weightKg < 0) {
        throw new EcoSDKError(
          "chaque item doit avoir { category: string, weightKg: number >= 0 }",
          { code: "VALIDATION_ERROR" }
        );
      }
    }
  }

  async _request(method, path, body) {
    const url = `${this.baseUrl}/${this.apiVersion}${path}`;
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this._attempt(method, url, body);
      } catch (err) {
        lastError = err;
        if (!this._isRetryable(err) || attempt === this.maxRetries) break;
        // backoff exponentiel + jitter : 300, 600, 1200 ms (± 25 %)
        const delay = this.retryBaseMs * 2 ** attempt * (0.75 + Math.random() * 0.5);
        await sleep(delay);
      }
    }
    throw lastError;
  }

  async _attempt(method, url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
          "X-EcoSDK-Version": SDK_VERSION,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new EcoSDKError(`Timeout après ${this.timeoutMs} ms`, { code: "TIMEOUT", cause: err });
      }
      throw new EcoSDKError(`Erreur réseau : ${err.message}`, { code: "NETWORK_ERROR", cause: err });
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) return response.json();

    let detail = response.statusText;
    try {
      const data = await response.json();
      if (data && data.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch (_) {
      /* corps non JSON : on garde statusText */
    }

    const s = response.status;
    const code =
      s === 401 || s === 403 ? "AUTH_ERROR" :
      s === 429 ? "RATE_LIMITED" :
      s >= 500 ? "SERVER_ERROR" : "VALIDATION_ERROR";
    throw new EcoSDKError(`HTTP ${s} : ${detail}`, { status: s, code });
  }

  _isRetryable(err) {
    // On ne réessaie jamais une erreur du développeur (4xx), sauf 429.
    return ["NETWORK_ERROR", "TIMEOUT", "SERVER_ERROR", "RATE_LIMITED"].includes(err.code);
  }
}

module.exports = { EcoSDK, EcoSDKError, SDK_VERSION };
