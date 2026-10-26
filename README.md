# sites

Scaffolded with Vuetify CLI.

## ❗️ Documentation

- Primary docs: https://vuetifyjs.com/
- Getting started guide: https://vuetifyjs.com/en/getting-started/installation/
- Community support: https://community.vuetifyjs.com/
- Issue tracker: https://issues.vuetifyjs.com/

## 🧱 Stack

- Framework: Nuxt 4
- UI Library: Vuetify
- Language: TypeScript
- Package manager: yarn

## 🧭 Start Here

- Main entry: `app/app.vue`
- Main app component: `app/app.vue`
- Main styles: `app/assets/styles/`
- Plugin setup: `app/plugins/`

## 📁 Project Structure

- `app/pages/` — application routes
- `app/components/` — reusable Vue components
- `app/assets/` — styles and static assets used in app
- `app/plugins/` — Nuxt plugins
- `public/` — static public files

## ✨ Enabled Features

- Vuetify MCP
- Pinia
- Vue I18n
- Tailwind CSS

## 💿 Install

Use your selected package manager (yarn) to install dependencies:

```bash
yarn install
```

## 🚀 Quick Start

```bash
yarn install
yarn dev
```

### Firebase Web Push

Copy `.env.example` to `.env` and provide the public Firebase Web App config plus the Web Push VAPID public key. The production site must be served over HTTPS so the root-scope Service Worker can receive background messages.

Never place Firebase service-account credentials or `GOOGLE_APPLICATION_CREDENTIALS` in frontend environment variables.

## 🏗️ Build

```bash
yarn build
```

## 🧪 Available Scripts

- `yarn build`
- `yarn typecheck`
- `yarn dev`
- `yarn generate`
- `yarn preview`
- `yarn postinstall`
- `yarn mcp`
- `yarn mcp:revert`

## 💪 Support Vuetify Development

This project uses Vuetify - an MIT licensed Open Source project. We are glad to welcome contributors and any support for ongoing development:

- Contribute to Vuetify and ecosystem projects: https://github.com/vuetifyjs
- Request enterprise support: https://support.vuetifyjs.com/
- Sponsor on GitHub: https://github.com/sponsors/vuetifyjs
- Support on Open Collective: https://opencollective.com/vuetify
