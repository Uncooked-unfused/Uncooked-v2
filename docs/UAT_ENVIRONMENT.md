# Opportia — UAT Environment Design

**Document ID:** `OPP-UAT-2026-09`  
**Audience:** Engineering, product owner, campus pilot hosts  
**Status:** Design (ready to implement)  
**Related:** [ENV.md](./ENV.md), [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md), [SECURITY.md](../SECURITY.md), [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md)

---

## 1. Purpose

UAT (User Acceptance Testing) is the **human + product gate** before opening Opportia to real campuses.

| Layer | Proves |
| --- | --- |
| CI / unit / build | Code compiles and invariants hold |
| Security probes | CSRF, authz, headers, injection basics |
| **UAT** | Students, hosts, and admins can complete real journeys on a **prod-like** stack |

**Design target this UAT must exercise:** soft-launch realism toward ~100k registered users (fest bursts, QR check-in, DPDP paths) — not load-test 100k accounts in UAT itself.

---

## 2. Recommended topology (fits today’s stack)

Opportia runs **Next.js 16 on Vercel**, **Supabase Auth + Postgres (Prisma)**, **Upstash Redis**, optional **Sentry**, edge **Cloudflare** in front of prod later.

### 2.1 Environments

```text
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│ Local dev   │     │ UAT / Staging│     │ Production     │
│ localhost   │────►│ Stable URL   │────►│ uncooked-v2 /  │
│ .env.local  │     │ + isolated DB│     │ opportia.in    │
└─────────────┘     └──────────────┘     └────────────────┘
       │                    │                     │
   memory Redis OK     Upstash UAT DB        Upstash PROD
   throwaway secrets   separate secrets      production secrets
```

| Env | App host | Auth + DB | Redis | Who uses it |
| --- | --- | --- | --- | --- |
| **Local** | `http://localhost:3000` | Dev Supabase project or local Postgres | Memory fallback OK | Engineers |
| **UAT (this design)** | Stable HTTPS e.g. `https://uat.opportia.in` **or** Vercel **Staging** alias | **Dedicated** Supabase project (or branch) + Postgres | **Dedicated** Upstash DB | Product + pilot host + student |
| **Preview** | `*.vercel.app` per PR | Prefer **same as UAT DB** only if isolated; else share UAT carefully | Shared UAT Redis with key prefix *or* skip | Engineers reviewing PRs |
| **Production** | `uncooked-v2.vercel.app` → `opportia.in` | Production Supabase + Postgres | Production Upstash | Real users |

### 2.2 Why not “Preview = UAT”?

| Preview deploys | UAT |
| --- | --- |
| Ephemeral URL per PR | **Stable URL** for testers and Google OAuth redirect allowlists |
| Easy to point at wrong DB | Fixed env, fixed seed, fixed checklist |
| Great for eng review | Great for **sign-off** |

**Recommendation:** Keep PR Previews for engineering. Create one **long-lived Staging/UAT** deployment on Vercel (branch `staging` or Vercel “Staging” environment) with its own env vars.

---

## 3. Isolation rules (non-negotiable)

1. **No shared production database** for UAT writes (register, check-in, host apply, delete).  
2. **No shared `TICKET_HMAC_SECRET` or `NEXTAUTH_SECRET` with production** — UAT tickets must not verify on prod and vice versa.  
3. **`NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` must equal the UAT HTTPS origin** (CSRF Origin allowlist).  
4. **Supabase Auth Site URL + redirect allowlist** must include  
   `https://<uat-host>/auth/callback` (Google OAuth).  
5. **Sentry:** `SENTRY_ENVIRONMENT=uat` (or `staging`).  
6. **Email:** Prefer a real provider on UAT with a **safe inbox** (e.g. `+uat` aliases or a shared QA mailbox). Do not send UAT resets to random real students.  
7. **Admin kill-switch / role changes:** practice on UAT first (never first on prod).

---

## 4. Component design

### 4.1 Application (Vercel)

| Item | UAT setting |
| --- | --- |
| Project | Same Vercel project, environment **Preview/Staging** *or* separate Staging env |
| Branch | `staging` (protected) — merge `main` → `staging` for UAT builds; promote `staging` → production after sign-off |
| Region | Prefer **bom1 (Mumbai)** like production when measuring check-in latency |
| Domain | `uat.opportia.in` (ideal) or fixed `opportia-uat.vercel.app` |
| Protection | Optional Vercel Deployment Protection (password) **off** for external campus testers, **or** share bypass; document choice |

