# 🔒 RetourenApp Security Hardening Plan

**Status:** In Progress  
**Last Updated:** 2026-07-01  
**Branch:** `claude/app-security-analysis-bztf1o`

---

## 📊 Executive Summary

**Critical Issues Found:** 7  
**High Priority Issues:** 6  
**Total Estimated Effort:** 3-4 weeks  
**Current Progress:** All CRITICAL (7/7) and HIGH (4/4, see `SECURITY_CHECKLIST.md`
for the exact breakdown) items resolved as of 2026-07-13. Several resolved via
architecture/documented decisions rather than new packages — see items 9
(CSRF) and 13 (CORS) below. Remaining: MEDIUM items (dependency scanning,
secrets rotation, security testing, docs).

---

## 🎯 Priority 1: CRITICAL - Must Fix This Week

### ✅ COMPLETED
- [x] **Security Issue #1:** Protect `/api/debug` endpoint with authentication
- [x] **Security Issue #2:** Protect `/api/search` endpoint with authentication
- [x] **Security Issue #3:** Require + validate strength of `JWT_SECRET` in production
- [x] **Security Issue #5:** Remove verbose error messages
- [x] **Security Issue #7:** Clean up `.env.example` GCP credentials handling
- [x] **Security Issue #4 (Input Validation):** Zod schemas cover search, submit,
      versand, auth/session, search-products
- [x] **Security Issue #6 (Security Headers):** CSP, X-Frame-Options, nosniff,
      HSTS (prod), X-XSS-Protection, Referrer-Policy added in `next.config.ts`
- [x] **No-Auth Route Check:** `/api/order/[id]` was dead code (unused, no auth
      check) — deleted rather than fixed, since the actual order page fetches
      via a Server Component (`getOrder()` directly), never through this API
      route. `/api/search-products` was live but missing auth — fixed.
- [x] **Security Issue #8 (CSRF):** Analyzed and resolved via existing
      architecture, no token system built — see item 9 below for reasoning.

### ⏳ IN PROGRESS / TO DO

#### 1. **Weak JWT Secret** (15 min) — ✅ DONE (2026-07-13)
- [x] Make `JWT_SECRET` environment variable REQUIRED (throws in production if unset)
- [x] Throw error in production if not set
- [x] Also throw in production if set but shorter than 32 chars (was previously
      accepted — "weak" secret, not just "missing" secret)
- [ ] Document in README.md (not done in this pass)
- [ ] Generate strong default for dev — dev fallback stays a static warned string,
      not auto-generated; acceptable since it only applies outside production
- **Files updated:** `src/lib/session.ts`
- **Blocking:** No other security features work without this

```bash
# After implementation, verify:
JWT_SECRET=dev-only-key npm run dev
# Should work

# In production without JWT_SECRET:
# Should fail with clear error message
```

---

#### 2. **Implement Input Validation (Zod)** — ✅ DONE
**Package:** `zod@^4.4.3` (already in `package.json`)

**Step 1:** Install & Setup
- [x] `zod` installed
- [x] `src/lib/schemas.ts` with all validation schemas
- [x] Schemas defined: `SearchQuerySchema`, `SessionCreateSchema`,
      `ReturnCaptureSchema`, `VersandSchema`, `OrderDetailQuerySchema`,
      `ProductSearchQuerySchema` (added 2026-07-13), `DeviceCodeSchema`
      (added 2026-07-13 for the device-gate login)

**Step 2:** Integrate into APIs
- [x] `/api/search/route.ts`
- [x] `/api/auth/session/route.ts`
- [x] `/api/submit/route.ts`
- [x] `/api/versand/route.ts`
- [x] `/api/search-products/route.ts` (added 2026-07-13, was previously unvalidated + unauthenticated)
- `/api/order/[id]/route.ts` — n/a, route deleted (dead code, see item 6 below)

**Files updated:**
- `src/lib/schemas.ts`
- `src/app/api/search/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/submit/route.ts`
- `src/app/api/versand/route.ts`
- `src/app/api/search-products/route.ts`

---

#### 3. **Add Security Headers to Next.js Config** — ✅ DONE (2026-07-13)
**No new packages needed**

- [x] Update `next.config.ts` with `headers()` function
- [x] Add CSP (Content-Security-Policy) — `style-src 'unsafe-inline'` needed
      because the app uses React inline styles throughout; `script-src`
      relaxes to `unsafe-eval`/`unsafe-inline` only in dev (Fast Refresh)
