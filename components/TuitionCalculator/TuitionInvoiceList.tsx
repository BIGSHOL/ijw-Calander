import React, { useState } from 'react';
import { Search, Trash2, Loader2, FileText, ArrowLeft } from 'lucide-react';
import { useTuitionInvoices } from '../../hooks/useTuitionInvoices';
import type { TuitionSavedInvoice } from '../../types/tuition';

interface TuitionInvoiceListProps {
  onSelectInvoice: (invoice: TuitionSavedInvoice) => void;
  onClose: () => void;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatCurrency = (amount: number): string =>
  amount.toLocaleString('ko-KR') + '원';

export const TuitionInvoiceList: React.FC<TuitionInvoiceListProps> = ({
  onSelectInvoice, onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<TuitionSavedInvoice[]>([]);

  const { invoices, isLoading, deleteInvoice, searchByName, refetch } = useTuitionInvoices();

  // 표시할 목록 (검색 모드면 검색 결과, 아니면 전체)
  const displayInvoices = isSearchMode ? searchResults : invoices;

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setIsSearchMode(false);
      return;
    }
    const results = searchByName(searchTerm.trim());
    setSearchResults(results);
    setIsSearchMode(true);
  };

  const handleShowAll = () => {
    setSearchTerm('');
    setIsSearchMode(false);
    refetch();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말 이 청구서를 삭제하시겠습니까?')) return;
    try {
      await deleteInvoice(id);
      if (isSearchMode) {
        setSearchResults(prev => prev.filter(inv => inv.id !== id));
      }
    } catch (err) {
      console.error('청구서 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#081429]/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[#081429]" />
          </button>
          <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
            <FileText size={24} className="text-[#fdb813]" />
            저장된 청구서 목록
          </h2>
        </div>
        <span className="text-sm text-[#373d41]">{displayInvoices.length}건</span>
      </div>

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#373d41]" size={18} />
          <input
            type="text"
            placeholder="학생 이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-[#373d41]/30 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#0c1e3d] transition-colors"
        >
          검색
        </button>
        <button
          onClick={handleShowAll}
          className="px-4 py-2 bg-[#373d41]/20 text-[#373d41] rounded-lg hover:bg-[#373d41]/30 transition-colors"
        >
          전체
        </button>
      </div>

      {/* 로딩 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#fdb813]" />
        </div>
      ) : displayInvoices.length === 0 ? (
        <div className="text-center py-12 text-[#373d41]">
          <FileText className="w-12 h-12 mx-auto mb-3 text-[#373d41]/30" />
          <p>{isSearchMode ? '검색 결과가 없습니다.' : '저장된 청구서가 없습니다.'}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {displayInvoices.map((invoice) => (
            <div
              key={invoice.id}
              onClick={() => onSelectInvoice(invoice)}
              className="flex items-center justify-between p-4 bg-[#081429]/5 hover:bg-[#fdb813]/20 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-[#fdb813]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-[#081429]">{invoice.studentInfo.name}</span>
                  <span className="text-sm text-[#373d41]">
                    {invoice.studentInfo.school} {invoice.studentInfo.grade}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-[#373d41]">
                  <span>수강: {invoice.courses.length}개</span>
                  <span>교재/기타: {invoice.extras.length}개</span>
                  <span className="text-xs">{formatDate(invoice.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#081429] text-lg">
                  {formatCurrency(invoice.totalAmount)}
                </span>
                <button
                  onClick={(e) => handleDelete(invoice.id, e)}
                  className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  title="삭제"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
