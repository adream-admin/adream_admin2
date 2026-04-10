import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUTCDate } from '@/lib/dateUtils';
import { alertServerError } from '@/lib/errorAlert';

// 수정확인 대상 필드 — API 자동 입력 항목 전체 추적
const MODIFY_TRACKED_FIELDS = [
  'companyName', 'receiptSource', 'placeAddress', 'midValue',
  'contentType', 'manuscriptPhoto', 'mainKeyword', 'keyword', 'tag', 'companyGuide',
] as const;
type TrackedField = typeof MODIFY_TRACKED_FIELDS[number];

// External API endpoint - receives orders from blog order admin

// POST: Create new order (승인대기 승인)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orders = Array.isArray(body) ? body : [body];
    const results = [];

    for (const orderData of orders) {
      const {
        externalId,
        receiptSource,
        companyName,
        placeAddress,
        midValue,
        contentType,
        manuscriptPhoto,
        mainKeyword,
        keyword,
        tag,
        companyGuide,
        startDate,
        endDate,
        dailyCount,
      } = orderData;

      if (!companyName || !startDate || !endDate || !dailyCount) {
        results.push({ error: '필수 항목 누락 (companyName, startDate, endDate, dailyCount)', data: orderData });
        continue;
      }

      // Skip if externalId already processed
      if (externalId) {
        const existing = await prisma.order.findUnique({ where: { externalId } });
        if (existing) {
          results.push({ skipped: true, orderId: existing.id });
          await prisma.orderSyncLog.create({
            data: {
              action: 'new',
              externalId,
              companyName: String(orderData.companyName || ''),
              payload: JSON.stringify(orderData),
              result: 'skipped',
            },
          });
          continue;
        }
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 접수처 + 업체명 + MID값 모두 일치하면 기존 업체 재사용 (중복 등록 방지)
          let company = await tx.company.findFirst({
            where: {
              companyName,
              receiptSource: receiptSource || null,
              midValue: midValue || null,
              isActive: true,
            },
          });

          if (!company) {
            company = await tx.company.create({
              data: {
                receiptSource,
                companyName,
                placeAddress,
                midValue,
                contentType,
                manuscriptPhoto,
                mainKeyword,
                keyword,
                tag,
                companyGuide,
              },
            });
          }

          const start = parseUTCDate(startDate);
          const end = parseUTCDate(endDate);

          // 중복 주문 체크
          const existingUnassigned = await tx.schedule.findFirst({
            where: {
              companyId: company.id,
              scheduledDate: { gte: start, lte: end },
              workItems: { none: { accountId: { not: null } } },
            },
            select: { id: true },
          });

          if (existingUnassigned) {
            const dupOrder = await tx.order.create({
              data: {
                companyId: company.id,
                startDate: start,
                endDate: end,
                dailyCount: Number(dailyCount),
                externalId: externalId || null,
                status: 'duplicate',
              },
            });
            await tx.orderSyncLog.create({
              data: {
                action: 'new',
                externalId: externalId || null,
                companyName: company.companyName,
                payload: JSON.stringify(orderData),
                result: 'duplicate',
              },
            });
            return { orderId: dupOrder.id, companyId: company.id, schedulesCreated: 0, duplicate: true };
          }

          const order = await tx.order.create({
            data: {
              companyId: company.id,
              startDate: start,
              endDate: end,
              dailyCount: Number(dailyCount),
              externalId: externalId || null,
            },
          });

          const schedules = [];
          const cur = new Date(start);
          while (cur <= end) {
            for (let i = 0; i < Number(dailyCount); i++) {
              schedules.push({
                companyId: company.id,
                orderId: order.id,
                scheduledDate: new Date(cur.getTime()),
              });
            }
            cur.setUTCDate(cur.getUTCDate() + 1);
          }

          if (schedules.length > 0) {
            await tx.schedule.createMany({ data: schedules });
          }

          await tx.orderSyncLog.create({
            data: {
              action: 'new',
              externalId: externalId || null,
              companyName: company.companyName,
              payload: JSON.stringify(orderData),
              result: 'created',
            },
          });

          return { orderId: order.id, companyId: company.id, schedulesCreated: schedules.length };
        });
        results.push(result);
      } catch (e) {
        console.error('주문 생성 트랜잭션 오류:', e);
        alertServerError('POST /api/orders', e).catch(() => {});
        results.push({ error: '처리 오류', data: orderData });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// PATCH: Modify order (수정요청 승인)
export async function PATCH(req: NextRequest) {
  try {
    const {
      externalId,
      receiptSource,
      companyName,
      placeAddress,
      midValue,
      contentType,
      manuscriptPhoto,
      mainKeyword,
      keyword,
      tag,
      companyGuide,
      startDate,
      endDate,
      dailyCount,
    } = await req.json();

    if (!externalId) {
      return NextResponse.json({ error: 'externalId 필수' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { externalId },
      include: { company: true },
    });

    if (!order) {
      // Order not found — treat as new creation
      const createRes = await POST(new NextRequest(req.url, {
        method: 'POST',
        body: JSON.stringify({ externalId, receiptSource, companyName, placeAddress, midValue, contentType, manuscriptPhoto, mainKeyword, keyword, tag, companyGuide, startDate, endDate, dailyCount }),
        headers: { 'Content-Type': 'application/json' },
      }));
      return createRes;
    }

    // 수정확인 대상 필드 변경 감지
    const incomingMap: Record<TrackedField, string | undefined> = {
      companyName, receiptSource, placeAddress, midValue,
      contentType, manuscriptPhoto, mainKeyword, keyword, tag, companyGuide,
    };
    const changedFields = MODIFY_TRACKED_FIELDS.filter((f) => {
      const incoming = incomingMap[f];
      if (incoming === undefined) return false;
      return incoming !== (order.company[f] ?? '');
    });

    // 기존 modifiedFields와 병합 (누적 추적 — 덮어쓰기 방지)
    let prevModified: string[] = [];
    if (order.company.modifiedFields) {
      try { prevModified = JSON.parse(order.company.modifiedFields); } catch { prevModified = []; }
    }
    const mergedModified = Array.from(new Set([...prevModified, ...changedFields]));

    const newStart = startDate ? parseUTCDate(startDate) : order.startDate;
    const newEnd = endDate ? parseUTCDate(endDate) : order.endDate;
    const newDaily = dailyCount !== undefined ? Number(dailyCount) : order.dailyCount;
    const datesChanged =
      newStart.getTime() !== order.startDate.getTime() ||
      newEnd.getTime() !== order.endDate.getTime() ||
      newDaily !== order.dailyCount;

    const patchBody = { externalId, receiptSource, companyName, placeAddress, midValue, contentType, manuscriptPhoto, mainKeyword, keyword, tag, companyGuide, startDate, endDate, dailyCount };

    await prisma.$transaction(async (tx) => {
      // Update company fields
      await tx.company.update({
        where: { id: order.companyId },
        data: {
          companyName: companyName ?? order.company.companyName,
          receiptSource: receiptSource ?? order.company.receiptSource,
          placeAddress: placeAddress ?? order.company.placeAddress,
          midValue: midValue ?? order.company.midValue,
          contentType: contentType ?? order.company.contentType,
          manuscriptPhoto: manuscriptPhoto ?? order.company.manuscriptPhoto,
          mainKeyword: mainKeyword ?? order.company.mainKeyword,
          keyword: keyword ?? order.company.keyword,
          tag: tag ?? order.company.tag,
          companyGuide: companyGuide ?? order.company.companyGuide,
          ...(mergedModified.length > 0 ? {
            promptUpdateRequired: true,
            modifiedFields: JSON.stringify(mergedModified),
          } : {}),
        },
      });

      if (datesChanged) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const futureSchedules = await tx.schedule.findMany({
          where: { orderId: order.id, scheduledDate: { gte: tomorrow } },
          include: { workItems: true },
        });

        const deletableIds = futureSchedules
          .filter((s) => s.workItems.length === 0)
          .map((s) => s.id);

        if (deletableIds.length > 0) {
          await tx.schedule.deleteMany({ where: { id: { in: deletableIds } } });
        }

        const cursorStart = newStart < tomorrow ? tomorrow : newStart;
        const newSlots = [];
        const cur = new Date(cursorStart);
        while (cur <= newEnd) {
          for (let i = 0; i < newDaily; i++) {
            newSlots.push({
              companyId: order.companyId,
              orderId: order.id,
              scheduledDate: new Date(cur.getTime()),
            });
          }
          cur.setUTCDate(cur.getUTCDate() + 1);
        }

        if (newSlots.length > 0) {
          await tx.schedule.createMany({ data: newSlots });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { startDate: newStart, endDate: newEnd, dailyCount: newDaily },
        });
      }

      await tx.orderSyncLog.create({
        data: {
          action: 'modify',
          externalId: externalId || null,
          companyName: order.company.companyName,
          payload: JSON.stringify({ ...patchBody, changedFields: mergedModified }),
          result: 'modified',
        },
      });
    });

    return NextResponse.json({ success: true, changedFields });
  } catch (e) {
    console.error(e);
    alertServerError('PATCH /api/orders', e).catch(() => {});
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  const orders = await prisma.order.findMany({
    where: companyId ? { companyId: Number(companyId) } : {},
    include: { company: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(orders);
}
