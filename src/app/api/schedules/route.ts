import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { getDayRange, parseUTCDate } from '@/lib/dateUtils';

// 배정 취소: 특정 날짜 + 업체의 workItem 아이디 배정 해제
export async function PATCH(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { scheduleIds } = await req.json();
  if (!scheduleIds?.length) return NextResponse.json({ error: '스케줄 ID 필요' }, { status: 400 });
  if (!Array.isArray(scheduleIds) || scheduleIds.length > 500) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  await prisma.workItem.updateMany({
    where: { scheduleId: { in: scheduleIds } },
    data: { accountId: null, server: null },
  });

  return NextResponse.json({ ok: true });
}

// 삭제: 특정 날짜 + 업체의 스케줄 및 workItem 완전 삭제
export async function DELETE(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { scheduleIds } = await req.json();
  if (!scheduleIds?.length) return NextResponse.json({ error: '스케줄 ID 필요' }, { status: 400 });
  if (!Array.isArray(scheduleIds) || scheduleIds.length > 500) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.workItem.deleteMany({ where: { scheduleId: { in: scheduleIds } } }),
    prisma.schedule.deleteMany({ where: { id: { in: scheduleIds } } }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const date = searchParams.get('date');

  let dateFilter = {};
  if (date) {
    const { start: d, end: next } = getDayRange(date);
    dateFilter = { scheduledDate: { gte: d, lt: next } };
  } else if (startDate && endDate) {
    const { start } = getDayRange(startDate);
    const { end } = getDayRange(endDate);
    dateFilter = { scheduledDate: { gte: start, lt: end } };
  }

  const schedules = await prisma.schedule.findMany({
    where: dateFilter,
    include: {
      company: true,
      order: true,
      workItems: {
        include: { account: true },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { companyId: 'asc' }],
  });

  return NextResponse.json(schedules);
}
