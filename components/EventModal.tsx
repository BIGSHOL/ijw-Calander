
import React, { useState, useEffect } from 'react';
import { CalendarEvent, Department } from '../types';
import { EVENT_COLORS } from '../constants';
// Added Edit3 and Plus to the imports to fix "Cannot find name" errors on line 95
import { X, Trash2, Clock, Users, AlignLeft, Type, Edit3, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  initialDate?: string;
  initialDepartmentId?: string;
  existingEvent?: CalendarEvent | null;
  departments: Department[];
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  initialDepartmentId,
  existingEvent,
  departments,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (existingEvent) {
        setTitle(existingEvent.title);
        setDescription(existingEvent.description || '');
        setParticipants(existingEvent.participants || '');
        setDepartmentId(existingEvent.departmentId);
        setStartDate(existingEvent.startDate);
        setEndDate(existingEvent.endDate);
        setStartTime(existingEvent.startTime || '');
        setEndTime(existingEvent.endTime || '');
        const cIndex = EVENT_COLORS.findIndex(c => c.value === existingEvent.color);
        setColorIndex(cIndex !== -1 ? cIndex : 0);
      } else {
        setTitle('');
        setDescription('');
        setParticipants('');
        setDepartmentId(initialDepartmentId || departments[0]?.id || '');

        const todayStr = initialDate || format(new Date(), 'yyyy-MM-dd');
        setStartDate(todayStr);
        setEndDate(todayStr);

        const now = new Date();
        const timeStr = format(now, 'HH:mm');
        setStartTime(timeStr);
        setEndTime(timeStr);

        setColorIndex(0);
      }
    }
  }, [isOpen, existingEvent, initialDate, initialDepartmentId, departments]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: existingEvent?.id || crypto.randomUUID(),
      title,
      description,
      participants,
      departmentId,
      startDate,
      endDate,
      startTime,
      endTime,
      color: EVENT_COLORS[colorIndex].value,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 relative max-h-[90vh] overflow-hidden border border-gray-200">
        <div className="bg-[#081429] p-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {existingEvent ? <Edit3 size={20} className="text-[#fdb813]" /> : <Plus size={20} className="text-[#fdb813]" />}
            {existingEvent ? '일정 수정' : '새 일정 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-64px)]">
          {/* Title */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Type size={14} className="text-[#fdb813]" /> 제목
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium"
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5">
              부서
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none bg-white font-medium cursor-pointer"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Range */}
          <div className="grid grid-cols-1 gap-4">
            {/* Start */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider flex items-center gap-1">
                <Clock size={14} className="text-[#fdb813]" /> 시작
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
              </div>
            </div>

            {/* End */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider flex items-center gap-1">
                <Clock size={14} className="text-[#fdb813]" /> 종료
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold"
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Users size={14} className="text-[#fdb813]" /> 참가자
            </label>
            <input
              type="text"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none font-medium"
              placeholder="참가자를 입력하세요 (선택)"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlignLeft size={14} className="text-[#fdb813]" /> 상세 내용
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none min-h-[100px] resize-y font-medium text-sm"
              placeholder="일정의 자세한 내용을 입력하세요"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
              색상 라벨
            </label>
            <div className="flex gap-3 flex-wrap">
              {EVENT_COLORS.map((c, idx) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColorIndex(idx)}
                  className={`w-10 h-10 rounded-full border-4 transition-all ${colorIndex === idx ? 'border-[#081429] scale-110 shadow-lg' : 'border-white shadow hover:scale-105'
                    }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-6 border-t border-gray-100">
            {existingEvent ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete(existingEvent.id);
                    onClose();
                  }
                }}
                className="text-red-500 hover:text-red-700 font-bold flex items-center gap-1 text-sm px-4 py-2 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 size={18} /> 삭제
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-[#373d41] hover:bg-gray-100 rounded-xl text-sm font-bold transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 bg-[#fdb813] text-[#081429] rounded-xl hover:brightness-110 text-sm font-extrabold shadow-lg transition-all"
              >
                저장
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
