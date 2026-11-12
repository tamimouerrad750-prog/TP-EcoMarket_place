# Réponses — TP EcoSDK / EcoMarketplace

## Partie 1 — Modélisation économique & stratégie

### 1. Cartographie de la plateforme

```
        Données d'émissions CO2 produits            Mesure d'empreinte, avis,
        (via le SDK, gratuitement)                  comparaison de produits
 ┌────────────────────────┐                    ┌──────────────────────────┐
 │  Versant 2 : Marchands │ ─────────────────▶ │                          │
 │  (e-commerce, devs)    │                    │      ECOMARKETPLACE      │
 │                        │ ◀───────────────── │   API + EcoSDK + analytics│
 └────────────────────────┘  Statistiques,     │                          │
                             label "éco",       │                          │ ◀──── Consommateurs
                             trafic qualifié    └──────────────────────────┘       (suivi CO2)
                                                           │
                                       Audience, achats, attention des consommateurs
                                                  ──▶ vers les marchands
```

Flux de valeur :

- **Marchands → plateforme → consommateurs** : les données produits/achats alimentent la mesure d'empreinte carbone.
- **Consommateurs → plateforme → marchands** : audience sensible à l'écologie, trafic, et pour le marchand des statistiques (`/v1/analytics/merchant`) et une image de marque responsable.
- **Plateforme** : fournit l'infrastructure (API, SDK, calcul des facteurs d'émission) et capte la valeur (données agrégées, éventuelle commission ou abonnement premium).

**Effet de réseau direct (même versant)** : plus il y a de consommateurs, plus les avis, comparaisons et notations des produits sont pertinents et fiables. Côté marchands, un effet existe aussi : plus un standard de reporting carbone est adopté, plus il devient la norme sectorielle, ce qui pousse les retardataires à s'y conformer.

**Effet de réseau indirect (inter-versants)** :

- Plus de marchands connectés → plus de produits couverts → l'application est plus utile pour le consommateur → plus de consommateurs.
- Plus de consommateurs → plus d'audience et de ventes attribuables à la démarche éco → les marchands ont davantage intérêt à s'intégrer.

C'est une boucle de rétroaction positive, qui doit être amorcée.

### 2. Rôle du SDK : une subvention vers le versant développeurs

Le problème de la poule et de l'œuf : les consommateurs ne viennent pas sans marchands, et les marchands n'investissent pas sans consommateurs. La plateforme doit donc **subventionner un versant**, en général celui dont l'entrée est la plus coûteuse et qui apporte l'offre, ici les marchands.

Le SDK joue ce rôle de subvention, mais en **temps d'ingénieur** plutôt qu'en argent :

- **Gratuité** : pas de licence ni d'abonnement. Le coût monétaire d'entrée est nul.
- **Simplicité** : 3 lignes au lieu de ~40 (auth, sérialisation, gestion d'erreurs, retry). Le coût d'intégration, en jours-développeur, tombe à quelques minutes.
- **Risque réduit** : le SDK gère les pannes et ne bloque pas le tunnel de paiement. Le marchand ne risque rien à essayer.

Le coût d'entrée d'un marchand devient quasi nul. La plateforme absorbe ce coût (développement et maintenance du SDK) et se rémunère de l'autre côté ou plus tard, via la valeur créée par la masse critique de marchands. C'est exactement la logique de Stripe ou des SDK mobiles.

---

## Partie 3 — Mesure de la friction & analyse critique

### 1. Developer Experience & boucle de rétroaction

**Influence de 40 → 3 lignes sur le TTFC.** Le TTFC (Time-To-First-Call) est le temps entre la découverte de la documentation et le premier appel réussi. Sans SDK, le développeur doit : lire la doc, comprendre le schéma d'auth, construire les headers, sérialiser le JSON, traiter les codes HTTP (fetch ne rejette pas sur un 401 ou 500), écrire un retry et un timeout. Chaque étape est une source d'erreur et d'abandon. Avec le SDK, il installe, initialise, appelle : le TTFC passe de plusieurs heures ou jours à quelques minutes. Les bonnes pratiques (auth, erreurs, retry) sont intégrées par défaut, donc le premier appel est aussi plus souvent correct.

**Impact sur la croissance du versant marchands.** Chaque marchand potentiel compare le coût d'intégration (temps d'ingénieur, risque) à un bénéfice incertain. Un TTFC faible baisse ce coût, donc :

1. davantage de marchands passent de « curieux » à « intégré » (meilleur taux de conversion de l'entonnoir d'adoption) ;
2. l'adoption est plus rapide, ce qui raccourcit le délai pour atteindre la masse critique ;
3. cela déclenche la boucle indirecte : plus de marchands → plus de valeur pour les consommateurs → plus de consommateurs → plus d'intérêt pour les marchands.

La chaîne causale est : **SDK simple → TTFC bas → adoption massive des marchands → effets de réseau indirects activés**.

### 2. Gouvernance & lock-in

**Protection contre les breaking changes (API v2).** Le SDK est une couche d'abstraction entre le code du marchand et le protocole HTTP :

- Le marchand ne dépend que de l'interface publique `trackPurchase({orderId, items})`, pas des URL, formats ou noms de champs de l'API.
- La version d'API est figée dans le SDK (`/v1/...`) : la v2 de l'algorithme n'affecte pas les installations existantes. Les deux versions coexistent côté serveur.
- Le SDK peut traduire (adapter) l'ancien format vers le nouveau, et la plateforme publie une nouvelle version majeure du SDK pour les changements réellement incompatibles, avec dépréciation annoncée et période de transition.
- Le header `X-EcoSDK-Version` permet à la plateforme de savoir qui utilise quoi et de planifier l'arrêt de la v1.

Limite : cela vaut tant que l'interface publique du SDK reste stable. Un changement de l'algorithme change aussi les valeurs retournées, ce qui est visible pour le marchand même si le code ne casse pas.

**Risque de lock-in pour l'e-commerçant :**

- *Dépendance technique* : le SDK est inséré dans le tunnel de commande. Migrer vers un concurrent oblige à réécrire ces appels.
- *Dépendance aux données* : l'historique d'émissions et les statistiques vivent chez la plateforme, qui en détient la méthodologie de calcul. Le marchand ne peut pas la vérifier (boîte noire) ni la reproduire.
- *Dépendance de gouvernance* : la plateforme contrôle les prix futurs, les conditions et le calendrier de dépréciation. Une fois la masse critique atteinte, elle a un pouvoir de négociation fort (subvention au départ, puis monétisation).
- *Dépendance réputationnelle* : si le marchand communique sur un label « EcoMarketplace », en sortir a un coût d'image.

Atténuations : méthodologie de calcul publique et documentée, export des données, SDK open source, spécification d'API ouverte (OpenAPI) permettant à un tiers de réécrire le client, et standards communs (ex. GHG Protocol) pour éviter qu'un seul acteur impose sa mesure.

On retrouve ici la tension de la gouvernance de plateforme : le SDK qui crée l'adoption est aussi ce qui crée la dépendance.
