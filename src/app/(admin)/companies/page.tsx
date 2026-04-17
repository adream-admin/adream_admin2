'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Company {
  id: number;
  receiptSource: string | null;
  businessName: string | null;
  companyName: string;
  placeAddress: string | null;
  midValue: string | null;
  contentType: string | null;
  manuscriptPhoto: string | null;
  mainKeyword: string | null;
  keyword: string | null;
  tag: string | null;
  companyGuide: string | null;
  prompt: string | null;
  paragraphCount: string;
  subTopic: string;
  introPath: string | null;
  companyParagraphImage: string | null;
  randomSticker: string;
  location: string | null;
  mapPosition: string;
  isActive: boolean;
  status: string;
  promptUpdateRequired: boolean;
  modifiedFields: string | null;
  createdAt: string;
}

const emptyForm: Partial<Company> = {
  receiptSource: '',
  businessName: '',
  companyName: '',
  placeAddress: '',
  midValue: '',
  contentType: '',
  manuscriptPhoto: '',
  mainKeyword: '',
  keyword: '',
  tag: '',
  companyGuide: '',
  prompt: '',
  paragraphCount: '4',
  subTopic: 'ON',
  introPath: '',
  companyParagraphImage: '',
  randomSticker: 'ON',
  location: '',
  mapPosition: '하단',
};

