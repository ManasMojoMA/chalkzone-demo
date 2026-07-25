import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A throwaway client used ONLY to fire resetPasswordForEmail.
 *
 * @supabase/ssr's createBrowserClient hardcodes flowType: "pkce" with no way
 * to override it. PKCE recovery links only complete in the same browser
 * profile that requested them — a "code verifier" is stashed in that
 * profile's storage and must be there when the link is clicked. Email
 * clients (Gmail, Outlook) routinely open links in a different profile,
 * which is exactly the failure this app hit.
 *
 * Firing the request from a plain, separate client configured for the
 * implicit flow makes Supabase issue a link carrying the session tokens
 * directly in the URL fragment instead — no stored secret required, so it
 * completes in ANY browser/device. This client persists nothing and is
 * discarded immediately after the one call.
 */
export function createResetRequestClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
