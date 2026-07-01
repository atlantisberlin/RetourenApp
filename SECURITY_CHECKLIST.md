# ✅ Security Implementation Checklist

Quick reference for tracking security improvements.  
Full details in `SECURITY_PLAN.md`

---

## 🔴 CRITICAL - Week 1

### Authentication & Authorization
- [x] Protect `/api/debug` with JWT
- [x] Protect `/api/search` with JWT
- [ ] Require `JWT_SECRET` in production
- [ ] Add rate limiting to `/api/auth/session`

### Input Validation
- [ ] Install Zod
- [ ] Validate `/api/search` input
- [ ] Validate `/api/submit` input
- [ ] Validate `/api/versand` input
- [ ] Validate `/api/auth/session` input
- [ ] Limit query string length (max 100 chars)

### Security Headers
- [ ] Add Content-Security-Policy
- [ ] Add X-Frame-Options: DENY
- [ ] Add X-Content-Type-Options: nosniff
- [ ] Add Strict-Transport-Security
- [ ] Add X-XSS-Protection
- [ ] Add Referrer-Policy

### CSRF Protection
- [ ] Generate CSRF token on session creation
- [ ] Validate CSRF token on POST/DELETE
- [ ] Use SameSite=Strict cookies

### Error Handling
- [x] Remove stack traces from responses
- [ ] Generic error messages for client
- [ ] Detailed errors only in server logs

### Credentials Management
- [ ] Update `.env.example` (remove GCP plain text)
- [ ] Document GOOGLE_APPLICATION_CREDENTIALS usage
- [ ] Document Asana token rotation

---

## 🟠 HIGH - Week 2

### Rate Limiting
- [ ] Auth endpoint: 5 req/min per IP
- [ ] Search endpoint: 30 req/min per operator
- [ ] Submit endpoint: 10 req/min per operator
- [ ] Versand endpoint: 10 req/min per operator

### Audit Logging
- [ ] Setup Pino logger
- [ ] Log authentication events
- [ ] Log submission events
- [ ] Log search queries
- [ ] Log failed auth attempts
- [ ] 90-day retention policy

### HTTPS Enforcement
- [ ] Redirect HTTP to HTTPS
- [ ] Verify in production

### CORS
- [ ] Define allowed origins
- [ ] Add CORS headers
- [ ] Test cross-origin requests

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
CRITICAL Issues:    2/7 ✅✅❌❌❌❌❌  (29%)
HIGH Issues:        0/6                (0%)
MEDIUM Issues:      0/3                (0%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              2/16               (13%)
```

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
