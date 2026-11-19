# CORS configuration

Owner: Rahul (@rahulgheek)

The API whitelists browser origins in one place: `server/src/core/cors.js`.
The list itself is environment-driven, so adding a deployed storefront URL never
requires a code change.

## Where the list lives

`server/.env` (never commit this file):

```env
CORS_ORIGINS=["http://localhost:5173"]
```

`server/.env.example` shows the same key with a commented deployed example.

Two formats are accepted:

```env
# JSON array
CORS_ORIGINS=["http://localhost:5173","https://thread-store.example.com"]

# comma-separated (easier when pasting one URL)
CORS_ORIGINS=http://localhost:5173,https://thread-store.example.com
```

Rules:

- Use the exact origin: scheme + host + port, no path, no trailing slash.
- `https://shop.example.com` and `https://www.shop.example.com` are different origins.
- In development, any `localhost` / `127.0.0.1` port is also accepted.
- `*` is honoured only outside production, because auth uses an httpOnly cookie.

## Add the deployed URL

1. Open `server/.env`.
2. Append the storefront origin to `CORS_ORIGINS` (comma-separated is fine).
3. Restart the API. `node --watch` restarts on save; a plain `node` process needs a manual restart.
4. Check the boot log line: `CORS origins: [...]` should include the new URL.
5. Reload the storefront and confirm requests no longer fail with `CORS_REJECTED`.

## Verify

Allowed origin (expect `204` and `access-control-allow-origin` echoing the origin):

```bash
curl -i -X OPTIONS http://localhost:5000/api/products \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
```

Rejected origin (expect `403` with `CORS_REJECTED`):

```bash
curl -i -X OPTIONS http://localhost:5000/api/products \
  -H "Origin: https://not-allowed.example.com" \
  -H "Access-Control-Request-Method: GET"
```

## What the middleware allows

- Credentials: on, so the refresh cookie works on `/api/auth/*`.
- Methods: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Request headers: `Accept`, `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Requested-With`.
- Exposed headers: `RateLimit`, `RateLimit-Policy`, `Retry-After`.
- Preflight cache: 10 minutes.
- Requests without an `Origin` header (curl, server-to-server, same-origin) are allowed.
