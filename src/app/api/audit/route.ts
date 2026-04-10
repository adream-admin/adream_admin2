import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { username: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json(logs);
}