const FORM_FIELDS: Array<{ key: keyof Company; label: string; auto: boolean; required?: boolean; default?: string; textarea?: boolean }> = [
  { key: 'receiptSource',         label: '업체코드',         auto: true,  required: true },
  { key: 'businessName',          label: '사업자명',         auto: true },
  { key: 'companyName',           label: '업체명',           auto: true,  required: true },
  { key: 'placeAddress',          label: '플레이스주소',     auto: true,  required: true },
  { key: 'midValue',              label: 'MID 값',           auto: true,  required: true },
  { key: 'contentType',           label: '글의 종류',        auto: true,  required: true },
  { key: 'manuscriptPhoto',       label: '원고 사진',        auto: true,  required: true },
  { key: 'mainKeyword',           label: '메인 키워드',      auto: true,  required: true },
  { key: 'keyword',               label: '키워드',           auto: true },
  { key: 'tag',                   label: '태그',             auto: true,  required: true },
  { key: 'companyGuide',          label: '업체가이드',       auto: true,  textarea: true },
  { key: 'prompt',                label: '프롬프트',         auto: false, required: true, textarea: true },
  { key: 'paragraphCount',        label: '문단갯수',         auto: false, required: true, default: '4' },
  { key: 'subTopic',              label: '소주제',           auto: false, required: true, default: 'ON' },
  { key: 'introPath',             label: '인트로 경로',      auto: false, required: true },
  { key: 'companyParagraphImage', label: '업체 문단이미지',  auto: false, required: true, textarea: true },
  { key: 'randomSticker',         label: '랜덤스티커',       auto: false, required: true, default: 'ON' },
  { key: 'location',              label: '장소',             auto: false, required: true },
  { key: 'mapPosition',           label: '지도위치',         auto: false, required: true, default: '하단' },
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modifyFilter, setModifyFilter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [form, setForm] = useState<Partial<Company>>(emptyForm);
  const [saving, setSaving] = useState(false);

  // 수정확인 대상 필드 세트 (팝업에서 빨간 음영 표시용)
  const modifiedSet = new Set<string>(
    editTarget?.modifiedFields ? JSON.parse(editTarget.modifiedFields) : []
  );

  const fetchCompanies = async () => {
    setLoading(true);
    const params = new URLSearchParams({ search });
    if (modifyFilter) params.set('promptUpdateRequired', 'true');
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/companies?${params}`);
    if (res.ok) setCompanies(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, [search, statusFilter, modifyFilter]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (c: Company) => {
    setEditTarget(c);
    setForm({ ...c });
    setShowModal(true);
  };

  const handleSave = async () => {
    const missingFields = FORM_FIELDS.filter(
      (f) => f.required && !String(form[f.key] ?? '').trim()
    );
    if (missingFields.length > 0) {
      return toast.error(`필수 항목을 입력해주세요: ${missingFields.map((f) => f.label).join(', ')}`);
    }
    setSaving(true);
    try {
      const url = editTarget ? `/api/companies/${editTarget.id}` : '/api/companies';
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
      fetchCompanies();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('업체를 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('삭제되었습니다.'); fetchCompanies(); }
  };

  const val = (c: Company, key: keyof Company) => {
    const v = c[key];
    return v !== null && v !== undefined && v !== '' ? String(v) : '-';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">업체 리스트</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">총 {companies.length}개</span>
            <span className="badge bg-yellow-100 text-yellow-700">
              신규접수 {companies.filter(c => c.status === '신규접수').length}
            </span>
            <span className="badge bg-green-100 text-green-700">
              완료 {companies.filter(c => c.status === '완료').length}
            </span>
            {companies.filter(c => c.promptUpdateRequired).length > 0 && (
              <span className="badge bg-orange-100 text-orange-700">
                수정확인 {companies.filter(c => c.promptUpdateRequired).length}
              </span>
            )}
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">+ 업체 추가</button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          className="input-field max-w-xs"
          placeholder="업체명, 접수처, 키워드 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setStatusFilter(statusFilter === '신규접수' ? '' : '신규접수')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            statusFilter === '신규접수'
              ? 'bg-yellow-500 text-white border-yellow-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-yellow-400 hover:text-yellow-600'
          }`}
        >
          신규접수
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === '완료' ? '' : '완료')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            statusFilter === '완료'
              ? 'bg-green-500 text-white border-green-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:text-green-600'
          }`}
        >
          완료
        </button>
        <button
          onClick={() => setModifyFilter(!modifyFilter)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            modifyFilter
              ? 'bg-orange-500 text-white border-orange-500'
              : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600'
          }`}
        >
          수정확인
        </button>
      </div>

      <div className="card p-0 overflow-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-gray-50">
              <th className="table-header">NO</th>
              <th className="table-header">
                업체코드<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                사업자명<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                업체명<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                플레이스주소<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                MID 값<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                글의 종류<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">
                메인 키워드<span className="ml-1 text-blue-400 font-normal text-[10px]">자동</span>
              </th>
              <th className="table-header">상태</th>
              <th className="table-header">프롬프트</th>
              <th className="table-header">문단갯수</th>
              <th className="table-header">소주제</th>
              <th className="table-header">랜덤스티커</th>
              <th className="table-header">지도위치</th>
              <th className="table-header">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="table-cell text-center text-gray-400">불러오는 중...</td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={15} className="table-cell text-center text-gray-400">등록된 업체가 없습니다.</td></tr>
            ) : companies.map((c, i) => (
              <tr key={c.id} className={`hover:bg-gray-50 ${c.promptUpdateRequired ? 'bg-orange-50' : ''}`}>
                <td className="table-cell text-center text-gray-400">{i + 1}</td>
                <td className="table-cell font-mono text-gray-500">{val(c, 'receiptSource')}</td>
                <td className="table-cell text-gray-500">{val(c, 'businessName')}</td>
                <td className="table-cell font-medium">
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.companyName}
                    {c.promptUpdateRequired && (
                      <span className="badge bg-orange-100 text-orange-700 text-[10px]">수정확인</span>
                    )}
                  </div>
                </td>
                <td className="table-cell text-gray-500 max-w-40 truncate">{val(c, 'placeAddress')}</td>
                <td className="table-cell font-mono text-gray-500">{val(c, 'midValue')}</td>
                <td className="table-cell">{val(c, 'contentType')}</td>
                <td className="table-cell max-w-32 truncate">{val(c, 'mainKeyword')}</td>
                <td className="table-cell text-center">
                  <span className={`badge ${c.status === '완료' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="table-cell text-center">
                  {c.prompt
                    ? <span className="badge bg-blue-100 text-blue-700">입력됨</span>
                    : <span className="badge bg-gray-100 text-gray-400">미입력</span>
                  }
                </td>
                <td className="table-cell text-center">
                  <span className="badge bg-gray-100 text-gray-700">{c.paragraphCount}</span>
                </td>
                <td className="table-cell text-center">
                  <span className={`badge ${c.subTopic === 'ON' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.subTopic}</span>
                </td>
                <td className="table-cell text-center">
                  <span className={`badge ${c.randomSticker === 'ON' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.randomSticker}</span>
                </td>
                <td className="table-cell text-center">{c.mapPosition}</td>
                <td className="table-cell">
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline">수정</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{editTarget ? '업체 수정' : '업체 추가'}</h2>
                {editTarget?.promptUpdateRequired && (
                  <span className="badge bg-orange-100 text-orange-700">수정확인 — 변경 항목 확인 후 저장하세요</span>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* API 자동 입력 구역 */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-blue-100 text-blue-700">API 자동 입력</span>
                <span className="text-xs text-gray-400">접수 어드민 연동 시 자동 입력됩니다</span>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-lg p-4">
                {FORM_FIELDS.filter((f) => f.auto).map((field) => {
                  const isModified = modifiedSet.has(field.key);
                  return (
                    <div key={field.key} className={field.textarea ? 'col-span-2' : ''}>
                      <label className={`block text-xs font-medium mb-1 ${isModified ? 'text-red-600' : 'text-gray-600'}`}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        {isModified && <span className="ml-1 text-red-500 font-semibold">● 수정됨</span>}
                      </label>
                      {field.textarea ? (
                        <textarea
                          className={`input-field text-xs h-16 resize-none ${isModified ? 'border-red-400 bg-red-50 ring-1 ring-red-300' : ''}`}
                          value={String(form[field.key] ?? '')}
                          onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        />
                      ) : (
                        <input
                          className={`input-field text-xs ${isModified ? 'border-red-400 bg-red-50 ring-1 ring-red-300' : ''}`}
                          value={String(form[field.key] ?? '')}
                          onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 직접 입력 구역 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-gray-100 text-gray-700">직접 입력</span>
                <span className="text-xs text-red-500">* 입력 후 저장하면 완료로 변경됩니다</span>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                {FORM_FIELDS.filter((f) => !f.auto).map((field) => (
                  <div key={field.key} className={field.textarea ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      {field.default && <span className="text-gray-400 ml-1">(기본: {field.default})</span>}
                      {field.key === 'companyParagraphImage' && (
                        <span className="text-gray-400 ml-1">(ALT+ENTER로 줄바꿈)</span>
                      )}
                    </label>
                    {field.textarea ? (
                      <textarea
                        className="input-field text-xs h-20 resize-none"
                        value={String(form[field.key] ?? '')}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        onKeyDown={field.key === 'companyParagraphImage' ? (e) => {
                          if (e.altKey && e.key === 'Enter') {
                            e.preventDefault();
                            const el = e.currentTarget;
                            const start = el.selectionStart;
                            const end = el.selectionEnd;
                            const v = String(form[field.key] ?? '');
                            const newVal = v.substring(0, start) + '\n' + v.substring(end);
                            setForm({ ...form, [field.key]: newVal });
                            setTimeout(() => { el.selectionStart = el.selectionEnd = start + 1; }, 0);
                          }
                        } : undefined}
                      />
                    ) : (
                      <input
                        className="input-field text-xs"
                        value={String(form[field.key] ?? '')}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
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
