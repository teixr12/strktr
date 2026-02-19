import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for Supabase auth cookie (sb-<project-ref>-auth-token)
  // This is a lightweight check — actual auth verification happens in server components
  const hasAuthCookie = request.cookies.getAll().some(
    (cookie) =>
      cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  )

  const { pathname } = request.nextUrl
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth')

  // No auth cookie + not on auth page → redirect to login
  if (!hasAuthCookie && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Has auth cookie + on auth page → redirect to dashboard
  if (hasAuthCookie && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
