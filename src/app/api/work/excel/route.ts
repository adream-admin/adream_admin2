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
}, workDate: string) {
  const c = item.schedule.company;
  return {
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
    '날짜': workDate,           // N열
    '업체코드': item.companyCode || '', // O열
    '결과 URL': '',              // P열 공란
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    // allServers: 서버별로 합쳐서 CSV 1개 출력
    const shuffled = shuffleArray(workItems);
    const sheetData = shuffled.map((item) => buildRow(item, date));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  } else {
    const shuffled = shuffleArray(workItems);
    const sheetData = shuffled.map((item) => buildRow(item, date));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  }

  const csv = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  const filename = allServers
    ? `스케줄_${date}_전체서버`
    : `스케줄_${date}_${server}`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.csv`,
    },
  });
}
