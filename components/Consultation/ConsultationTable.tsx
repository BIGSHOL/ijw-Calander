import React, { useState, useMemo } from 'react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';
import { Search, Edit2, Trash2, ChevronLeft, ChevronRight, User, Banknote, Settings2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ConsultationTableProps {
    data: ConsultationRecord[];
    onEdit: (record: ConsultationRecord) => void;
    onDelete: (id: string) => void;
}

// 컬럼 정의
type ColumnKey =
    | 'studentName' | 'parentPhone' | 'grade' | 'schoolName'
    | 'subject' | 'status' | 'counselor' | 'registrar'
    | 'consultationDate' | 'consultationPath' | 'createdAt'
    | 'paymentAmount' | 'paymentDate' | 'followUpDate' | 'followUpContent'
    | 'notes' | 'nonRegistrationReason';

interface ColumnConfig {
    key: ColumnKey;
    label: string;
    defaultVisible: boolean;
    width?: string;
}

const COLUMNS: ColumnConfig[] = [
    { key: 'studentName', label: '학생명', defaultVisible: true },
    { key: 'parentPhone', label: '학부모 연락처', defaultVisible: true },
    { key: 'grade', label: '학년', defaultVisible: true },
    { key: 'schoolName', label: '학교', defaultVisible: true },
    { key: 'subject', label: '상담 과목', defaultVisible: true },
    { key: 'counselor', label: '상담자', defaultVisible: true },
    { key: 'registrar', label: '등록자', defaultVisible: true },
    { key: 'consultationDate', label: '상담일', defaultVisible: true },
    { key: 'consultationPath', label: '상담 경로', defaultVisible: false },
    { key: 'createdAt', label: '접수일', defaultVisible: true },
    { key: 'status', label: '상태', defaultVisible: true },
    { key: 'paymentAmount', label: '결제 금액', defaultVisible: true },
    { key: 'paymentDate', label: '결제일', defaultVisible: false },
    { key: 'followUpDate', label: '후속 조치일', defaultVisible: false },
    { key: 'followUpContent', label: '후속 내용', defaultVisible: false },
    { key: 'notes', label: '메모', defaultVisible: false },
    { key: 'nonRegistrationReason', label: '미등록 사유', defaultVisible: true },
];

export const ConsultationTable: React.FC<ConsultationTableProps> = ({ data, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
        new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
    );
    const itemsPerPage = 15;

    const filteredData = useMemo(() => {
        return data.filter(r =>
            r.studentName.includes(searchTerm) ||
            r.parentPhone.includes(searchTerm) ||
            r.schoolName.includes(searchTerm) ||
            r.counselor.includes(searchTerm) ||
            r.registrar.includes(searchTerm)
        );
    }, [data, searchTerm]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const toggleColumn = (key: ColumnKey) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setVisibleColumns(newSet);
    };

    const selectAllColumns = () => {
        setVisibleColumns(new Set(COLUMNS.map(c => c.key)));
    };

    const resetColumns = () => {
        setVisibleColumns(new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key)));
    };

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'yy.MM.dd', { locale: ko });
        } catch {
            return '-';
        }
    };

    const formatDateWithDay = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'yy.MM.dd(eee)', { locale: ko });
        } catch {
            return '-';
        }
    };

    const getCellValue = (record: ConsultationRecord, key: ColumnKey): React.ReactNode => {
        switch (key) {
            case 'studentName':
                return <span className="font-medium text-slate-900">{record.studentName}</span>;
            case 'parentPhone':
                return <span className="text-slate-600">{record.parentPhone}</span>;
            case 'grade':
                return <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{record.grade}</span>;
            case 'schoolName':
                return <span className="text-slate-600">{record.schoolName}</span>;
            case 'subject':
                return <span className="font-semibold text-slate-700">{record.subject}</span>;
            case 'counselor':
                return <span className="text-slate-600">{record.counselor || '-'}</span>;
            case 'registrar':
                return <span className="text-slate-600">{record.registrar || '-'}</span>;
            case 'consultationDate':
                return <span className="text-slate-700">{formatDateWithDay(record.consultationDate)}</span>;
            case 'consultationPath':
                return <span className="text-slate-500 text-xs">{record.consultationPath || '-'}</span>;
            case 'createdAt':
                return <span className="text-slate-500">{formatDate(record.createdAt)}</span>;
            case 'status':
                return (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                        {record.status}
                    </span>
                );
            case 'paymentAmount':
                return record.paymentAmount ? (
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <Banknote size={12} />₩{record.paymentAmount}
                    </span>
                ) : <span className="text-slate-400">-</span>;
            case 'paymentDate':
                return <span className="text-slate-500">{formatDate(record.paymentDate)}</span>;
            case 'followUpDate':
                return record.followUpDate ? (
                    <span className="text-amber-600 font-medium">{formatDate(record.followUpDate)}</span>
                ) : <span className="text-slate-400">-</span>;
            case 'followUpContent':
                return <span className="text-slate-500 text-xs truncate max-w-[120px] block">{record.followUpContent || '-'}</span>;
            case 'notes':
                return <span className="text-slate-500 text-xs truncate max-w-[150px] block">{record.notes || '-'}</span>;
            case 'nonRegistrationReason':
                return record.nonRegistrationReason ? (
                    <span className="text-red-500 text-xs truncate max-w-[100px] block">{record.nonRegistrationReason}</span>
                ) : <span className="text-slate-400">-</span>;
            default:
                return '-';
        }
    };

    const visibleColumnsList = COLUMNS.filter(c => visibleColumns.has(c.key));

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header with Search and Settings */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="hidden sm:flex text-lg font-bold text-slate-800 items-center">
                    <span className="w-2 h-6 bg-indigo-500 rounded-sm mr-2"></span>
                    상담 기록 목록
                    <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{filteredData.length}</span>
                </h3>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:placeholder-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                            placeholder="학생명, 번호, 담당자 검색..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    {/* Settings Button */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2.5 rounded-xl border transition-all ${showSettings ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                        title="보기 설정"
                    >
                        <Settings2 size={18} />
                    </button>
                </div>
            </div>

            {/* Column Settings Panel */}
            {showSettings && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-700">📋 보기 설정</h4>
                        <div className="flex gap-2">
                            <button onClick={selectAllColumns} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">전체 선택</button>
                            <button onClick={resetColumns} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">기본값</button>
                            <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {COLUMNS.map(col => (
                            <label
                                key={col.key}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-sm ${visibleColumns.has(col.key)
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                        : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.has(col.key)}
                                    onChange={() => toggleColumn(col.key)}
                                    className="hidden"
                                />
                                {col.label}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Desktop Table View - Full Width */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {visibleColumnsList.map(col => (
                                    <th key={col.key} scope="col" className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                        {col.label}
                                    </th>
                                ))}
                                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">관리</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {currentData.length > 0 ? (
                                currentData.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                                        {visibleColumnsList.map(col => (
                                            <td key={col.key} className="px-3 py-3 whitespace-nowrap text-sm">
                                                {getCellValue(record, col.key)}
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-1">
                                                <button
                                                    onClick={() => onEdit(record)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1.5 hover:bg-indigo-50 rounded-md transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('정말로 삭제하시겠습니까?')) onDelete(record.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumnsList.length + 1} className="px-6 py-12 text-center text-slate-400">
                                        검색 결과가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {currentData.length > 0 ? (
                    currentData.map((record) => (
                        <div key={record.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold text-slate-900">{record.studentName}</span>
                                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{record.grade}</span>
                                    </div>
                                    <span className="text-sm text-slate-500">{record.schoolName}</span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                                    {record.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">과목</span>
                                    <span className="font-medium">{record.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">상담일</span>
                                    <span className="font-medium">{formatDate(record.consultationDate)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">접수일</span>
                                    <span className="font-medium">{formatDate(record.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">연락처</span>
                                    <span className="font-medium">{record.parentPhone}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center text-slate-500">
                                        <User size={12} className="mr-1" /> {record.counselor}
                                    </div>
                                    {record.paymentAmount && (
                                        <div className="flex items-center text-emerald-600 font-medium">
                                            <Banknote size={12} className="mr-1" /> ₩{record.paymentAmount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(record)}
                                        className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('삭제하시겠습니까?')) onDelete(record.id);
                                        }}
                                        className="p-2 text-red-500 bg-red-50 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white p-8 rounded-xl text-center text-slate-400">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
                <p className="text-sm text-slate-700 hidden sm:block">
                    총 <span className="font-medium">{filteredData.length}</span>개 중 <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span>
                </p>

                <nav className="flex justify-between w-full sm:w-auto gap-2" aria-label="Pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> 이전
                    </button>
                    <span className="sm:hidden flex items-center text-sm font-medium text-slate-700">
                        {currentPage} / {totalPages || 1}
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        다음 <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                </nav>
            </div>
        </div>
    );
};
