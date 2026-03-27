import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, FileText, List, Download, Search, X, Check, Edit2 } from 'lucide-react';
import { useExpenses, useCreateExpense, useDeleteExpense } from '../../hooks/useExpenses';
import { Expense, ExpenseItem } from '../../types/expense';
import { getTodayKST } from '../../utils/dateUtils';

// ==================== 상수 ====================
const PAGE_SIZE = 20;
const PAYMENT_METHODS = ['카드결제', '현금', '계좌이체', '법인카드'];
const RECEIPT_TYPES = ['영수증', '세금계산서', '견적서', '계산서', '기타'];
const EMPTY_ITEM: ExpenseItem = { purpose: '', vendor: '', description: '', quantity: 1, unitPrice: 0, totalPrice: 0 };

// ==================== 메인 컴포넌트 ====================
const ExpensesTab: React.FC = () => {
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
        <ExpenseFormView editData={editingExpense} onBack={handleBackToList} />
      )}
    </div>
  );
};

// ==================== 관리대장 목록 뷰 ====================
const ExpenseListView: React.FC<{ onEdit: (e: Expense) => void; onNewClick: () => void }> = ({ onEdit, onNewClick }) => {
  const { data: expenses = [], isLoading } = useExpenses();
  const deleteMutation = useDeleteExpense();
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

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
    return result;
  }, [expenses, searchTerm, dateFilter]);

  // 관리대장 표시용: 각 expense의 items를 flat하게 펼침
  const flatRows = useMemo(() => {
    const rows: { expense: Expense; item: ExpenseItem; itemIndex: number }[] = [];
    filtered.forEach(expense => {
      if (expense.items?.length > 0) {
        expense.items.forEach((item, idx) => {
          rows.push({ expense, item, itemIndex: idx });
        });
      } else {
        rows.push({ expense, item: EMPTY_ITEM, itemIndex: 0 });
      }
    });
    return rows;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(flatRows.length / PAGE_SIZE));
  const pageRows = flatRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('이 지출결의서를 삭제하시겠습니까?')) return;
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  const formatAmount = (n: number) => n ? n.toLocaleString() : '';

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
      {/* 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">자출정보 입력</span>
        <button onClick={onNewClick} className="p-1 border rounded hover:bg-blue-50 text-blue-600" title="추가"><Plus size={14} /></button>
        <div className="flex-1" />
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="검색 (이름, 부서, 거래처...)" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-7 pr-2 py-1 text-xs border rounded w-48 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={10} /></button>}
        </div>
        <input type="date" value={dateFilter.from} onChange={e => { setDateFilter(p => ({ ...p, from: e.target.value })); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded" />
        <span className="text-xs text-gray-400">~</span>
        <input type="date" value={dateFilter.to} onChange={e => { setDateFilter(p => ({ ...p, to: e.target.value })); setPage(0); }}
          className="px-1.5 py-1 text-xs border rounded" />
        {/* 페이지네이션 */}
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft size={14} /></button>
          <span className="text-xs text-gray-500">{page + 1}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight size={14} /></button>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded p-0.5">
          <button className={`px-2 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-bold`}>증빙자료</button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex-1 overflow-auto bg-white rounded border">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-24">일자</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-20">부서명</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-16">성명</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-14">직위</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">지출처</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">사용내역</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-14">수량</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-20">단가</th>
              <th className="px-2 py-1.5 text-right font-medium text-gray-600 w-24">금액</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-20">증빙자료</th>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-20">비고</th>
              <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-16">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageRows.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">등록된 지출 내역이 없습니다.</td></tr>
            ) : pageRows.map((row, idx) => (
              <tr key={`${row.expense.id}-${row.itemIndex}`} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-2 py-1.5 text-gray-700">{row.itemIndex === 0 ? row.expense.expenseDate : ''}</td>
                <td className="px-2 py-1.5 text-gray-700">{row.itemIndex === 0 ? row.expense.department : ''}</td>
                <td className="px-2 py-1.5 text-gray-700">{row.itemIndex === 0 ? row.expense.author : ''}</td>
                <td className="px-2 py-1.5 text-gray-500">{row.itemIndex === 0 ? row.expense.position : ''}</td>
                <td className="px-2 py-1.5 text-gray-700">{row.item.vendor}</td>
                <td className="px-2 py-1.5 text-gray-700">{row.item.description || row.item.purpose}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{row.item.quantity || ''}</td>
                <td className="px-2 py-1.5 text-right text-gray-700">{formatAmount(row.item.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right font-medium text-amber-700">{formatAmount(row.item.totalPrice || (row.item.quantity * row.item.unitPrice))}</td>
                <td className="px-2 py-1.5 text-center">
                  {row.itemIndex === 0 && row.expense.receiptUrl && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{row.expense.receiptUrl}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-gray-500 text-[11px]">{row.itemIndex === 0 ? row.expense.memo : ''}</td>
                <td className="px-2 py-1.5 text-center">
                  {row.itemIndex === 0 && (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onEdit(row.expense)} className="p-0.5 rounded text-blue-500 hover:bg-blue-50"><Edit2 size={12} /></button>
                      <button onClick={() => handleDelete(row.expense.id)} className="p-0.5 rounded text-red-400 hover:bg-red-50"><Trash2 size={12} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 합계 */}
      <div className="flex justify-end px-2">
        <span className="text-xs font-bold text-gray-600">
          총 {filtered.length}건 | 합계: <span className="text-amber-700">{filtered.reduce((sum, e) => sum + (e.totalAmount || 0), 0).toLocaleString()}원</span>
        </span>
      </div>
    </div>
  );
};

// ==================== 결의서 작성/수정 뷰 ====================
const ExpenseFormView: React.FC<{ editData: Expense | null; onBack: () => void }> = ({ editData, onBack }) => {
  const createMutation = useCreateExpense();
  const previewRef = useRef<HTMLDivElement>(null);
  const today = getTodayKST();

  // 폼 상태
  const [title, setTitle] = useState(editData?.title || '');
  const [author, setAuthor] = useState(editData?.author || '');
  const [department, setDepartment] = useState(editData?.department || '');
  const [position, setPosition] = useState(editData?.position || '');
  const [createdDate, setCreatedDate] = useState(editData?.createdDate || today);
  const [expenseDate, setExpenseDate] = useState(editData?.expenseDate || today);
  const [paymentMethod, setPaymentMethod] = useState(editData?.paymentMethod || '카드결제');
  const [accountNumber, setAccountNumber] = useState(editData?.accountNumber || '-');
  const [receiptUrl, setReceiptUrl] = useState(editData?.receiptUrl || '');
  const [memo, setMemo] = useState(editData?.memo || '');
  const [items, setItems] = useState<ExpenseItem[]>(
    editData?.items?.length ? editData.items : Array(7).fill(null).map(() => ({ ...EMPTY_ITEM }))
  );
  const [isSaving, setIsSaving] = useState(false);

  // 항목 수정
  const updateItem = useCallback((idx: number, field: keyof ExpenseItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // 총액 자동계산
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

  // 저장
  const handleSave = useCallback(async () => {
    if (!author.trim()) { alert('작성자를 입력해주세요.'); return; }
    if (!title.trim()) { alert('제목을 입력해주세요.'); return; }

    setIsSaving(true);
    try {
      const validItems = items.filter(i => i.purpose || i.vendor || i.description || i.unitPrice > 0);
      await createMutation.mutateAsync({
        ...(editData?.id ? { id: editData.id } : {}),
        title: title.trim(),
        author: author.trim(),
        department: department.trim(),
        position: position.trim(),
        createdDate,
        expenseDate,
        items: validItems,
        paymentMethod,
        accountNumber: accountNumber.trim(),
        approvalStatus: editData?.approvalStatus || 'pending',
        receiptUrl: receiptUrl.trim(),
        memo: memo.trim(),
        totalAmount,
        createdAt: editData?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: editData?.createdBy || '',
      });
      alert(editData ? '수정되었습니다.' : '저장되었습니다.');
      onBack();
    } catch (err) {
      console.error('지출결의서 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [title, author, department, position, createdDate, expenseDate, items, paymentMethod, accountNumber, receiptUrl, memo, totalAmount, editData, createMutation, onBack]);

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
          </div>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded p-2 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400">No.{idx + 1}</span>
                  {(item.purpose || item.vendor || item.description) && (
                    <button onClick={() => updateItem(idx, 'purpose', '') || setItems(prev => { const n = [...prev]; n[idx] = { ...EMPTY_ITEM }; return n; })}
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
                  <div className="text-right text-[10px] font-bold text-amber-600 mt-1">총액: {item.totalPrice.toLocaleString()}원</div>
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
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">계좌번호</label>
              <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="계좌번호" className={inputCls} /></div>
            <div><label className="block text-[11px] font-medium text-gray-500 mb-0.5">증빙자료</label>
              <select value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} className={inputCls}>
                <option value="">선택</option>
                {RECEIPT_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
              </select></div>
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
        <div ref={previewRef} className="bg-white w-[720px] min-h-[900px] p-10 shadow-2xl text-black" style={{ fontFamily: 'serif' }}>
          {/* 상단: 결재란 */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-wider">지출결의서</h1>
            </div>
            <table className="border-2 border-black text-xs">
              <thead>
                <tr>
                  <th className="border border-black px-1 py-0.5 bg-gray-50" rowSpan={2}>결<br/>재</th>
                  <th className="border border-black px-4 py-0.5 bg-gray-50">담당자</th>
                  <th className="border border-black px-4 py-0.5 bg-gray-50">원장</th>
                  <th className="border border-black px-4 py-0.5 bg-gray-50">대표</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black px-4 py-3 text-center">{author || ''}</td>
                  <td className="border border-black px-4 py-3 text-center"></td>
                  <td className="border border-black px-4 py-3 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 기본 정보 테이블 */}
          <table className="w-full border-2 border-black text-xs mb-4">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold w-28 text-center">제목</td>
                <td className="border border-black px-3 py-2">{title}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold w-24 text-center">작성일자</td>
                <td className="border border-black px-3 py-2 w-28">{createdDate}</td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center">사업자 / 작성자</td>
                <td className="border border-black px-3 py-2">{author} {position && `(${position})`}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center">지출일자</td>
                <td className="border border-black px-3 py-2">{expenseDate}</td>
              </tr>
            </tbody>
          </table>

          {/* 안내 문구 */}
          <p className="text-xs text-center text-gray-600 mb-3">아래와 같이 금액을 청구하오니 검토 후 지급을 요청합니다.</p>

          {/* 항목 테이블 */}
          <table className="w-full border-2 border-black text-xs mb-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-black px-2 py-1.5 w-8">No.</th>
                <th className="border border-black px-2 py-1.5">용도</th>
                <th className="border border-black px-2 py-1.5">거래처</th>
                <th className="border border-black px-2 py-1.5">사용내역</th>
                <th className="border border-black px-2 py-1.5 w-14">수량</th>
                <th className="border border-black px-2 py-1.5 w-20">금액</th>
                <th className="border border-black px-2 py-1.5 w-24">총액(VAT포함)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black px-2 py-3 text-center font-bold">{idx + 1}</td>
                  <td className="border border-black px-2 py-3">{item.purpose}</td>
                  <td className="border border-black px-2 py-3">{item.vendor}</td>
                  <td className="border border-black px-2 py-3">{item.description}</td>
                  <td className="border border-black px-2 py-3 text-right">{item.quantity || ''}</td>
                  <td className="border border-black px-2 py-3 text-right">{item.unitPrice ? item.unitPrice.toLocaleString() : ''}</td>
                  <td className="border border-black px-2 py-3 text-right">{item.totalPrice ? item.totalPrice.toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 합계 */}
          <div className="flex border-2 border-black mb-4">
            <div className="bg-amber-100 font-bold px-4 py-2 text-sm flex-1">합계</div>
            <div className="font-bold px-4 py-2 text-sm text-right w-40">₩{totalAmount.toLocaleString()}</div>
          </div>

          {/* 정산 정보 */}
          <table className="w-full border-2 border-black text-xs">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center w-28">정산방법</td>
                <td className="border border-black px-3 py-2">{paymentMethod}</td>
                <td className="border border-black px-3 py-2 bg-gray-50 font-bold text-center w-24">계좌번호</td>
                <td className="border border-black px-3 py-2">{accountNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensesTab;
