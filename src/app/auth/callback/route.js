import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safeRedirect";
import { getAppBaseUrl } from "@/lib/appUrl";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || searchParams.get("redirectTo") || "/dashboard";
  const safeNext = safeInternalPath(next, "/dashboard");

  let redirectBase = origin;
  try {
    // Prefer configured public URL; never trust x-forwarded-host.
    redirectBase = getAppBaseUrl();
  } catch {
    if (process.env.NODE_ENV === "development") {
      redirectBase = origin;
    } else {
      return NextResponse.redirect(`${origin}/login?error=app_url_misconfigured`);
    }
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session) {
      return NextResponse.redirect(`${redirectBase}${safeNext}`);
    }

    console.error("[OAUTH_CALLBACK] Exchange code for session error:", error?.message || "No session returned");
  } else {
    console.warn("[OAUTH_CALLBACK] No code parameter provided in callback request");
  }

  return NextResponse.redirect(`${redirectBase}/login?error=oauth_callback_failed`);
}
