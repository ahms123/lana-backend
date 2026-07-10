#### Setup

```bash
npm install && npm start
```

#### Database Connection

1. Import connect.js
2. Invoke in start()
3. Setup .env in the root
4. Add MONGO_URI with correct value

#### Routers

- `routes/auth.js` — public auth (register, login, refresh, revoke, password reset); `logout` requires Bearer
- `routes/me.js`, `wallet.js`, `tasks.js`, `frens.js`, `earn.js`, `claim.js` — JWT required on all routes (`createProtectedRouter`)
- New user APIs: add routes under a protected router; do not mount without auth

| Mount | Auth | Status |
|-------|------|--------|
| `/api/v1/auth` | Per-route | Live (except logout = Bearer required) |
| `/api/v1/me` | Router-level JWT | Live |
| `/api/v1/wallet` | Router-level JWT | Live (`GET /`, `POST /link`, `DELETE /link`) |
| `/api/v1/tasks` | Router-level JWT | Live (`GET /`, `POST /check-in`, `POST /:taskId/start`) |
| `/api/v1/frens` | Router-level JWT | Live (`GET /`) |
| `/api/v1/earn` | Router-level JWT | Live (`GET /actions`) |
| `/api/v1/claim` | Router-level JWT | Stub `501` until feature tickets |

#### User Model

Email Validation Regex

```regex
/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
```

#### Register User

- Validate - name, email, password - with Mongoose
- Hash Password (with bcryptjs)
- Save User
- Generate Token
- Send Response with Token

#### Login User

- Validate - email, password - in controller
- If email or password is missing, throw BadRequestError
- Find User
- Compare Passwords
- If no user or password does not match, throw UnauthenticatedError
- If correct, generate Token
- Send Response with Token

#### Mongoose Errors

- Validation Errors
- Duplicate (Email)
- Cast Error

#### Security

- helmet
- cors
- xss-clean
- express-rate-limit

#### Health

- `GET /` — `{ "service": "lana-api", "status": "ok" }`

#### Error responses

All API errors use a standard JSON envelope:

```json
{
  "success": false,
  "message": "Human-readable summary",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Please provide a valid email" }]
}
```

- `errors` — optional per-field list (validation, duplicates)
- `code` — machine-readable (`DUPLICATE_EMAIL`, `VALIDATION_ERROR`, `UNAUTHORIZED`, etc.)
- Duplicate register: **409** with `DUPLICATE_EMAIL` or `DUPLICATE_NAME`
