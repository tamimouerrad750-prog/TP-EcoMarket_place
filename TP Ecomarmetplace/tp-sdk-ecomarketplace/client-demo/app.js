// SIMULATION : Code présent sur le site e-commerce marchand
// =========================================================================
// SANS SDK (approche historique, verbeuse et sujette aux erreurs) :
// ~25 lignes, pas de retry, pas de timeout, gestion d'erreur HTTP oubliée
// (fetch ne rejette pas sur un 401 !).

const API_KEY = "mch_live_99x821a";
const API_URL = "http://localhost:8000/v1/events/purchase";

async function simulatePurchaseWithoutSDK() {
  const payload = {
    orderId: "ORD-" + Math.floor(Math.random() * 10000),
    items: [
      { category: "electronics", weightKg: 1.5 },
      { category: "clothing", weightKg: 0.8 },
    ],
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("[Sans SDK] Réponse de l'API :", data);
  } catch (error) {
    console.error("[Sans SDK] Erreur :", error);
  }
}

// =========================================================================
// AVEC SDK : 3 lignes utiles.

const { EcoSDK } = require("./ecosdk");

async function simulatePurchaseWithSDK() {
  const eco = new EcoSDK({ apiKey: API_KEY });                       // 1. init

  const res = await eco.trackPurchase({                              // 2. appel
    orderId: "ORD-" + Math.floor(Math.random() * 10000),
    items: [
      { category: "electronics", weightKg: 1.5 },
      { category: "clothing", weightKg: 0.8 },
    ],
  });
  console.log("[Avec SDK] Réponse :", res);

  console.log("[Avec SDK] Analytics :", await eco.getAnalytics()); // 3. stats

  // Mode non bloquant : ne ralentit pas la validation du panier
  eco.track({ orderId: "ORD-ASYNC-1", items: [{ category: "food", weightKg: 2 }] });
}

(async () => {
  await simulatePurchaseWithoutSDK();
  await simulatePurchaseWithSDK();
})();
