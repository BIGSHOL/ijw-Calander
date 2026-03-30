import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, FileText, List, Download, Search, X, Check, Edit2, Paperclip, Image as ImageIcon } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useExpenses, useCreateExpense, useDeleteExpense, useToggleApproval, useUpdateReceipt, useUpdateReceiptUrls } from '../../hooks/useExpenses';
import { Expense, ExpenseItem } from '../../types/expense';
import { UserProfile } from '../../types/auth';
import { StaffMember } from '../../types/staff';
import { storage } from '../../firebaseConfig';
import { getTodayKST } from '../../utils/dateUtils';

// ==================== 상수 ====================
const PAGE_SIZE = 20;
const PAYMENT_METHODS = ['카드결제', '현금', '계좌이체', '법인카드'];
const RECEIPT_TYPES = ['영수증', '세금계산서', '견적서', '계산서', '카드전표', '현금영수증', '기타'];
const CURRENCIES = [
  { symbol: '₩', label: '₩(원)' },
  { symbol: '$', label: '$(달러)' },
  { symbol: '¥', label: '¥(엔)' },
  { symbol: '€', label: '€(유로)' },
  { symbol: '£', label: '£(파운드)' },
  { symbol: 'CN¥', label: 'CN¥(위안)' },
  { symbol: '₫', label: '₫(동)' },
  { symbol: '₱', label: '₱(페소)' },
  { symbol: '฿', label: '฿(바트)' },
  { symbol: 'A$', label: 'A$(호주달러)' },
];
const EMPTY_ITEM: ExpenseItem = { purpose: '', vendor: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 };

// ==================== 메인 컴포넌트 ====================
interface ExpensesTabProps {
  currentUser?: UserProfile | null;
  staffMember?: StaffMember;
}

