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
| `/api/v1/me` | Router-level JWT | Live (`GET /`, `GET /stats`, `PATCH /`) |
| `/api/v1/wallet` | Router-level JWT | Live (`GET /`, `POST /link`, `DELETE /link`) |
| `/api/v1/tasks` | Router-level JWT | Live (`GET /`, `POST /check-in`, `POST /:taskId/start`) — check-in awards streak points (no cap) |
| `/api/v1/frens` | Router-level JWT | Live (`GET /`) |
| `/api/v1/earn` | Router-level JWT | Live (`GET /actions`) |
| `/api/v1/claim` | Router-level JWT | Live (`GET /`, `POST /`) |

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

#### Claim / rewards

- `GET /api/v1/claim` — `{ canClaim, lastClaimAt, nextClaimAt, cooldownHours, pointsPerClaim }`
- `POST /api/v1/claim` — awards points when cooldown elapsed
  - **200** — `{ success: true, points, nextClaimAt, totalPoints }`
  - **429** — `{ success: false, code: "CLAIM_COOLDOWN", message, nextClaimAt }`
- Cooldown and points configurable via `CLAIM_COOLDOWN_HOURS` (default 8) and `CLAIM_POINTS` (default 10)
- Race-safe: conditional `findOneAndUpdate` on `WalletAccount.lastClaimAt`

#### Tasks / daily check-in

- `GET /api/v1/tasks` — catalog + `checkIn` summary including `nextCheckInPoints`
  - Only **active** tasks with a non-empty `externalUrl` are returned (empty social links stay hidden)
- `POST /api/v1/tasks/check-in` — idempotent daily check-in (UTC day)
  - New check-in: streak continues if yesterday, else resets to `1`
  - Awards **points = new streak** (no cap): day 8 → +8, miss a day → +1
  - **200** — `{ checkIn, alreadyCheckedIn, pointsAwarded, totalPoints }`
  - Repeat same day: `alreadyCheckedIn: true`, `pointsAwarded: 0`
- `POST /api/v1/tasks/:taskId/start` — honor-system follow
  - Completes the task on click and awards `rewardPoints` once (default **5** per social task)
  - Client opens `externalUrl` after success
  - **200** — `{ task, alreadyCompleted, pointsAwarded, totalPoints }`
- Social seeds: Telegram channel `https://t.me/lana_varse`, group `https://t.me/+Ld_0gZyNY-A0MmNk`, YouTube `https://www.youtube.com/@LanaVarse`, X `https://x.com/lanavarse`, Discord `https://discord.gg/9zpHdWA4E`

#### Me stats

- `GET /api/v1/me/stats` — `{ rank, score }` (score = `lanaPoints`)
- Rank is among **active users only** (wallets whose User still exists), sorted by `lanaPoints` desc then `userId` asc — same order as Frens leaderboard
- After deleting users manually, orphan wallets no longer inflate rank; optional cleanup: `node db/cleanupOrphanUserData.js`

#### Referral rewards

- On signup with a valid referral code: inviter gets `REFERRAL_SIGNUP_BONUS` points once (default **10**)
- When an invitee successfully claims: inviter gets `floor(claimPoints * REFERRAL_CLAIM_SHARE_PERCENT / 100)` (default **5%**)
- `GET /api/v1/frens` `invited[]` includes `score` (invitee total points) and `pointsEarned` (points you got from them)
