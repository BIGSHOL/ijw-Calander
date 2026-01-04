import React, { useState, useCallback } from 'react';
import { ConsultationRecord, UserProfile } from '../../types';
import { useConsultations, useCreateConsultation, useUpdateConsultation, useDeleteConsultation } from '../../hooks/useConsultations';
import { ConsultationDashboard } from './ConsultationDashboard';
import { ConsultationTable } from './ConsultationTable';
import { ConsultationForm } from './ConsultationForm';
import { LayoutDashboard, List, Plus, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

interface ConsultationManagerProps {
    userProfile: UserProfile | null;
}

const ConsultationManager: React.FC<ConsultationManagerProps> = ({ userProfile }) => {
    const [view, setView] = useState<'dashboard' | 'table'>('dashboard');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Modal State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ConsultationRecord | null>(null);

    // Firestore hooks
    const { data: consultations = [], isLoading } = useConsultations({ month: selectedMonth, year: selectedYear });
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

    // Month navigation
    const months = ['all', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

    const handlePrevMonth = () => {
        const currentIndex = months.indexOf(selectedMonth);
        const prevIndex = (currentIndex - 1 + months.length) % months.length;
        setSelectedMonth(months[prevIndex]);
    };

    const handleNextMonth = () => {
        const currentIndex = months.indexOf(selectedMonth);
        const nextIndex = (currentIndex + 1) % months.length;
        setSelectedMonth(months[nextIndex]);
    };

    const getMonthDisplay = (m: string) => {
        if (m === 'all') return '전체 기간';
        return `${m}월`;
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="text-gray-500">상담 데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900">
            {/* Desktop Header */}
            <header className="hidden md:flex bg-white border-b border-slate-200 px-8 py-4 justify-between items-center z-10">
                <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {view === 'dashboard' ? '운영 현황' : '상담 관리'}
                    </h2>
                    <div className="h-8 w-px bg-slate-200 mx-4"></div>
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setView('dashboard')}
                            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutDashboard size={16} />
                            대시보드
                        </button>
                        <button
                            onClick={() => setView('table')}
                            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <List size={16} />
                            상담목록
                        </button>
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-4"></div>
                    {/* Month Filter */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['all', String(new Date().getMonth()), String(new Date().getMonth() + 1)].map((m) => (
                            <button
                                key={m}
                                onClick={() => setSelectedMonth(m)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${selectedMonth === m ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {getMonthDisplay(m)}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Plus size={20} />
                    <span>상담 등록</span>
                </button>
            </header>

            {/* Mobile Month Filter */}
            <div className="md:hidden sticky top-0 z-20 bg-slate-50 pt-2 pb-2 px-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between px-2 py-3">
                    <button
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-slate-800 font-bold text-base cursor-pointer">
                            {selectedYear}년
                            <ChevronDown size={14} className="text-slate-400 mt-0.5" />
                        </div>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <div className="flex items-center gap-1 text-slate-800 font-bold text-base cursor-pointer">
                            {getMonthDisplay(selectedMonth)}
                            <ChevronDown size={14} className="text-slate-400 mt-0.5" />
                        </div>
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
            <div className="flex-1 overflow-y-auto bg-slate-50">
                <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
                    {view === 'dashboard' ? (
                        <ConsultationDashboard data={consultations} month={selectedMonth} year={selectedYear} />
                    ) : (
                        <ConsultationTable
                            data={consultations}
                            onEdit={openEditModal}
                            onDelete={handleDeleteRecord}
                        />
                    )}
                </div>
            </div>

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
                    <span className="text-[10px] font-medium">대시보드</span>
                </button>
                <button
                    onClick={() => setView('table')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'table' ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                    <List size={24} strokeWidth={view === 'table' ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">상담목록</span>
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
