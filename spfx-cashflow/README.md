# Liora Cash Flow Analyzer — SPFx Web Part

Web Part SharePoint Framework pour l'analyse de trésorerie Liora.

## Prérequis

- **Node.js 18.x** (SPFx 1.18.2 ne supporte PAS Node 20+)
- npm 9+
- Un tenant SharePoint Online avec un catalogue d'applications

### Installer Node 18

```bash
# Avec nvm (recommandé)
nvm install 18
nvm use 18
node --version  # doit afficher v18.x.x
```

## Installation

```bash
cd spfx-cashflow
npm install
```

## Développement local

1. Modifiez `config/serve.json` — remplacez l'URL par votre site SharePoint :
   ```json
   "initialPage": "https://votre-tenant.sharepoint.com/sites/votre-site/_layouts/workbench.aspx"
   ```

2. Lancez le serveur de dev :
   ```bash
   gulp serve
   ```

3. Le workbench s'ouvre dans votre navigateur. Ajoutez le web part « Liora Cash Flow ».

## Build & Déploiement sur SharePoint

### 1. Compiler le package

```bash
gulp bundle --ship
gulp package-solution --ship
```

Le fichier `.sppkg` est généré dans `sharepoint/solution/liora-cashflow.sppkg`.

### 2. Déployer sur le catalogue d'applications

1. Allez dans **SharePoint Admin Center** → **Apps** → **App Catalog**
   - Si vous n'avez pas de catalogue, créez-en un : Admin Center → More features → Apps → App Catalog
2. Uploadez le fichier `liora-cashflow.sppkg`
3. Cochez **"Make this solution available to all sites in the organization"**
4. Cliquez **Deploy**

### 3. Ajouter le Web Part à une page

1. Allez sur n'importe quel site SharePoint
2. Créez ou modifiez une page
3. Cliquez **+** pour ajouter un web part
4. Cherchez **"Liora Cash Flow"** dans la catégorie "Liora"
5. Le web part s'affiche avec l'application complète

## Structure du projet

```
spfx-cashflow/
├── config/                    # Configuration SPFx
│   ├── config.json            # Bundles + externals (CDN scripts)
│   ├── package-solution.json  # Solution metadata
│   └── serve.json             # Dev server config
├── src/webparts/lioraCashFlow/
│   ├── LioraCashFlowWebPart.ts      # Web Part principal
│   ├── LioraCashFlowWebPart.manifest.json
│   ├── LioraCashFlowWebPart.module.scss  # Styles (importe cashflow-styles)
│   ├── CashFlowApp.js               # Logique applicative (modifié pour SPFx)
│   ├── template.ts                  # Template HTML
│   ├── cashflow-styles.scss         # CSS de l'application
│   ├── loc/                         # Localisation
│   └── assets/                      # Logo et images
├── package.json
├── tsconfig.json
└── gulpfile.js
```

## Modifications par rapport à la version standalone

- `app.js` → `CashFlowApp.js` : toutes les requêtes DOM (`document.getElementById`, `document.querySelector`, etc.) sont scopées au conteneur du web part via un paramètre `rootEl`
- Les librairies externes (Chart.js, PapaParse, XLSX) sont chargées via `SPComponentLoader` depuis CDN
- Les styles CSS sont encapsulés via le module SCSS de SPFx
- Le logo est packagé comme asset statique

## Notes importantes

- **Clé API** : Collez votre clé API Claude dans l'onglet Fichiers du web part (jamais dans le code source)
- **Données** : Stockées en IndexedDB du navigateur de l'utilisateur, comme la version standalone
- **Réseau** : Le web part charge Chart.js, PapaParse et XLSX depuis les CDN jsdelivr. Vérifiez que votre réseau d'entreprise autorise `cdn.jsdelivr.net`
