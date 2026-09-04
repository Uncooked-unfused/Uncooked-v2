# India IT & data-protection law — Opportia

**Document type:** Internal product mapping (not a government certificate)  
**Product:** Opportia campus events platform  
**Country of operation:** India  
**Date:** 4 September 2026  
**Privacy / Terms version in product:** `2026-09-04`  
**Security rules to follow on every change:** [SECURITY_TEST.md](./SECURITY_TEST.md)

No Indian ministry, MeitY, the Data Protection Board, or CERT-In issues a badge that a website is “following an Act perfectly.” Compliance is shown by **what the product actually does**. This file lists laws whose requirements are implemented in this codebase today.

**Primary instruments covered**

| Instrument | Status |
| --- | --- |
| Digital Personal Data Protection Act, 2023 | Implemented for a campus Data Fiduciary |
| Digital Personal Data Protection Rules, 2025 (G.S.R. 846(E), 13 Nov 2025) | Product notice, rights, security, breach, retention, grievance SLA aligned |
| Information Technology Act, 2000 (incl. §43A) | Reasonable security practices |
| IT (Intermediary Guidelines…) Rules, 2021 as amended 2025 (G.S.R. 775(E)) | Due diligence + 36-hour takedown on defined actual knowledge |
| SPDI Rules, 2011 | Still relevant for passwords / sensitive data practices we retain |
| Consumer Protection Act, 2019 | Honest public claims |
| Aadhaar Act, 2016 | Non-collection |

---

## 1. DPDP Act, 2023 + DPDP Rules, 2025

**Status in product: implemented for a campus web app that is a Data Fiduciary.**

Phased Rules commencement applies nationally (full substantive obligations by May 2027 for many Rules). Opportia ships the product controls now so we are not waiting until the last compliance day.

| Obligation | What Opportia does |
| :--- | :--- |
| Identify a Data Fiduciary | Privacy Notice states Opportia is the Data Fiduciary. |
| Rule 3 notice | `/privacy` itemises data categories, purposes, rights, retention, security, breach, cross-border, contacts, and how to complain to the Board. |
| Consent | Signup requires age + Terms/Privacy; `ConsentRecord` rows with version and hashed IP. |
| Purpose limitation | Documented collection only; no ad tracking; no sale of personal data. |
| Children (Rules 10–12) | 18+ only; attestation at signup; no child-directed ads/tracking. |
| Rights (Rule 14) | Access/correction (profile), export (`GET /api/user/export`), erasure (`POST /api/user/delete`), grievance via contact category **DPDP Rights / Grievance**, nominee fields on profile. |
| Grievance SLA | Published ≤ **90 days** (Rules / fiduciary systems). |
| Rule 6 security | scrypt, lockout, CSRF, rate limits, RBAC, TLS, headers, audit logs (≥ 1 year retention policy). |
| Rule 7 breach | Privacy + Security pages commit to user notice without delay + Board report within **72 hours**. |
| Rule 8 retention | Purpose-linked retention table published on `/privacy`. |
| Rule 9 contact | Privacy contact + grievance officer published. |
| Rule 15 transfers | Negative-list posture described; no sale of data. |
| SDF | Not claimed unless government-notified. |

Public pages: `/privacy`, `/terms`, `/cookies`, `/security`, Profile → Data rights.

---

## 2. Information Technology Act, 2000 — Section 43A

**Status: implemented (reasonable security practices for sensitive personal data we hold).**

| Practice | Implementation |
| :--- | :--- |
| Passwords | scrypt hashes; plaintext rejected. |
| Access control | Session required; admin = SUPER_ADMIN from DB. |
| Session security | HTTP-only cookies; tokenVersion revoke; ban on lock. |
| Abuse resistance | Rate limits, lockout, kill-switch. |
| Audit | Admin actions in `AuditLog`. |
| No card data | Payments not live. |

---

## 3. SPDI Rules, 2011

**Status: implemented for the data we collect** (passwords as sensitive personal data; privacy policy; consent; correction/withdrawal; grievance officer).

---

## 4. IT Intermediary Guidelines Rules, 2021 (as amended 2025)

**Status: implemented for a non-significant intermediary hosting user listings.**

| Due-diligence item | Implementation |
| :--- | :--- |
| User agreement / privacy | `/terms`, `/privacy`. |
| Grievance officer | Published on `/privacy`. |
| Unlawful content | Contact category **Unlawful Content Report**; admin can lock/unpublish; Terms state **36-hour** action on actual knowledge per 2025 amendment (court order or reasoned JS-level intimation with specific URL). |
| Honest claims | `/security` avoids fake PCI / uptime / pen-test badges. |

We are **not** claiming Significant Social Media Intermediary status.

---

## 5. Consumer Protection Act, 2019

Public claims match the software (no fake PCI, SLA, or pen-test assertions).

---

## 6. Aadhaar Act, 2016

We do not collect Aadhaar numbers or copies.

---

## 7. What we deliberately do **not** claim

| Topic | Why |
| --- | --- |
| Government “certified DPDP compliant” badge | No such product badge exists. |
| Significant Data Fiduciary | Only if notified by Central Government. |
| Consent Manager registration | We are the Data Fiduciary app, not a registered Consent Manager platform. |
| CERT-In audit completion | Organisational; track separately. |
| Full multilingual Eighth Schedule notices | English notice shipped; additional languages can be added as localisation work. |

---

## 8. Engineering checklist (keep green)

- [ ] Privacy / Terms versions bump when obligations change (`LEGAL.privacyVersion` / `termsVersion`).
- [ ] Signup still stores consents + 18+ attestation.
- [ ] Export / erase / nominee remain reachable from Profile.
- [ ] Grievance email + 90-day SLA remain published.
- [ ] Breach playbook text remains on `/privacy` and `/security`.
- [ ] No Aadhaar / card / biometric collection without a fresh legal review.