- [x] Add X-Frame-Options: DENY
- [x] Add X-Content-Type-Options: nosniff
- [x] Add Strict-Transport-Security (HSTS) — production only (sent over
      plain HTTP it's a no-op per spec, but scoped anyway to avoid any
      confusion during local dev)
- [x] Add X-XSS-Protection — set to `0` (disabled), not `1; mode=block`;
      the legacy XSS-auditor mode had its own exploitable bugs and is
      removed in modern browsers, OWASP now recommends disabling it and
      relying on CSP instead
- [x] Add Referrer-Policy (`strict-origin-when-cross-origin`)

**Verification (once a Node environment is available to run `npm run dev`/`next start`):**
```bash
curl -I http://localhost:3000/
# Should show Content-Security-Policy, X-Frame-Options, etc.
```

---

#### 4. **Fix GCP Credentials Handling** — ✅ mostly DONE (2026-07-13)
**Estimated Time:** 30 min  
**Security Risk:** CRITICAL - Credentials in Environment Variables

- [x] Update `.env.example`: `GOOGLE_APPLICATION_CREDENTIALS` documented as the
      recommended default; `GCP_SERVICE_ACCOUNT_JSON` kept only as a clearly
      marked, commented-out fallback for filesystem-less deploys (e.g. Vercel),
      with explicit warnings against committing/sharing real keys and a
      rotation reminder — not removed outright, since some deploy targets
      genuinely need it
- [x] Document: `GOOGLE_APPLICATION_CREDENTIALS` (file path / ADC) as primary option
- [x] OR: Use Application Default Credentials (ADC) — documented
- [ ] Add warning comment in code (`src/lib/bigquery.ts` not touched in this pass)
- [ ] Document in README.md (not done in this pass)

**Files updated:**
- `.env.example`

---

#### 5. **Fix Asana Token Management**
**Estimated Time:** 15 min

