# Powly game template

A clean React + TypeScript + Vite starting point for client-only games on Powly.

It connects to Powly before React loads, displays player and launch information, reads the
platform API, and includes a small score game that demonstrates browser-enabled saves,
leaderboards, and achievements. Outside Powly it runs with local preview data.

## Start

Requirements: Node.js 20.19+ and a game in Powly Studio.

```bash
npm install
npm run dev
```

Open your game in **Studio → Developer mode**, enter `http://localhost:5173`, and press **Open**.
Opening Vite directly shows the local preview; the real SDK only connects inside Powly.

## Configure the demo in Studio

The template keeps working without these resources, but creating them enables persistence:

1. **Saves → New save**: `best-score`, Number, browser writes allowed.
2. **Leaderboards → New leaderboard**: `high-score`, descending, browser submissions allowed.
3. **Achievements → New achievement**: `first-run`, browser unlocks allowed.

Browser writes are appropriate for prototypes and low-stakes data only. Players control their
browsers. Submit competitive scores and trusted progress from a backend.

## Build and upload

```bash
npm run check
npm run build
cd dist && zip -r ../powly-game.zip .
```

Upload `powly-game.zip` under **Configuration → Builds**. `index.html` must be at the root of the
zip. Test the build before making it live.

## Project structure

```text
src/main.tsx              connects to Powly first, then loads React
src/platform.ts           typed SDK/API reads and client-write examples
src/App.tsx               starter game and platform information UI
src/powly/                bundled Powly SDK and TypeScript declarations
scripts/update-sdk.mjs    refreshes the checked-in SDK from Powly
```

Update the SDK with:

```bash
npm run sdk:update
```

Set `POWLY_ORIGIN` when developing against another Powly installation:

```bash
POWLY_ORIGIN=http://localhost:3000 npm run sdk:update
```

Never add a Powly secret key to a client-only game. The SDK's short-lived session token is handled
for you; `powly.api()` attaches it to browser-safe platform API calls.

## Scripts

- `npm run dev` — Vite development server on port 5173
- `npm run check` — Biome and TypeScript checks
- `npm run build` — production build in `dist/`
- `npm run preview` — preview the production build locally
- `npm run sdk:update` — download the latest Powly SDK files

## License

MIT

