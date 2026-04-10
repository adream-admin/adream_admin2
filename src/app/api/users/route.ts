import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, username: true, name: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 });

  const { username, password, name, role } = await req.json();
  if (!username || !password || !name) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed, name, role: role || 'manager', createdBy: session.userId },
  });

  await createAuditLog(session.userId, 'CREATE_USER', `user:${user.id}`, `username: ${username}`);

  return NextResponse.json({ id: user.id, username: user.username, name: user.name, role: user.role });
}
