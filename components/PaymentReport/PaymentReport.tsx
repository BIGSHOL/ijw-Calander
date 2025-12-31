import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    FileText,
    Trash2,
    Edit2,
    Sparkles,
    LayoutDashboard,
    Printer,
    RefreshCw,
    Sheet,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Copy
} from 'lucide-react';
import { EntryForm } from './EntryForm';
import { TuitionChart } from './TuitionChart';
import { generateReportInsight } from '../../services/geminiService';
import { fetchSheetData } from '../../services/sheetService';
import { TuitionEntry } from '../../types';
import ReactMarkdown from 'react-markdown';

type TuitionHistory = Record<string, TuitionEntry[]>;

interface PaymentReportProps {
    // Future props if needed
}

const PaymentReport: React.FC<PaymentReportProps> = () => {
    const [currentPeriod, setCurrentPeriod] = useState<string>(() => {
        return new Date().toISOString().slice(0, 7);
    });

    const [history, setHistory] = useState<TuitionHistory>(() => {
        const savedHistory = localStorage.getItem('tuition_history');
        if (savedHistory) {
            return JSON.parse(savedHistory);
        }
        const oldData = localStorage.getItem('tuition_entries');
        if (oldData) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            return { [currentMonth]: JSON.parse(oldData) };
        }
        return {};
    });

    const [entries, setEntries] = useState<TuitionEntry[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TuitionEntry | null>(null);
    const [aiReport, setAiReport] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [viewMode, setViewMode] = useState<'dashboard' | 'report'>('dashboard');

    useEffect(() => {
        setEntries(history[currentPeriod] || []);
        setAiReport('');
    }, [currentPeriod, history]);

    const updateHistory = (newEntries: TuitionEntry[]) => {
        const newHistory = { ...history, [currentPeriod]: newEntries };
        setHistory(newHistory);
        localStorage.setItem('tuition_history', JSON.stringify(newHistory));
        localStorage.setItem('tuition_entries', JSON.stringify(newEntries));
    };

    const totalRevenue = useMemo(() => entries.reduce((acc, curr) => acc + curr.projectedFee, 0), [entries]);
    const formattedTotal = new Intl.NumberFormat('ko-KR').format(totalRevenue);

    const existingAcademies = useMemo(() => {
        const allEntries = Object.values(history).flat() as TuitionEntry[];
        const names = new Set(allEntries.map(e => e.academyName));
        return Array.from(names).sort();
    }, [history]);

    const previousMonthData = useMemo(() => {
        const date = new Date(currentPeriod + "-01");
        date.setMonth(date.getMonth() - 1);
        const prevKey = date.toISOString().slice(0, 7);
        return history[prevKey] || [];
    }, [currentPeriod, history]);

    const getDiff = (academyName: string, currentFee: number) => {
        const prevEntry = previousMonthData.find(e => e.academyName === academyName);
        const prevFee = prevEntry ? prevEntry.projectedFee : 0;
        return currentFee - prevFee;
    };

    const handlePeriodChange = (direction: 'prev' | 'next') => {
        const date = new Date(currentPeriod + "-01");
        date.setMonth(date.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentPeriod(date.toISOString().slice(0, 7));
    };

    const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) setCurrentPeriod(e.target.value);
    };

    const handleSave = (entryData: Omit<TuitionEntry, 'id'> | TuitionEntry) => {
        let newEntries;
        if ('id' in entryData) {
            newEntries = entries.map(e => e.id === entryData.id ? entryData : e);
        } else {
            const newEntry: TuitionEntry = {
                ...entryData,
                id: crypto.randomUUID(),
            };
            newEntries = [...entries, newEntry];
        }
        setEntries(newEntries);
        updateHistory(newEntries);
        setIsFormOpen(false);
        setEditingEntry(null);
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            const newEntries = entries.filter(e => e.id !== id);
            setEntries(newEntries);
            updateHistory(newEntries);
        }
    };

    const handleEdit = (entry: TuitionEntry) => {
        setEditingEntry(entry);
        setIsFormOpen(true);
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        const enrichedEntries = entries.map(e => ({
            ...e,
            diff: getDiff(e.academyName, e.projectedFee)
        }));
        const report = await generateReportInsight(enrichedEntries);
        setAiReport(report || '');
        setIsGenerating(false);
    };

    const handleSyncSheet = async () => {
        if (!confirm(`[${currentPeriod}] 데이터를 구글 시트에서 가져오시겠습니까?\n현재 월의 기존 데이터는 덮어씌워집니다.`)) return;

        setIsSyncing(true);
        try {
            const sheetData = await fetchSheetData();
            if (sheetData.length === 0) {
                alert('가져올 데이터가 없거나 시트를 읽을 수 없습니다.');
            } else {
                setEntries(sheetData);
                updateHistory(sheetData);
                alert(`${sheetData.length}건의 데이터를 ${currentPeriod}월에 동기화했습니다.`);
                setAiReport('');
            }
        } catch (e) {
            alert('데이터 동기화 실패: 시트 접근 권한을 확인해주세요.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCopyPrevious = () => {
        const curr = new Date(currentPeriod + "-01");
        curr.setMonth(curr.getMonth() - 1);
        const prevMonthStr = curr.toISOString().slice(0, 7);
        const prevData = history[prevMonthStr];

        if (!prevData || prevData.length === 0) {
            alert(`${prevMonthStr}월에 데이터가 없습니다.`);
            return;
        }

        if (!confirm(`${prevMonthStr}월 데이터에서 ${prevData.length}개의 사업장 정보를 가져오시겠습니까?`)) return;

        const clonedData: TuitionEntry[] = prevData.map(d => ({
            ...d,
            id: crypto.randomUUID(),
            projectedFee: 0,
            reason: '',
            category: 'steady'
        }));

        setEntries(clonedData);
        updateHistory(clonedData);
    };

    const ApprovalBox = () => (
        <div className="flex justify-end mb-8 print:mb-4">
            <table className="border-collapse border border-[#373d41] text-center text-xs">
                <tbody>
                    <tr>
                        <td className="border border-[#373d41] bg-gray-100 p-1 w-16">담당</td>
                        <td className="border border-[#373d41] bg-gray-100 p-1 w-16">원장</td>
                        <td className="border border-[#373d41] bg-gray-100 p-1 w-16">대표</td>
                    </tr>
                    <tr>
                        <td className="border border-[#373d41] h-16"></td>
                        <td className="border border-[#373d41] h-16"></td>
                        <td className="border border-[#373d41] h-16"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 text-[#373d41] font-sans pb-20 print:bg-white print:pb-0">
            {/* Header */}
            <header className="bg-[#081429] border-b border-white/10 sticky top-0 z-30 print:hidden">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#fdb813] p-2 rounded-lg hidden sm:block">
                            <FileText className="text-[#081429] h-5 w-5" />
                        </div>

                        <div className="flex items-center bg-white/10 rounded-lg p-1">
                            <button onClick={() => handlePeriodChange('prev')} className="p-1 hover:bg-white/10 rounded-md text-gray-300 transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="relative mx-2 group">
                                <input
                                    type="month"
                                    value={currentPeriod}
                                    onChange={handleDateInput}
                                    className="bg-transparent border-none font-bold text-white text-lg focus:ring-0 p-0 cursor-pointer w-[140px] text-center"
                                />
                                <span className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Calendar size={14} />
                                </span>
                            </div>
                            <button onClick={() => handlePeriodChange('next')} className="p-1 hover:bg-white/10 rounded-md text-gray-300 transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {viewMode === 'dashboard' && (
                            <button
                                onClick={handleSyncSheet}
                                disabled={isSyncing}
                                className="text-[#fdb813] hover:bg-[#fdb813]/10 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-[#fdb813]/30"
                                title="구글 시트 동기화"
                            >
                                {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Sheet size={18} />}
                                <span className="hidden sm:inline">시트 동기화</span>
                            </button>
                        )}
                        <button
                            onClick={() => setViewMode(prev => prev === 'dashboard' ? 'report' : 'dashboard')}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'report'
                                    ? "bg-[#fdb813] text-[#081429]"
                                    : "text-gray-300 hover:bg-white/10"
                                }`}
                        >
                            {viewMode === 'report' ? <LayoutDashboard size={18} /> : <Printer size={18} />}
                            {viewMode === 'report' ? '대시보드' : '인쇄용 뷰'}
                        </button>
                        {viewMode === 'dashboard' && (
                            <button
                                onClick={() => { setEditingEntry(null); setIsFormOpen(true); }}
                                className="bg-[#fdb813] hover:brightness-110 text-[#081429] px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
                            >
                                <Plus size={18} />
                                <span className="hidden sm:inline">신규 등록</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:max-w-none print:p-0 print:m-0">

                {/* Empty State */}
                {entries.length === 0 && viewMode === 'dashboard' && (
                    <div className="mb-8 p-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-center bg-white/50">
                        <h3 className="text-lg font-semibold text-[#081429] mb-2">{currentPeriod} 데이터가 없습니다.</h3>
                        <p className="text-[#373d41] mb-6 max-w-md">
                            새로운 데이터를 직접 등록하거나, 구글 시트에서 가져오거나, 지난달 데이터를 복사하여 시작할 수 있습니다.
                        </p>
                        <div className="flex gap-3 flex-wrap justify-center">
                            <button
                                onClick={handleCopyPrevious}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-[#373d41] rounded-lg hover:bg-gray-50 hover:border-[#fdb813] transition-all shadow-sm"
                            >
                                <Copy size={18} className="text-[#fdb813]" />
                                지난달 사업장 목록 가져오기
                            </button>
                            <button
                                onClick={handleSyncSheet}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-[#373d41] rounded-lg hover:bg-gray-50 hover:border-green-400 transition-all shadow-sm"
                            >
                                <Sheet size={18} className="text-green-600" />
                                구글 시트 가져오기
                            </button>
                            <button
                                onClick={() => { setEditingEntry(null); setIsFormOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg hover:brightness-110 shadow-sm font-bold"
                            >
                                <Plus size={18} />
                                직접 등록하기
                            </button>
                        </div>
                    </div>
                )}

                {/* Dashboard Widgets */}
                {entries.length > 0 && viewMode === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-sm font-medium text-[#373d41] mb-1">{currentPeriod} 총 예상 수강료</p>
                            <h2 className="text-3xl font-bold text-[#081429]">{formattedTotal}<span className="text-lg font-normal text-gray-400 ml-1">원</span></h2>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <p className="text-sm font-medium text-[#373d41] mb-1">등록 사업장 수</p>
                            <h2 className="text-3xl font-bold text-[#081429]">{entries.length}<span className="text-lg font-normal text-gray-400 ml-1">개소</span></h2>
                        </div>
                        <div
                            className="bg-gradient-to-br from-[#081429] to-[#1e3a5f] p-6 rounded-xl border border-transparent shadow-sm text-white cursor-pointer relative overflow-hidden group"
                            onClick={handleGenerateAI}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Sparkles size={64} />
                            </div>
                            <p className="text-[#fdb813] font-medium mb-1 flex items-center gap-2">
                                <Sparkles size={16} /> AI 분석
                            </p>
                            <h2 className="text-xl font-bold leading-tight">
                                {isGenerating ? "분석 중..." : `${currentPeriod} 리포트 생성`}
                            </h2>
                            <p className="text-gray-300 text-sm mt-2 opacity-80">클릭하여 분석 시작</p>
                        </div>
                    </div>
                )}

                {/* AI Report Section */}
                {aiReport && viewMode === 'dashboard' && (
                    <div className="mb-8 bg-white rounded-xl border border-[#fdb813]/30 shadow-sm overflow-hidden print:hidden">
                        <div className="bg-[#081429] px-6 py-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <Sparkles className="text-[#fdb813]" size={18} />
                                AI 분석 리포트 ({currentPeriod})
                            </h3>
                            <button onClick={() => setAiReport('')} className="text-xs text-gray-400 hover:text-white">닫기</button>
                        </div>
                        <div className="p-6 prose prose-slate prose-headings:text-[#081429] prose-p:text-[#373d41] max-w-none text-sm">
                            <ReactMarkdown>{aiReport}</ReactMarkdown>
                        </div>
                    </div>
                )}

                {/* Visual Chart */}
                {entries.length > 0 && viewMode === 'dashboard' && (
                    <div className="mb-8 print:hidden">
                        <TuitionChart data={entries} />
                    </div>
                )}

                {/* Data Table / Report View */}
                {(entries.length > 0 || viewMode === 'report') && (
                    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${viewMode === 'report' ? "p-8 print:p-0 print:border-0 print:shadow-none print:w-full" : ""}`}>

                        {viewMode === 'report' && (
                            <div>
                                <div className="flex justify-between items-end mb-8 border-b border-[#081429] pb-6 print:mb-4 print:pb-4">
                                    <div className="flex-1">
                                        <h1 className="text-3xl font-bold text-[#081429] mb-2">익월 수강료 발생 현황</h1>
                                        <p className="text-[#373d41] font-medium text-lg">대상 기간: {currentPeriod}</p>
                                        <p className="text-gray-400 text-sm mt-1">작성일: {new Date().toLocaleDateString()}</p>
                                    </div>
                                    <ApprovalBox />
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse border border-gray-200">
                                <thead>
                                    <tr className="bg-[#081429] text-white">
                                        <th className="py-3 px-4 border border-gray-600 text-center font-bold w-[20%]">구분 (사업장)</th>
                                        <th className="py-3 px-4 border border-gray-600 text-center font-bold w-[20%]">예상 수강료</th>
                                        <th className="py-3 px-4 border border-gray-600 text-center font-bold w-[15%]">전월 대비</th>
                                        <th className="py-3 px-4 border border-gray-600 text-center font-bold w-[35%]">증감 및 특이 사유</th>
                                        {viewMode === 'dashboard' && (
                                            <th className="py-3 px-4 border border-gray-600 text-center font-bold w-[10%]">관리</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.length === 0 ? (
                                        <tr>
                                            <td colSpan={viewMode === 'dashboard' ? 5 : 4} className="py-12 text-center text-gray-400 border border-gray-200">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry) => {
                                            const diff = getDiff(entry.academyName, entry.projectedFee);
                                            return (
                                                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-4 border border-gray-200 font-medium text-[#081429] text-center">
                                                        {entry.academyName}
                                                    </td>
                                                    <td className="py-3 px-4 border border-gray-200 font-mono text-[#373d41] text-right">
                                                        {entry.projectedFee.toLocaleString()}원
                                                    </td>
                                                    <td className="py-3 px-4 border border-gray-200 font-mono text-right">
                                                        <span className={`font-medium ${diff > 0 ? "text-red-600" : diff < 0 ? "text-blue-600" : "text-gray-400"
                                                            }`}>
                                                            {diff > 0 ? '+' : ''}{diff === 0 ? '-' : diff.toLocaleString()}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 border border-gray-200 text-[#373d41] text-sm">
                                                        {entry.reason || <span className="text-gray-300 italic">-</span>}
                                                    </td>
                                                    {viewMode === 'dashboard' && (
                                                        <td className="py-3 px-4 border border-gray-200 text-center print:hidden">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => handleEdit(entry)}
                                                                    className="p-1.5 rounded text-gray-400 hover:text-[#fdb813] hover:bg-[#fdb813]/10 transition-colors"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(entry.id)}
                                                                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {entries.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-50">
                                            <td className="py-3 px-4 border border-gray-200 font-bold text-[#081429] text-center">합계</td>
                                            <td className="py-3 px-4 border border-gray-200 font-bold text-[#081429] text-right font-mono text-lg text-[#fdb813]">
                                                {formattedTotal}원
                                            </td>
                                            <td className="py-3 px-4 border border-gray-200 bg-gray-100"></td>
                                            <td className="py-3 px-4 border border-gray-200 text-xs text-gray-400 text-right">
                                                * 단위: 원 (KRW)
                                            </td>
                                            {viewMode === 'dashboard' && <td className="border border-gray-200"></td>}
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {viewMode === 'report' && aiReport && (
                            <div className="mt-8 border-t border-gray-200 pt-8">
                                <h4 className="text-sm font-bold uppercase text-[#373d41] mb-4">종합 의견 (AI Analysis)</h4>
                                <div className="prose prose-sm max-w-none text-[#373d41]">
                                    <ReactMarkdown>{aiReport}</ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal */}
            {isFormOpen && (
                <EntryForm
                    initialData={editingEntry}
                    existingAcademies={existingAcademies}
                    onSave={handleSave}
                    onCancel={() => { setIsFormOpen(false); setEditingEntry(null); }}
                />
            )}
        </div>
    );
};

export default PaymentReport;
