import React, { useState } from 'react';
import { Student, SalaryConfig } from '../types';
import { X, Trash2, CalendarDays, Users, UserCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Student) => void;
  onDelete: (id: string) => void;
  initialData?: Student | null;
  salaryConfig: SalaryConfig;
  currentViewDate: Date;
  existingGroups: string[];
}

const StudentModal: React.FC<Props> = ({ isOpen, onClose, onSave, onDelete, initialData, salaryConfig, currentViewDate, existingGroups }) => {
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    school: '',
    grade: '',
    group: '',
    salarySettingId: '',
    days: [],
    attendance: {},
    startDate: '',
    endDate: null,
    isHomeroom: false,
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Default to the first available salary setting
      const defaultSalaryId = salaryConfig.items.length > 0 ? salaryConfig.items[0].id : '';

      // Default start date is the 1st of currently viewed month
      const year = currentViewDate.getFullYear();
      const month = (currentViewDate.getMonth() + 1).toString().padStart(2, '0');
      const today = new Date().toISOString().split('T')[0]; // fallback

      setFormData({
        id: crypto.randomUUID(),
        name: '',
        school: '',
        grade: '',
        group: '',
        salarySettingId: defaultSalaryId,
        days: [],
        attendance: {},
        startDate: `${year}-${month}-01`, // Default to 1st of month
        endDate: null,
        isHomeroom: false,
      });
    }
  }, [initialData, isOpen, salaryConfig, currentViewDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.salarySettingId && formData.startDate) {
      onSave(formData as Student);
      onClose();
    }
  };

  const handleDelete = () => {
    if (initialData && initialData.id) {
      onDelete(initialData.id);
    }
  }

  const toggleDay = (day: string) => {
    const currentDays = formData.days || [];
    if (currentDays.includes(day)) {
      setFormData({ ...formData, days: currentDays.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, days: [...currentDays, day] });
    }
  };

  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? '학생 정보 수정' : '새 학생 추가'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                placeholder="홍길동"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 w-full hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isHomeroom || false}
                  onChange={(e) => setFormData({ ...formData, isHomeroom: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="flex items-center gap-1.5">
                  <UserCheck size={16} className={formData.isHomeroom ? "text-indigo-600" : "text-gray-400"} />
                  <span className={`text-sm font-medium ${formData.isHomeroom ? "text-indigo-700" : "text-gray-500"}`}>담임 관리 학생</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">그룹 (반 이름)</label>
              <input
                disabled
                type="text"
                value={formData.group || ''}
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                title="시간표에서 자동으로 설정됩니다."
              />
              <p className="text-[10px] text-gray-400 mt-1">* 시간표 연동으로 자동 설정됩니다.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학교</label>
              <input
                type="text"
                placeholder="OO초등학교"
                value={formData.school}
                onChange={e => setFormData({ ...formData, school: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
              <input
                type="text"
                placeholder="예: 3, 중1"
                value={formData.grade}
                onChange={e => setFormData({ ...formData, grade: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수업 과정 (급여 기준) <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.salarySettingId}
                onChange={e => setFormData({ ...formData, salarySettingId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>선택하세요</option>
                {salaryConfig.items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.type === 'fixed' ? '고정급' : '비율제'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-3 text-slate-700 font-bold text-sm">
              <CalendarDays size={16} />
              수강 기간 설정 (일 단위)
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">수강 시작일 <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">수강 종료일 (선택)</label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="계속 수강중"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  * 이 날짜 이후에는 출석부에서 제외되거나 비활성화됩니다.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">수업 요일</label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map(day => (
                <button
                  disabled
                  key={day}
                  type="button"
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-not-allowed ${formData.days?.includes(day)
                    ? 'bg-blue-100 text-blue-700 border-blue-200 border'
                    : 'bg-gray-50 text-gray-400 border border-transparent'
                    }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">* 수업 요일은 시간표 연동으로 자동 설정됩니다.</p>
          </div>

          <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">

            <button
              type="submit"
              disabled={salaryConfig.items.length === 0}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {initialData ? '수정 완료' : '학생 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentModal;