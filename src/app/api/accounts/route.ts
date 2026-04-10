import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const server = searchParams.get('server') || '';

  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      ...(search ? {
        OR: [
          { accountId: { contains: search } },
          { name: { contains: search } },
          { server: { contains: search } },
        ]
      } : {}),
      ...(server ? { server } : {}),
    },
    orderBy: { id: 'asc' },
  });

  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  // Excel bulk upload
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
    }
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as string[][];

    let count = 0;
    let skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[3]) continue; // ID column required
      const accountId = String(row[3] || '');
      const password = String(row[4] || '');

      // 중복 체크: server + accountId 조합 (같은 서버에 동일 아이디 중복 방지)
      const server = String(row[1] || '');
      const existing = await prisma.account.findFirst({
        where: { server, accountId },
      });
      if (existing) { skipped++; continue; }

      await prisma.account.create({
        data: {
          server,
          ip: String(row[2] || ''),
          accountId,
          password,
          category: String(row[5] || ''),
          name: String(row[7] || ''),
          birthDate: String(row[8] || ''),
          gender: String(row[9] || ''),
          phone: String(row[10] || ''),
          email: String(row[11] || ''),
          note: String(row[12] || ''),
        },
      });
      count++;
    }

    await createAuditLog(session.userId, 'BULK_UPLOAD_ACCOUNTS', undefined, `${count}개 업로드, ${skipped}개 중복 건너뜀`);
    return NextResponse.json({ count, skipped });
  }

  // Single create
  const data = await req.json();
  if (!data.accountId || !data.server) {
    return NextResponse.json({ error: '서버와 아이디는 필수입니다.' }, { status: 400 });
  }

  const account = await prisma.account.create({ data });
  await createAuditLog(session.userId, 'CREATE_ACCOUNT', `account:${account.id}`, data.accountId);

  return NextResponse.json(account);
}
