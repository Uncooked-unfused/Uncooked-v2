export function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-opportia.session-token"
    : "opportia.session-token";
}

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd,
  };
}
