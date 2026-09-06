# KOREXIA-MD — Bot-Hosting V4

This build is tuned for a small Pterodactyl container (around 256 MiB RAM).

## Changes
- Removed unused direct dependencies: `@hapi/boom`, `libphonenumber-js`.
- Removed development dependencies so `npm install` does not install ESLint/Vitest/Nodemon.
- Added `pino` as an explicit runtime dependency because `index.js` imports it directly.
- Added `.npmrc` with `omit=dev`, no audit/fund, one npm socket, and reduced retry/progress overhead.
- Reduced the optional `start:optimized` Node heap limit from 512 MiB to 128 MiB.
- Kept the existing Baileys/libsignal, pairing API, dynamic port, CORS and Vercel proxy fixes.

## Recommended startup command
`npm start`

Do not use `start:optimized` on a 256 MiB server unless needed.
