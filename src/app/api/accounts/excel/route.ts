import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { ids } = await req.json();

  const accounts = await prisma.account.findMany({
    where: ids?.length ? { id: { in: ids } } : { isActive: true },
    orderBy: { id: 'asc' },
  });

  const data = accounts.map((a, idx) => ({
    'NO': idx + 1,
    '배정서버': a.server,
    'IP': a.ip || '',
    'ID': a.accountId,
    'PW': a.password,
    '구분': a.category || '',
    '생성일자': a.createdAt.toISOString().split('T')[0],
    '이름': a.name || '',
    '생년월일': a.birthDate || '',
    '성별': a.gender || '',
    '전화번호': a.phone || '',
    '이메일': a.email || '',
    '비고': a.note || '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
    { wch: 14 }, { wch: 24 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '아이디리스트');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('아이디리스트')}.xlsx`,
    },
  });
}
