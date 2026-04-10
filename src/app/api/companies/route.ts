import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const promptUpdateRequired = searchParams.get('promptUpdateRequired') === 'true';
  const statusFilter = searchParams.get('status') || '';

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(promptUpdateRequired ? { promptUpdateRequired: true } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? {
        OR: [
          { companyName: { contains: search } },
          { receiptSource: { contains: search } },
          { placeAddress: { contains: search } },
          { mainKeyword: { contains: search } },
        ]
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const data = await req.json();
  if (!data.companyName) {
    return NextResponse.json({ error: '업체명은 필수입니다.' }, { status: 400 });
  }

  const company = await prisma.company.create({ data });
  await createAuditLog(session.userId, 'CREATE_COMPANY', `company:${company.id}`, data.companyName);

  return NextResponse.json(company);
}
