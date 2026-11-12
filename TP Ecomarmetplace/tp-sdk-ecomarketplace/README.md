# TP — Concevoir le SDK d'une plateforme multi-faces (EcoMarketplace)

Master 1 Informatique : Digital Ecosystems and Innovation.
Les réponses aux parties 1 et 3 sont dans [REPONSES.md](REPONSES.md).

## Structure

```
tp-sdk-ecomarketplace/
├── README.md
├── REPONSES.md            # Parties 1 et 3 (économie, DX, gouvernance)
├── backend/               # API de la plateforme (FastAPI)
│   ├── main.py
│   └── requirements.txt
└── client-demo/           # Site marchand simulé + EcoSDK
    ├── ecosdk.js          # Le SDK (sans dépendance, Node >= 18 ou navigateur)
    ├── app.js             # Démo sans SDK vs avec SDK
    └── test-sdk.js        # Tests : 401, retry, validation, mode non bloquant
```

## Démarrage rapide

```bash
# Terminal 1 : backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # Swagger : http://localhost:8000/docs

# Terminal 2 : client
cd client-demo
node app.js        # démo
node test-sdk.js   # tests du SDK
```

## Utilisation du SDK (3 lignes)

```js
const { EcoSDK } = require("./ecosdk");
const eco = new EcoSDK({ apiKey: "mch_live_99x821a" });
await eco.trackPurchase({ orderId: "ORD-12345", items: [{ category: "electronics", weightKg: 1.2 }] });
```

Autres méthodes : `eco.track(payload)` (non bloquant, erreurs via `onError`), `eco.getAnalytics()`,
`eco.trackCarbon(payload)` (alias de l'énoncé).

## Ce que fait le SDK à la place du développeur

| Besoin | Implémentation |
|---|---|
| Authentification | Header `X-API-Key` injecté automatiquement |
| Retry | Backoff exponentiel + jitter sur réseau / timeout / 5xx / 429 ; jamais sur 4xx |
| Ne pas bloquer le site | Timeout par tentative (5 s) + `track()` en arrière-plan |
| Erreurs lisibles | `EcoSDKError` avec `code` (`AUTH_ERROR`, `VALIDATION_ERROR`, `RATE_LIMITED`, `SERVER_ERROR`, `NETWORK_ERROR`, `TIMEOUT`) |
| Standardisation | Validation locale du payload avant tout appel réseau |
| Stabilité | Version d'API figée (`v1`) + header `X-EcoSDK-Version` |

## Limites connues (volontairement hors périmètre du TP)

- Retry sans idempotence : si la réponse est perdue après enregistrement, un retry peut dupliquer l'achat. En production, l'API devrait dédupliquer sur `orderId` ou accepter un header `Idempotency-Key`.
- Base en mémoire, clés API en dur, pas de limitation de débit.
- Une clé API « live » utilisée dans un navigateur serait publique : en front, passer par le serveur du marchand.
