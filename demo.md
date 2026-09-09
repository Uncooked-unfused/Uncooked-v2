# Demo credentials

Use these to sign in on the live deployment.

| Field | Value |
|--------|--------|
| **Site** | https://uncooked-v2.vercel.app |
| **Login** | https://uncooked-v2.vercel.app/login |
| **Email** | `demo@opportia.in` |
| **Password** | `DemoPass1234!` |
| **Role** | `USER` |

## Notes
- Email is **pre-confirmed** (no verification mail needed).
- Normal user account — **not** `SUPER_ADMIN` / admin panel.
- Created with `scripts/create-demo-user.mjs` (Supabase Auth + Prisma).
- If login returns “Too many requests”, wait ~15 minutes (IP rate limit) and retry.

## After login
You should reach `/dashboard`. If the navbar still shows **Login / Get Started**, hard-refresh once — production may not yet include the client session-refresh fix.
