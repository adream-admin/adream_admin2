import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다');
  return new TextEncoder().encode(secret);
};

const PUBLIC_PATHS = ['/login', '/api/auth/login'];
// 접수 어드민 서버→서버 호출 전용 경로 (API 키로 보호)
const INTERNAL_API_PATHS = ['/api/orders', '/api/internal'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 내부 API 키 인증 (서버→서버 전용)
  if (INTERNAL_API_PATHS.some((p) => pathname.startsWith(p))) {
    const internalKey = process.env.SCHEDULE_INTERNAL_API_KEY;
    const reqKey = req.headers.get('x-internal-api-key');
    if (internalKey && reqKey === internalKey) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
