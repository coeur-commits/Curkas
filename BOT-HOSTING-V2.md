# Bot-Hosting / Vercel configuration

## Bot-Hosting
The HTTP server binds to `0.0.0.0` and selects the port in this order:
1. `SERVER_PORT` (Pterodactyl/Bot-Hosting)
2. `PTERODACTYL_SERVER_PORT`
3. `ALLOCATED_PORT`
4. `PORT`
5. `config.port` / 5000 fallback

The API endpoints are:
- `POST /api/pair` with JSON `{ "number": "243..." }`
- `GET /api/pair/status/:number`
- `GET /health`
- `GET /pair?number=243...` (legacy compatibility)

## Vercel
The backend accepts HTTPS Vercel origins (`*.vercel.app`) by default. For a stricter setup, set `CORS_ORIGINS` to a comma-separated list of exact origins.

The Vercel frontend should call the backend API, not `/pair` on the Vercel domain. The browser also requires the backend to be reachable over HTTPS when the Vercel page is served over HTTPS; otherwise use an HTTPS reverse proxy/serverless proxy in front of Bot-Hosting.
