import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { getDayRange } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';

function buildRow(item: {
  companyCode: string | null;
  account: { accountId: string; password: string; ip: string | null } | null;
  schedule: {
    company: {
      companyName: string;
      prompt: string | null;
      paragraphCount: string;
      subTopic: string;
      introPath: string | null;
      companyParagraphImage: string | null;
      randomSticker: string;
      location: string | null;
      mapPosition: string;
      tag: string | null;
    };
  };
}, idx: number) {
  const c = item.schedule.company;
  return {
    'NO': idx + 1,
    '아이디': item.account?.accountId || '미배정',
    '패스워드': item.account?.password || '',
    'IP': item.account?.ip || '',
    '업체명': c.companyName,
    '업체별 프롬프트': c.prompt || '',
    '문단갯수': c.paragraphCount,
    '소주제': c.subTopic,
    '인트로경로': c.introPath || '',
    '업체문단이미지': c.companyParagraphImage || '',
    '랜덤스티커': c.randomSticker,
    '장소': c.location || '',
    '지도위치': c.mapPosition,
    '태그': c.tag || '',
    '업체코드': item.companyCode || '',
  };
}

const COL_WIDTHS = [
  { wch: 5 },  // NO
  { wch: 22 }, // 아이디
  { wch: 16 }, // 패스워드
  { wch: 16 }, // IP
  { wch: 22 }, // 업체명
  { wch: 30 }, // 프롬프트
  { wch: 8 },  // 문단갯수
  { wch: 8 },  // 소주제
  { wch: 20 }, // 인트로경로
  { wch: 20 }, // 업체문단이미지
  { wch: 10 }, // 랜덤스티커
  { wch: 16 }, // 장소
  { wch: 10 }, // 지도위치
  { wch: 24 }, // 태그
  { wch: 14 }, // 업체코드
];

export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { date, server, allServers } = await req.json();
  if (!date) return NextResponse.json({ error: '날짜를 입력하세요.' }, { status: 400 });

  const { start: dayStart, end: dayEnd } = getDayRange(date);

  const where = {
    workDate: { gte: dayStart, lt: dayEnd },
    ...(server && !allServers ? { server } : {}),
  };

  const workItems = await prisma.workItem.findMany({
    where,
    select: {
      companyCode: true,
      server: true,
      schedule: {
        select: {
          company: {
            select: {
              companyName: true,
              prompt: true,
              paragraphCount: true,
              subTopic: true,
              introPath: true,
              companyParagraphImage: true,
              randomSticker: true,
              location: true,
              mapPosition: true,
              tag: true,
            },
          },
        },
      },
      account: {
        select: { accountId: true, password: true, ip: true },
      },
    },
    orderBy: [{ server: 'asc' }, { id: 'asc' }],
  });

  if (workItems.length === 0) {
    return NextResponse.json({ error: '다운로드할 데이터가 없습니다.' }, { status: 400 });
  }

  const wb = XLSX.utils.book_new();

  if (allServers) {
    const servers = new Map<string, typeof workItems>();
    for (const item of workItems) {
      const srv = item.server || '미배정';
      if (!servers.has(srv)) servers.set(srv, []);
      servers.get(srv)!.push(item);
    }

    for (const [srv, items] of servers) {
      const sheetData = items.map((item, idx) => buildRow(item, idx));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      ws['!cols'] = COL_WIDTHS;
      XLSX.utils.book_append_sheet(wb, ws, srv.substring(0, 31));
    }
  } else {
    const sheetData = workItems.map((item, idx) => buildRow(item, idx));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws['!cols'] = COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, server || '전체');
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = allServers
    ? `스케줄_${date}_전체서버`
    : `스케줄_${date}_${server}`;

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`,
    },
  });
}
