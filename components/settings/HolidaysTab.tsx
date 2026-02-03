import React, { useState, useEffect } from 'react';
import { Holiday } from '../../types';
import { db } from '../../firebaseConfig';
import { setDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Calendar, Plus, Check, X, Edit, Trash2, ChevronRight, List, Download } from 'lucide-react';
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
        <div className="space-y-2">
            {/* Section 1: 기본 공휴일 (Standard Holidays Import) */}
            {isMaster && (
                <div className="bg-white border border-gray-200 overflow-hidden">
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                        <Download className="w-3 h-3 text-[#081429]" />
                        <h3 className="text-[#081429] font-bold text-xs">기본 공휴일</h3>
                    </div>
                    <div className="p-3">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    <p className="text-xs text-gray-600 mb-1 font-medium">대한민국 공휴일 데이터 가져오기</p>
                                    <p className="text-xxs text-gray-400 break-keep">
                                        2024~2030년 대한민국 기본 공휴일 데이터를 일괄 등록합니다.
                                        이미 등록된 날짜는 건너뛰거나 업데이트되며, 기존 사용자 데이터는 삭제되지 않습니다.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleResetHolidays}
                                className="w-full py-2 bg-[#081429] text-white rounded-sm font-bold hover:bg-[#1e293b] transition-all flex items-center justify-center gap-2 text-xs"
                            >
                                <Download size={14} />
                                기본 공휴일 가져오기 ({STANDARD_HOLIDAYS.length}개)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Section 2: 커스텀 공휴일 (Existing Holidays List) */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center gap-1">
                        <List className="w-3 h-3 text-[#081429]" />
                        <h3 className="text-[#081429] font-bold text-xs">공휴일 목록</h3>
                    </div>
                    <span className="text-xxs text-gray-400">{localHolidays.length}개 등록됨</span>
                </div>

                {/* Holiday List Grouped by Year */}
                <div className="max-h-[400px] overflow-y-auto">
                    {Array.from(new Set(localHolidays.map(h => h.date.split('-')[0]))).sort((a, b) => Number(b) - Number(a)).map(year => (
                        <div key={year} className="border-b border-gray-100 last:border-0">
                            <button
                                onClick={() => setExpandedYear(expandedYear === year ? '' : year)}
                                className="w-full flex justify-between items-center px-2 py-1.5 hover:bg-gray-50 transition-colors text-left"
                            >
                                <span className="font-bold text-xs text-gray-700">{year}년</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xxs text-gray-400">{localHolidays.filter(h => h.date.startsWith(year)).length}개</span>
                                    <ChevronRight size={12} className={`transition-transform text-gray-400 ${expandedYear === year ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {expandedYear === year && (
                                <div className="bg-gray-50/50 p-2 space-y-1">
                                    {localHolidays
                                        .filter(h => h.date.startsWith(year))
                                        .sort((a, b) => a.date.localeCompare(b.date))
                                        .map(holiday => (
                                            <div key={holiday.id} className="group flex items-center justify-between px-2 py-1.5 bg-white rounded-sm border border-gray-100 hover:border-[#fdb813]/50 transition-colors">
                                                {editingHolidayId === holiday.id ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <span className="text-gray-500 font-mono text-xxs">{holiday.date}</span>
                                                        <input
                                                            type="text"
                                                            value={editHolidayName}
                                                            onChange={(e) => setEditHolidayName(e.target.value)}
                                                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#fdb813] outline-none"
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateHoliday(holiday)}
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateHoliday(holiday)}
                                                            className="text-green-600 p-1 hover:bg-green-50 rounded"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                        <button onClick={() => setEditingHolidayId(null)} className="text-gray-400 p-1 hover:bg-gray-100 rounded">
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1 h-1 rounded-sm ${holiday.type === 'public' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                            <span className="font-mono text-gray-500 text-xxs">{holiday.date}</span>
                                                            <span className={`text-xs font-medium ${holiday.type === 'public' ? 'text-red-700' : 'text-gray-700'}`}>
                                                                {holiday.name}
                                                            </span>
                                                            {holiday.type === 'public' && (
                                                                <span className="text-xxs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">공휴일</span>
                                                            )}
                                                        </div>
                                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingHolidayId(holiday.id);
                                                                    setEditHolidayName(holiday.name);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-[#081429] hover:bg-gray-100 rounded-sm"
                                                            >
                                                                <Edit size={11} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteHoliday(holiday)}
                                                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm"
                                                            >
                                                                <Trash2 size={11} />
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

            {/* Section 3: 공휴일 추가 (Add Holiday Form) */}
            <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                    <Plus className="w-3 h-3 text-[#081429]" />
                    <h3 className="text-[#081429] font-bold text-xs">공휴일 추가</h3>
                </div>
                <div className="p-2">
                    <div className="divide-y divide-gray-100">
                        {/* Date Input Row */}
                        <div className="flex items-center gap-2 py-1.5">
                            <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="w-10 shrink-0 text-xs font-medium text-[#373d41]">날짜</span>
                            <input
                                type="date"
                                value={newHolidayDate}
                                onChange={(e) => setNewHolidayDate(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                            />
                        </div>

                        {/* Name Input Row */}
                        <div className="flex items-center gap-2 py-1.5">
                            <Edit className="w-3 h-3 text-gray-400 shrink-0" />
                            <span className="w-10 shrink-0 text-xs font-medium text-[#373d41]">이름</span>
                            <input
                                type="text"
                                placeholder="예: 창립기념일, 임시공휴일"
                                value={newHolidayName}
                                onChange={(e) => setNewHolidayName(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddHoliday()}
                            />
                        </div>

                        {/* Add Button Row */}
                        <div className="pt-2">
                            <button
                                onClick={handleAddHoliday}
                                disabled={!newHolidayDate || !newHolidayName}
                                className="w-full bg-[#081429] text-white px-3 py-1.5 rounded-sm text-xs font-bold hover:bg-[#1e293b] disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
                            >
                                <Plus size={12} /> 공휴일 추가
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HolidaysTab;
