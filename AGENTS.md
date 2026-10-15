# Powly game rules

- Call `Powly.init()` before importing React, an engine, or large assets. Powly stops a game that
  does not connect promptly. Keep the dynamic import in `src/main.tsx`.
- Keep `base: "./"` in `vite.config.ts`; uploaded builds are served from their own path.
- Treat all browser code and values as untrusted. Use client writes only for low-stakes saves,
  achievements, and leaderboards explicitly enabled for browser access in Studio.
- Never put a Powly secret key or another server credential in this repository or the game build.
- Use `profile.playerId`, not `username`, as the stable player identifier.
- Catch SDK and API failures so the game remains playable.
- Do not add a service worker or PWA plugin; Powly builds do not allow them.
- Run `npm run check` and `npm run build` before handing off changes.

