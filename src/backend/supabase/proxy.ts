import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request. Called from the root
// proxy.ts (Next.js 16 renamed the `middleware` file convention to `proxy` --
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Pattern verified against the current official `with-supabase` Next.js
// template (generated via `create-next-app -e with-supabase`), adapted here
// to reuse this project's existing NEXT_PUBLIC_SUPABASE_ANON_KEY naming
// (T8/AD-009) instead of the template's newer PUBLISHABLE_KEY var, and to
// enforce AD-002 (no anonymous access anywhere, not just on the routes the
// template treats as protected).
export async function updateSession(request: NextRequest) {
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

  // Do not run code between createServerClient and getClaims() -- a mistake
  // here can make it very hard to debug users being randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const { pathname } = request.nextUrl;
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    // Bypass de login pra dev local (T-adhoc, ver app/admin/acesso) --
    // liberado do gate de auth aqui pra existir sem sessão prévia, mas
    // a própria rota se recusa a rodar fora de NODE_ENV=development, então
    // isto não abre acesso anônimo real em produção/Preview (AD-002).
    pathname.startsWith("/admin/acesso");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Must return supabaseResponse as-is (or copy its cookies) -- see the
  // official pattern's warning: a fresh NextResponse without these cookies
  // desyncs the browser and server session.
  return supabaseResponse;
}
