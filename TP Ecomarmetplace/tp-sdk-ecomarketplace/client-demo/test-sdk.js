// Tests du comportement du SDK : node test-sdk.js  (backend lancé sur :8000)
const http = require("http");
const assert = require("assert");
const { EcoSDK } = require("./ecosdk");

(async () => {
  // 1. Clé invalide -> AUTH_ERROR immédiat, pas de retry
  let calls = 0;
  const bad = new EcoSDK({ apiKey: "bad", retryBaseMs: 10 });
  const t0 = Date.now();
  await bad.trackPurchase({ orderId: "X", items: [{ category: "food", weightKg: 1 }] })
    .then(() => assert.fail("devrait échouer"))
    .catch((e) => { assert.strictEqual(e.code, "AUTH_ERROR"); assert.strictEqual(e.status, 401); });
  assert(Date.now() - t0 < 200, "pas de retry sur 401");
  console.log("OK  401 -> AUTH_ERROR sans retry");

  // 2. Validation locale avant tout appel réseau
  const ok = new EcoSDK({ apiKey: "mch_live_99x821a" });
  await ok.trackPurchase({ orderId: "X", items: [] })
    .then(() => assert.fail()).catch((e) => assert.strictEqual(e.code, "VALIDATION_ERROR"));
  console.log("OK  validation locale");

  // 3. Serveur instable : 2 x 503 puis succès -> le SDK réussit via retry
  const flaky = http.createServer((req, res) => {
    calls++;
    res.setHeader("Content-Type", "application/json");
    if (calls <= 2) { res.statusCode = 503; return res.end('{"detail":"down"}'); }
    res.end('{"success":true,"orderId":"R1","carbonEmittedKg":2}');
  }).listen(8099);
  const sdk = new EcoSDK({ apiKey: "k", baseUrl: "http://localhost:8099", retryBaseMs: 10 });
  const r = await sdk.trackPurchase({ orderId: "R1", items: [{ category: "food", weightKg: 1 }] });
  assert.strictEqual(r.success, true); assert.strictEqual(calls, 3);
  console.log("OK  retry : 2 x 503 puis succès (3 appels)");

  // 4. Mode non bloquant : retourne tout de suite, erreur finale via onError
  flaky.close();
  let reported;
  const nb = new EcoSDK({ apiKey: "k", baseUrl: "http://localhost:8098", maxRetries: 1, retryBaseMs: 10, onError: (e) => (reported = e) });
  const t1 = Date.now();
  nb.track({ orderId: "N1", items: [{ category: "food", weightKg: 1 }] });
  assert(Date.now() - t1 < 20, "track() ne doit pas bloquer");
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(reported.code, "NETWORK_ERROR");
  console.log("OK  track() non bloquant, erreur remontée via onError");

  // 5. Succès réel contre l'API
  const res = await ok.trackPurchase({ orderId: "E2E", items: [{ category: "electronics", weightKg: 1 }] });
  assert.strictEqual(res.carbonEmittedKg, 12.5);
  console.log("OK  appel réel : 1 kg d'électronique = 12.5 kg CO2");
})().catch((e) => { console.error("ECHEC", e); process.exit(1); });
