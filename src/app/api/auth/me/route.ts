import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  return NextResponse.json(user);
}
