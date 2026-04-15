import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTokenFromRequest } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { getDayRange, parseUTCDate } from '@/lib/dateUtils';
import * as XLSX from 'xlsx';

interface AssignSettings {
  no_duplicate_days: number;
  daily_assign_per_id: number;
  rest_after_assign: number;
  server_daily_limit: number;
  one_server_per_company: boolean;
}

async function getSettings(): Promise<AssignSettings> {
  const settings = await prisma.systemSetting.findMany();
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    no_duplicate_days: parseInt(map['no_duplicate_days'] || '7'),
    daily_assign_per_id: parseInt(map['daily_assign_per_id'] || '5'),
    rest_after_assign: parseInt(map['rest_after_assign'] || '3'),
    server_daily_limit: parseInt(map['server_daily_limit'] || '100'),
    one_server_per_company: map['one_server_per_company'] === 'true',
  };
}

// GET: Get work items for a date (after assignment)
export async function GET(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: '날짜를 입력하세요.' }, { status: 400 });

  const { start: d, end: next } = getDayRange(date);

  const workItems = await prisma.workItem.findMany({
    where: { workDate: { gte: d, lt: next } },
    include: {
      schedule: { include: { company: true } },
      account: true,
    },
    orderBy: [{ server: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json(workItems);
}

// POST: Run assignment for a date
export async function POST(req: NextRequest) {
  const session = await getTokenFromRequest(req);
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { date, serverCount } = await req.json();
  if (!date) return NextResponse.json({ error: '날짜를 입력하세요.' }, { status: 400 });

  const settings = await getSettings();
  const { start: dayStart, end: dayEnd } = getDayRange(date);
  const workDate = parseUTCDate(date);
  const workDateStr = date;

  // Delete existing work items for this date (re-run) — atomic with create below

  // Get schedules for this date
  const schedules = await prisma.schedule.findMany({
    where: { scheduledDate: { gte: dayStart, lt: dayEnd } },
    include: { company: true, order: true },
    orderBy: [{ companyId: 'asc' }, { id: 'asc' }],
  });

  if (schedules.length === 0) {
    return NextResponse.json({ message: '해당 날짜에 배정할 스케줄이 없습니다.', count: 0 });
  }

  // Get all active accounts
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ error: '사용 가능한 아이디가 없습니다.' }, { status: 400 });
  }

  // Get recent work history for "no_duplicate_days" constraint
  const historyStart = new Date(date);
  historyStart.setDate(historyStart.getDate() - settings.no_duplicate_days);

  const recentWork = await prisma.workItem.findMany({
    where: {
      workDate: { gte: historyStart, lt: dayStart },
      accountId: { not: null },
    },
    include: { schedule: true },
    orderBy: { workDate: 'desc' },
  });

  // Build lookup: accountId -> [companyId] (within duplicate window)
  const accountCompanyHistory = new Map<number, Set<number>>();
  for (const w of recentWork) {
    if (!w.accountId) continue;
    if (!accountCompanyHistory.has(w.accountId)) {
      accountCompanyHistory.set(w.accountId, new Set());
    }
    accountCompanyHistory.get(w.accountId)!.add(w.schedule.companyId);
  }

  // Today's work counts per account
  const todayAccountCount = new Map<number, number>();
  // Today's work counts per server
  const todayServerCount = new Map<string, number>();
  // Recent assign counts for rest calculation
  const recentAssignCount = new Map<number, number>();
  // Last assigned count per account (to avoid same count twice in a row)
  const lastAssignCount = new Map<number, number>();

  // Count recent assigns per account (for rest calculation) — reuse recentWork
  for (const w of recentWork) {
    if (!w.accountId) continue;
    const cur = recentAssignCount.get(w.accountId) || 0;
    recentAssignCount.set(w.accountId, cur + 1);
  }

  // Company -> server history (for one_server_per_company) — reuse recentWork
  const companyServerHistory = new Map<number, string>();
  if (settings.one_server_per_company) {
    for (const w of recentWork) {
      if (w.server && !companyServerHistory.has(w.schedule.companyId)) {
        companyServerHistory.set(w.schedule.companyId, w.server);
      }
    }
  }

  // Group accounts by server
  const serverGroups = new Map<string, typeof accounts>();
  for (const acc of accounts) {
    if (!serverGroups.has(acc.server)) serverGroups.set(acc.server, []);
    serverGroups.get(acc.server)!.push(acc);
  }

  // 배정 서버 수 제한: serverCount 입력 시 이름순 정렬 후 상위 N개만 사용
  if (serverCount && serverCount > 0) {
    const sortedServers = Array.from(serverGroups.keys()).sort();
    const limitedServers = new Set(sortedServers.slice(0, serverCount));
    for (const srv of Array.from(serverGroups.keys())) {
      if (!limitedServers.has(srv)) serverGroups.delete(srv);
    }
  }

  // 오늘 배정 중 업체별 서버 고정 (one_server_per_company 용)
  const companyTodayServer = new Map<number, string>();

  // 업체코드: 접수 어드민 order_code(externalId) 사용. 없으면 날짜+순번 폴백
  const datePrefix = date.replace(/-/g, '');
  let codeSeq = 1;
  const genCode = (externalId?: string | null) => externalId || `${datePrefix}-${String(codeSeq++).padStart(3, '0')}`;

  const workItems: Array<{
    companyCode: string;
    scheduleId: number;
    accountId: number | null;
    server: string | null;
    workDate: Date;
  }> = [];

  // Assign each schedule
  for (const schedule of schedules) {
    const companyId = schedule.companyId;
    let assignedAccount = null;
    let assignedServer = null;

    // 신규접수 / 비활성 / 수정확인 업체는 배정 제외
    if (schedule.company.status === '신규접수' || !schedule.company.isActive || schedule.company.promptUpdateRequired) {
      workItems.push({ companyCode: genCode(schedule.order?.externalId), scheduleId: schedule.id, accountId: null, server: null, workDate: workDate });
      continue;
    }

    // Determine server candidates
    let serverCandidates = Array.from(serverGroups.keys());

    if (settings.one_server_per_company) {
      const todayServer = companyTodayServer.get(companyId);
      if (todayServer) {
        // 오늘 이미 배정된 서버가 있으면 같은 서버 강제 사용
        serverCandidates = serverGroups.has(todayServer) ? [todayServer] : serverCandidates;
      } else {
        // 이전 날짜 이력에서 사용한 서버 제외
        const prevServer = companyServerHistory.get(companyId);
        if (prevServer) {
          serverCandidates = serverCandidates.filter((s) => s !== prevServer);
          if (serverCandidates.length === 0) serverCandidates = Array.from(serverGroups.keys());
        }
      }
    }

    // Filter servers by daily limit
    serverCandidates = serverCandidates.filter(
      (s) => (todayServerCount.get(s) || 0) < settings.server_daily_limit
    );

    if (serverCandidates.length === 0) {
      // All servers at limit - skip
      workItems.push({ companyCode: genCode(schedule.order?.externalId), scheduleId: schedule.id, accountId: null, server: null, workDate: workDate });
      continue;
    }

    // Pick server (least loaded first)
    serverCandidates.sort((a, b) => (todayServerCount.get(a) || 0) - (todayServerCount.get(b) || 0));
    const selectedServer = serverCandidates[0];
    const serverAccounts = serverGroups.get(selectedServer) || [];

    // Find eligible account in server
    let eligible = serverAccounts.filter((acc) => {
      // Check duplicate company constraint
      const history = accountCompanyHistory.get(acc.id);
      if (history && history.has(companyId)) return false;

      // Check today's count
      const todayCount = todayAccountCount.get(acc.id) || 0;
      if (todayCount >= settings.daily_assign_per_id) return false;

      // Check rest constraint
      const assignCount = recentAssignCount.get(acc.id) || 0;
      if (settings.rest_after_assign > 0 && assignCount > 0) {
        if (assignCount % settings.rest_after_assign === 0) return false;
      }

      return true;
    });

    if (eligible.length === 0) {
      // Relax rest constraint
      eligible = serverAccounts.filter((acc) => {
        const history = accountCompanyHistory.get(acc.id);
        if (history && history.has(companyId)) return false;
        const todayCount = todayAccountCount.get(acc.id) || 0;
        if (todayCount >= settings.daily_assign_per_id) return false;
        return true;
      });
    }

    if (eligible.length === 0) {
      workItems.push({ companyCode: genCode(schedule.order?.externalId), scheduleId: schedule.id, accountId: null, server: selectedServer, workDate: workDate });
      continue;
    }

    // Random count within 0 ~ daily_assign_per_id for this account pick
    // Sort by today usage (fewest first), then pick randomly among tied
    eligible.sort((a, b) => (todayAccountCount.get(a.id) || 0) - (todayAccountCount.get(b.id) || 0));

    // Pick from first group (least used today), avoid same last assign count
    const minCount = todayAccountCount.get(eligible[0].id) || 0;
    const sameMinGroup = eligible.filter((a) => (todayAccountCount.get(a.id) || 0) === minCount);

    // Among same min, filter out those where lastAssignCount was same
    const filtered = sameMinGroup.filter((a) => {
      const last = lastAssignCount.get(a.id);
      return last === undefined || last !== minCount + 1;
    });

    const pool = filtered.length > 0 ? filtered : sameMinGroup;
    const pick = pool[Math.floor(Math.random() * pool.length)];

    assignedAccount = pick;
    assignedServer = selectedServer;

    // Update counters
    todayAccountCount.set(pick.id, (todayAccountCount.get(pick.id) || 0) + 1);
    todayServerCount.set(selectedServer, (todayServerCount.get(selectedServer) || 0) + 1);
    lastAssignCount.set(pick.id, todayAccountCount.get(pick.id)!);

    // Add to company/account history
    if (!accountCompanyHistory.has(pick.id)) accountCompanyHistory.set(pick.id, new Set());
    accountCompanyHistory.get(pick.id)!.add(companyId);

    // 오늘 배정 서버 기록 (같은 날 동일 업체는 같은 서버 고정)
    if (settings.one_server_per_company && assignedServer) {
      companyTodayServer.set(companyId, assignedServer);
    }

    workItems.push({
      companyCode: genCode(schedule.order?.externalId),
      scheduleId: schedule.id,
      accountId: assignedAccount?.id || null,
      server: assignedServer,
      workDate: workDate,
    });
  }

  // Bulk delete existing + create new — atomic transaction
  await prisma.$transaction([
    prisma.workItem.deleteMany({ where: { workDate: { gte: dayStart, lt: dayEnd } } }),
    prisma.workItem.createMany({ data: workItems }),
  ]);

  await createAuditLog(
    session.userId,
    'RUN_ASSIGNMENT',
    workDateStr,
    `${workItems.length}개 배정 완료`
  );

  // Return result grouped by server
  const result = await prisma.workItem.findMany({
    where: { workDate: { gte: dayStart, lt: dayEnd } },
    include: {
      schedule: { include: { company: true } },
      account: true,
    },
    orderBy: [{ server: 'asc' }, { id: 'asc' }],
  });

  const byServer = new Map<string, typeof result>();
  for (const item of result) {
    const srv = item.server || '미배정';
    if (!byServer.has(srv)) byServer.set(srv, []);
    byServer.get(srv)!.push(item);
  }

  return NextResponse.json({
    date,
    total: result.length,
    assigned: result.filter((r) => r.accountId).length,
    unassigned: result.filter((r) => !r.accountId).length,
    byServer: Object.fromEntries(byServer),
    items: result,
  });
}
