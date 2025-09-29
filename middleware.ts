import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow access to signup page and its assets
  if (pathname === '/signup' || 
      pathname.startsWith('/_next') || 
      pathname.startsWith('/api') ||
      pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Redirect all other routes to /signup
  return NextResponse.redirect(new URL('/signup', request.url));
}

export const config = {
  matcher: '/:path*',
};