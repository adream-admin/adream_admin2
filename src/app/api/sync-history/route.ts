import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;

  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.orderSyncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderSyncLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}

export async function DELETE(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const { ids, all, action } = await req.json();

  // 전체 삭제 (현재 탭)
  if (all) {
    const where = action ? { action } : {};
    const { count } = await prisma.orderSyncLog.deleteMany({ where });
    return NextResponse.json({ deleted: count });
  }

  // 선택 삭제
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '삭제할 항목을 선택하세요' }, { status: 400 });
  }
  const { count } = await prisma.orderSyncLog.deleteMany({
    where: { id: { in: ids.map(Number) } },
  });
  return NextResponse.json({ deleted: count });
}
