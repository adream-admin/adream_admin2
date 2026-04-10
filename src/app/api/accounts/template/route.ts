import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const headers = [
    'NO', '배정서버', 'IP', 'ID', 'PW', '구분', '생성일자',
    '이름', '생년월일', '성별', '전화번호', '이메일', '비고',
  ];

  const example = [
    1, 'server1', '192.168.0.1', 'example_id', 'example_pw', '일반', '',
    '홍길동', '1990-01-01', '남', '010-0000-0000', 'example@email.com', '비고내용',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  ws['!cols'] = [
    { wch: 5 },  // NO
    { wch: 12 }, // 배정서버
    { wch: 16 }, // IP
    { wch: 20 }, // ID
    { wch: 16 }, // PW
    { wch: 10 }, // 구분
    { wch: 12 }, // 생성일자
    { wch: 10 }, // 이름
    { wch: 12 }, // 생년월일
    { wch: 8 },  // 성별
    { wch: 14 }, // 전화번호
    { wch: 24 }, // 이메일
    { wch: 20 }, // 비고
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '아이디리스트');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('아이디리스트_업로드양식')}.xlsx`,
    },
  });
}
