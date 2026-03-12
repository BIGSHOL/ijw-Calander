import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTuitionHolidays } from '../../hooks/useTuitionHolidays';

const YEARS = [2024, 2025, 2026, 2027, 2028];

const formatDate = (dateStr: string): string => {
  // 로컬 시간대 기준으로 파싱
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dateStr} (${days[date.getDay()]})`;
};

export const TuitionHolidayManager: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const {
    holidays, isLoading, isSaving, isMigrating,
    saveHoliday, deleteHoliday, migrateHolidays,
  } = useTuitionHolidays();

  // DB 문서에 year 필드가 없을 수 있으므로 date에서 추출
  const filteredHolidays = holidays.filter(h => {
    const year = h.year || parseInt(h.date?.split('-')[0]);
    return year === selectedYear;
  });

  const handleAddHoliday = async () => {
    if (!newDate || !newName.trim()) {
      alert('날짜와 공휴일 이름을 입력해주세요.');
      return;
    }
    try {
      const year = parseInt(newDate.split('-')[0]);
      await saveHoliday({ date: newDate, name: newName.trim(), year });
      setNewDate('');
      setNewName('');
    } catch (err) {
      console.error('공휴일 저장 오류:', err);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('이 공휴일을 삭제하시겠습니까?')) return;
    try {
      await deleteHoliday(id);
    } catch (err) {
      console.error('공휴일 삭제 오류:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-[#373d41]/20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[#081429] flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#fdb813]" />
          공휴일 관리
        </h2>
      </div>

      {/* 연도 선택 */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => setSelectedYear(y => Math.max(2024, y - 1))}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-2">
          {YEARS.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedYear === year
                  ? 'bg-[#081429] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
        <button
          onClick={() => setSelectedYear(y => Math.min(2028, y + 1))}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* 새 공휴일 추가 */}
      <div className="bg-slate-50 p-4 rounded-lg mb-6">
        <h3 className="text-sm font-semibold text-slate-500 mb-3">새 공휴일 추가</h3>
        <div className="flex gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#fdb813] outline-none"
          />
          <input
            type="text"
            placeholder="공휴일 이름 (예: 설날)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddHoliday()}
            className="flex-[2] p-2 border border-slate-300 rounded focus:ring-2 focus:ring-[#fdb813] outline-none"
          />
          <button
            onClick={handleAddHoliday}
            disabled={isSaving}
            className="flex items-center gap-1 px-4 py-2 bg-[#fdb813] text-[#081429] rounded font-bold hover:bg-[#fdc943] transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            추가
          </button>
        </div>
      </div>

      {/* 공휴일 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#fdb813]" />
        </div>
      ) : filteredHolidays.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{selectedYear}년 등록된 공휴일이 없습니다.</p>
          <p className="text-sm mt-1">"기본 데이터 불러오기" 버튼을 클릭하여 공휴일을 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredHolidays.map((holiday) => (
            <div
              key={holiday.id}
              className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#fdb813]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#081429]" />
                </div>
                <div>
                  <div className="font-medium text-slate-700">{holiday.name}</div>
                  <div className="text-sm text-slate-400">{formatDate(holiday.date)}</div>
                </div>
              </div>
              <button
                onClick={() => handleDeleteHoliday(holiday.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 요약 */}
      <div className="mt-4 pt-4 border-t border-slate-200 text-sm text-slate-500 text-center">
        {selectedYear}년 총 {filteredHolidays.length}개의 공휴일
      </div>
    </div>
  );
};
