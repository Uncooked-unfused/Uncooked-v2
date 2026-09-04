export const TERMS_VERSION = "2026-09-04";
export const PRIVACY_VERSION = "2026-09-04";

/** DPDP Act, 2023 + Digital Personal Data Protection Rules, 2025 (G.S.R. 846(E)). */
export const DPDP = {
  actShort: "DPDP Act, 2023",
  rulesShort: "DPDP Rules, 2025",
  rulesNotifyDate: "13 November 2025",
  /** Rule 14 / grievance systems: respond within a reasonable period not exceeding 90 days. */
  grievanceSlaDays: 90,
  /** Rule 7: detailed report to the Board within 72 hours of awareness (or longer if Board allows). */
  breachBoardHours: 72,
  /** Rule 8 / Seventh Schedule style ops: retain security/processing logs at least 1 year. */
  securityLogRetentionYears: 1,
  /** Inactive-account style erasure notice window commonly applied under Rules practice. */
  erasureAdvanceNoticeHours: 48,
  boardName: "Data Protection Board of India",
  /** Cross-border: negative-list approach under Rule 15 — we do not transfer to restricted territories when notified. */
  crossBorderNote:
    "Personal data may be processed on infrastructure that supports delivery of this service. We do not sell personal data. Transfers, if any, follow the DPDP Act and Rules (including any government restriction list under Rule 15).",
};

/** IT Act, 2000 + Intermediary Guidelines (2021 as amended 2025). */
export const IT_INTERMEDIARY = {
  rulesShort: "IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (as amended 2025)",
  amendment2025: "G.S.R. 775(E) dated 22 October 2025 (in force 15 November 2025)",
  takedownHours: 36,
  actualKnowledgeNote:
    "Actual knowledge for unlawful-content takedown arises from (i) an order of a competent court, or (ii) a written reasoned intimation from an authorised government officer not below Joint Secretary (or equivalent), identifying the specific URL/digital identifier.",
};

export const LEGAL = {
  productName: "Opportia",
  entityName: process.env.LEGAL_ENTITY_NAME || "Opportia",
  country: "India",
  governingLaw: "the laws of India",
  grievanceOfficerName: process.env.GRIEVANCE_OFFICER_NAME || "Grievance Officer",
  grievanceEmail: process.env.GRIEVANCE_EMAIL || process.env.SUPPORT_EMAIL || "support@opportia.in",
  supportEmail: process.env.SUPPORT_EMAIL || "support@opportia.in",
  /** Rule 9 — person to answer questions about processing */
  privacyContactEmail: process.env.PRIVACY_CONTACT_EMAIL || process.env.GRIEVANCE_EMAIL || process.env.SUPPORT_EMAIL || "support@opportia.in",
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
  dataFiduciaryNotice: `${process.env.LEGAL_ENTITY_NAME || "Opportia"} is the Data Fiduciary for personal data collected through this website under the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025.`,
};

export const ALLOWED_ROLES = Object.freeze(["USER", "ORGANIZER", "SUPER_ADMIN"]);
export const ASSIGNABLE_ROLES = Object.freeze(["USER", "ORGANIZER"]);

export const PASSWORD_MIN_LENGTH = 12;
export const LOGIN_LOCKOUT_THRESHOLD = 8;
export const LOGIN_LOCKOUT_MS = 30 * 60 * 1000;
export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/** Purpose-linked retention defaults published under Rule 3 / Rule 8 practice. */
export const RETENTION = {
  accountActive: "While your account remains active and the service purpose continues.",
  afterErasure: "Personal fields are anonymised or deleted on erasure; opaque fraud-prevention identifiers may remain.",
  securityLogs: `At least ${DPDP.securityLogRetentionYears} year(s) for security, access, and investigation logs (DPDP Rules, 2025).`,
  consents: "Consent records retained to demonstrate compliance, then deleted or anonymised when no longer required.",
  supportMessages: "Support and grievance messages retained until resolved and for a reasonable period thereafter (grievance SLA up to 90 days for first response/resolution tracking).",
};
