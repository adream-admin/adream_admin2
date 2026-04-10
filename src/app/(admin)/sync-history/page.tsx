'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SyncLog {
  id: number;
  action: string;
  externalId: string | null;
  companyName: string | null;
  payload: string;
  result: string | null;
  createdAt: string;
}

const ACTION_TABS = [
  { key: 'new',    label: '신규주문',  color: 'blue' },
  { key: 'modify', label: '수정요청',  color: 'orange' },
  { key: 'stop',   label: '중단요청',  color: 'red' },
] as const;

const RESULT_LABEL: Record<string, { text: string; cls: string }> = {
  created:   { text: '생성',   cls: 'bg-green-100 text-green-700' },
  duplicate: { text: '중복',   cls: 'bg-yellow-100 text-yellow-700' },
  skipped:   { text: '중복',   cls: 'bg-yellow-100 text-yellow-700' },
  modified:  { text: '수정',   cls: 'bg-orange-100 text-orange-700' },
  stopped:   { text: '중단',   cls: 'bg-red-100 text-red-600' },
};

const FIELD_LABEL: Record<string, string> = {
  companyName: '업체명', placeAddress: '플레이스주소', midValue: 'MID값',
  contentType: '글의종류', mainKeyword: '메인키워드', keyword: '키워드',
  tag: '태그', companyGuide: '업체가이드',
};

const PAGE_SIZE = 50;

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;

  // 최대 7개 페이지 번호 표시
  const getPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  return (
    <div className="flex justify-center items-center gap-1 mt-4">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
      >
        ◀
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(Number(p))}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              page === p
                ? 'bg-blue-600 border-blue-600 text-white font-medium'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
      >
        ▶
      </button>
    </div>
  );
}

export default function SyncHistoryPage() {
  const [tab, setTab] = useState<'new' | 'modify' | 'stop'>('new');
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchLogs = useCallback(async (action: string, p: number) => {
    setLoading(true);
    setSelected(new Set());
    const res = await fetch(`/api/sync-history?action=${action}&page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setPage(1);
    fetchLogs(tab, 1);
  }, [tab, fetchLogs]);

  useEffect(() => {
    fetchLogs(tab, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const parsePayload = (raw: string): Record<string, unknown> => {
    try { return JSON.parse(raw); } catch { return {}; }
  };

  const allOnPage = logs.map(l => l.id);
  const allSelected = allOnPage.length > 0 && allOnPage.every(id => selected.has(id));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) allOnPage.forEach(id => next.delete(id));
      else allOnPage.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteItems = async (body: object, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    const res = await fetch('/api/sync-history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`${data.deleted}건 삭제되었습니다.`);
      fetchLogs(tab, page);
    } else {
      alert('삭제 실패');
    }
    setDeleting(false);
  };

  const handleDeleteSelected = () =>
    deleteItems(
      { ids: Array.from(selected) },
      `선택한 ${selected.size}건을 삭제하시겠습니까?`
    );

  const handleDeleteAll = () =>
    deleteItems(
      { all: true, action: tab },
      `현재 탭의 전체 ${total}건을 삭제하시겠습니까?\n(되돌릴 수 없습니다)`
    );

  const handleDeleteOne = (id: number) =>
    deleteItems({ ids: [id] }, '이 항목을 삭제하시겠습니까?');

  const colSpan = tab === 'new' ? 9 : tab === 'modify' ? 8 : 7;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주문 수집 이력</h1>
          <p className="text-sm text-gray-500 mt-1">접수 어드민에서 수신한 신규주문 · 수정요청 · 중단요청 이력</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDeleteSelected}
            disabled={selected.size === 0 || deleting}
            className="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
          >
            선택 삭제 ({selected.size})
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={total === 0 || deleting}
            className="px-3 py-1.5 text-sm rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-40 transition-colors"
          >
            전체 삭제 ({total})
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {ACTION_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? t.color === 'blue'   ? 'border-blue-600 text-blue-600'
                : t.color === 'orange' ? 'border-orange-500 text-orange-600'
                :                        'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {tab === t.key && total > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({total})</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className="table-header w-10">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              </th>
              <th className="table-header w-12">NO</th>
              <th className="table-header">수신일시</th>
              <th className="table-header">업체코드</th>
              <th className="table-header">업체명</th>
              {tab === 'new' && <>
                <th className="table-header">접수처</th>
                <th className="table-header">시작일</th>
                <th className="table-header">종료일</th>
                <th className="table-header">일발행건수</th>
              </>}
              {tab === 'modify' && <>
                <th className="table-header">수정된 항목</th>
                <th className="table-header">일발행건수</th>
                <th className="table-header">종료일</th>
              </>}
              {tab === 'stop' && <>
                <th className="table-header">중단요청일</th>
                <th className="table-header">삭제된 스케줄</th>
              </>}
              <th className="table-header">결과</th>
              <th className="table-header w-14">삭제</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan + 2} className="table-cell text-center text-gray-400 py-8">불러오는 중...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={colSpan + 2} className="table-cell text-center text-gray-400 py-8">이력이 없습니다.</td></tr>
            ) : logs.map((log, i) => {
              const p = parsePayload(log.payload);
              const resultInfo = RESULT_LABEL[log.result || ''] ?? { text: log.result || '-', cls: 'bg-gray-100 text-gray-500' };
              const isChecked = selected.has(log.id);
              return (
                <tr key={log.id} className={isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="table-cell text-center">
                    <input type="checkbox" checked={isChecked} onChange={() => toggleOne(log.id)} className="rounded" />
                  </td>
                  <td className="table-cell text-center text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="table-cell text-gray-500 whitespace-nowrap">
                    {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                  </td>
                  <td className="table-cell font-mono text-gray-600">{log.externalId || '-'}</td>
                  <td className="table-cell font-medium">{log.companyName || String(p.companyName || '-')}</td>

                  {tab === 'new' && <>
                    <td className="table-cell text-gray-500">{String(p.receiptSource || '-')}</td>
                    <td className="table-cell text-gray-500">{String(p.startDate || '-')}</td>
                    <td className="table-cell text-gray-500">{String(p.endDate || '-')}</td>
                    <td className="table-cell text-center">{String(p.dailyCount || '-')}</td>
                  </>}

                  {tab === 'modify' && <>
                    <td className="table-cell">
                      {Array.isArray(p.changedFields) && p.changedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(p.changedFields as string[]).map((f) => (
                            <span key={f} className="badge bg-orange-100 text-orange-700">
                              {FIELD_LABEL[f] ?? f}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-gray-400">일정 변경만</span>}
                    </td>
                    <td className="table-cell text-center">{String(p.dailyCount || '-')}</td>
                    <td className="table-cell text-gray-500">{String(p.endDate || '-')}</td>
                  </>}

                  {tab === 'stop' && <>
                    <td className="table-cell text-gray-500">{String(p.stopDate || '-')}</td>
                    <td className="table-cell text-center">{String(p.deletedSchedules ?? '-')}</td>
                  </>}

                  <td className="table-cell text-center">
                    <span className={`badge ${resultInfo.cls}`}>{resultInfo.text}</span>
                  </td>
                  <td className="table-cell text-center">
                    <button
                      onClick={() => handleDeleteOne(log.id)}
                      disabled={deleting}
                      className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-40 transition-colors"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} onChange={(p) => setPage(p)} />
    </div>
  );
}
