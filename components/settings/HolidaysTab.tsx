import React, { useState, useEffect } from 'react';
import { Holiday } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch, collection, onSnapshot } from 'firebase/firestore';
import { CalendarClock, Plus, Check, X, Edit, Trash2, ChevronRight } from 'lucide-react';
import { STANDARD_HOLIDAYS } from '../../constants_holidays';

interface HolidaysTabProps {
    holidays: Holiday[];
    isMaster: boolean;
}

const HolidaysTab: React.FC<HolidaysTabProps> = ({ holidays, isMaster }) => {
    // --- Local State ---
    const [localHolidays, setLocalHolidays] = useState<Holiday[]>(holidays);
    const [expandedYear, setExpandedYear] = useState<string>(new Date().getFullYear().toString());
    const [newHolidayDate, setNewHolidayDate] = useState('');
    const [newHolidayName, setNewHolidayName] = useState('');
    const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
    const [editHolidayName, setEditHolidayName] = useState('');

    // Sync props to local state
    useEffect(() => {
        setLocalHolidays(holidays);
    }, [holidays]);

    // --- Handlers ---
    const handleAddHoliday = async () => {
        if (!newHolidayDate || !newHolidayName) return alert('날짜와 이름을 입력해주세요.');
        try {
            await setDoc(doc(db, 'holidays', newHolidayDate), {
                id: newHolidayDate,
                date: newHolidayDate,
                name: newHolidayName,
                type: 'custom'
            });
            setNewHolidayDate('');
            setNewHolidayName('');
        } catch (e) {
            console.error(e);
            alert('공휴일 추가 실패');
        }
    };

    const handleUpdateHoliday = async (holiday: Holiday) => {
        try {
            await setDoc(doc(db, 'holidays', holiday.id), { ...holiday, name: editHolidayName }, { merge: true });
            setEditingHolidayId(null);
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        }
    };

    const handleDeleteHoliday = async (holiday: Holiday) => {
        if (!confirm(`'${holiday.name}' 삭제하시겠습니까?`)) return;
        try {
            await deleteDoc(doc(db, 'holidays', holiday.id));
        } catch (e) {
            console.error(e);
            alert('삭제 실패');
        }
    };

    const handleResetHolidays = async () => {
        if (!confirm('기본 대한민국 공휴일(2024~2030)을 DB에 즉시 등록하시겠습니까?')) return;
        try {
            const batch = writeBatch(db);
            let count = 0;
            for (const h of STANDARD_HOLIDAYS) {
                const ref = doc(db, 'holidays', h.date);
                batch.set(ref, {
                    id: h.date,
                    date: h.date,
                    name: h.name,
                    type: 'public'
                }, { merge: true });
                count++;
            }
            await batch.commit();
            alert(`${count}개의 공휴일 데이터가 등록되었습니다.`);
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Holiday Management (Accordion Style) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-gray-800">
                        <CalendarClock size={16} /> 공휴일 관리
                    </h3>
                    <div className="text-xs text-gray-500">
                        {localHolidays.length}개의 휴일 등록됨
                    </div>
                </div>

                {/* Add New Holiday Form */}
                <div className="p-4 bg-white border-b border-gray-100">
                    <div className="flex gap-2 items-center">
                        <input
                            type="date"
                            value={newHolidayDate}
                            onChange={(e) => setNewHolidayDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                        />
                        <input
                            type="text"
                            placeholder="공휴일 이름 (예: 창립기념일)"
                            value={newHolidayName}
                            onChange={(e) => setNewHolidayName(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#fdb813] outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddHoliday()}
                        />
                        <button
                            onClick={handleAddHoliday}
                            className="bg-[#081429] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#1e293b] flex items-center gap-1"
                        >
                            <Plus size={14} /> 추가
                        </button>
                    </div>
                </div>

                {/* Holiday List Grouped by Year */}
                <div className="max-h-[500px] overflow-y-auto">
                    {Array.from(new Set(localHolidays.map(h => h.date.split('-')[0]))).sort((a, b) => Number(b) - Number(a)).map(year => (
                        <div key={year} className="border-b border-gray-100 last:border-0">
                            <button
                                onClick={() => setExpandedYear(expandedYear === year ? '' : year)}
                                className="w-full flex justify-between items-center p-3 hover:bg-gray-50 transition-colors text-left"
                            >
                                <span className="font-bold text-sm text-gray-700">{year}년</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{localHolidays.filter(h => h.date.startsWith(year)).length}개</span>
                                    <ChevronRight size={14} className={`transition-transform text-gray-400 ${expandedYear === year ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {expandedYear === year && (
                                <div className="bg-gray-50/50 p-2 space-y-1">
                                    {localHolidays
                                        .filter(h => h.date.startsWith(year))
                                        .sort((a, b) => a.date.localeCompare(b.date))
                                        .map(holiday => (
                                            <div key={holiday.id} className="group flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100 text-sm hover:border-[#fdb813]/50 transition-colors">
                                                {editingHolidayId === holiday.id ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <span className="text-gray-500 font-mono text-xs">{holiday.date}</span>
                                                        <input
                                                            type="text"
                                                            value={editHolidayName}
                                                            onChange={(e) => setEditHolidayName(e.target.value)}
                                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateHoliday(holiday)}
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateHoliday(holiday)}
                                                            className="text-green-600 p-1 hover:bg-green-50 rounded"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                        <button onClick={() => setEditingHolidayId(null)} className="text-gray-400 p-1 hover:bg-gray-100 rounded">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${holiday.type === 'public' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                            <span className="font-mono text-gray-500 text-xs">{holiday.date}</span>
                                                            <span className={`font-medium ${holiday.type === 'public' ? 'text-red-700' : 'text-gray-700'}`}>
                                                                {holiday.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingHolidayId(holiday.id);
                                                                    setEditHolidayName(holiday.name);
                                                                }}
                                                                className="p-1.5 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-md"
                                                            >
                                                                <Edit size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteHoliday(holiday)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {localHolidays.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-xs">
                            등록된 공휴일이 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* Reset Holidays (Master only) */}
            {isMaster && (
                <div className="bg-red-50 p-6 rounded-xl shadow-sm border border-red-100">
                    <h3 className="font-bold mb-4 flex gap-2 text-red-900"><CalendarClock size={18} /> 시스템 초기화 (공휴일)</h3>
                    <p className="text-xs text-red-700 mb-4 break-keep">
                        대한민국 기본 공휴일(2024~2030) 데이터를 데이터베이스에 일괄 등록합니다.
                        이미 등록된 날짜는 건너뛰거나 업데이트되며, 기존 사용자 데이터는 삭제되지 않습니다.
                    </p>
                    <button
                        onClick={handleResetHolidays}
                        className="w-full py-3 bg-white text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 border border-red-200 shadow-sm"
                    >
                        🇰🇷 기본 공휴일 데이터 가져오기
                    </button>
                </div>
            )}
        </div>
    );
};

export default HolidaysTab;
