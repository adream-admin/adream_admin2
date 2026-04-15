import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDayRange, parseUTCDate } from '@/lib/dateUtils';

function verifyInternalApiKey(req: NextRequest): boolean {
  const apiKey = process.env.SCHEDULE_INTERNAL_API_KEY;
  if (!apiKey) return false;
  return req.headers.get('x-internal-api-key') === apiKey;
}

// POST: Stop order - delete future unassigned schedules (중단요청 승인)
export async function POST(req: NextRequest) {
  if (!verifyInternalApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { externalId, stopDate } = await req.json();

    if (!externalId) {
      return NextResponse.json({ error: 'externalId 필수' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { externalId },
      include: { company: { select: { companyName: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: '해당 접수를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Cutoff: 중단요청일 익일 UTC 자정
    let cutoff: Date;
    if (stopDate) {
      const { end } = getDayRange(stopDate); // stopDate 다음날 UTC 자정
      cutoff = end;
    } else {
      // 오늘 기준 익일
      const today = new Date().toISOString().split('T')[0];
      const { end } = getDayRange(today);
      cutoff = end;
    }

    // cutoff 이후 스케줄 조회
    const futureSchedules = await prisma.schedule.findMany({
      where: {
        orderId: order.id,
        scheduledDate: { gte: cutoff },
      },
      include: {
        workItems: { select: { id: true, accountId: true } },
      },
    });

    // 실제 배정된(accountId 있는) workItem이 하나도 없는 스케줄만 삭제
    const deletableSchedules = futureSchedules.filter(
      (s) => !s.workItems.some((w) => w.accountId !== null)
    );
    const deletableIds = deletableSchedules.map((s) => s.id);

    let deleted = 0;
    if (deletableIds.length > 0) {
      await prisma.$transaction([
        // 미배정 workItem 먼저 삭제 후 스케줄 삭제
        prisma.workItem.deleteMany({ where: { scheduleId: { in: deletableIds } } }),
        prisma.schedule.deleteMany({ where: { id: { in: deletableIds } } }),
      ]);
      deleted = deletableIds.length;
    }

    // 주문 중단 처리
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'stopped' },
    });

    // 수집 이력 로그
    await prisma.orderSyncLog.create({
      data: {
        action: 'stop',
        externalId: externalId || null,
        companyName: order.company?.companyName ?? null,
        payload: JSON.stringify({ externalId, stopDate, deletedSchedules: deleted }),
        result: 'stopped',
      },
    });

    return NextResponse.json({ success: true, deleted });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
