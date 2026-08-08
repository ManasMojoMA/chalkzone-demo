import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps the Supabase project awake.
 *
 * Supabase pauses free-tier projects after about a week of inactivity, and a paused
 * project stops resolving in DNS entirely. That took this app's homepage down with a
 * 504 once already: middleware called into Supabase, the lookup hung, and Vercel
 * killed the request. The middleware is now bounded and scoped, so an outage
 * degrades to a login page rather than a gateway error — but logins still fail while
 * the database is asleep, which is a bad way for a recruiter to meet the project.
 *
 * Any query resets the inactivity timer, so this only has to be cheap and regular.
 * Scheduled every 5 days in vercel.json, comfortably inside the ~7-day window.
 */

// Never prerender or cache — the point is that it actually runs.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vercel signs cron invocations with this header. Without the check, anyone could
  // hammer the endpoint; it is cheap, but there is no reason to leave it open.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, reason: 'supabase env vars missing' },
      { status: 500 }
    );
  }

  const started = Date.now();

  try {
    // A HEAD against the REST root is enough to count as activity, and avoids
    // depending on any particular table still existing.
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
      // Bounded: a hung request here must not sit until the function is killed.
      signal: AbortSignal.timeout(10_000),
    });

    return NextResponse.json({
      ok: true,
      status: res.status,
      ms: Date.now() - started,
      at: new Date().toISOString(),
    });
  } catch (err) {
    // Report the failure rather than throwing, so the cron log shows what happened.
    return NextResponse.json(
      {
        ok: false,
        reason: (err as Error).message,
        ms: Date.now() - started,
        at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
