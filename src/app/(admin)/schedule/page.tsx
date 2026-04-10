'use client';

import { useEffect, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Schedule {
  id: number;
  scheduledDate: string;
  status: string;
  company: {
    id: number;
    companyName: string;
    placeAddress: string | null;
    mainKeyword: string | null;
    receiptSource: string | null;
  };
  order: { externalId: string | null } | null;
  workItems: Array<{
    id: number;
    companyCode: string | null;
    server: string | null;
    account: { accountId: string } | null;
  }>;
}

interface DayGroup {
  date: Date;
  total: number;
  assigned: number;
  companies: Array<{
    companyId: number;
    companyName: string;
    placeAddress: string | null;
    mainKeyword: string | null;
    receiptSource: string | null;
    orderExternalId: string | null;
    count: number;
    assignedCount: number;
    scheduleIds: number[];
  }>;
}

export default function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null); // companyId
  const [companySearch, setCompanySearch] = useState('');

  const fetchSchedules = async (month: Date) => {
    setLoading(true);
    const start = format(startOfMonth(month), 'yyyy-MM-dd');
    const end = format(endOfMonth(month), 'yyyy-MM-dd');
    const res = await fetch(`/api/schedules?startDate=${start}&endDate=${end}`);
    if (res.ok) setSchedules(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(currentMonth); }, [currentMonth]);

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
  });

  // Build DayGroup for a given day
  const getDayGroup = (day: Date): DayGroup => {
    const daySchedules = schedules.filter((s) => isSameDay(new Date(s.scheduledDate), day));

    // Group by company
    const companyMap = new Map<number, {
      companyName: string;
      placeAddress: string | null;
      mainKeyword: string | null;
      receiptSource: string | null;
      orderExternalId: string | null;
      count: number;
      assignedCount: number;
      scheduleIds: number[];
    }>();

    for (const s of daySchedules) {
      const existing = companyMap.get(s.company.id);
      const wi = s.workItems[0];
      const assigned = wi?.account ? 1 : 0;
      if (existing) {
        existing.count++;
        existing.assignedCount += assigned;
        existing.scheduleIds.push(s.id);
      } else {
        companyMap.set(s.company.id, {
          companyName: s.company.companyName,
          placeAddress: s.company.placeAddress,
          mainKeyword: s.company.mainKeyword,
          receiptSource: s.company.receiptSource,
          orderExternalId: s.order?.externalId ?? null,
          count: 1,
          assignedCount: assigned,
          scheduleIds: [s.id],
        });
      }
    }

    return {
      date: day,
      total: daySchedules.length,
      assigned: daySchedules.filter((s) => s.workItems[0]?.account).length,
      companies: Array.from(companyMap.entries()).map(([companyId, v]) => ({ companyId, ...v })),
    };
  };

  const selectedGroup = selectedDate ? getDayGroup(selectedDate) : null;

  const handleCancelAssign = async (companyId: number, scheduleIds: number[], companyName: string) => {
    if (!confirm(`[${companyName}] 배정을 취소하시겠습니까?\n아이디 배정이 해제되며 스케줄은 유지됩니다.`)) return;
    setActionLoading(companyId);
    try {
      const res = await fetch('/api/schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleIds }),
      });
      if (!res.ok) return toast.error('배정 취소에 실패했습니다.');
      toast.success(`[${companyName}] 배정 취소 완료`);
      await fetchSchedules(currentMonth);
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (companyId: number, scheduleIds: number[], companyName: string) => {
    if (!confirm(`[${companyName}] 스케줄을 삭제하시겠습니까?\n해당 날짜의 스케줄과 배정 정보가 완전히 삭제됩니다.`)) return;
    setActionLoading(companyId);
    try {
      const res = await fetch('/api/schedules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleIds }),
      });
      if (!res.ok) return toast.error('삭제에 실패했습니다.');
      toast.success(`[${companyName}] 스케줄 삭제 완료`);
      await fetchSchedules(currentMonth);
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">발행 일정표</h1>
          <p className="text-sm text-gray-500 mt-1">일자별 스케줄 배정 현황</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary px-3">◀</button>
          <span className="text-lg font-semibold w-32 text-center">
            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary px-3">▶</button>
          <button onClick={() => setCurrentMonth(new Date())} className="btn-secondary text-sm">오늘</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-semibold py-2.5 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {daysInMonth.map((day, idx) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const group = getDayGroup(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                const dayOfWeek = day.getDay();
                const hasSchedules = group.total > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'hover:bg-gray-50'
                    } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    {/* Date number */}
                    <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${
                      isToday ? 'bg-blue-600 text-white' :
                      dayOfWeek === 0 ? 'text-red-500' :
                      dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                    }`}>
                      {format(day, 'd')}
                    </div>

                    {/* Total count badge */}
                    {hasSchedules && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white">
                          {group.total}건
                        </span>
                        {group.assigned > 0 && group.assigned < group.total && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-green-100 text-green-700">
                            배정 {group.assigned}
                          </span>
                        )}
                        {group.assigned === group.total && group.total > 0 && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] bg-green-500 text-white">
                            완료
                          </span>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="card overflow-hidden flex flex-col">
          {selectedGroup && selectedDate ? (
            <>
              {/* Header */}
              <div className="pb-3 border-b border-gray-100 mb-3">
                <h2 className="text-base font-semibold text-gray-900">
                  {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
                </h2>
                <div className="flex gap-2 mt-1.5">
                  <span className="badge bg-blue-100 text-blue-700">총 {selectedGroup.total}건</span>
                  {selectedGroup.assigned > 0 && (
                    <span className="badge bg-green-100 text-green-700">배정 {selectedGroup.assigned}건</span>
                  )}
                  {selectedGroup.total - selectedGroup.assigned > 0 && (
                    <span className="badge bg-red-100 text-red-600">
                      미배정 {selectedGroup.total - selectedGroup.assigned}건
                    </span>
                  )}
                </div>
                <input
                  className="input-field text-xs mt-2 w-full"
                  placeholder="업체명 검색..."
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
              </div>

              {/* Company list */}
              {selectedGroup.total === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">이 날에 배정된 스케줄이 없습니다.</p>
              ) : (
                <div className="space-y-2 overflow-y-auto flex-1">
                  {selectedGroup.companies.filter((c) =>
                    c.companyName.includes(companySearch)
                  ).map((c) => (
                    <div key={c.companyId} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 leading-tight">{c.companyName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {c.receiptSource && (
                              <span className="text-[10px] text-gray-400">{c.receiptSource}</span>
                            )}
                            {c.orderExternalId && (
                              <span className="badge bg-gray-100 text-gray-500 font-mono text-[10px]">{c.orderExternalId}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="badge bg-blue-100 text-blue-700">{c.count}건</span>
                          {c.assignedCount === c.count ? (
                            <span className="badge bg-green-100 text-green-700">배정완료</span>
                          ) : c.assignedCount > 0 ? (
                            <span className="badge bg-yellow-100 text-yellow-700">부분배정</span>
                          ) : (
                            <span className="badge bg-gray-100 text-gray-500">미배정</span>
                          )}
                        </div>
                      </div>
                      {c.placeAddress && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{c.placeAddress}</p>
                      )}
                      {c.mainKeyword && (
                        <p className="text-xs text-blue-500 mt-0.5 truncate">🔑 {c.mainKeyword}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        일 발행 {c.count}건
                        {c.assignedCount > 0 && <span className="text-green-600"> · 배정 {c.assignedCount}건</span>}
                      </p>
                      {/* 액션 버튼 */}
                      <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-200">
                        {c.assignedCount > 0 && (
                          <button
                            onClick={() => handleCancelAssign(c.companyId, c.scheduleIds, c.companyName)}
                            disabled={actionLoading === c.companyId}
                            className="flex-1 text-xs px-2 py-1.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === c.companyId ? '처리 중...' : '배정 취소'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(c.companyId, c.scheduleIds, c.companyName)}
                          disabled={actionLoading === c.companyId}
                          className="flex-1 text-xs px-2 py-1.5 rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === c.companyId ? '처리 중...' : '삭제'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-sm">날짜를 클릭하면<br/>해당일 스케줄을 확인합니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
