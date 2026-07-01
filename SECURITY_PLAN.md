# 🔒 RetourenApp Security Hardening Plan

**Status:** In Progress  
**Last Updated:** 2026-07-01  
**Branch:** `claude/app-security-analysis-bztf1o`

---

## 📊 Executive Summary

**Critical Issues Found:** 7  
**High Priority Issues:** 6  
**Total Estimated Effort:** 3-4 weeks  
**Current Progress:** 29% (2/7 Critical Fixed)

---

## 🎯 Priority 1: CRITICAL - Must Fix This Week

### ✅ COMPLETED
- [x] **Security Issue #1:** Protect `/api/debug` endpoint with authentication
- [x] **Security Issue #2:** Protect `/api/search` endpoint with authentication
- [x] **Security Issue #5:** Remove verbose error messages

### ⏳ IN PROGRESS / TO DO

#### 1. **Weak JWT Secret** (15 min)
- [ ] Make `JWT_SECRET` environment variable REQUIRED
- [ ] Throw error in production if not set
- [ ] Document in README.md
- [ ] Generate strong default for dev: `crypto.randomBytes(32).toString('hex')`
- **Files to update:** `src/lib/session.ts`, `.env.example`
- **Blocking:** No other security features work without this

```bash
# After implementation, verify:
JWT_SECRET=dev-only-key npm run dev
# Should work

# In production without JWT_SECRET:
# Should fail with clear error message
```

---

#### 2. **Implement Input Validation (Zod)**
**Estimated Time:** 3-4 hours  
**Package:** `zod@^3.22.0`

**Step 1:** Install & Setup
- [ ] `npm install zod`
- [ ] Create `src/lib/schemas.ts` with all validation schemas
- [ ] Define schemas for:
  - [ ] `SearchQuerySchema` - query string max 100 chars
  - [ ] `SessionCreateSchema` - operator name validation
  - [ ] `ReturnCaptureSchema` - complex return data
  - [ ] `VersandSchema` - shipping data
  - [ ] `OrderSearchSchema` - order ID validation

**Step 2:** Integrate into APIs
- [ ] Add Zod validation to `/api/search/route.ts`
- [ ] Add Zod validation to `/api/auth/session/route.ts`
- [ ] Add Zod validation to `/api/submit/route.ts`
- [ ] Add Zod validation to `/api/versand/route.ts`
- [ ] Add Zod validation to `/api/order/[id]/route.ts`

**Step 3:** Test
- [ ] Manual test: Invalid JSON payloads return 400
- [ ] Manual test: Oversized inputs rejected
- [ ] Manual test: Valid inputs pass through

**Files to update:**
- `src/lib/schemas.ts` (new)
- `src/app/api/search/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/submit/route.ts`
- `src/app/api/versand/route.ts`

---

#### 3. **Add Security Headers to Next.js Config**
**Estimated Time:** 1 hour  
**No new packages needed**

- [ ] Update `next.config.ts` with `headers()` function
- [ ] Add CSP (Content-Security-Policy)
- [ ] Add X-Frame-Options: DENY
- [ ] Add X-Content-Type-Options: nosniff
- [ ] Add Strict-Transport-Security (HSTS)
- [ ] Add X-XSS-Protection
- [ ] Add Referrer-Policy

**Verification:**
```bash
curl -I https://app.local/api/search
# Should show Security Headers
```

---

#### 4. **Fix GCP Credentials Handling**
**Estimated Time:** 30 min  
**Security Risk:** CRITICAL - Credentials in Environment Variables

