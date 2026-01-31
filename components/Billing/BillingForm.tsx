import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { BillingRecord } from '../../types';

interface BillingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<BillingRecord>) => void;
  initialData?: BillingRecord | null;
  selectedMonth: string;
}

export const BillingForm: React.FC<BillingFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  selectedMonth,
}) => {
  const [formData, setFormData] = useState({
    externalStudentId: '',
    studentName: '',
    grade: '',
    school: '',
    parentPhone: '',
    studentPhone: '',
    category: '수업',
    month: selectedMonth,
    billingDay: 1,
    billingName: '',
    billedAmount: 0,
    discountAmount: 0,
    pointsUsed: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    status: 'pending' as 'pending' | 'paid',
    paymentMethod: '',
    cardCompany: '',
    paidDate: '',
    cashReceipt: '',
    memo: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        externalStudentId: initialData.externalStudentId,
        studentName: initialData.studentName,
        grade: initialData.grade,
        school: initialData.school,
        parentPhone: initialData.parentPhone,
        studentPhone: initialData.studentPhone,
        category: initialData.category,
        month: initialData.month,
        billingDay: initialData.billingDay,
        billingName: initialData.billingName,
        billedAmount: initialData.billedAmount,
        discountAmount: initialData.discountAmount,
        pointsUsed: initialData.pointsUsed,
        paidAmount: initialData.paidAmount,
        unpaidAmount: initialData.unpaidAmount,
        status: initialData.status,
        paymentMethod: initialData.paymentMethod,
        cardCompany: initialData.cardCompany,
        paidDate: initialData.paidDate,
        cashReceipt: initialData.cashReceipt,
        memo: initialData.memo,
      });
    }
  }, [initialData]);

  // 미납금 자동 계산
  const effectiveUnpaid = formData.billedAmount - formData.discountAmount - formData.pointsUsed - formData.paidAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const status = effectiveUnpaid <= 0 ? 'paid' : 'pending';
    onSubmit({
      ...formData,
      unpaidAmount: Math.max(0, effectiveUnpaid),
      status,
      createdAt: initialData?.createdAt || '',
      updatedAt: '',
    });
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">
            {initialData ? '수납 수정' : '수납 추가'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {/* 학생 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => updateField('studentName', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                <input
                  type="text"
                  value={formData.grade}
                  onChange={(e) => updateField('grade', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            {/* 청구 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구월</label>
                <input
                  type="month"
                  value={formData.month}
                  onChange={(e) => updateField('month', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구일</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.billingDay}
                  onChange={(e) => updateField('billingDay', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수납명</label>
              <input
                type="text"
                value={formData.billingName}
                onChange={(e) => updateField('billingName', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="예: [수학] 중2 정규반 월수금"
                required
              />
            </div>

            {/* 금액 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">청구액</label>
                <input
                  type="number"
                  value={formData.billedAmount || ''}
                  onChange={(e) => updateField('billedAmount', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">할인액</label>
                <input
                  type="number"
                  value={formData.discountAmount || ''}
                  onChange={(e) => updateField('discountAmount', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">적립금 사용</label>
                <input
                  type="number"
                  value={formData.pointsUsed || ''}
                  onChange={(e) => updateField('pointsUsed', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">실제 납부액</label>
                <input
                  type="number"
                  value={formData.paidAmount || ''}
                  onChange={(e) => updateField('paidAmount', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-right"
                />
              </div>
            </div>

            {/* 미납금 자동 계산 표시 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">미납 금액</span>
                <span className={`text-lg font-bold ${effectiveUnpaid > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {Math.max(0, effectiveUnpaid).toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 결제 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">결제수단</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">선택</option>
                  <option value="카드">카드</option>
                  <option value="온라인(계좌)">계좌이체</option>
                  <option value="현금">현금</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카드사</label>
                <input
                  type="text"
                  value={formData.cardCompany}
                  onChange={(e) => updateField('cardCompany', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="예: KB국민카드"
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => updateField('memo', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg resize-none text-sm"
                rows={2}
              />
            </div>
          </div>
        </form>

        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            {initialData ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};
