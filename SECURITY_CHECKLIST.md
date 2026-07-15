# ✅ Security Implementation Checklist

Quick reference for tracking security improvements.  
Full details in `SECURITY_PLAN.md`

---

## 🔴 CRITICAL - Week 1

### Authentication & Authorization
- [x] Protect `/api/debug` with JWT
- [x] Protect `/api/search` with JWT
- [x] Require `JWT_SECRET` in production
- [x] Add rate limiting to `/api/auth/session` (see Rate Limiting section below)

### Input Validation
- [x] Install Zod
- [x] Validate `/api/search` input
- [x] Validate `/api/submit` input
- [x] Validate `/api/versand` input
- [x] Validate `/api/auth/session` input
- [x] Limit query string length (max 100 chars)
- [x] Bonus: `/api/search-products` now also validated + requires auth (was open before)

### Security Headers
- [x] Add Content-Security-Policy
- [x] Add X-Frame-Options: DENY
- [x] Add X-Content-Type-Options: nosniff
- [x] Add Strict-Transport-Security (production only)
- [x] Add X-XSS-Protection (explicitly disabled: `0`, not `1; mode=block` — see comment in `next.config.ts`)
- [x] Add Referrer-Policy

### CSRF Protection — ✅ Resolved via architecture (2026-07-13), no token system built
- [x] Use SameSite=Strict cookies (device cookie already `SameSite=Strict`)
- [x] Generate CSRF token on session creation — **N/A by design:** operator
      session token lives in `localStorage`, attached manually via
      `Authorization: Bearer` header (see `src/lib/api-client.ts`), never sent
      automatically by the browser like a cookie would be. A cross-site page
      cannot read `localStorage` or attach that header — this closes the
      classic CSRF vector without a token system.
- [x] Validate CSRF token on POST/DELETE — **N/A by design**, same reasoning.
      Cleaned up two unused, never-wired-up cookie helpers
      (`getSessionCookieHeader`/`getClearSessionCookieHeader` in `session.ts`)
      that could have misled a future reader into thinking session auth was
      cookie-based.
- Re-evaluate if the app ever switches operator-session auth to cookies —
  that would reopen this vector and require an actual CSRF token.

### Error Handling
- [x] Remove stack traces from responses
- [x] Generic error messages for client (search, submit, versand, auth/session, search-products)
- [x] Detailed errors only in server logs
- [ ] `/api/debug` remains intentionally verbose (diagnostic tool) — now behind
      both the device-gate and operator session, but still worth removing or
      further restricting before go-live

### Credentials Management
- [x] Update `.env.example` (remove GCP plain text)
- [x] Document GOOGLE_APPLICATION_CREDENTIALS usage
- [ ] Document Asana token rotation

---

## 🟠 HIGH - Week 2

