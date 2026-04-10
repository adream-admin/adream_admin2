'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface Account {
  id: number;
  server: string;
  ip: string | null;
  accountId: string;
  password: string;
  category: string | null;
  createdAt: string;
  name: string | null;
  birthDate: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
}

const emptyForm: Partial<Account> = {
  server: '', ip: '', accountId: '', password: '', category: '',
  name: '', birthDate: '', gender: '', phone: '', email: '', note: '',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [form, setForm] = useState<Partial<Account>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    const res = await fetch(`/api/accounts?search=${encodeURIComponent(search)}`);
    if (res.ok) setAccounts(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, [search]);

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === accounts.length) setSelected(new Set());
    else setSelected(new Set(accounts.map((a) => a.id)));
  };

  const handleExcelDownload = async (all = false) => {
    const ids = all ? [] : Array.from(selected);
    if (!all && ids.length === 0) return toast.error('다운로드할 항목을 선택하세요.');
    const res = await fetch('/api/accounts/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return toast.error('다운로드에 실패했습니다.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '아이디리스트.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTemplateDownload = async () => {
    const res = await fetch('/api/accounts/template');
    if (!res.ok) return toast.error('다운로드에 실패했습니다.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '아이디리스트_업로드양식.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/accounts', { method: 'POST', body: fd });
    const data = await res.json();
    if (res.ok) { toast.success(`${data.count}개 업로드 완료`); fetchAccounts(); }
    else toast.error(data.error || '업로드 실패');
    e.target.value = '';
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (a: Account) => {
    setEditTarget(a);
    setForm({ ...a });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.accountId || !form.server) return toast.error('서버와 아이디는 필수입니다.');
    setSaving(true);
    try {
      const url = editTarget ? `/api/accounts/${editTarget.id}` : '/api/accounts';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(editTarget ? '수정되었습니다.' : '추가되었습니다.');
      setShowModal(false);
      fetchAccounts();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); fetchAccounts(); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">아이디 리스트</h1>
          <p className="text-sm text-gray-500 mt-1">총 {accounts.length}개</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExcelDownload(false)} className="btn-secondary text-sm">선택 다운로드</button>
          <button onClick={() => handleExcelDownload(true)} className="btn-secondary text-sm">일괄 다운로드</button>
          <button onClick={handleTemplateDownload} className="btn-secondary text-sm">업로드 양식</button>
          <button onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">엑셀 업로드</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
          <button onClick={openCreate} className="btn-primary text-sm">+ 추가</button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input-field max-w-xs"
          placeholder="아이디, 이름, 서버 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr>
              <th className="table-header">
                <input type="checkbox" checked={selected.size === accounts.length && accounts.length > 0} onChange={toggleAll} />
              </th>
              <th className="table-header">NO</th>
              <th className="table-header">배정서버</th>
              <th className="table-header">IP</th>
              <th className="table-header">ID</th>
              <th className="table-header">PW</th>
              <th className="table-header">구분</th>
              <th className="table-header">생성일자</th>
              <th className="table-header">이름</th>
              <th className="table-header">생년월일</th>
              <th className="table-header">성별</th>
              <th className="table-header">전화번호</th>
              <th className="table-header">이메일</th>
              <th className="table-header">비고</th>
              <th className="table-header">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="table-cell text-center text-gray-400">불러오는 중...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={15} className="table-cell text-center text-gray-400">등록된 아이디가 없습니다.</td></tr>
            ) : accounts.map((a, i) => (
              <tr key={a.id} className={`hover:bg-gray-50 ${selected.has(a.id) ? 'bg-blue-50' : ''}`}>
                <td className="table-cell text-center"><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                <td className="table-cell text-center">{i + 1}</td>
                <td className="table-cell"><span className="badge bg-blue-100 text-blue-700">{a.server}</span></td>
                <td className="table-cell font-mono text-gray-500">{a.ip || '-'}</td>
                <td className="table-cell font-mono font-medium">{a.accountId}</td>
                <td className="table-cell font-mono text-gray-500">{a.password}</td>
                <td className="table-cell">{a.category || '-'}</td>
                <td className="table-cell text-gray-400">{new Date(a.createdAt).toLocaleDateString('ko-KR')}</td>
                <td className="table-cell">{a.name || '-'}</td>
                <td className="table-cell">{a.birthDate || '-'}</td>
                <td className="table-cell">{a.gender || '-'}</td>
                <td className="table-cell">{a.phone || '-'}</td>
                <td className="table-cell">{a.email || '-'}</td>
                <td className="table-cell max-w-32 truncate">{a.note || '-'}</td>
                <td className="table-cell">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(a)} className="text-blue-600 hover:underline">수정</button>
                    <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:underline">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editTarget ? '아이디 수정' : '아이디 추가'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['배정서버', 'server', true], ['IP', 'ip', false],
                ['ID', 'accountId', true], ['PW', 'password', true],
                ['구분', 'category', false], ['이름', 'name', false],
                ['생년월일', 'birthDate', false], ['성별', 'gender', false],
                ['전화번호', 'phone', false], ['이메일', 'email', false],
                ['비고', 'note', false],
              ] as [string, keyof Account, boolean][]).map(([label, key, req]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label}{req && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    className="input-field"
                    value={String(form[key] ?? '')}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