**Promotion flow:**

```text
feature PR → CI green → merge main
                ↓
         deploy / merge to staging  →  UAT checklist
                ↓
         product sign-off
                ↓
         promote same commit to Production
```

### 4.2 Auth (Supabase)

| Item | UAT |
| --- | --- |
| Project | **Separate** Supabase project: `opportia-uat` |
| Auth providers | Email/password + Google (same client IDs *or* a dedicated Google OAuth client for UAT) |
| Users | Seeded QA accounts only (see §6) |
| Service role | UAT-only key in Vercel Staging env |

### 4.3 Database (Postgres + Prisma)

| Item | UAT |
| --- | --- |
| Instance | Supabase UAT Postgres **or** Neon/Supabase branch dedicated to UAT |
| `DATABASE_URL` | **Pooler** URL |
| `DIRECT_URL` | Direct URL for `prisma migrate deploy` / `db push` |
| Schema | Same migrations as production (apply via CI or manual go-live script) |
| Data | **Seeded**, resettable (see §5) — never a clone of full prod PII without scrubbing |

### 4.4 Redis (Upstash)

| Item | UAT |
| --- | --- |
| Database | Dedicated Upstash DB `opportia-uat` |
| Why | Rate limits / locks must not block or be polluted by production probes |
| Health | `/api/health` should see Redis configured (same fail-closed policy as prod when `NODE_ENV=production`) |

### 4.5 Email

| Path | UAT behaviour |
| --- | --- |
| Forgot password / verify | Real Resend/SMTP to **QA inboxes only** |
| Contact / broadcasts | Deliver to `support+uat@…` or log + sandbox |
| Fail-closed | If unset, document that reset tests are blocked (matches prod honesty) |

### 4.6 Observability

| Tool | UAT |
| --- | --- |
| Sentry | Separate project or env tag `uat` |
| `/api/health` | Monitored; alert on 503 (Redis/email/DB) |
| Web Vitals | Optional; confirm mobile scanner pages |

### 4.7 Edge / WAF (optional for UAT)

