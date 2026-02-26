import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('x-request-id', requestId)
    return res
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  supabaseResponse.headers.set('x-request-id', requestId)

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          supabaseResponse.headers.set('x-request-id', requestId)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Unauthenticated → redirect to login (except auth pages and API routes)
    if (
      !user &&
      !request.nextUrl.pathname.startsWith('/portal') &&
      !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/register') &&
      !request.nextUrl.pathname.startsWith('/forgot-password') &&
      !request.nextUrl.pathname.startsWith('/auth') &&
      !request.nextUrl.pathname.startsWith('/api/')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const res = NextResponse.redirect(url)
      res.headers.set('x-request-id', requestId)
      return res
    }

    // Authenticated on auth pages → redirect to dashboard
    if (
      user &&
      (request.nextUrl.pathname.startsWith('/login') ||
        request.nextUrl.pathname.startsWith('/register'))
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      const res = NextResponse.redirect(url)
      res.headers.set('x-request-id', requestId)
      return res
    }
  } catch (e) {
    console.error('Middleware auth error:', e)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
