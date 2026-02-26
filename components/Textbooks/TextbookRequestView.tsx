import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useTextbookRequests, TextbookRequest } from '../../hooks/useTextbookRequests';
import { useStudents } from '../../hooks/useStudents';
import { useTeachers } from '../../hooks/useFirebaseQueries';
import { TextbookCatalogItem } from '../../data/textbookCatalog';
import { TextbookPreviewCard, TextbookRequestData } from './TextbookPreviewCard';
import TextbookBookSelector from './TextbookBookSelector';
import { toPng } from 'html-to-image';
import Search from 'lucide-react/dist/esm/icons/search';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Download from 'lucide-react/dist/esm/icons/download';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import User from 'lucide-react/dist/esm/icons/user';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import Chrome from 'lucide-react/dist/esm/icons/chrome';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import { getTodayKST } from '../../utils/dateUtils';

// ===== Types =====

type SubTab = 'create' | 'history';
type HistoryFilter = 'incomplete' | 'complete';

interface FormData {
  studentName: string;
  teacherName: string;
  requestDate: string;
  bookName: string;
  bookDetail: string;
  price: number;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

// ===== Constants =====

const PAGE_SIZE = 20;

const TODAY = getTodayKST();

const EMPTY_FORM: FormData = {
  studentName: '',
  teacherName: '',
  requestDate: TODAY,
  bookName: '',
  bookDetail: '',
  price: 0,
  bankName: '',
  accountHolder: '',
  accountNumber: '',
};

// ===== Helpers =====

const formatShortDate = (isoString: string): string => {
  const date = new Date(isoString);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};

const formatFullDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const isIncomplete = (r: TextbookRequest): boolean =>
  !r.isCompleted || !r.isPaid || !r.isOrdered;

const isFullyComplete = (r: TextbookRequest): boolean =>
  !!r.isCompleted && !!r.isPaid && !!r.isOrdered;

// ===== Sub-components =====

interface FormSectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

const FormSectionHeader: React.FC<FormSectionHeaderProps> = ({ icon, title, action }) => (
  <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
    <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
      {icon}
      <span>{title}</span>
    </div>
    {action}
  </div>
);

interface LabeledInputProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const LabeledInput: React.FC<LabeledInputProps> = ({ label, children, className }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    {children}
  </div>
);

const inputCls =
  'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

// ===== Autocomplete Input =====

interface AutocompleteOption {
  label: string;
  sub?: string;
  value: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  options: AutocompleteOption[];
  placeholder: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ value, onChange, onSelect, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return [];
    const q = value.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.sub && o.sub.toLowerCase().includes(q))).slice(0, 8);
  }, [value, options]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto">
          {filtered.map((o, i) => (
            <li
              key={i}
              className="px-2.5 py-1.5 text-xs hover:bg-blue-50 cursor-pointer flex items-center justify-between"
              onMouseDown={() => { onSelect(o); setOpen(false); }}
            >
              <span className="font-medium">{o.label}</span>
              {o.sub && <span className="text-gray-400 text-[10px]">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ===== Status Checkbox =====

interface StatusCheckboxProps {
  label: string;
  checked: boolean;
  timestamp?: string;
  color: 'green' | 'blue' | 'orange';
  disabled: boolean;
  onChange: (v: boolean) => void;
}

const COLOR_MAP: Record<string, { checked: string; unchecked: string; text: string }> = {
  green: {
    checked: 'bg-emerald-500 border-emerald-500',
    unchecked: 'bg-white border-gray-300',
    text: 'text-emerald-600',
  },
  blue: {
    checked: 'bg-blue-500 border-blue-500',
    unchecked: 'bg-white border-gray-300',
    text: 'text-blue-600',
  },
  orange: {
    checked: 'bg-orange-500 border-orange-500',
    unchecked: 'bg-white border-gray-300',
    text: 'text-orange-600',
  },
};

const StatusCheckbox: React.FC<StatusCheckboxProps> = ({
  label,
  checked,
  timestamp,
  color,
  disabled,
  onChange,
}) => {
  const c = COLOR_MAP[color];
  return (
    <label
      className={`flex flex-col items-center gap-0.5 select-none ${disabled ? 'cursor-default' : 'cursor-pointer group'}`}
      title={timestamp ? `${label}: ${formatFullDate(timestamp)}` : `${label} 대기`}
    >
      <div className="flex items-center gap-1">
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            checked ? c.checked : c.unchecked
          }`}
        >
          {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
        </div>
        {!disabled && (
          <input
            type="checkbox"
            className="hidden"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
        )}
        <span className={`text-xs font-medium ${checked ? c.text : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 h-3">
        {timestamp ? formatShortDate(timestamp) : ''}
      </span>
    </label>
  );
};

// ===== Pagination =====

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, total, onPage }) => {
  if (totalPages <= 1) return null;

  const pageNumbers = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i + 1;
    if (page <= 4) return i + 1;
    if (page >= totalPages - 3) return totalPages - 6 + i;
    return page - 3 + i;
  });

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
      <span className="text-[11px] text-gray-500">
        총 {total.toLocaleString()}건 중{' '}
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}건
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`min-w-[24px] h-6 text-xs rounded ${
              page === n ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 text-gray-600'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

// ===== Main Component =====

interface TextbookRequestViewProps {
  isAdmin?: boolean;
  initialTab?: SubTab;
  onRequestCreated?: () => void;
}

export default function TextbookRequestView({ isAdmin = false, initialTab, onRequestCreated }: TextbookRequestViewProps) {
  const { requests, requestsLoading, accountSettings, catalog, createRequest, updateRequest, deleteRequest, copyToBillings, saveAccountSettings } =
    useTextbookRequests();

  const effectiveAdmin = isAdmin;

  // Sub-tab은 상위 TextbooksTab에서 제어 (initialTab prop으로 결정)
  const subTab: SubTab = initialTab || 'create';

  // 학생/선생님 자동완성용 데이터
  const { students = [] } = useStudents(false, subTab === 'create');
  const { data: teachers = [] } = useTeachers(subTab === 'create');

  const studentOptions = useMemo<AutocompleteOption[]>(() =>
    students.map(s => ({
      label: s.name,
      sub: [s.grade, s.school].filter(Boolean).join(' · '),
      value: s.id,
    })),
    [students]
  );

  const subjectKo: Record<string, string> = { math: '수학', english: '영어', science: '과학', korean: '국어' };
  const teacherOptions = useMemo<AutocompleteOption[]>(() =>
    teachers.map((t: any) => ({
      label: t.name,
      sub: t.subjects?.map((s: string) => subjectKo[s] || s).join(', ') || '',
      value: t.id,
    })),
    [teachers]
  );

  // Account settings panel (admin only)
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    bankName: accountSettings.bankName,
    accountNumber: accountSettings.accountNumber,
    accountHolder: accountSettings.accountHolder,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm({
      bankName: accountSettings.bankName,
      accountNumber: accountSettings.accountNumber,
      accountHolder: accountSettings.accountHolder,
    });
  }, [accountSettings]);

  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      await saveAccountSettings.mutateAsync(settingsForm);
      setShowSettings(false);
    } catch (err) {
      console.error('saveAccountSettings failed:', err);
      alert('계좌 설정 저장에 실패했습니다.');
    }
    setIsSavingSettings(false);
  }, [settingsForm, saveAccountSettings]);

  // Create form state
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Auto-populate account fields from accountSettings on mount
  useEffect(() => {
    if (accountSettings.bankName || accountSettings.accountNumber || accountSettings.accountHolder) {
      setForm((prev) => ({
        ...prev,
        bankName: prev.bankName || accountSettings.bankName,
        accountHolder: prev.accountHolder || accountSettings.accountHolder,
        accountNumber: prev.accountNumber || accountSettings.accountNumber,
      }));
    }
  }, [accountSettings]);

  // History state
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('incomplete');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // ===== Create Tab Handlers =====

  const handleFormChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target;
      setForm((prev) => ({
        ...prev,
        [name]: type === 'number' ? Number(value) : value,
      }));
    },
    []
  );

  const handleBookSelect = useCallback((item: TextbookCatalogItem) => {
    let bookName = item.name;
    let bookDetail = '';

    // Pattern: "XX. description" — split on first " NN." where NN is digits
    const splitMatch = bookName.match(/\s(\d{2}\..*)/);
    if (splitMatch && typeof splitMatch.index === 'number') {
      bookDetail = splitMatch[1];
      bookName = item.name.substring(0, splitMatch.index);
    }

    setForm((prev) => ({
      ...prev,
      bookName,
      bookDetail,
      price: item.price,
    }));
    setIsBookSelectorOpen(false);
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm('입력한 내용을 모두 초기화하시겠습니까?')) {
      setForm({
        ...EMPTY_FORM,
        requestDate: getTodayKST(),
        bankName: accountSettings.bankName,
        accountHolder: accountSettings.accountHolder,
        accountNumber: accountSettings.accountNumber,
      });
    }
  }, [accountSettings]);

  const handleSaveAndDownload = useCallback(async () => {
    if (!previewRef.current) return;

    if (!form.studentName.trim() || !form.bookName.trim()) {
      alert('학생 이름과 교재명은 필수입니다.');
      return;
    }

    setIsSaving(true);
    let dataUrl = '';
    try {
      dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2 });
    } catch (err) {
      console.error('Image generation failed:', err);
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
      setIsSaving(false);
      return;
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `${form.requestDate}_${form.studentName}_${form.bookName}.png`;
    link.href = dataUrl;
    link.click();

    // Save to Firestore
    try {
      await createRequest.mutateAsync({
        studentName: form.studentName,
        teacherName: form.teacherName,
        requestDate: form.requestDate,
        bookName: form.bookName,
        ...(form.bookDetail ? { bookDetail: form.bookDetail } : {}),
        price: form.price,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        accountHolder: form.accountHolder,
      });
      alert('이미지가 다운로드되고 요청 내역이 저장되었습니다.');
      onRequestCreated?.();
    } catch (err) {
      console.error('Firestore save failed:', err);
      alert('서버 저장에 실패했습니다. (이미지는 다운로드되었습니다)');
    } finally {
      setIsSaving(false);
    }
  }, [form, createRequest]);

  const previewData: TextbookRequestData = {
    studentName: form.studentName,
    teacherName: form.teacherName,
    requestDate: form.requestDate,
    bookName: form.bookName,
    bookDetail: form.bookDetail || undefined,
    price: form.price,
    bankName: form.bankName,
    accountNumber: form.accountNumber,
    accountHolder: form.accountHolder,
  };

  // ===== History Tab Logic =====

  const filteredRequests = useMemo(() => {
    const term = historySearch.toLowerCase();
    return requests.filter((r) => {
      const matchesFilter =
        historyFilter === 'incomplete' ? isIncomplete(r) : isFullyComplete(r);
      if (!matchesFilter) return false;
      if (!term) return true;
      return (
        r.studentName.toLowerCase().includes(term) ||
        r.bookName.toLowerCase().includes(term)
      );
    });
  }, [requests, historyFilter, historySearch]);

  const incompleteCount = useMemo(
    () => requests.filter(isIncomplete).length,
    [requests]
  );
  const completeCount = useMemo(
    () => requests.filter(isFullyComplete).length,
    [requests]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));

  const pagedRequests = useMemo(
    () => filteredRequests.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE),
    [filteredRequests, historyPage]
  );

  // Reset to page 1 when filter/search changes
  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilter, historySearch]);

  const handleHistoryFilterChange = useCallback((f: HistoryFilter) => {
    setHistoryFilter(f);
  }, []);

  const handleUpdateStatus = useCallback(
    (id: string, updates: Partial<TextbookRequest>) => {
      updateRequest.mutate({ id, updates });
    },
    [updateRequest]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('이 요청서를 삭제하시겠습니까?')) {
        deleteRequest.mutate(id);
      }
    },
    [deleteRequest]
  );

  // 완료된 요청 → 수납 내역 복사
  const uncopiedCompleteCount = useMemo(
    () => requests.filter(r => isFullyComplete(r) && !r.copiedToBilling).length,
    [requests]
  );

  const [isCopying, setIsCopying] = useState(false);
  const handleCopyToBillings = useCallback(async () => {
    const targets = requests.filter(r => isFullyComplete(r) && !r.copiedToBilling);
    if (targets.length === 0) {
      alert('복사할 새로운 완료 건이 없습니다.');
      return;
    }
    if (!window.confirm(`완료된 요청 ${targets.length}건을 수납 내역으로 복사하시겠습니까?\n(원본 데이터는 유지됩니다)`)) return;
    setIsCopying(true);
    try {
      const result = await copyToBillings.mutateAsync(targets);
      alert(`수납 내역 복사 완료!\n신규 복사: ${result.copied}건${result.skipped > 0 ? `\n이미 존재: ${result.skipped}건` : ''}`);
    } catch (err) {
      console.error('copyToBillings failed:', err);
      alert('수납 내역 복사에 실패했습니다.');
    }
    setIsCopying(false);
  }, [requests, copyToBillings]);

  // 요청 내역에서 이미지 재다운로드
  const historyPreviewRef = useRef<HTMLDivElement>(null);
  const [downloadTarget, setDownloadTarget] = useState<TextbookRequest | null>(null);

  useEffect(() => {
    if (!downloadTarget || !historyPreviewRef.current) return;
    const el = historyPreviewRef.current;
    // 렌더링 완료 후 캡처
    const timer = setTimeout(async () => {
      try {
        const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `${downloadTarget.requestDate}_${downloadTarget.studentName}_${downloadTarget.bookName}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Image download failed:', err);
        alert('이미지 생성에 실패했습니다.');
      }
      setDownloadTarget(null);
    }, 200);
    return () => clearTimeout(timer);
  }, [downloadTarget]);

  // ===== Render =====

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ===== 작성하기 Tab ===== */}
      {subTab === 'create' && (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left Panel: Form */}
          <div className="w-full md:w-1/3 bg-white border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto p-4 space-y-5 shrink-0">
            {/* Section 1: 기본 정보 */}
            <div>
              <FormSectionHeader
                icon={<User size={14} />}
                title="기본 정보"
                action={effectiveAdmin ? (
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-1 rounded transition-colors ${showSettings ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    title="계좌 설정"
                  >
                    <Settings size={14} />
                  </button>
                ) : undefined}
              />
              {/* Admin Settings Panel */}
              {showSettings && effectiveAdmin && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-700">기본 계좌 설정</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isSavingSettings ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        저장
                      </button>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledInput label="은행명">
                      <input
                        type="text"
                        value={settingsForm.bankName}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, bankName: e.target.value }))}
                        placeholder="은행명"
                        className={inputCls}
                      />
                    </LabeledInput>
                    <LabeledInput label="예금주">
                      <input
                        type="text"
                        value={settingsForm.accountHolder}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, accountHolder: e.target.value }))}
                        placeholder="예금주"
                        className={inputCls}
                      />
                    </LabeledInput>
                  </div>
                  <LabeledInput label="계좌번호">
                    <input
                      type="text"
                      value={settingsForm.accountNumber}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="계좌번호"
                      className={inputCls}
                    />
                  </LabeledInput>
                  <p className="text-[10px] text-blue-500">* 저장하면 새 요청서 작성시 자동으로 입력됩니다.</p>
                </div>
              )}

              <div className="space-y-3">
                <LabeledInput label="학생 이름">
                  <AutocompleteInput
                    value={form.studentName}
                    onChange={(v) => setForm(prev => ({ ...prev, studentName: v }))}
                    onSelect={(o) => setForm(prev => ({ ...prev, studentName: o.label }))}
                    options={studentOptions}
                    placeholder="학생 이름을 입력하세요"
                  />
                </LabeledInput>
                <LabeledInput label="담임 선생님">
                  <AutocompleteInput
                    value={form.teacherName}
                    onChange={(v) => setForm(prev => ({ ...prev, teacherName: v }))}
                    onSelect={(o) => setForm(prev => ({ ...prev, teacherName: o.label }))}
                    options={teacherOptions}
                    placeholder="선생님 성함을 입력하세요"
                  />
                </LabeledInput>
                <LabeledInput label="요청 일자">
                  <input
                    type="date"
                    name="requestDate"
                    value={form.requestDate}
                    onChange={handleFormChange}
                    className={inputCls}
                  />
                </LabeledInput>
              </div>
            </div>

            {/* Section 2: 교재 내용 */}
            <div>
              <FormSectionHeader
                icon={<BookOpen size={14} />}
                title="교재 내용"
                action={
                  <button
                    onClick={() => setIsBookSelectorOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Search size={11} />
                    교재 검색
                  </button>
                }
              />
              <div className="space-y-3">
                <LabeledInput label="교재명 (과목/난이도)">
                  <input
                    type="text"
                    name="bookName"
                    value={form.bookName}
                    onChange={handleFormChange}
                    placeholder="교재명을 입력하세요"
                    className={inputCls}
                  />
                </LabeledInput>
                <LabeledInput label="상세 내용 (단원)">
                  <input
                    type="text"
                    name="bookDetail"
                    value={form.bookDetail}
                    onChange={handleFormChange}
                    placeholder="상세 내용을 입력하세요 (선택)"
                    className={inputCls}
                  />
                </LabeledInput>
                <LabeledInput label="금액 (원)">
                  <input
                    type="number"
                    name="price"
                    value={form.price === 0 ? '' : form.price}
                    onChange={handleFormChange}
                    placeholder="금액을 입력하세요"
                    min={0}
                    className={inputCls}
                  />
                </LabeledInput>
              </div>
            </div>

            {/* Section 3: 계좌 정보 */}
            <div>
              <FormSectionHeader
                icon={<CreditCard size={14} />}
                title="계좌 정보"
              />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <LabeledInput label="은행명">
                    <input
                      type="text"
                      name="bankName"
                      value={form.bankName}
                      onChange={handleFormChange}
                      placeholder="은행명"
                      className={inputCls}
                    />
                  </LabeledInput>
                  <LabeledInput label="예금주">
                    <input
                      type="text"
                      name="accountHolder"
                      value={form.accountHolder}
                      onChange={handleFormChange}
                      placeholder="예금주"
                      className={inputCls}
                    />
                  </LabeledInput>
                </div>
                <LabeledInput label="계좌번호">
                  <input
                    type="text"
                    name="accountNumber"
                    value={form.accountNumber}
                    onChange={handleFormChange}
                    placeholder="계좌번호를 입력하세요"
                    className={inputCls}
                  />
                </LabeledInput>
              </div>
            </div>
          </div>

          {/* Right Panel: Preview */}
          <div className="flex-1 bg-gray-100 overflow-y-auto flex flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-2xl">
              {/* Action bar */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-600">미리보기</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                  >
                    <RotateCcw size={12} />
                    초기화
                  </button>
                  <button
                    onClick={handleSaveAndDownload}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        이미지 저장 및 기록
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Preview card */}
              <div className="shadow-2xl rounded overflow-hidden origin-top scale-95 md:scale-100 transition-transform">
                <TextbookPreviewCard ref={previewRef} data={previewData} />
              </div>

              <p className="text-[11px] text-gray-400 mt-6 text-center space-y-0.5">
                <span className="block">
                  * &apos;이미지 저장 및 기록&apos; 버튼을 누르면 이미지가 다운로드되고 이력에 저장됩니다.
                </span>
                <span className="block">
                  * 입력한 내용은 자동으로 미리보기에 반영됩니다.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== 요청 이력 Tab ===== */}
      {subTab === 'history' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 space-y-4">
            {/* Chrome Extension Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                  <Chrome size={16} className="shrink-0" />
                  <span>메이크에듀 연동이 필요하신가요?</span>
                </div>
                <div className="flex items-center gap-3 sm:ml-auto">
                  <a
                    href="/makeedu-sync-extension.zip"
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shrink-0"
                  >
                    <Download size={12} />
                    확장 프로그램 다운로드
                  </a>
                </div>
              </div>
              <div className="text-[11px] text-blue-700 space-y-0.5 border-t border-blue-200 pt-2">
                <p className="font-semibold text-blue-800 mb-1">설치 및 사용 방법:</p>
                <p>1. 위 버튼을 눌러 ZIP 파일을 다운로드한 후 압축을 해제합니다.</p>
                <p>2. Chrome 주소창에 <span className="font-mono bg-blue-100 px-1 rounded">chrome://extensions</span> 입력 → 우측 상단 <span className="font-semibold">개발자 모드</span> 활성화</p>
                <p>3. <span className="font-semibold">압축 해제된 확장 프로그램을 로드합니다</span> 클릭 → 압축 해제한 폴더 선택</p>
                <p>4. 메이크에듀 사이트에 로그인 → 확장 프로그램 아이콘 클릭 → <span className="font-semibold">교재 수납 데이터 동기화</span></p>
                <p className="text-blue-500 mt-1">* 동기화된 데이터는 아래 목록에 자동으로 반영됩니다.</p>
              </div>
            </div>

            {/* Tab filter + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleHistoryFilterChange('incomplete')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    historyFilter === 'incomplete'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  미완료
                  {incompleteCount > 0 && (
                    <span className="ml-1.5 bg-white/25 px-1.5 py-0.5 rounded-full text-[11px]">
                      {incompleteCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleHistoryFilterChange('complete')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    historyFilter === 'complete'
                      ? 'bg-gray-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  완료
                  {completeCount > 0 && (
                    <span className="ml-1.5 bg-white/25 px-1.5 py-0.5 rounded-full text-[11px]">
                      {completeCount}
                    </span>
                  )}
                </button>
                {effectiveAdmin && historyFilter === 'complete' && (
                  <button
                    onClick={handleCopyToBillings}
                    disabled={isCopying || uncopiedCompleteCount === 0}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isCopying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    수납 내역으로 복사
                    {uncopiedCompleteCount > 0 && (
                      <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-[11px]">
                        {uncopiedCompleteCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
              <div className="relative sm:ml-auto sm:w-64">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="학생명, 교재명 검색..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Table */}
            {requestsLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                로딩 중...
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <FileText size={40} className="mb-3 opacity-30" />
                <p className="text-sm">
                  {historyFilter === 'incomplete'
                    ? '미완료 요청서가 없습니다.'
                    : '완료된 요청서가 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">학생명</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">담임</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">교재명</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">금액</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">등록</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">납부</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">주문</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">요청일</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">저장</th>
                        {effectiveAdmin && (
                          <th className="px-3 py-2 text-center font-medium text-gray-600">삭제</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagedRequests.map((r) => {
                        const done = isFullyComplete(r);
                        return (
                          <tr
                            key={r.id}
                            className={`hover:bg-gray-50 transition-colors ${
                              done ? 'text-gray-400' : 'text-gray-800'
                            }`}
                          >
                            <td className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                              {r.studentName}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500 whitespace-nowrap">
                              {r.teacherName}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center">
                                <span className={done ? 'line-through decoration-gray-400' : ''}>
                                  {r.bookName}
                                </span>
                                {r.bookDetail && (
                                  <span className="text-[10px] text-gray-400 mt-0.5">
                                    {r.bookDetail}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap font-medium">
                              {r.price.toLocaleString()}원
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusCheckbox
                                label="등록"
                                checked={!!r.isCompleted}
                                timestamp={r.completedAt}
                                color="green"
                                disabled={!effectiveAdmin}
                                onChange={(v) =>
                                  handleUpdateStatus(r.id, { isCompleted: v })
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusCheckbox
                                label="납부"
                                checked={!!r.isPaid}
                                timestamp={r.paidAt}
                                color="blue"
                                disabled={!effectiveAdmin}
                                onChange={(v) =>
                                  handleUpdateStatus(r.id, { isPaid: v })
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StatusCheckbox
                                label="주문"
                                checked={!!r.isOrdered}
                                timestamp={r.orderedAt}
                                color="orange"
                                disabled={!effectiveAdmin}
                                onChange={(v) =>
                                  handleUpdateStatus(r.id, { isOrdered: v })
                                }
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                {r.requestDate}
                                {r.copiedToBilling && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-600">수납</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button
                                onClick={() => setDownloadTarget(r)}
                                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="이미지 다운로드"
                              >
                                <Download size={14} />
                              </button>
                            </td>
                            {effectiveAdmin && (
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={historyPage}
                  totalPages={totalPages}
                  total={filteredRequests.length}
                  onPage={setHistoryPage}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Book Selector Modal */}
      <TextbookBookSelector
        isOpen={isBookSelectorOpen}
        onClose={() => setIsBookSelectorOpen(false)}
        onSelect={handleBookSelect}
        books={catalog.filter(b => (b.subject || '수학') === '수학')}
      />

      {/* 히스토리 이미지 재다운로드용 Hidden Preview */}
      {downloadTarget && (
        <div className="fixed -left-[9999px] top-0">
          <TextbookPreviewCard
            ref={historyPreviewRef}
            data={{
              studentName: downloadTarget.studentName,
              teacherName: downloadTarget.teacherName,
              requestDate: downloadTarget.requestDate,
              bookName: downloadTarget.bookName,
              bookDetail: downloadTarget.bookDetail,
              price: downloadTarget.price,
              bankName: downloadTarget.bankName,
              accountNumber: downloadTarget.accountNumber,
              accountHolder: downloadTarget.accountHolder,
            }}
          />
        </div>
      )}
    </div>
  );
}