### Rate Limiting — ✅ DONE (2026-07-13), in-memory instead of Upstash/Redis
Implemented in `src/lib/rate-limit.ts` + applied centrally in `src/middleware.ts`
(one place for all routes, not per-endpoint code). No external Redis/Upstash
dependency — deliberately simple, since [`SELFHOSTING_PLAN.md`](SELFHOSTING_PLAN.md)
moves this app to a single self-hosted Node process, where in-memory state is
fully reliable. **Caveat on Vercel today:** serverless instances don't share
this in-memory state, so it's best-effort there, not a hard guarantee — full
strength kicks in once self-hosted.
- [x] Auth-Login (`/api/auth/session`): 20 req/min per IP
- [x] Geräte-Code (`/api/auth/device`): 10 req/**15 min** per IP — stricter,
      since this guards a shared secret against brute-forcing (didn't exist
      yet when this checklist was written)
- [x] Search endpoints (`/api/search`, `/api/search-products`): 60 req/min per IP
- [x] Submit/Versand/Foto-Upload: 20 req/min per IP
- [x] Default fallback limit (60 req/min per IP) for any other/future `/api/*`
      route, so a newly added endpoint is never accidentally unlimited
- Keyed by **IP**, not per-operator — simpler, and in this shared-tablet
  setup one IP ≈ one device anyway

### Audit Logging — ✅ DONE (2026-07-13), no Pino
Implemented in `src/lib/audit-log.ts` — one structured JSON line per event via
`console.log`/`console.warn`, no logging package. Vercel today and Coolify/
Docker later (see `SELFHOSTING_PLAN.md`) both already capture stdout/stderr as
logs with their own retention settings — that's where **90-day retention**
should be configured (hosting/log-platform level), not enforceable from
application code.
- [x] Log authentication events (`/api/auth/session`, `/api/auth/device`)
- [x] Log submission events (`/api/submit`)
- [x] Log Versand events (`/api/versand`)
- [x] Log search queries — **result count only, not the raw query text**
      (the query can itself be a customer's name — kept out of logs)
- [x] Log failed authentication attempts (login, device unlock, rate-limit
      rejections, device-gate rejections in `src/middleware.ts`)
- [ ] 90-day retention policy — set this at the hosting-platform level once
      deployed (Vercel log retention setting, or Docker log-rotation config
      on the self-hosted server), not in this repo

### HTTPS Enforcement — ✅ DONE (2026-07-13)
- [x] Redirect HTTP to HTTPS — added as defense-in-depth in `src/middleware.ts`
      (production only, checks `x-forwarded-proto`). Vercel and the planned
      Coolify/Traefik setup already enforce this at the proxy level; this is
      a backstop, not the primary defense.
- [ ] Verify in production (not runnable in this environment — no Node.js
      available; please verify manually once deployed)

### CORS — ✅ Resolved via absence (2026-07-13), no headers added
**Analysis:** Without any `Access-Control-Allow-Origin` header, browsers
already default to same-origin-only — no other website can read responses
from this API. There is currently no legitimate cross-origin caller (no other
app needs to call the RetourenApp API). Adding CORS headers now would only
ever *loosen* this default, without solving a real requirement.
- [x] Define allowed origins — **none needed today**; revisit only if a real
      cross-origin caller appears (e.g. a future Messe-App integration that
      needs to call this API directly)
- Not done: CORS headers — intentionally, per above
- Not done: cross-origin testing — nothing to test without a real caller

---

## 🟡 MEDIUM - Week 3+

### Dependency Management
- [ ] Run `npm audit`
- [ ] Setup GitHub Dependabot
- [ ] Review security advisories
- [ ] Update vulnerable packages

### Secrets Rotation
- [ ] Setup JWT_SECRET rotation (30 days)
- [ ] Setup Asana token rotation (90 days)
- [ ] Setup GCP key rotation (90 days)
- [ ] Document rotation process

### Security Testing
- [ ] Manual penetration testing
- [ ] OWASP Top 10 review
- [ ] Load testing with rate limits
- [ ] Error handling verification

### Documentation
- [ ] Security best practices guide
- [ ] Incident response procedure
- [ ] Deployment security checklist

---

## 📊 Progress Dashboard

```
CRITICAL Issues:    7/7 ✅✅✅✅✅✅✅  (100%)
HIGH Issues:        4/4 ✅✅✅✅        (100%)
MEDIUM Issues:      0/3                (0%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              11/14              (79%)
```

> Alle CRITICAL- und HIGH-Punkte sind erledigt (einige davon durch begründete
> Architektur-Entscheidungen statt neuer Pakete — siehe CSRF- und CORS-Notizen
> oben). Als Nächstes: MEDIUM-Punkte (Week 3+) — Dependency-Scanning,
> Secrets-Rotation, Security-Testing, Doku. Offene Restpunkte, die trotzdem
> noch Aufmerksamkeit brauchen: 90-Tage-Log-Retention auf Hosting-Ebene
> einstellen, `/api/debug` vor Go-Live nochmal bewerten, Asana-Token-Rotation
> dokumentieren.

---

## 🎯 This Week's Focus

**Target:** Complete all CRITICAL items by Friday

```
Monday:   JWT_SECRET + Zod Setup
Tuesday:  Input Validation (5 endpoints)
Wednesday: Security Headers + CSRF
Thursday:  Testing & Documentation
Friday:    Code Review & Push to Staging
```

---

## 🔗 Quick Links

- Full Plan: `SECURITY_PLAN.md`
- Analysis: Available in PR description
- Security Headers: `next.config.ts`
- Validation Schemas: `src/lib/schemas.ts` (to create)
- Session/JWT: `src/lib/session.ts`

---

## ⚠️ Breaking Changes

None planned - all changes are additive/security-focused.

---

## 📝 Status Updates

Update checklist as you complete each task:
1. Change `[ ]` → `[x]` when done
2. Commit with message: `docs: update security checklist - complete [item]`
3. Push to staging branch regularly

---

**Last Updated:** 2026-07-01  
**Next Update:** After each major task completion
