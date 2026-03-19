import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Paths excluded from rate limiting (during test/dev)
const RATE_LIMIT_WHITELIST = [
  "/api/seed",
  "/api/debug",
  "/api/listings/search",
  "/api/leads",
  "/api/webhooks/",
  "/api/import",
  "/api/ai/generate-description",
  "/api/ai/score-lead",
  "/api/ai/draft-reply",
  "/api/ai/fraud-check",
  "/api/chat/context",
  "/api/chat/messages",
  "/api/listings/",
  "/api/account/",
  "/api/notifications/",
];

// In-memory rate limiter (per-instance; use Redis in production for multi-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isWhitelisted(pathname: string): boolean {
  return RATE_LIMIT_WHITELIST.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIP(request);

  // Rate limit: /api/chat — 20 requests/hour per IP (skip whitelisted)
  if (
    pathname === "/api/chat" &&
    request.method === "POST" &&
    !isWhitelisted(pathname)
  ) {
    const { allowed, remaining } = checkRateLimit(
      `chat:${ip}`,
      20,
      60 * 60 * 1000
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Troppe richieste. Riprova tra un'ora." },
        {
          status: 429,
          headers: { "X-RateLimit-Remaining": "0" },
        }
      );
    }
    const response = NextResponse.next({ request });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  // Rate limit: /api/ai/valuation — 5/day unauthenticated, 20/day authenticated
  if (pathname === "/api/ai/valuation" && request.method === "POST") {
    const dayMs = 24 * 60 * 60 * 1000;
    const hasAuth = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-"));
    const maxReqs = hasAuth ? 20 : 5;

    const { allowed } = checkRateLimit(`valuation:${ip}`, maxReqs, dayMs);
    if (!allowed) {
      return NextResponse.json(
        {
          error: hasAuth
            ? "Limite giornaliero raggiunto (20 valutazioni/giorno)."
            : "Limite giornaliero raggiunto (5 valutazioni/giorno). Accedi per avere più valutazioni.",
        },
        { status: 429 }
      );
    }
  }

  // Supabase auth for dashboard protection
  if (
    pathname.startsWith("/dashboard") ||
    pathname === "/login" ||
    pathname === "/registrati"
  ) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (pathname.startsWith("/dashboard") && !user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (
      user &&
      (pathname === "/login" || pathname === "/registrati")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return supabaseResponse;
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/registrati",
    "/api/chat",
    "/api/ai/valuation",
  ],
};
