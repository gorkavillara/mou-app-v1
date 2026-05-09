import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED_PAGE = /^\/doctor(\/.*)?$/;
const PROTECTED_API = /^\/api\/doctor(\/.*)?$/;
const LOGIN_PAGE = '/login';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedPage = PROTECTED_PAGE.test(pathname);
  const isProtectedApi = PROTECTED_API.test(pathname);
  const isLogin = pathname === LOGIN_PAGE;

  if (!isProtectedPage && !isProtectedApi && !isLogin) return NextResponse.next();

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isLogin && user) {
    const { data: doctorRow } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (doctorRow) return NextResponse.redirect(new URL('/doctor', request.url));
    return response;
  }

  if (isProtectedPage || isProtectedApi) {
    if (!user) {
      if (isProtectedApi) {
        return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
      }
      const url = new URL(LOGIN_PAGE, request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    const { data: doctorRow } = await supabase
      .from('doctors')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!doctorRow) {
      if (isProtectedApi) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      await supabase.auth.signOut();
      const url = new URL(LOGIN_PAGE, request.url);
      url.searchParams.set('error', 'no_access');
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/doctor/:path*', '/api/doctor/:path*', '/login'],
};
