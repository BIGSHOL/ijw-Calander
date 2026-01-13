import React, { useState, useCallback } from 'react';
import { ConsultationRecord, UserProfile } from '../../types';
import { useConsultations, useCreateConsultation, useUpdateConsultation, useDeleteConsultation } from '../../hooks/useConsultations';
import { ConsultationDashboard } from './ConsultationDashboard';
import { ConsultationTable } from './ConsultationTable';
import { ConsultationYearView } from './ConsultationYearView';
import { ConsultationForm } from './ConsultationForm';
import { LayoutDashboard, List, Calendar, Plus, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';

interface ConsultationManagerProps {
    userProfile: UserProfile | null;
}

const ConsultationManager: React.FC<ConsultationManagerProps> = ({ userProfile }) => {
    const [view, setView] = useState<'dashboard' | 'table' | 'yearly'>('dashboard');
    const [viewColumns, setViewColumns] = useState<1 | 2>(1); // 1단/2단 보기 상태
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ConsultationRecord | null>(null);

    // Firestore hooks - pass year as number or undefined for 'all'
    // 대시보드(통계 비교), 연간뷰(전체 흐름)에서는 전체 데이터를 불러와야 함
    const yearParam = (selectedYear === 'all' || view === 'dashboard' || view === 'yearly') ? undefined : parseInt(selectedYear, 10);
    const queryMonth = (view === 'yearly' || view === 'dashboard') ? 'all' : selectedMonth;
    const { data: consultations = [], isLoading } = useConsultations({ month: queryMonth, year: yearParam });
    const createConsultation = useCreateConsultation();
    const updateConsultation = useUpdateConsultation();
    const deleteConsultation = useDeleteConsultation();

    const handleAddRecord = useCallback((record: Omit<ConsultationRecord, 'id' | 'createdAt'>) => {
        createConsultation.mutate({
            ...record,
            authorId: userProfile?.uid
        } as Omit<ConsultationRecord, 'id'>, {
            onSuccess: () => {
                setIsFormOpen(false);
            },
            onError: (error) => {
                console.error('상담 등록 오류:', error);
                alert('상담 등록에 실패했습니다.');
            }
        });
    }, [createConsultation, userProfile?.uid]);

    const handleUpdateRecord = useCallback((record: Omit<ConsultationRecord, 'id' | 'createdAt'>) => {
        if (!editingRecord) return;

        updateConsultation.mutate({
            id: editingRecord.id,
            updates: record,
        }, {
            onSuccess: () => {
                setEditingRecord(null);
                setIsFormOpen(false);
            },
            onError: (error) => {
                console.error('상담 수정 오류:', error);
                alert('상담 수정에 실패했습니다.');
            }
        });
    }, [editingRecord, updateConsultation]);

    const handleDeleteRecord = useCallback((id: string) => {
        deleteConsultation.mutate(id, {
            onError: (error) => {
                console.error('상담 삭제 오류:', error);
                alert('상담 삭제에 실패했습니다.');
            }
        });
    }, [deleteConsultation]);

    const openAddModal = () => {
        setEditingRecord(null);
        setIsFormOpen(true);
    };

    const openEditModal = (record: ConsultationRecord) => {
        setEditingRecord(record);
        setIsFormOpen(true);
    };

    // Month navigation - arrows only navigate months (skip 'all')
    const handlePrevMonth = () => {
        if (selectedYear === 'all') return; // 연도 전체일 때는 화살표 비활성화

        if (selectedMonth === 'all') {
            // 전체에서 왼쪽: 작년 12월로
            const currentYear = parseInt(selectedYear, 10);
            setSelectedYear(String(currentYear - 1));
            setSelectedMonth('12');
        } else {
            const currentMonth = parseInt(selectedMonth, 10);
            if (currentMonth === 1) {
                // 1월에서 왼쪽: 작년 12월
                const currentYear = parseInt(selectedYear, 10);
                setSelectedYear(String(currentYear - 1));
                setSelectedMonth('12');
            } else {
                setSelectedMonth(String(currentMonth - 1));
            }
        }
    };

    const handleNextMonth = () => {
        if (selectedYear === 'all') return; // 연도 전체일 때는 화살표 비활성화

        if (selectedMonth === 'all') {
            // 전체에서 오른쪽: 내년 1월로
            const currentYear = parseInt(selectedYear, 10);
            setSelectedYear(String(currentYear + 1));
            setSelectedMonth('1');
        } else {
            const currentMonth = parseInt(selectedMonth, 10);
            if (currentMonth === 12) {
                // 12월에서 오른쪽: 내년 1월
                const currentYear = parseInt(selectedYear, 10);
                setSelectedYear(String(currentYear + 1));
                setSelectedMonth('1');
            } else {
                setSelectedMonth(String(currentMonth + 1));
            }
        }
    };

    const getMonthDisplay = (m: string) => {
        if (m === 'all') return '전체';
        return `${m}월`;
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <div className="mb-4">
                        <ClipboardList className="w-16 h-16 mx-auto text-gray-300" />
                    </div>
                    <p className="text-gray-500">상담 데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
            {/* Desktop Header - Dark Theme to match Main Calendar */}
            <header className="hidden md:flex bg-[#081429] border-b border-white/10 px-6 h-10 justify-between items-center z-10 shadow-lg relative">
                <div className="flex items-center gap-4">
                    {/* Consistent Title Style (Optional, or remove) */}
                    {/* <h2 className="text-sm font-bold text-white tracking-wide">상담 관리</h2>
                    <div className="h-4 w-px bg-white/10"></div> */}

                    {/* View Switcher Tabs - Adjusted sizing */}
                    <div className="flex bg-white/10 p-0.5 rounded-lg border border-white/10">
                        <button
                            onClick={() => setView('dashboard')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'dashboard'
                                ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <LayoutDashboard size={12} />
                            대시보드
                        </button>
                        <button
                            onClick={() => setView('table')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${view === 'table'
                                ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <List size={12} />
                            상담목록
                        </button>
                        <button
                            onClick={() => setView('yearly')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${view === 'yearly'
                                ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Calendar size={12} />
                            연간뷰
                        </button>
                    </div>

                    {/* Year/Month Filter - Show based on view */}
                    {(view === 'table' || view === 'dashboard') && (
                        <>
                            <div className="h-4 w-px bg-white/20"></div>
                            <div className="flex items-center gap-2">
                                {/* Year Select */}
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="px-2 py-0.5 rounded bg-[#1e293b] border border-gray-600 text-white text-xs font-bold focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813] outline-none"
                                >
                                    <option value="all" className="text-black">전체 연도</option>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                        <option key={year} value={year} className="text-black">{year}년</option>
                                    ))}
                                </select>

                                {/* Month Select & Navigation */}
                                <div className="flex items-center bg-[#1e293b] rounded border border-gray-600 p-0">
                                    <button
                                        onClick={handlePrevMonth}
                                        disabled={selectedYear === 'all'}
                                        className="p-0.5 text-gray-400 hover:text-[#fdb813] disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        disabled={selectedYear === 'all'}
                                        className="bg-transparent text-white text-xs font-bold px-2 py-1 outline-none text-center min-w-[60px] cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="all" className="text-black">전체</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={String(m)} className="text-black">{m}월</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleNextMonth}
                                        disabled={selectedYear === 'all'}
                                        className="p-1 text-gray-400 hover:text-[#fdb813] disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* View Column Toggle - Only for Yearly View */}
                    {view === 'yearly' && (
                        <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                            {([1, 2] as const).map((cols) => (
                                <button
                                    key={cols}
                                    onClick={() => setViewColumns(cols)}
                                    className={`
                                    px-2 py-0.5 rounded-md text-xs font-bold transition-all
                                    ${viewColumns === cols
                                            ? 'bg-[#fdb813] text-[#081429] shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }
                                `}
                                >
                                    {cols}단
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all text-xs font-bold"
                    >
                        <Plus size={16} />
                        상담 등록
                    </button>
                </div>
            </header>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-20 bg-slate-50 pt-2 pb-2 px-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between px-2 py-3">
                    <button
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedYear(val);
                                if (val === 'all') {
                                    setSelectedMonth('all');
                                }
                            }}
                            className="appearance-none bg-transparent text-slate-800 font-bold text-base cursor-pointer outline-none pr-4"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                        >
                            <option value="all">전체</option>
                            {[2024, 2025, 2026, 2027, 2028].map(y => (
                                <option key={y} value={String(y)}>{y}년</option>
                            ))}
                        </select>

                        <div className="w-px h-4 bg-slate-200"></div>

                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={selectedYear === 'all'}
                            className={`appearance-none bg-transparent text-slate-800 font-bold text-base cursor-pointer outline-none pr-4 ${selectedYear === 'all' ? 'opacity-50' : ''}`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}
                        >
                            <option value="all">전체</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                <option key={m} value={String(m)}>{m}월</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto p-4 md:p-6" style={{ backgroundColor: '#f8fafc' }}>
                    {view === 'dashboard' && (
                        <ConsultationDashboard
                            data={consultations}
                            month={selectedMonth}
                            year={selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)}
                        />
                    )}

                    {view === 'table' && (
                        <ConsultationTable
                            data={consultations}
                            onEdit={openEditModal}
                            onDelete={handleDeleteRecord}
                        />
                    )}

                    {view === 'yearly' && (
                        <div className="flex flex-col md:flex-row gap-4 h-full">
                            {/* Current Year View */}
                            <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <ConsultationYearView
                                    data={consultations}
                                    currentYear={selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)}
                                    onYearChange={(y) => setSelectedYear(String(y))}
                                />
                            </div>

                            {/* Previous Year Comparison View (2 Columns) */}
                            {viewColumns === 2 && (
                                <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-right duration-300">
                                    <ConsultationYearView
                                        data={consultations}
                                        currentYear={(selectedYear === 'all' ? new Date().getFullYear() : parseInt(selectedYear, 10)) - 1} // 1년 전
                                        onYearChange={(y) => {/* Comparison view logic if needed */ }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Mobile Floating Action Button */}
            <button
                onClick={openAddModal}
                className="md:hidden fixed bottom-24 right-5 bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-400/50 z-40 hover:scale-105 active:scale-95 transition-all"
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-20 pb-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                    onClick={() => setView('dashboard')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <LayoutDashboard size={24} strokeWidth={view === 'dashboard' ? 2.5 : 2} />
                    <span className="text-xxs font-medium">대시보드</span>
                </button>
                <button
                    onClick={() => setView('table')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'table' ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <List size={24} strokeWidth={view === 'table' ? 2.5 : 2} />
                    <span className="text-xxs font-medium">상담목록</span>
                </button>
            </div>

            {/* Modal */}
            <ConsultationForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord}
                initialData={editingRecord}
            />
        </div>
    );
};

export default ConsultationManager;
