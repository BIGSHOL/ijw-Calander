import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { BillingRecord, BillingItem, PaymentMethod } from '../../types';

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
    studentId: '',
    studentName: '',
    month: selectedMonth,
    items: [{ name: '', amount: 0 }] as BillingItem[],
    dueDate: '',
    paymentMethod: 'card' as PaymentMethod,
    memo: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        studentId: initialData.studentId,
        studentName: initialData.studentName,
        month: initialData.month,
        items: initialData.items,
        dueDate: initialData.dueDate,
        paymentMethod: initialData.paymentMethod || 'card',
        memo: initialData.memo || '',
      });
    }
  }, [initialData]);

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', amount: 0 }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof BillingItem, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: totalAmount,
      paidAmount: initialData?.paidAmount || 0,
      status: initialData?.status || 'pending',
      createdBy: initialData?.createdBy || '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">
            {initialData ? '청구서 수정' : '청구서 생성'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {/* 학생 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학생</label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="학생 이름"
                required
              />
            </div>

            {/* 청구 월 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">청구 월</label>
              <input
                type="month"
                value={formData.month}
                onChange={(e) => setFormData(prev => ({ ...prev, month: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            {/* 청구 항목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">청구 항목</label>
              <div className="space-y-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      placeholder="항목명 (예: 수학)"
                    />
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => handleItemChange(index, 'amount', parseInt(e.target.value) || 0)}
                      className="w-32 px-3 py-2 border rounded-lg text-sm text-right"
                      placeholder="금액"
                    />
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="w-4 h-4" /> 항목 추가
              </button>
            </div>

            {/* 합계 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">총 청구액</span>
                <span className="text-xl font-bold text-emerald-600">
                  {totalAmount.toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 납부 기한 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">납부 기한</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={2}
                placeholder="추가 메모"
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
            {initialData ? '수정' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
};
