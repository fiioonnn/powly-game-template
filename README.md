# Powly game template

A clean React + TypeScript + Vite starting point for client-only games on Powly.

It connects to Powly before React loads and includes a simple starter screen with compact player,
save, achievement, and platform API information. Outside Powly it uses local preview data.

## Start

Requirements: Node.js 20.19+ and a game in Powly Studio.

```bash
npm install
npm run dev
```

Open your game in **Studio → Developer mode**, enter `http://localhost:5173`, and press **Open**.
Opening Vite directly shows the local preview; the real SDK only connects inside Powly.

## Optional Studio data

The information screen reads these example resources when they exist:

1. **Saves → New save**: `best-score`, Number.
2. **Achievements → New achievement**: `first-run`.

If you later enable browser writes, use them only for prototypes and low-stakes data. Players
control their browsers. Store trusted progress from a backend.

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
src/platform.ts           typed SDK and platform API reads
src/App.tsx               simple starter screen and platform information
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

