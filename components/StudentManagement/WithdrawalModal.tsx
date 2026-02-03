import React, { useState } from 'react';
import { X, UserMinus, AlertTriangle, Calendar, FileText, Info } from 'lucide-react';
import { UnifiedStudent } from '../../types';

// 퇴원 사유 옵션
const WITHDRAWAL_REASONS = [
  { value: '', label: '선택하세요' },
  { value: 'graduation', label: '졸업' },
  { value: 'relocation', label: '이사' },
  { value: 'competitor', label: '경쟁 학원 이동' },
  { value: 'financial', label: '경제적 사유' },
  { value: 'schedule', label: '시간 조절 어려움' },
  { value: 'dissatisfied', label: '불만족' },
  { value: 'other', label: '기타' },
] as const;

interface WithdrawalModalProps {
  student: UnifiedStudent;
  onClose: () => void;
  onConfirm: (data: {
    withdrawalDate: string;
    withdrawalReason?: string;
    withdrawalMemo?: string;
  }) => Promise<void>;
}

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  student,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    withdrawalDate: new Date().toISOString().split('T')[0],
    withdrawalReason: '',
    withdrawalMemo: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.withdrawalDate) {
      alert('퇴원일을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        withdrawalDate: formData.withdrawalDate,
        withdrawalReason: formData.withdrawalReason || undefined,
        withdrawalMemo: formData.withdrawalMemo || undefined,
      });
      onClose();
    } catch (error) {
      console.error('퇴원 처리 실패:', error);
      alert('퇴원 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-sm shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-sm flex items-center justify-center">
              <UserMinus className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#081429]">퇴원 처리</h2>
              <p className="text-xs text-gray-500">{student.name} 학생</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Section 1: 퇴원 정보 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Info className="w-3 h-3 text-[#081429]" />
              <h3 className="text-[#081429] font-bold text-xs">퇴원 정보</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* 퇴원일 Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">
                  퇴원일 <span className="text-red-500">*</span>
                </span>
                <input
                  type="date"
                  value={formData.withdrawalDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, withdrawalDate: e.target.value }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              {/* 퇴원 사유 Row */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">사유</span>
                <select
                  value={formData.withdrawalReason}
                  onChange={(e) => setFormData(prev => ({ ...prev, withdrawalReason: e.target.value }))}
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-white"
                >
                  {WITHDRAWAL_REASONS.map(reason => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>

              {/* 메모 Row */}
              <div className="px-2 py-1.5">
                <span className="text-xs font-medium text-[#373d41] block mb-1">메모</span>
                <textarea
                  value={formData.withdrawalMemo}
                  onChange={(e) => setFormData(prev => ({ ...prev, withdrawalMemo: e.target.value }))}
                  placeholder="퇴원 관련 메모를 입력하세요..."
                  rows={3}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 확인 사항 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-amber-50 border-b border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <h3 className="text-amber-800 font-bold text-xs">확인 사항</h3>
            </div>
            <div className="px-2 py-2 bg-amber-50/50">
              <ul className="text-xs space-y-1 text-amber-800">
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 shrink-0">•</span>
                  <span>학생 상태가 '퇴원'으로 변경됩니다</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 shrink-0">•</span>
                  <span>출석부 및 시간표에서 제외됩니다</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-amber-600 shrink-0">•</span>
                  <span>나중에 '재원' 상태로 복구할 수 있습니다</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-sm animate-spin" />
                  <span>처리 중...</span>
                </>
              ) : (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>퇴원 처리</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WithdrawalModal;
