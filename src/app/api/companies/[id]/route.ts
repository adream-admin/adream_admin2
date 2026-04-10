import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  // 직접 입력 항목(prompt)이 입력되면 자동으로 완료 처리
  if (data.prompt && String(data.prompt).trim() !== '') {
    data.status = '완료';
  }

  // 저장 시 수정확인 플래그 및 수정 필드 목록 초기화
  data.promptUpdateRequired = false;
  data.modifiedFields = null;

  const company = await prisma.company.update({ where: { id: Number(id) }, data });
  await createAuditLog(session.userId, 'UPDATE_COMPANY', `company:${id}`);
  return NextResponse.json(company);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const companyId = Number(id);

  // 관련 스케줄 ID 수집
  const schedules = await prisma.schedule.findMany({
    where: { companyId },
    select: { id: true },
  });
  const scheduleIds = schedules.map((s) => s.id);

  // 트랜잭션으로 완전 삭제: WorkItem → Schedule → Order → Company
  await prisma.$transaction([
    prisma.workItem.deleteMany({ where: { scheduleId: { in: scheduleIds } } }),
    prisma.schedule.deleteMany({ where: { companyId } }),
    prisma.order.deleteMany({ where: { companyId } }),
    prisma.company.delete({ where: { id: companyId } }),
  ]);

  await createAuditLog(session.userId, 'DELETE_COMPANY', `company:${id}`);
  return NextResponse.json({ ok: true });
}
