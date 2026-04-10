import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  const data = await req.json();
  const account = await prisma.account.update({ where: { id: Number(id) }, data });
  await createAuditLog(session.userId, 'UPDATE_ACCOUNT', `account:${id}`);
  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { id } = await params;
  await prisma.account.update({ where: { id: Number(id) }, data: { isActive: false } });
  await createAuditLog(session.userId, 'DELETE_ACCOUNT', `account:${id}`);
  return NextResponse.json({ ok: true });
}
