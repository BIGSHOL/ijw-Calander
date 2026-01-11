import React from 'react';
import { ALL_WEEKDAYS, MATH_PERIODS, ENGLISH_PERIODS, MATH_PERIOD_TIMES } from '../../../constants';

interface AddClassModalProps {
    isOpen: boolean;
    onClose: () => void;
    newClassName: string;
    setNewClassName: (value: string) => void;
    newTeacher: string;
    setNewTeacher: (value: string) => void;
    newRoom: string;
    setNewRoom: (value: string) => void;
    newSubject: string;
    setNewSubject: (value: string) => void;
    newSchedule: string[];
    toggleScheduleSlot: (day: string, period: string) => void;
    handleAddClass: () => void;
    teacherNames: string[];
}

const AddClassModal: React.FC<AddClassModalProps> = ({
    isOpen,
    onClose,
    newClassName,
    setNewClassName,
    newTeacher,
    setNewTeacher,
    newRoom,
    setNewRoom,
    newSubject,
    setNewSubject,
    newSchedule,
    toggleScheduleSlot,
    handleAddClass,
    teacherNames
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-[#fdb813] px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#081429]">새 수업 추가</h3>
                    <div className="flex gap-2 bg-white/20 p-1 rounded-lg">
                        <button
                            onClick={() => setNewSubject('수학')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${newSubject === '수학' ? 'bg-[#081429] text-white' : 'text-[#081429] hover:bg-white/30'}`}
                        >
                            수학
                        </button>
                        <button
                            onClick={() => setNewSubject('영어')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${newSubject === '영어' ? 'bg-[#081429] text-white' : 'text-[#081429] hover:bg-white/30'}`}
                        >
                            영어
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">수업명</label>
                        <input
                            type="text"
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                            placeholder="수업명 입력"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">강사</label>
                            <select
                                value={newTeacher}
                                onChange={(e) => setNewTeacher(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none appearance-none bg-white"
                            >
                                <option value="">강사 선택</option>
                                {teacherNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xxs font-bold text-gray-500 mb-1">교실</label>
                            <input
                                type="text"
                                value={newRoom}
                                onChange={(e) => setNewRoom(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#fdb813] outline-none"
                                placeholder="301호"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-2">시간표</label>
                        <div className="flex">
                            {/* Time labels column */}
                            <div className="flex flex-col mr-2">
                                <div className="text-xs font-bold text-gray-400 mb-1 h-[24px]"></div>
                                {(newSubject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => (
                                    <div key={period} className="text-xxs text-gray-600 font-bold h-[32px] flex items-center justify-end pr-2 whitespace-nowrap">
                                        {MATH_PERIOD_TIMES[period] || period}
                                    </div>
                                ))}
                            </div>
                            {/* Days grid */}
                            <div className="grid grid-cols-7 gap-1 flex-1">
                                {ALL_WEEKDAYS.map(day => (
                                    <div key={day} className="text-center">
                                        <div className={`text-xs font-bold mb-1 ${(day === '토' || day === '일') ? 'text-orange-500' : 'text-gray-500'}`}>{day}</div>
                                        {(newSubject === '수학' ? MATH_PERIODS : ENGLISH_PERIODS).map(period => {
                                            const slot = `${day} ${period}`;
                                            const isSelected = newSchedule.includes(slot);
                                            return (
                                                <button
                                                    key={slot}
                                                    onClick={() => toggleScheduleSlot(day, period)}
                                                    className={`w-full p-1.5 text-xs rounded mb-1 transition-all ${isSelected
                                                        ? 'bg-[#fdb813] text-[#081429] font-bold shadow-sm'
                                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                        }`}
                                                    title={MATH_PERIOD_TIMES[period] || ''}
                                                >
                                                    {period.replace('교시', '')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 p-6 pt-0">
                    <button onClick={onClose} className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold">
                        취소
                    </button>
                    <button onClick={handleAddClass} className="px-4 py-1.5 bg-[#fdb813] text-[#081429] rounded-lg text-sm font-bold hover:brightness-110">
                        추가
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddClassModal;
