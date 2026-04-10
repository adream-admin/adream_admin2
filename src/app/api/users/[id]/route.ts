import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const { id } = await params;
  const { name, role, password, isActive } = await req.json();
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({ where: { id: Number(id) }, data });
  await createAuditLog(session.userId, 'UPDATE_USER', `user:${id}`, JSON.stringify({ name, role, isActive }));

  return NextResponse.json({ id: user.id, name: user.name, role: user.role, isActive: user.isActive });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const { id } = await params;
  if (Number(id) === session.userId) {
    return NextResponse.json({ error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: Number(id) } });
  await createAuditLog(session.userId, 'DELETE_USER', `user:${id}`);

  return NextResponse.json({ ok: true });
}
