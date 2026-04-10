import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Internal API — called by 접수 어드민 sync-check page
// Auth: x-internal-api-key header
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-internal-api-key');
  const expectedKey = process.env.SCHEDULE_INTERNAL_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const externalIdsParam = searchParams.get('externalIds');

  if (!externalIdsParam) {
    return NextResponse.json({ logs: [] });
  }

  const externalIds = externalIdsParam.split(',').filter(Boolean);

  if (externalIds.length === 0) {
    return NextResponse.json({ logs: [] });
  }

  const logs = await prisma.orderSyncLog.findMany({
    where: {
      externalId: { in: externalIds },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ logs });
}
