import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FileText, Clock } from 'lucide-react';
import { StudentTermSummary, EnrollmentTerm } from '../../../types/enrollmentTerm';
import { useCreateEnrollmentTerm, useCancelEnrollmentTerm, useStudentEnrollmentTerms } from '../../../hooks/useEnrollmentTerms';

interface Props {
  studentId: string;
  studentName: string;
  month: string;
  termSummary?: StudentTermSummary;
  anchorRect: { top: number; left: number };
  onClose: () => void;
}

const EnrollmentTermPopover: React.FC<Props> = ({
  studentId,
  studentName,
  month,
  termSummary,
  anchorRect,
  onClose,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addUnitPrice, setAddUnitPrice] = useState('');
  const [addNote, setAddNote] = useState('');

  const createMutation = useCreateEnrollmentTerm();
  const cancelMutation = useCancelEnrollmentTerm();
  const { data: allTerms = [] } = useStudentEnrollmentTerms(studentId);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const terms = termSummary?.terms || [];
  const currentTermNumber = termSummary?.currentTermNumber || 0;

  // 이전 월 차수 이력 (현재 월 제외)
  const historyTerms = allTerms.filter(
    (t) => t.month !== month && t.status === 'active'
  );

  const handleAddTerm = async () => {
    const amount = parseInt(addAmount.replace(/[^0-9]/g, ''), 10) || 0;
    const unitPrice = parseInt(addUnitPrice.replace(/[^0-9]/g, ''), 10) || 0;

    if (amount <= 0) return;

    try {
      await createMutation.mutateAsync({
        studentId,
        studentName,
        month,
        termNumber: currentTermNumber + 1,
        billedAmount: amount,
        unitPrice,
        source: 'manual',
        status: 'active',
        note: addNote || undefined,
      });
      setShowAddForm(false);
      setAddAmount('');
      setAddUnitPrice('');
      setAddNote('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '등록차수 생성에 실패했습니다.');
    }
  };

  const handleCancelTerm = async (termId: string) => {
    if (!confirm('이 등록차수를 취소하시겠습니까?')) return;
    try {
      await cancelMutation.mutateAsync(termId);
    } catch {
      alert('등록차수 취소에 실패했습니다.');
    }
  };

  // 위치 계산 (뷰포트 내에 위치하도록)
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(anchorRect.top, window.innerHeight - 400),
    left: Math.min(anchorRect.left, window.innerWidth - 320),
    zIndex: 9999,
  };

  return createPortal(
    <div ref={popoverRef} style={popoverStyle} className="w-[300px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* 헤더 */}
      <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-indigo-900">{studentName} - 등록차수</h3>
          <p className="text-micro text-indigo-500">{month}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-indigo-100 rounded transition-colors">
          <X size={14} className="text-indigo-400" />
        </button>
      </div>

      {/* 현재 월 차수 */}
      <div className="p-3 space-y-2">
        {terms.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-xxs font-bold text-gray-500 uppercase tracking-wider">이번 달 등록</div>
            {terms.map((term) => (
              <div
                key={term.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                    {term.termNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">
                      {term.billedAmount.toLocaleString()}원
                      {term.billingName && (
                        <span className="text-gray-400 ml-1">({term.billingName})</span>
                      )}
                    </div>
                    <div className="text-micro text-gray-400 flex items-center gap-1">
                      {term.source === 'auto' ? (
                        <><FileText size={8} /> 자동 생성</>
                      ) : (
                        <><Plus size={8} /> 수동 추가</>
                      )}
                      {term.note && <span>| {term.note}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelTerm(term.id)}
                  className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="취소"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 text-gray-400 text-xs">
            이번 달 등록차수가 없습니다.
          </div>
        )}

        {/* 차수 추가 폼 */}
        {showAddForm ? (
          <div className="p-2 bg-blue-50 rounded border border-blue-100 space-y-2">
            <div className="text-xxs font-bold text-blue-700">수동 차수 추가</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-micro text-gray-500 font-bold">청구액</label>
                <input
                  type="text"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="예: 300,000"
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>
              <div>
                <label className="text-micro text-gray-500 font-bold">1회 단가</label>
                <input
                  type="text"
                  value={addUnitPrice}
                  onChange={(e) => setAddUnitPrice(e.target.value)}
                  placeholder="예: 25,000"
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-micro text-gray-500 font-bold">메모 (선택)</label>
              <input
                type="text"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="예: 보충 수업"
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>
            <div className="flex gap-1.5 justify-end">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-2 py-1 text-xxs text-gray-500 hover:bg-gray-100 rounded"
              >
                취소
              </button>
              <button
                onClick={handleAddTerm}
                disabled={createMutation.isPending}
                className="px-2 py-1 text-xxs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-200 flex items-center justify-center gap-1 transition-colors"
          >
            <Plus size={12} /> 차수 추가
          </button>
        )}

        {/* 이전 이력 (최근 3개월) */}
        {historyTerms.length > 0 && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            <div className="text-xxs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={10} /> 이전 이력
            </div>
            {historyTerms.slice(0, 6).map((term) => (
              <div key={term.id} className="flex items-center justify-between text-micro text-gray-400 px-1">
                <span>{term.month} | {term.termNumber}차</span>
                <span>{term.billedAmount.toLocaleString()}원</span>
              </div>
            ))}
            {historyTerms.length > 6 && (
              <div className="text-micro text-gray-300 text-center">
                +{historyTerms.length - 6}건 더
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default EnrollmentTermPopover;
