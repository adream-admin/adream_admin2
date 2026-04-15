'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface WorkItem {
  id: number;
  companyCode: string | null;
  server: string | null;
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
  account: { accountId: string; password: string; ip: string | null; name: string | null } | null;
}

interface WorkResult {
  date: string;
  total: number;
  assigned: number;
  unassigned: number;
  byServer: Record<string, WorkItem[]>;
  items: WorkItem[];
}

export default function WorkPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [serverCount, setServerCount] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkResult | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleRun = async () => {
    if (!date) return toast.error('날짜를 입력하세요.');
    if (!confirm(`${date} 날짜로 아이디 배정을 실행하시겠습니까?\n\n이미 배정된 데이터가 있으면 초기화됩니다.`)) return;

    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, serverCount: serverCount || 0 }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || '배정에 실패했습니다.');
      setResult(data);
      toast.success(`배정 완료 (총 ${data.total}건, 배정 ${data.assigned}건)`);
    } catch {
      toast.error('서버 오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  };

  const handleLoad = async () => {
    if (!date) return toast.error('날짜를 입력하세요.');
    const res = await fetch(`/api/work?date=${date}`);
    if (!res.ok) return toast.error('불러오기에 실패했습니다.');
    const items: WorkItem[] = await res.json();

    if (items.length === 0) {
      toast('해당 날짜에 배정된 데이터가 없습니다.', { icon: 'ℹ️' });
      setResult(null);
      return;
    }

    const byServer = new Map<string, WorkItem[]>();
    for (const item of items) {
      const srv = item.server || '미배정';
      if (!byServer.has(srv)) byServer.set(srv, []);
      byServer.get(srv)!.push(item);
    }

    setResult({
      date,
      total: items.length,
      assigned: items.filter((i) => i.account).length,
      unassigned: items.filter((i) => !i.account).length,
      byServer: Object.fromEntries(byServer),
      items,
    });
  };

  const handleDownloadServer = async (server: string) => {
    setDownloading(server);
    try {
      const res = await fetch('/api/work/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: result!.date, server }),
      });
      if (!res.ok) {
        const d = await res.json();
        return toast.error(d.error || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `스케줄_${result!.date}_${server}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading('all');
    try {
      const servers = Object.keys(result!.byServer).sort();
      for (const srv of servers) {
        const res = await fetch('/api/work/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: result!.date, server: srv }),
        });
        if (!res.ok) {
          const d = await res.json();
          toast.error(`${srv} 다운로드 실패: ${d.error || '오류'}`);
          continue;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `스케줄_${result!.date}_${srv}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      toast.success('전체 다운로드 완료');
    } catch {
      toast.error('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">작업</h1>
        <p className="text-sm text-gray-500 mt-1">날짜를 지정하여 아이디 배정 후 엑셀 다운로드</p>
      </div>

      {/* Date input & action */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발행 날짜</label>
            <input
              type="date"
              className="input-field w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">배정 서버 수</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                className="input-field w-20 text-center"
                value={serverCount || ''}
                placeholder="전체"
                onChange={(e) => setServerCount(Number(e.target.value))}
              />
              <span className="text-sm text-gray-500">개</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">비워두면 전체 서버</p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary px-8"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> 배정 중...
              </span>
            ) : '⚙️ 작업 실행'}
          </button>
          <button onClick={handleLoad} className="btn-secondary">
            📋 기존 배정 불러오기
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-sm text-gray-500">전체</p>
              <p className="text-3xl font-bold text-gray-900">{result.total}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">배정완료</p>
              <p className="text-3xl font-bold text-green-600">{result.assigned}</p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-500">미배정</p>
              <p className="text-3xl font-bold text-red-500">{result.unassigned}</p>
            </div>
          </div>

          {/* Download buttons */}
          <div className="card mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">엑셀 다운로드:</span>
              {Object.keys(result.byServer).sort().map((srv) => (
                <button
                  key={srv}
                  onClick={() => handleDownloadServer(srv)}
                  disabled={!!downloading}
                  className="btn-secondary text-sm"
                >
                  {downloading === srv ? '⟳' : '📥'} {srv} ({result.byServer[srv].length}건)
                </button>
              ))}
              <button
                onClick={handleDownloadAll}
                disabled={!!downloading}
                className="btn-success text-sm"
              >
                {downloading === 'all' ? '⟳' : '📥'} 일괄 다운로드
              </button>
            </div>
          </div>

          {/* Per-server tables */}
          {Object.entries(result.byServer).sort().map(([srv, items]) => (
            <div key={srv} className="card mb-4 p-0 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                <span className="font-semibold text-gray-800">{srv}</span>
                <span className="badge bg-blue-100 text-blue-700">{items.length}건</span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr>
                      <th className="table-header">NO</th>
                      <th className="table-header">아이디</th>
                      <th className="table-header">패스워드</th>
                      <th className="table-header">IP</th>
                      <th className="table-header">업체명</th>
                      <th className="table-header">업체별 프롬프트</th>
                      <th className="table-header">문단갯수</th>
                      <th className="table-header">소주제</th>
                      <th className="table-header">인트로경로</th>
                      <th className="table-header">업체문단이미지</th>
                      <th className="table-header">랜덤스티커</th>
                      <th className="table-header">장소</th>
                      <th className="table-header">지도위치</th>
                      <th className="table-header">태그</th>
                      <th className="table-header">업체코드</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const c = item.schedule.company;
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50 ${!item.account ? 'bg-red-50' : ''}`}>
                          <td className="table-cell text-center">{idx + 1}</td>
                          <td className="table-cell font-mono">
                            {item.account
                              ? <span className="text-green-700">{item.account.accountId}</span>
                              : <span className="text-red-500">미배정</span>}
                          </td>
                          <td className="table-cell font-mono text-gray-500">{item.account?.password || '-'}</td>
                          <td className="table-cell font-mono text-gray-400">{item.account?.ip || '-'}</td>
                          <td className="table-cell font-medium">{c.companyName}</td>
                          <td className="table-cell text-gray-500 max-w-40 truncate">{c.prompt || '-'}</td>
                          <td className="table-cell text-center">{c.paragraphCount}</td>
                          <td className="table-cell text-center">
                            <span className={`badge ${c.subTopic === 'ON' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.subTopic}</span>
                          </td>
                          <td className="table-cell text-gray-500 max-w-32 truncate">{c.introPath || '-'}</td>
                          <td className="table-cell text-gray-500 max-w-32 truncate">{c.companyParagraphImage || '-'}</td>
                          <td className="table-cell text-center">
                            <span className={`badge ${c.randomSticker === 'ON' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.randomSticker}</span>
                          </td>
                          <td className="table-cell text-gray-500">{c.location || '-'}</td>
                          <td className="table-cell text-center">{c.mapPosition}</td>
                          <td className="table-cell text-gray-500 max-w-32 truncate">{c.tag || '-'}</td>
                          <td className="table-cell font-mono text-gray-400">{item.companyCode || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