- [ ] Update `.env.example`: Remove `GCP_SERVICE_ACCOUNT_JSON` (Plain Text)
- [ ] Document: Use only `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- [ ] OR: Use Application Default Credentials (ADC)
- [ ] Add warning comment in code
- [ ] Document in README.md

**Files to update:**
- `.env.example`
- `src/lib/bigquery.ts` (add comments)
- `README.md`

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

#### 6. **Implement No-Auth Route Check**
**Estimated Time:** 30 min

- [ ] Add middleware or route check to prevent accidental public endpoints
- [ ] Document which routes MUST have auth:
  - `/api/submit` ✅ Protected
  - `/api/versand` ✅ Protected
  - `/api/search` ✅ Protected (Fixed)
  - `/api/debug` ✅ Protected (Fixed)
  - `/api/order/[id]` ❓ Check - should be protected
- [ ] Review all new routes before deployment

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

### 8. **Implement Rate Limiting**
**Estimated Time:** 4-6 hours  
**Packages:** `@upstash/ratelimit@^0.4.0` (OR: Vercel built-in)

**Strategy A: Vercel Built-in (Easier)**
```typescript
export const config = {
  rateLimit: {
    limit: 5,
    window: '1m',
  }
}
```

**Strategy B: Upstash Redis (More Control)**
- [ ] Setup Upstash Redis account (free tier ok)
- [ ] Install `npm install @upstash/ratelimit`
- [ ] Create rate limiters:
  - `/api/auth/session`: 5 req/min per IP
  - `/api/search`: 30 req/min per operator
  - `/api/submit`: 10 req/min per operator
  - `/api/versand`: 10 req/min per operator

**Limits:**
```
Auth:      5 requests / minute / IP
Search:    30 requests / minute / operator
Submit:    10 requests / minute / operator
Versand:   10 requests / minute / operator
Order:     50 requests / minute / operator
```

---

### 9. **Implement CSRF Protection**
**Estimated Time:** 2-3 hours  
**Packages:** `csrf@^3.7.0`

**Approach:** SameSite Cookies (Already partially implemented!)

- [ ] Verify cookies have `SameSite=Strict`
- [ ] Add CSRF token to session response
- [ ] Validate CSRF token on POST/DELETE
- [ ] Add to all state-changing endpoints

---

### 10. **Implement Audit Logging**
**Estimated Time:** 3-4 hours  
**Packages:** `pino@^8.17.0`

**Audit Events to Log:**
- [ ] User login (session creation)
- [ ] User logout (session deletion)
- [ ] Retoure submission (order, items, operator)
- [ ] Versand submission
- [ ] Search queries (high volume, but include count)
- [ ] Failed authentication attempts

**Schema:**
```typescript
{
  timestamp: ISO string,
  event: string,
  operator: string,
  action: string,
  resource: string,
  status: 'success' | 'failure',
  ip: string,
  userAgent: string,
  details: object
}
```

**Retention:** 90 days minimum

---

### 11. **Setup Error Handling & Logging**
**Estimated Time:** 2 hours

- [ ] Create centralized error handler
- [ ] Return generic error messages to client
- [ ] Log detailed errors to server logs
- [ ] Implement error tracking (Sentry optional)
- [ ] Don't expose stack traces in responses

---

### 12. **Implement HTTPS Enforcement**
**Estimated Time:** 30 min

- [ ] Add redirect middleware: HTTP → HTTPS
- [ ] Set `Strict-Transport-Security` header
- [ ] Verify in production

---

## 🎯 Priority 3: MEDIUM - Nice to Have

### 13. **CORS Configuration**
**Estimated Time:** 30 min
- [ ] Define allowed origins whitelist
- [ ] Add `Access-Control-Allow-Origin` headers
- [ ] Add `Access-Control-Allow-Credentials`

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
| **CRITICAL** | Zod | Input Validation | 3-4h | 🔴 Critical | ⏳ TODO |
| **CRITICAL** | next/config | Security Headers | 1h | 🔴 Critical | ⏳ TODO |
| **CRITICAL** | - | JWT_SECRET Required | 15m | 🔴 Critical | ⏳ TODO |
| **HIGH** | @upstash/ratelimit | Rate Limiting | 4-6h | 🔴 Critical | ⏳ TODO |
| **HIGH** | csrf | CSRF Protection | 2-3h | 🟠 High | ⏳ TODO |
| **HIGH** | pino | Audit Logging | 3-4h | 🟠 High | ⏳ TODO |
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

### CRITICAL #3: Weak JWT Secret
- [ ] Make JWT_SECRET required in production
- [ ] Generate strong dev default
- [ ] Update `.env.example`
- [ ] Test: Production fails without JWT_SECRET
- [ ] Commit & Push
- **Est. Time:** 15 min

### CRITICAL #4: No CSRF Protection
- [ ] Implement CSRF token in session
- [ ] Validate on POST/DELETE
- [ ] Test with curl/Postman
- [ ] Commit & Push
- **Est. Time:** 2-3 hours
- **Blocking:** None (can implement now)

### CRITICAL #5: No Security Headers
- [ ] Update `next.config.ts`
- [ ] Add CSP, X-Frame-Options, HSTS
- [ ] Test with `curl -I`
- [ ] Verify in browser DevTools
- [ ] Commit & Push
- **Est. Time:** 1 hour
- **Blocking:** None

### CRITICAL #6: Input Validation Missing
- [ ] Install Zod
- [ ] Create schema file
- [ ] Add validation to 5 routes
- [ ] Test with invalid inputs
- [ ] Commit & Push
- **Est. Time:** 3-4 hours
- **Blocking:** Security critical

### CRITICAL #7: Credentials in Env Vars
- [ ] Update `.env.example`
- [ ] Document best practices
- [ ] Add code comments
- [ ] Commit & Push
- **Est. Time:** 30 min

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