- [ ] Update `.env.example`: Note that this is sensitive
- [ ] Add `.env.local` to `.gitignore` (verify it's there)
- [ ] Document: Use GitHub Secrets for production
- [ ] Add rotation policy comment: "Rotate every 90 days"

**Files to update:**
- `.env.example`
- `.gitignore` (verify)
- `README.md` (add deployment section)

---

#### 6. **Implement No-Auth Route Check** — ✅ DONE (2026-07-13)

- [x] Device-gate middleware (`src/proxy.ts`) now blocks every route
      (pages + API) by default unless a valid device cookie is present —
      a structural backstop, not just per-route checks
- [x] Document which routes have operator-session auth:
  - `/api/submit` ✅ Protected
  - `/api/versand` ✅ Protected
  - `/api/search` ✅ Protected
  - `/api/debug` ✅ Protected (plus now behind the device-gate too)
  - `/api/search-products` ✅ Protected (was open — fixed 2026-07-13, client
    fetch in `ArticleRow.tsx` updated to send the session token)
  - `/api/order/[id]` — **deleted** (2026-07-13): unused dead code, no
    component ever called it (the real order page fetches server-side via
    `getOrder()` directly); an unauthenticated endpoint returning customer
    PII that nothing used was a pure liability, so removed instead of fixed
- [ ] Review all new routes before deployment (ongoing process, not a one-time task)

---

#### 7. **Mandatory JWT_SECRET in Production**
**Estimated Time:** 15 min

```typescript
// src/lib/session.ts
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'FATAL: JWT_SECRET environment variable not set. ' +
    'This is required for production. Set a 32+ character random string.'
  )
}

const secret = new TextEncoder().encode(JWT_SECRET || 'dev-only-insecure-key')
```

---

## 🎯 Priority 2: HIGH - Implement in Week 2

### 8. **Implement Rate Limiting** — ✅ DONE (2026-07-13), in-memory instead of Upstash

**Chosen approach:** Neither Vercel's built-in config nor Upstash Redis — a
small in-memory fixed-window limiter (`src/lib/rate-limit.ts`), applied
centrally in `src/proxy.ts` for every `/api/*` request instead of
per-route code. Reasoning: this app is moving to a single self-hosted Node
process ([`SELFHOSTING_PLAN.md`](SELFHOSTING_PLAN.md)), where in-memory state
is fully reliable — paying for/operating Upstash Redis for that end state
would be unnecessary complexity. **Caveat while still on Vercel:**
serverless function instances don't share this in-memory state with each
other, so it's best-effort there, not a hard guarantee.

- [x] Create rate limiters (in-memory, per path prefix, keyed by IP):
  - `/api/auth/device`: 10 req / **15 min** — stricter, guards the shared
    device-access code against brute-forcing (this endpoint didn't exist
    when this plan was first written)
  - `/api/auth/session`: 20 req/min
  - `/api/search`, `/api/search-products`: 60 req/min
  - `/api/submit`, `/api/versand`, `/api/attach-photo`: 20 req/min
  - any other `/api/*`: 60 req/min default fallback (so a future endpoint
    is never accidentally unlimited)

**Actual limits implemented:**
```
Device unlock:  10 requests / 15 minutes / IP
Auth (login):   20 requests / minute / IP
Search:         60 requests / minute / IP
Submit/Versand: 20 requests / minute / IP
Everything else: 60 requests / minute / IP (default)
```
Keyed by IP rather than per-operator — simpler, and given this runs on a
handful of shared tablets, one IP already corresponds to one device.

---

### 9. **Implement CSRF Protection** — ✅ RESOLVED (2026-07-13), no token system built

**Analysis:** A CSRF token (synchronizer/double-submit pattern) protects against
an attacker's page silently riding on a victim's *cookie-based* auth. This app
doesn't use cookie-based auth for state-changing operator actions:

- [x] Verify cookies have `SameSite=Strict` — true for the device-gate cookie
      (`src/lib/device-auth.ts`)
- [x] Operator session token lives in `localStorage`, attached manually via
      `Authorization: Bearer` header (`src/lib/api-client.ts`) for every call
      to `/api/submit`, `/api/versand`, `/api/attach-photo`, `/api/search`,
      `/api/search-products`. A cross-site attacker page can't read another
      origin's `localStorage` and can't attach a custom `Authorization` header
      via a plain HTML form (the classic CSRF delivery mechanism) — this
      closes the CSRF vector these endpoints would otherwise have.
- [x] Cleaned up two unused, never-wired-up cookie helpers
      (`getSessionCookieHeader`/`getClearSessionCookieHeader` in
      `src/lib/session.ts`) left over from an earlier design — they could
      have misled a future reader into believing session auth was
      cookie-based (which would have reopened this exact vector).
- **Not done:** a `csrf` package / token system — would add complexity
  without closing a gap that doesn't currently exist.
- **Re-evaluate if:** operator-session auth ever moves to a cookie instead of
  `localStorage` + Bearer header — that would reintroduce the classic CSRF
  vector and require an actual token system at that point.

---

### 10. **Implement Audit Logging** — ✅ DONE (2026-07-13), no Pino

**Chosen approach:** `src/lib/audit-log.ts` — one structured JSON line per
event via `console.log`/`console.warn`, no logging package. Reasoning: Pino
needs Node APIs unavailable in the Edge runtime that `src/proxy.ts`
runs on, which would have forced two different logging mechanisms (Pino in
Node route handlers, something else in Edge middleware) for no real benefit
at this app's scale. Both Vercel today and Coolify/Docker later already
capture stdout/stderr as logs with their own retention — that's the right
place to configure **90-day retention**, not application code.

**Audit Events logged:**
- [x] User login (`/api/auth/session` — success + failure)
- [x] Device unlock (`/api/auth/device` — success + failure, the shared
      device-access code login)
- [x] Retoure submission (`/api/submit` — operator, orderId, mode, taskId)
- [x] Versand submission (`/api/versand` — operator, trackingNumber, mode, taskId)
- [x] Search queries (`/api/search` — **result count only**, not the raw
      query text, since it can itself be a customer's name)
- [x] Failed authentication attempts (login/device-unlock failures, plus
      rate-limit rejections and device-gate rejections logged in
      `src/proxy.ts`)
- [ ] User logout — not logged (stateless JWT, logout has no server-side
      effect to audit beyond the client clearing its own token)

**Actual log line shape** (via `auditLog()` in `src/lib/audit-log.ts`):
```typescript
{
  timestamp: string   // ISO
  event: string        // 'login' | 'device_unlock' | 'submit' | 'versand' | 'search' | 'rate_limit' | 'device_gate'
  status: 'success' | 'failure'
  operator?: string
  ip?: string
  ...eventSpecificFields
}
```

**Retention:** 90 days minimum — configure at the hosting/log-platform level
(Vercel project settings now, Docker log rotation / log-shipping once
self-hosted), not enforceable from this repo.

---

### 11. **Setup Error Handling & Logging** — ✅ DONE (see CRITICAL #5/#7 above)
- [x] Return generic error messages to client
- [x] Log detailed errors to server logs (existing `console.error` calls)
- [x] Don't expose stack traces in responses
- [ ] Centralized error handler — not built; each route still has its own
      try/catch. Would be a nice-to-have refactor, not a security gap.
- [ ] Error tracking (Sentry) — optional, not done

---

### 12. **Implement HTTPS Enforcement** — ✅ DONE (2026-07-13)

- [x] Add redirect middleware: HTTP → HTTPS — added in `src/proxy.ts`,
      production-only, based on `x-forwarded-proto`. This is a backstop:
      Vercel and the planned Coolify/Traefik setup already redirect at the
      proxy level before a request even reaches this app.
- [x] `Strict-Transport-Security` header — added in `next.config.ts` (see
      CRITICAL #5 above), production only
- [ ] Verify in production

---

## 🎯 Priority 3: MEDIUM - Nice to Have

### 13. **CORS Configuration** — ✅ Resolved via absence (2026-07-13), no headers added

**Analysis:** Without any `Access-Control-Allow-Origin` response header,
browsers already default to same-origin-only — no other website can read
this API's responses. There is no legitimate cross-origin caller today (no
other app needs to call the RetourenApp API directly). Adding CORS headers
now would only *loosen* this default without solving a real requirement —
so nothing was added.

- [x] Define allowed origins whitelist — **none needed today**
- Not done: `Access-Control-Allow-Origin` — intentionally, per above
- Not done: `Access-Control-Allow-Credentials` — intentionally, per above
- **Re-evaluate if:** a real cross-origin caller appears — e.g. a future
  Messe-App integration that needs to call this API directly from a
  different subdomain

---

### 14. **Dependency Vulnerability Scanning**
**Estimated Time:** 1 hour (setup) + ongoing
- [ ] Run `npm audit`
- [ ] Setup GitHub Dependabot
- [ ] Enable automated security updates
- [ ] Create process for reviewing/merging security patches

---

### 15. **Secrets Rotation Policy**
**Estimated Time:** 2 hours (setup)
- [ ] JWT_SECRET: Rotate every 30 days
- [ ] ASANA_TOKEN: Rotate every 90 days
- [ ] GCP Keys: Rotate every 90 days
- [ ] Document in operations manual

---

## 📋 Security Packages Implementation Matrix

| Priority | Package | Purpose | Effort | Impact | Status |
|----------|---------|---------|--------|--------|--------|
| **CRITICAL** | Zod | Input Validation | 3-4h | 🔴 Critical | ✅ Done |
| **CRITICAL** | next/config | Security Headers | 1h | 🔴 Critical | ✅ Done |
| **CRITICAL** | - | JWT_SECRET Required | 15m | 🔴 Critical | ✅ Done |
| **HIGH** | ~~@upstash/ratelimit~~ | Rate Limiting | - | 🔴 Critical | ✅ Done — in-memory (`src/lib/rate-limit.ts`), no Redis needed |
| **HIGH** | ~~csrf~~ | CSRF Protection | - | 🟠 High | ✅ Resolved via architecture, no package needed |
| **HIGH** | ~~pino~~ | Audit Logging | - | 🟠 High | ✅ Done — structured console logging (`src/lib/audit-log.ts`), no package needed |
| **HIGH** | ~~cors headers~~ | CORS | - | 🟠 High | ✅ Resolved via absence, no headers needed |
| **MEDIUM** | sentry | Error Tracking | 1-2h | 🟡 Medium | ⏳ OPTIONAL |
| **MEDIUM** | - | Dependabot | 1h | 🟡 Medium | ⏳ TODO |

---

## ✅ Detailed Checklist - CRITICAL ISSUES

### CRITICAL #1: Debug Endpoint Unprotected
- [x] Add authentication check
- [x] Remove error stack traces
- [x] Test: Requires valid session token
- [x] Commit & Push

### CRITICAL #2: Search Endpoint Unprotected
- [x] Add authentication check
- [x] Remove detailed error messages
- [x] Test: Requires valid session token
- [x] Commit & Push

### CRITICAL #3: Weak JWT Secret — ✅ DONE
- [x] Make JWT_SECRET required in production
- [x] Also reject a JWT_SECRET shorter than 32 chars in production (not just missing)
- [ ] Generate strong dev default (dev fallback stays a static warned string)
- [x] Update `.env.example`
- [ ] Test: Production fails without JWT_SECRET (not runnable in this
      environment — no Node.js available; please verify manually)
- **Est. Time:** 15 min

### CRITICAL #4: No CSRF Protection — ✅ RESOLVED, no token built
- [x] Analyzed: operator auth uses `localStorage` + `Authorization: Bearer`
      header, not cookies — classic CSRF (which rides on auto-sent cookies)
      doesn't apply. Device-gate cookie already uses `SameSite=Strict`.
- [x] Removed two unused cookie helpers that could have misled a future
      reader into thinking session auth was cookie-based
- Not done: CSRF token package — would add complexity without closing a
  real gap (see item 9 in the section above for full reasoning)
- **Blocking:** None

### CRITICAL #5: No Security Headers — ✅ DONE
- [x] Update `next.config.ts`
- [x] Add CSP, X-Frame-Options, HSTS (+ nosniff, Referrer-Policy, X-XSS-Protection)
- [ ] Test with `curl -I` / verify in browser DevTools (not runnable in this
      environment — no Node.js available; please verify manually)
- **Blocking:** None

### CRITICAL #6: Input Validation Missing — ✅ DONE
- [x] Install Zod
- [x] Create schema file (`src/lib/schemas.ts`)
- [x] Add validation to all routes that accept user input, including
      `/api/search-products` (was missing both validation and auth)
- [ ] Test with invalid inputs (not runnable in this environment — no
      Node.js available; please verify manually)
- **Blocking:** Security critical

### CRITICAL #7: Credentials in Env Vars — ✅ DONE
- [x] Update `.env.example`
- [x] Document best practices (GOOGLE_APPLICATION_CREDENTIALS as recommended
      default, GCP_SERVICE_ACCOUNT_JSON as clearly-marked fallback)
- [ ] Add code comments in `src/lib/bigquery.ts` (not done in this pass)

---

## 🔄 Weekly Implementation Schedule

### **Week 1 (This Week)**
- Day 1-2: JWT_SECRET + Input Validation (Zod)
- Day 3-4: Security Headers + CSRF Token
- Day 5: Fix Credentials Handling + Testing

**Commits:** 4-5  
**PRs:** 1-2  
**Testing:** Manual + Automated

### **Week 2**
- Day 1-2: Rate Limiting
- Day 3-4: Audit Logging (Pino)
- Day 5: Error Handling + Testing

### **Week 3**
- Dependabot setup
- HTTPS enforcement
- CORS configuration

### **Week 4+**
- Secrets rotation policy
- Security testing
- Documentation

---

## 🚀 Development Commands

```bash
# Create security fix branch
git checkout -b security/critical-fixes

# Test security headers
curl -I http://localhost:3000/api/search

# Test authentication
curl -X GET http://localhost:3000/api/search
# Should return 401 Unauthorized

curl -X GET http://localhost:3000/api/search \
  -H "Authorization: Bearer INVALID_TOKEN"
# Should return 401 Unauthorized

# Test input validation (after Zod)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"q": "' + 'A'.repeat(200) + '"}'
# Should return 400 Bad Request

# Audit npm packages
npm audit
npm audit --production
```

---

## 📞 Dependencies & Blockers

- **GitHub Secrets:** For storing sensitive env vars in CI/CD
- **Upstash Redis:** For rate limiting (optional, free tier available)
- **Vercel Deployment:** For testing in production-like environment

---

## 📚 Related Files

- `/home/user/RetourenApp/SECURITY_PLAN.md` ← You are here
- `src/lib/session.ts` - JWT implementation
- `src/lib/schemas.ts` - Input validation (to create)
- `next.config.ts` - Security headers (to update)
- `.env.example` - Environment variables
- `README.md` - Documentation

---

## 📝 Notes

- All critical issues should be completed by end of Week 1
- High priority issues complete by end of Week 2
- Each commit should be pushed to `claude/app-security-analysis-bztf1o`
- Final PR to `staging` will consolidate all changes
- Move tasks from "TODO" → "IN PROGRESS" → "COMPLETED"

---

## 🔗 References

- [OWASP Top 10 2023](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [Zod Documentation](https://zod.dev/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last reviewed:** 2026-07-01  
**Next review:** 2026-07-08  
**Owner:** Security Team / Development Lead