UAT can sit behind Cloudflare later. Minimum for UAT: HTTPS + Vercel. Production still needs Cloudflare WAF before large public traffic ([issue #60](https://github.com/Uncooked-unfused/Uncooked-v2/issues/60)).

---

## 5. Data strategy

### 5.1 Seed pack (minimum)

Automate or script once per reset:

| Entity | Seed |
| --- | --- |
| `SUPER_ADMIN` | 1 account (strong password, MFA if enabled) |
| `ORGANIZER` (approved host) | 1–2 hosts with verified host application |
| `USER` (student) | 3–5 students |
| Events | 2–3 upcoming + 1 past; mix free/paid flag (paid checkout may still be “not live”) |
| Registrations | At least one student registered on a host’s event (QR pass ready) |
| Opportunity | 1 ACTIVE opportunity for apply tests |
| Notifications | Optional sample admin broadcast |

### 5.2 Reset policy

- **Weekly** or **before each formal UAT cycle**: wipe UAT DB (keep schema) + re-seed.  
- Never reset production.  
- Document who may run reset (eng lead).

### 5.3 PII rules

- Use `@example.com` / `+uat@` addresses.  
- No production student exports into UAT unless scrubbed and legally approved.

---

## 6. UAT accounts (example matrix)

| Role | Email (example) | Purpose |
| --- | --- | --- |
| Admin | `admin+uat@opportia.in` | Admin panel, lock/role, communications |
| Host | `host+uat@opportia.in` | Create event, scanner, broadcasts |
| Student A | `student.a+uat@opportia.in` | Register, QR fullscreen, Google optional |
| Student B | `student.b+uat@opportia.in` | Second device / duplicate check-in tests |
| Demo (optional) | Keep prod demo **out** of UAT or mirror with different secret | Avoid cross-env confusion |

Store passwords in a shared **1Password / Bitwarden** vault named `Opportia UAT` — not in GitHub issues.

---

## 7. Acceptance test suite (sign-off checklist)

Run on **UAT URL only**. Tick and date.

### 7.1 Access & auth

- [ ] Email/password login works  
- [ ] Google OAuth completes → lands on `/dashboard` (callback allowlisted)  
- [ ] Bad password shows safe error; rate limit eventually trips  
- [ ] Logged-out `/dashboard`, `/settings`, `/host/scanner/...` redirect to login  

### 7.2 Student journey

- [ ] Browse `/events`, filter categories, open detail  
- [ ] Register → pass appears with QR  
- [ ] Fullscreen pass usable on mobile  
- [ ] Dashboard shows registration + pass (profile fallback QR if used)  

### 7.3 Host journey

- [ ] Host apply / approved host can create event  
- [ ] Host sees Pass Scanner CTA  
- [ ] `/host/scanner/[eventId]` camera starts (`Permissions-Policy: camera=(self)`)  
- [ ] Scan student QR → checked in; duplicate scan → already checked in  
- [ ] Paste JSON fallback works if camera denied  
- [ ] Non-host gets forbidden (page and/or API 403)  

### 7.4 Admin & trust

- [ ] Admin can open `/admin` (authorized only)  
- [ ] Support / communications smoke (staging-safe)  
- [ ] Kill-switch behaviour understood (if tested, restore after)  

### 7.5 Platform honesty

- [ ] Contact form submits (201)  
- [ ] Forgot-password email arrives in QA inbox  
- [ ] `/api/health` → database/auth/email ok  
- [ ] Mobile: one low-end Android + one flagship iOS/Android  

### 7.6 Sign-off

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| Product owner | | | PASS / FAIL |
| Engineer | | | PASS / FAIL |
| Pilot host (optional) | | | PASS / FAIL |

**Rule:** Any **FAIL** on auth, check-in, or data loss blocks production promote.

---

## 8. Environment variable matrix (UAT)

Set these on Vercel **Staging/UAT** (values never committed):

| Variable | UAT notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Exact UAT origin |
| `NEXTAUTH_URL` | Same as above |
| `NEXTAUTH_SECRET` | Unique ≥ 32 chars |
| `TICKET_HMAC_SECRET` | Unique ≠ session secret |
| `DATABASE_URL` / `DIRECT_URL` | UAT pooler + direct |
| `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` | UAT project |
| `UPSTASH_REDIS_REST_*` | UAT Redis |
| `RESEND_API_KEY` / `SMTP_*` / `EMAIL_FROM` | QA-safe sender |
| `SENTRY_DSN` + `SENTRY_ENVIRONMENT=uat` | Tagged |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` if OAuth tested |
| `VERIFIED_HOSTS_ONLY` | Match intended UAT catalog policy |

Full contract: [ENV.md](./ENV.md).

---

## 9. CI / automation around UAT

| Job | Role |
| --- | --- |
| PR CI (existing) | Block merge on unit/lint/build |
| Deploy `staging` | Auto on push to `staging` |
| Optional: `NEXT_TEST_BASE=https://uat… npm run test:security` | Nightly or pre-sign-off |
| Playwright journeys | Student register + host check-in happy path against UAT |
| **Do not** point destructive admin tests at production |

---

## 10. Implementation plan (effort)

| Step | Owner | Effort |
| --- | --- | --- |
| 1. Create Supabase project `opportia-uat` + apply Prisma schema | Eng | 0.5–1 d |
| 2. Create Upstash UAT DB | Eng | 0.5 h |
| 3. Vercel Staging env + `staging` branch + domain | Eng | 0.5–1 d |
| 4. Wire Google redirect URLs for UAT | Eng | 0.5 h |
| 5. Seed script + password vault | Eng | 0.5–1 d |
| 6. First formal UAT cycle + sign-off sheet | Product + Eng | 1–5 d |
| 7. Promote signed commit to production | Eng | 0.5 h |

**Total to stand up:** ~2–4 engineering days. **First acceptance cycle:** ~1 week calendar with campus pilot optional.

---

## 11. What UAT is *not*

- Not a substitute for Cloudflare/WAF on production  
- Not a full 100k-user load test (use k6 separately before big fests)  
- Not Appwrite/NoSQL migration  
- Not sharing production secrets “temporarily”

---

## 12. Success criteria

UAT environment is **live** when:

1. Stable HTTPS URL responds with `/api/health` ok (DB + auth + email + Redis as required).  
2. Seeded admin/host/student can complete §7 checklist.  
3. Secrets and data are isolated from production.  
4. Product owner has signed **PASS** once in the last UAT cycle before any major production promote.

---

## 13. Next actions

1. Create `staging` branch from `main`.  
2. Provision Supabase UAT + Upstash UAT.  
3. Configure Vercel Staging env from §8.  
4. Add seed script under `scripts/seed-uat.mjs` (follow-up PR).  
5. Run first checklist; attach results under `docs/security-evidence/` or a private Notion page.

---

*Opportia — Internal. Aligns with go-live issues #57–#62 (schema, env, email, Cloudflare, domain, smoke QA).*