const ExpensesTab: React.FC<ExpensesTabProps> = ({ currentUser, staffMember }) => {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const handleEdit = useCallback((expense: Expense) => {
    setEditingExpense(expense);
    setViewMode('create');
  }, []);

  const handleBackToList = useCallback(() => {
    setEditingExpense(null);
    setViewMode('list');
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-800">지출결의서 관리대장</h2>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          <button onClick={() => { setViewMode('list'); setEditingExpense(null); }}
            className={`px-2.5 py-1 text-xs rounded flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm font-bold text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <List size={12} /> 관리대장
          </button>
          <button onClick={() => { setViewMode('create'); setEditingExpense(null); }}
            className={`px-2.5 py-1 text-xs rounded flex items-center gap-1 transition-colors ${viewMode === 'create' ? 'bg-white shadow-sm font-bold text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText size={12} /> 결의서 작성
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {viewMode === 'list' ? (
        <ExpenseListView onEdit={handleEdit} onNewClick={() => setViewMode('create')} />
      ) : (
        <ExpenseFormView editData={editingExpense} onBack={handleBackToList} currentUser={currentUser} staffMember={staffMember} />
      )}
    </div>
  );
};

// ==================== 관리대장 목록 뷰 ====================
const ExpenseListView: React.FC<{ onEdit: (e: Expense) => void; onNewClick: () => void }> = ({ onEdit, onNewClick }) => {
  const { data: expenses = [], isLoading } = useExpenses();
  const deleteMutation = useDeleteExpense();
  const toggleApproval = useToggleApproval();
  const updateReceipt = useUpdateReceipt();
  const updateReceiptUrls = useUpdateReceiptUrls();
  const [attachModalExpense, setAttachModalExpense] = useState<Expense | null>(null);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [deptFilter, setDeptFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState('');

  // 부서 목록 (동적)
  const departments = useMemo(() => [...new Set(expenses.map(e => e.department).filter(Boolean))].sort(), [expenses]);

  // 필터링
  const filtered = useMemo(() => {
    let result = expenses;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.author?.toLowerCase().includes(term) ||
        e.department?.toLowerCase().includes(term) ||
        e.title?.toLowerCase().includes(term) ||
        e.items?.some(i => i.vendor?.toLowerCase().includes(term) || i.description?.toLowerCase().includes(term))
      );
    }
    if (dateFilter.from) result = result.filter(e => e.expenseDate >= dateFilter.from);
    if (dateFilter.to) result = result.filter(e => e.expenseDate <= dateFilter.to);
    if (deptFilter) result = result.filter(e => e.department === deptFilter);
    if (methodFilter) result = result.filter(e => e.paymentMethod === methodFilter);
    if (approvalFilter) {
      if (approvalFilter === 'completed') result = result.filter(e => e.approvalChecks?.ceo?.checked && e.approvalChecks?.director?.checked);
      else if (approvalFilter === 'pending') result = result.filter(e => !e.approvalChecks?.ceo?.checked || !e.approvalChecks?.director?.checked);
    }
    return result;
  }, [expenses, searchTerm, dateFilter, deptFilter, methodFilter, approvalFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageExpenses = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('이 지출결의서를 삭제하시겠습니까?')) return;
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const handleApprovalToggle = useCallback(async (expense: Expense, role: 'author' | 'executor' | 'director' | 'ceo') => {
    const current = expense.approvalChecks?.[role]?.checked || false;
    const newChecked = !current;
    await toggleApproval.mutateAsync({ id: expense.id, role, checked: newChecked });
    // 대표 체크 시 원장도 자동 체크
    if (role === 'ceo' && newChecked && !expense.approvalChecks?.director?.checked) {
      await toggleApproval.mutateAsync({ id: expense.id, role: 'director', checked: true });
    }
  }, [toggleApproval]);

  const formatAmount = (n: number, sym?: string) => {
    const s = sym || '₩';
    return n ? `${s}${n.toLocaleString()}` : '';
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
      {/* 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">지출정보 입력</span>
        <button onClick={onNewClick} className="p-1 border rounded hover:bg-blue-50 text-blue-600" title="추가"><Plus size={14} /></button>
        <div className="flex-1" />
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">전체 부서</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">전체 정산</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={approvalFilter} onChange={e => { setApprovalFilter(e.target.value); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">전체 결재</option>
          <option value="completed">결재완료</option>
          <option value="pending">미결재</option>
        </select>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="검색 (이름, 부서, 거래처...)" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-7 pr-2 py-1 text-xs border rounded w-44 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={10} /></button>}
        </div>
        <input type="date" value={dateFilter.from} onChange={e => { setDateFilter(p => ({ ...p, from: e.target.value })); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded" />
        <span className="text-xs text-gray-400">~</span>
        <input type="date" value={dateFilter.to} onChange={e => { setDateFilter(p => ({ ...p, to: e.target.value })); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded" />
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft size={14} /></button>
          <span className="text-xs text-gray-500">{page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto bg-white rounded border">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: '8%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '5%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="pl-3 pr-1.5 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">일자</th>
              <th className="px-1.5 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">부서명</th>
              <th className="px-1.5 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">성명</th>
              <th className="px-1.5 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">제목</th>
              <th className="px-1.5 py-1.5 text-right font-medium text-gray-600 whitespace-nowrap">총액</th>
              <th className="px-1.5 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">증빙자료</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">작성</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">원장</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">대표</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">집행자</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">첨부</th>
              <th className="px-1 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageExpenses.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">등록된 지출 내역이 없습니다.</td></tr>
            ) : pageExpenses.map((expense) => {
              const checks = expense.approvalChecks || {};
              const sym = expense.currency || '₩';
              const itemCount = expense.items?.length || 0;
              return (
              <tr key={expense.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => onEdit(expense)}>
                <td className="pl-3 pr-1.5 py-2 text-center text-gray-700 truncate">{expense.expenseDate}</td>
                <td className="px-1.5 py-2 text-center text-gray-700 truncate">{expense.department}</td>
                <td className="px-1.5 py-2 text-center text-gray-700 truncate">{expense.author}</td>
                <td className="px-1.5 py-2 text-left text-gray-800 truncate">
                  <span className="font-medium hover:text-blue-600">{expense.title || '(제목 없음)'}</span>
                  {itemCount > 0 && <span className="ml-1.5 text-[10px] text-gray-400">({itemCount}건)</span>}
                </td>
                <td className="px-1.5 py-2 text-right font-medium text-amber-700 whitespace-nowrap">{formatAmount(expense.totalAmount || 0, sym)}</td>
                <td className="px-1.5 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <select
                    value={expense.receiptUrl || ''}
                    onChange={e => updateReceipt.mutate({ id: expense.id, receiptUrl: e.target.value })}
                    className="text-[10px] bg-transparent border-0 text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 rounded w-full px-0 py-0"
                  >
                    <option value="">-</option>
                    {RECEIPT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-1 py-2 text-center">
                  <span className={`text-xs ${checks.author?.checked ? 'text-green-600' : 'text-gray-300'}`}>{checks.author?.checked ? '✔' : '—'}</span>
                </td>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleApprovalToggle(expense, 'director')}
                    className={`text-xs px-1 py-0.5 rounded hover:bg-gray-100 ${checks.director?.checked ? 'text-green-600 font-bold' : 'text-gray-300'}`}>
                    {checks.director?.checked ? '✔' : '—'}
                  </button>
                </td>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleApprovalToggle(expense, 'ceo')}
                    className={`text-xs px-1 py-0.5 rounded hover:bg-gray-100 ${checks.ceo?.checked ? 'text-green-600 font-bold' : 'text-gray-300'}`}>
                    {checks.ceo?.checked ? '✔' : '—'}
                  </button>
                </td>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleApprovalToggle(expense, 'executor')}
                    className={`text-xs px-1 py-0.5 rounded hover:bg-gray-100 ${checks.executor?.checked ? 'text-green-600 font-bold' : 'text-gray-300'}`}>
                    {checks.executor?.checked ? '✔' : '—'}
                  </button>
                </td>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setAttachModalExpense(expense)}
                    className={`text-xs px-1 py-0.5 rounded hover:bg-blue-50 ${(expense.receiptUrls?.length || 0) > 0 ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                    <Paperclip size={12} />
                  </button>
                  {(expense.receiptUrls?.length || 0) > 0 && (
                    <span className="text-[9px] text-blue-500 ml-0.5">{expense.receiptUrls!.length}</span>
                  )}
                </td>
                <td className="px-1 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button onClick={() => onEdit(expense)} className="p-0.5 rounded text-blue-500 hover:bg-blue-50"><Edit2 size={12} /></button>
                    <button onClick={() => handleDelete(expense.id)} className="p-0.5 rounded text-red-400 hover:bg-red-50"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 합계 */}
      <div className="flex justify-end px-2">
        <span className="text-xs font-bold text-gray-600">
          총 {filtered.length}건 | 합계: <span className="text-amber-700">₩{filtered.reduce((sum, e) => sum + (e.totalAmount || 0), 0).toLocaleString()}</span>
        </span>
      </div>

      {/* 증빙자료 첨부 모달 */}
      {attachModalExpense && (
        <ReceiptUploadModal
          expense={attachModalExpense}
          onClose={() => setAttachModalExpense(null)}
          onUpdate={(urls) => updateReceiptUrls.mutate({ id: attachModalExpense.id, receiptUrls: urls })}
        />
      )}
    </div>
  );
};

// ==================== 증빙자료 첨부 모달 ====================
const ReceiptUploadModal: React.FC<{
  expense: Expense;
  onClose: () => void;
  onUpdate: (urls: string[]) => void;
}> = ({ expense, onClose, onUpdate }) => {
  const [images, setImages] = useState<string[]>(expense.receiptUrls || []);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    try {
      const path = `expenses/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setImages(prev => {
        const next = [...prev, url];
        onUpdate(next);
        return next;
      });
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  }, [onUpdate]);

  const removeImage = useCallback(async (idx: number) => {
    const url = images[idx];
    // Storage에서 실제 파일 삭제
    if (url) {
      try {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
      } catch (err: any) {
        // 파일이 이미 없으면 무시
        if (err?.code !== 'storage/object-not-found') {
          console.error('Storage 파일 삭제 실패:', err);
        }
      }
    }
    setImages(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onUpdate(next);
      return next;
    });
  }, [images, onUpdate]);

  // Ctrl+V 붙여넣기
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadImage(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploadImage]);

  // 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // 이미지 미리보기 모달
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl w-[400px] max-h-[500px] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Paperclip size={14} className="text-blue-600" />
            <span className="text-sm font-bold text-gray-800">증빙자료 첨부</span>
            <span className="text-[10px] text-gray-400">Ctrl+V · 드래그 · 클릭</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* 업로드 영역 */}
        <div className="p-4 flex flex-col gap-3 overflow-auto">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
            onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
              for (const file of e.dataTransfer.files) uploadImage(file);
            }}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            {isUploading ? (
              <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent" />
                업로드 중...
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ImageIcon size={24} className="text-gray-400" />
                <span className="text-xs text-gray-500">이미지를 드래그하거나 클릭하여 첨부</span>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) { for (const f of e.target.files) uploadImage(f); } e.target.value = ''; }} />

          {/* 첨부된 이미지 목록 */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative group">
                  <img src={url} alt={`증빙${idx + 1}`}
                    className="w-20 h-20 object-cover rounded border cursor-pointer hover:ring-2 hover:ring-blue-400"
                    onClick={(e) => { e.stopPropagation(); setPreviewUrl(url); }} />
                  <button onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length === 0 && (
            <p className="text-center text-xs text-gray-400">첨부된 증빙자료가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 이미지 미리보기 */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="미리보기" className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl" />
        </div>
      )}
    </div>
  );
};

// ==================== 결의서 작성/수정 뷰 ====================
const ExpenseFormView: React.FC<{
  editData: Expense | null;
  onBack: () => void;
  currentUser?: UserProfile | null;
  staffMember?: StaffMember;
}> = ({ editData, onBack, currentUser, staffMember }) => {
  const createMutation = useCreateExpense();
  const previewRef = useRef<HTMLDivElement>(null);
  const today = getTodayKST();

  // 작성자/직위 기본값: staffMember > currentUser > ''
  const defaultAuthor = editData?.author || staffMember?.name || currentUser?.displayName || currentUser?.name || currentUser?.koreanName || '';
  const defaultPosition = editData?.position || staffMember?.jobTitle || currentUser?.jobTitle || '';

  // 폼 상태
  const [title, setTitle] = useState(editData?.title || '');
  const [author, setAuthor] = useState(defaultAuthor);
  const [department, setDepartment] = useState(editData?.department || '');
  const [position, setPosition] = useState(defaultPosition);
  const [createdDate, setCreatedDate] = useState(editData?.createdDate || today);
  const [expenseDate, setExpenseDate] = useState(editData?.expenseDate || today);
  const [currency, setCurrency] = useState(editData?.currency || '₩');
  const [paymentMethod, setPaymentMethod] = useState(editData?.paymentMethod || '카드결제');
  const [bankName, setBankName] = useState(editData?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(editData?.accountNumber || '-');
  const [memo, setMemo] = useState(editData?.memo || '');
  const [items, setItems] = useState<ExpenseItem[]>(
    editData?.items?.length ? editData.items : [{ ...EMPTY_ITEM }]
  );
  const [isSaving, setIsSaving] = useState(false);

  // 항목 수정
  const updateItem = useCallback((idx: number, field: keyof ExpenseItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : next[idx].quantity;
        const price = field === 'unitPrice' ? Number(value) : next[idx].unitPrice;
        next[idx].totalPrice = qty * price;
      }
      return next;
    });
  }, []);

  // 합계
  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + (i.totalPrice || 0), 0), [items]);

  // 저장 - 작성 체크 자동 설정
  const handleSave = useCallback(async () => {
    if (!author.trim()) { alert('작성자를 입력해주세요.'); return; }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return; }

    setIsSaving(true);
    try {
      const validItems = items.filter(i => i.purpose || i.vendor || i.description || i.unitPrice > 0);
      const existingChecks = editData?.approvalChecks || {};
      await createMutation.mutateAsync({
        ...(editData?.id ? { id: editData.id } : {}),
        title: title.trim(),
        author: author.trim(),
        department: department.trim(),
        position: position.trim(),
        createdDate,
        expenseDate,
        items: validItems,
        currency,
        paymentMethod,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        approvalStatus: editData?.approvalStatus || 'pending',
        approvalChecks: {
          ...existingChecks,
          author: { checked: true, date: today },
        },
        memo: memo.trim(),
        totalAmount,
        createdAt: editData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: editData?.createdBy || currentUser?.uid || '',
      });
      alert(editData ? '수정되었습니다.' : '저장되었습니다.');
      onBack();
    } catch (err) {
      console.error('지출결의서 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [title, author, department, position, createdDate, expenseDate, items, currency, paymentMethod, bankName, accountNumber, memo, totalAmount, editData, createMutation, onBack, currentUser, today]);

  // PNG 다운로드
  const handleDownload = useCallback(async () => {
    if (!previewRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      link.download = `지출결의서_${author}_${expenseDate}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG 다운로드 실패:', err);
    }
  }, [author, expenseDate]);

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400';

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* 좌측: 입력 폼 */}
      <div className="w-full md:w-[340px] bg-white border-r overflow-auto p-4 flex flex-col gap-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">{editData ? '결의서 수정' : '결의서 작성'}</h3>
          <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700">← 목록</button>
        </div>

        {/* 기본 정보 */}
        <div>
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
            <FileText size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">기본 정보</span>
          </div>
          <div className="space-y-2">
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">제목 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="지출 제목" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">작성자 *</label>
                <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="성명" className={inputCls} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">직위</label>
                <input value={position} onChange={e => setPosition(e.target.value)} placeholder="직위" className={inputCls} /></div>
            </div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">부서명</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="부서명" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">작성일자</label>
                <input type="date" value={createdDate} onChange={e => setCreatedDate(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">지출일자</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={inputCls} /></div>
            </div>
          </div>
        </div>

        {/* 지출 항목 */}
        <div>
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
            <List size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">지출 항목</span>
            <div className="ml-auto flex items-center gap-1.5">
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="px-1.5 py-0.5 text-[11px] border rounded focus:outline-none focus:ring-1 focus:ring-blue-400">
                {CURRENCIES.map(c => <option key={c.label} value={c.symbol}>{c.label}</option>)}
              </select>
              <button onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
                className="p-0.5 border rounded hover:bg-blue-50 text-blue-600" title="항목 추가"><Plus size={12} /></button>
            </div>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded p-2 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400">No.{idx + 1}</span>
                  {(item.purpose || item.vendor || item.description) && (
                    <button onClick={() => setItems(prev => { const n = [...prev]; n[idx] = { ...EMPTY_ITEM }; return n; })}
                      className="text-gray-300 hover:text-red-400"><X size={10} /></button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={item.purpose} onChange={e => updateItem(idx, 'purpose', e.target.value)} placeholder="용도" className="px-1.5 py-1 text-[11px] border rounded" />
                  <input value={item.vendor} onChange={e => updateItem(idx, 'vendor', e.target.value)} placeholder="거래처" className="px-1.5 py-1 text-[11px] border rounded" />
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="사용내역" className="col-span-2 px-1.5 py-1 text-[11px] border rounded" />
                  <input type="number" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} placeholder="수량" className="px-1.5 py-1 text-[11px] border rounded text-right" />
                  <input type="number" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} placeholder="금액" className="px-1.5 py-1 text-[11px] border rounded text-right" />
                </div>
                {item.totalPrice > 0 && (
                  <div className="text-right text-[10px] font-bold text-amber-600 mt-1">총액: {currency}{item.totalPrice.toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 정산 정보 */}
        <div>
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
            <span className="text-blue-600 text-sm">💳</span>
            <span className="text-xs font-semibold text-blue-700">정산 정보</span>
          </div>
          <div className="space-y-2">
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">정산방법</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select></div>
            {(paymentMethod === '계좌이체' || paymentMethod === '카드결제' || paymentMethod === '법인카드') && (
              <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">{paymentMethod === '계좌이체' ? '은행명' : '카드명'}</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder={paymentMethod === '계좌이체' ? '예: 국민은행' : '예: 삼성카드'} className={inputCls} /></div>
            )}
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">계좌번호</label>
              <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="계좌번호" className={inputCls} /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">비고</label>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고" className={inputCls} /></div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex gap-2 pt-2 border-t">
          <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold border rounded hover:bg-gray-50 transition-colors">
            <Download size={12} /> PNG 저장
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Check size={12} /> {isSaving ? '저장 중...' : editData ? '수정' : '저장'}
          </button>
        </div>
      </div>

      {/* 우측: 실시간 미리보기 (결의서 양식) */}
      <div className="flex-1 bg-gray-100 overflow-auto flex justify-center p-6">
        <div ref={previewRef} className="bg-white w-full max-w-[960px] min-h-[900px] p-10 shadow-2xl text-black" style={{ fontFamily: 'serif' }}>
          {/* 상단: 결재란 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-wider whitespace-nowrap">지출결의서</h1>
            </div>
            <table className="border-2 border-black text-xs">
              <tbody>
                <tr>
                  <td className="border border-black px-2 py-0.5 bg-gray-50 font-bold text-center whitespace-nowrap text-purple-700" rowSpan={2}>결<br/>재</td>
                  <td className="border border-black px-6 py-0.5 bg-gray-50 font-bold text-center whitespace-nowrap">담당자</td>
                  <td className="border border-black px-6 py-0.5 bg-gray-50 font-bold text-center whitespace-nowrap">원장</td>
                  <td className="border border-black px-6 py-0.5 bg-gray-50 font-bold text-center whitespace-nowrap">대표</td>
                </tr>
                <tr>
                  <td className="border border-black px-6 py-4 text-center whitespace-nowrap">{author || ''}</td>
                  <td className="border border-black px-6 py-4 text-center"></td>
                  <td className="border border-black px-6 py-4 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 기본 정보 테이블 */}
          <table className="w-full border-2 border-black text-xs mb-4 table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[35%]" />
              <col className="w-[15%]" />
              <col className="w-[35%]" />
            </colgroup>
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">제목</td>
                <td className="border border-black px-3 py-2 truncate">{title}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">작성일자</td>
                <td className="border border-black px-3 py-2 whitespace-nowrap">{createdDate}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">사업자 / 작성자</td>
                <td className="border border-black px-3 py-2 truncate">{author} {position && `(${position})`}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">지출일자</td>
                <td className="border border-black px-3 py-2 whitespace-nowrap">{expenseDate}</td>
              </tr>
            </tbody>
          </table>

          {/* 안내 문구 */}
          <p className="text-xs text-center text-gray-600 mb-3 whitespace-nowrap">아래와 같이 금액을 청구하오니 검토 후 지급을 요청합니다.</p>

          {/* 항목 테이블 */}
          <table className="w-full border-2 border-black text-xs mb-4 table-fixed">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[24%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">No.</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">용도</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">거래처</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">사용내역</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">수량</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">금액</th>
                <th className="border border-black px-2 py-1.5 whitespace-nowrap">총액(VAT포함)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black px-2 py-3 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black px-2 py-3 text-center truncate">{item.purpose}</td>
                  <td className="border border-black px-2 py-3 text-center truncate">{item.vendor}</td>
                  <td className="border border-black px-2 py-3 text-center truncate">{item.description}</td>
                  <td className="border border-black px-2 py-3 text-center whitespace-nowrap">{item.quantity || ''}</td>
                  <td className="border border-black px-2 py-3 text-right whitespace-nowrap">{item.unitPrice ? `${currency}${item.unitPrice.toLocaleString()}` : ''}</td>
                  <td className="border border-black px-2 py-3 text-right whitespace-nowrap">{item.totalPrice ? `${currency}${item.totalPrice.toLocaleString()}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 합계 */}
          <div className="flex border-2 border-black mb-4">
            <div className="bg-amber-100 font-bold px-4 py-2 text-sm flex-1 whitespace-nowrap">합계</div>
            <div className="font-bold px-4 py-2 text-sm text-right whitespace-nowrap min-w-[160px]">{currency}{totalAmount.toLocaleString()}</div>
          </div>

          {/* 정산 정보 */}
          <table className="w-full border-2 border-black text-xs table-fixed">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[35%]" />
              <col className="w-[15%]" />
              <col className="w-[35%]" />
            </colgroup>
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">정산방법</td>
                <td className="border border-black px-3 py-2 truncate">{paymentMethod}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center whitespace-nowrap">계좌번호</td>
                <td className="border border-black px-3 py-2 truncate">{bankName ? `${bankName} ${accountNumber}` : accountNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensesTab;
