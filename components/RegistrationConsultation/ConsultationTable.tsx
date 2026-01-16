import React, { useState, useMemo } from 'react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';
import { Search, Edit2, Trash2, ChevronLeft, ChevronRight, User, Banknote, Settings2, X, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ConsultationTableProps {
    data: ConsultationRecord[];
    onEdit: (record: ConsultationRecord) => void;
    onDelete: (id: string) => void;
}

// 색상 테마
const COLORS = {
    navy: '#081429',
    yellow: '#fdb813',
    gray: '#373d41',
};

// 컬럼 정의
type ColumnKey =
    | 'createdAt' | 'receiver' | 'studentName' | 'schoolGrade' | 'parentPhone' | 'address'
    | 'consultationDate' | 'subject' | 'counselor' | 'status' | 'registrar'
    | 'paymentAmount' | 'paymentDate' | 'notes' | 'nonRegistrationReason'
    | 'followUpDate' | 'followUpContent' | 'consultationPath';

interface ColumnConfig {
    key: ColumnKey;
    label: string;
    defaultVisible: boolean;
    minWidth?: string;
}

const COLUMNS: ColumnConfig[] = [
    { key: 'createdAt', label: '접수일', defaultVisible: true, minWidth: '90px' },
    { key: 'receiver', label: '수신자', defaultVisible: true, minWidth: '80px' },
    { key: 'studentName', label: '이름', defaultVisible: true, minWidth: '80px' },
    { key: 'schoolGrade', label: '학교학년', defaultVisible: true, minWidth: '100px' },
    { key: 'parentPhone', label: '연락처', defaultVisible: true, minWidth: '120px' },
    { key: 'address', label: '주소', defaultVisible: false, minWidth: '150px' },
    { key: 'consultationDate', label: '상담일', defaultVisible: true, minWidth: '110px' },
    { key: 'subject', label: '상담과목', defaultVisible: true, minWidth: '80px' },
    { key: 'counselor', label: '상담자', defaultVisible: true, minWidth: '80px' },
    { key: 'status', label: '등록여부', defaultVisible: true, minWidth: '90px' },
    { key: 'registrar', label: '등록자', defaultVisible: true, minWidth: '80px' },
    { key: 'paymentAmount', label: '결제금액', defaultVisible: true, minWidth: '100px' },
    { key: 'paymentDate', label: '결제일', defaultVisible: true, minWidth: '90px' },
    { key: 'notes', label: '내용', defaultVisible: true, minWidth: '150px' },
    { key: 'nonRegistrationReason', label: '미등록사유', defaultVisible: true, minWidth: '120px' },
    { key: 'followUpDate', label: '후속조치일', defaultVisible: true, minWidth: '100px' },
    { key: 'followUpContent', label: '후속조치 내용', defaultVisible: true, minWidth: '150px' },
    { key: 'consultationPath', label: '상담경로', defaultVisible: true, minWidth: '100px' },
];
const STORAGE_KEY = 'consultation_table_columns';

// localStorage에서 저장된 컬럼 설정 로드
const loadSavedColumns = (): Set<ColumnKey> => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as ColumnKey[];
            // 유효한 컬럼만 필터링
            const validKeys = parsed.filter(key => COLUMNS.some(c => c.key === key));
            if (validKeys.length > 0) {
                return new Set(validKeys);
            }
        }
    } catch (e) {
        console.warn('Failed to load column settings:', e);
    }
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
};

export const ConsultationTable: React.FC<ConsultationTableProps> = ({ data, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadSavedColumns);
    const itemsPerPage = 15;

    // visibleColumns 변경 시 localStorage에 저장
    const updateVisibleColumns = (newColumns: Set<ColumnKey>) => {
        setVisibleColumns(newColumns);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...newColumns]));
        } catch (e) {
            console.warn('Failed to save column settings:', e);
        }
    };

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
        updateVisibleColumns(newSet);
    };

    const selectAllColumns = () => {
        updateVisibleColumns(new Set(COLUMNS.map(c => c.key)));
    };

    const resetColumns = () => {
        updateVisibleColumns(new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key)));
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
            case 'createdAt':
                return <span className="text-slate-500">{formatDate(record.createdAt)}</span>;
            case 'receiver':
                return <span className="text-slate-600">{record.receiver || '-'}</span>;
            case 'studentName':
                return <span className="font-semibold" style={{ color: COLORS.navy }}>{record.studentName}</span>;
            case 'schoolGrade':
                // grade에서 "초", "중", "고"를 제거하고 숫자만 추출
                const gradeNum = String(record.grade || '').replace(/^[초중고]/, '');
                return <span className="text-slate-700">{record.schoolName}{gradeNum}</span>;
            case 'parentPhone':
                return <span className="text-slate-600">{record.parentPhone}</span>;
            case 'address':
                return <span className="text-slate-500 text-xs truncate max-w-[140px] block">{record.address || '-'}</span>;
            case 'consultationDate':
                return <span style={{ color: COLORS.navy }}>{formatDateWithDay(record.consultationDate)}</span>;
            case 'subject':
                return <span className="font-semibold" style={{ color: COLORS.gray }}>{record.subject}</span>;
            case 'counselor':
                return <span className="text-slate-600">{record.counselor || '-'}</span>;
            case 'status':
                return (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                        {record.status}
                    </span>
                );
            case 'registrar':
                return <span className="text-slate-600">{record.registrar || '-'}</span>;
            case 'paymentAmount':
                return record.paymentAmount ? (
                    <span className="font-medium flex items-center gap-1" style={{ color: '#059669' }}>
                        <Banknote size={12} />₩{record.paymentAmount}
                    </span>
                ) : <span className="text-slate-400">-</span>;
            case 'paymentDate':
                return <span className="text-slate-500">{formatDate(record.paymentDate)}</span>;
            case 'notes':
                return <span className="text-slate-500 text-xs truncate max-w-[140px] block">{record.notes || '-'}</span>;
            case 'nonRegistrationReason':
                return record.nonRegistrationReason ? (
                    <span className="text-red-500 text-xs">{record.nonRegistrationReason}</span>
                ) : <span className="text-slate-400">-</span>;
            case 'followUpDate':
                return record.followUpDate ? (
                    <span className="font-medium" style={{ color: COLORS.yellow }}>{formatDate(record.followUpDate)}</span>
                ) : <span className="text-slate-400">-</span>;
            case 'followUpContent':
                return <span className="text-slate-500 text-xs truncate max-w-[140px] block">{record.followUpContent || '-'}</span>;
            case 'consultationPath':
                return <span className="text-slate-500 text-xs">{record.consultationPath || '-'}</span>;
            default:
                return '-';
        }
    };

    const visibleColumnsList = COLUMNS.filter(c => visibleColumns.has(c.key));

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header with Search and Settings */}
            <div className="rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row justify-between items-center gap-4" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                <h3 className="hidden sm:flex text-lg font-bold items-center" style={{ color: COLORS.navy }}>
                    <span className="w-2 h-6 rounded-sm mr-2" style={{ backgroundColor: COLORS.yellow }}></span>
                    상담 기록 목록
                    <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.gray }}>{filteredData.length}</span>
                </h3>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4" style={{ color: COLORS.gray }} />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 rounded-xl leading-5 placeholder-slate-400 focus:outline-none focus:ring-2 sm:text-sm transition-all"
                            style={{
                                backgroundColor: `${COLORS.navy}05`,
                                border: `1px solid ${COLORS.navy}20`,
                                color: COLORS.navy
                            }}
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
                        className="p-2.5 rounded-xl border transition-all"
                        style={{
                            backgroundColor: showSettings ? `${COLORS.yellow}20` : `${COLORS.navy}05`,
                            borderColor: showSettings ? COLORS.yellow : `${COLORS.navy}20`,
                            color: showSettings ? COLORS.yellow : COLORS.gray
                        }}
                        title="보기 설정"
                    >
                        <Settings2 size={18} />
                    </button>
                </div>
            </div>

            {/* Column Settings Panel */}
            {showSettings && (
                <div className="p-4 rounded-xl shadow-sm border" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: COLORS.navy }}>
                            <ClipboardList className="w-4 h-4" />
                            보기 설정
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAllColumns}
                                className="text-xs px-2 py-1 rounded-md transition-colors"
                                style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}
                            >
                                전체 선택
                            </button>
                            <button
                                onClick={resetColumns}
                                className="text-xs px-2 py-1 rounded-md transition-colors"
                                style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}
                            >
                                기본값
                            </button>
                            <button onClick={() => setShowSettings(false)} style={{ color: COLORS.gray }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {COLUMNS.map(col => (
                            <label
                                key={col.key}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-sm border"
                                style={{
                                    backgroundColor: visibleColumns.has(col.key) ? `${COLORS.yellow}20` : `${COLORS.navy}05`,
                                    borderColor: visibleColumns.has(col.key) ? COLORS.yellow : `${COLORS.navy}15`,
                                    color: visibleColumns.has(col.key) ? COLORS.navy : COLORS.gray
                                }}
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

            {/* Desktop Table View - Full Width with Horizontal Scroll */}
            <div className="hidden md:block rounded-xl shadow-sm border overflow-hidden flex-1" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full" style={{ minWidth: visibleColumnsList.length * 100 + 80 }}>
                        <thead className="sticky top-0 z-10" style={{ backgroundColor: COLORS.navy }}>
                            <tr>
                                {visibleColumnsList.map(col => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                                        style={{ color: 'white', minWidth: col.minWidth }}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th
                                    scope="col"
                                    className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider sticky right-0"
                                    style={{ color: 'white', backgroundColor: COLORS.navy, minWidth: '70px' }}
                                >
                                    관리
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: `${COLORS.navy}10` }}>
                            {currentData.length > 0 ? (
                                currentData.map((record, idx) => (
                                    <tr
                                        key={record.id}
                                        className="hover:bg-slate-50 transition-colors"
                                        style={{ backgroundColor: idx % 2 === 0 ? 'white' : `${COLORS.navy}02` }}
                                    >
                                        {visibleColumnsList.map(col => (
                                            <td key={col.key} className="px-3 py-3 whitespace-nowrap text-sm" style={{ minWidth: col.minWidth }}>
                                                {getCellValue(record, col.key)}
                                            </td>
                                        ))}
                                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium sticky right-0 bg-inherit" style={{ minWidth: '70px' }}>
                                            <div className="flex justify-end space-x-1">
                                                <button
                                                    onClick={() => onEdit(record)}
                                                    className="p-1.5 rounded-md transition-colors"
                                                    style={{ color: COLORS.navy }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('정말로 삭제하시겠습니까?')) onDelete(record.id);
                                                    }}
                                                    className="text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumnsList.length + 1} className="px-6 py-12 text-center" style={{ color: COLORS.gray }}>
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
                        <div key={record.id} className="p-4 rounded-xl shadow-sm border flex flex-col gap-3" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold" style={{ color: COLORS.navy }}>{record.studentName}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}>{record.grade}</span>
                                    </div>
                                    <span className="text-sm" style={{ color: COLORS.gray }}>{record.schoolName}</span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                                    {record.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded-lg" style={{ backgroundColor: `${COLORS.navy}05` }}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs" style={{ color: COLORS.gray }}>과목</span>
                                    <span className="font-medium" style={{ color: COLORS.navy }}>{record.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs" style={{ color: COLORS.gray }}>상담일</span>
                                    <span className="font-medium" style={{ color: COLORS.navy }}>{formatDate(record.consultationDate)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs" style={{ color: COLORS.gray }}>접수일</span>
                                    <span className="font-medium" style={{ color: COLORS.navy }}>{formatDate(record.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs" style={{ color: COLORS.gray }}>연락처</span>
                                    <span className="font-medium" style={{ color: COLORS.navy }}>{record.parentPhone}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t mt-1" style={{ borderColor: `${COLORS.navy}10` }}>
                                <div className="flex items-center gap-2 text-xs">
                                    <div className="flex items-center" style={{ color: COLORS.gray }}>
                                        <User size={12} className="mr-1" /> {record.counselor}
                                    </div>
                                    {record.paymentAmount && (
                                        <div className="flex items-center font-medium" style={{ color: '#059669' }}>
                                            <Banknote size={12} className="mr-1" /> ₩{record.paymentAmount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onEdit(record)}
                                        className="p-2 rounded-lg"
                                        style={{ backgroundColor: `${COLORS.yellow}20`, color: COLORS.navy }}
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
                    <div className="p-8 rounded-xl text-center" style={{ backgroundColor: 'white', color: COLORS.gray }}>
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="p-4 rounded-xl shadow-sm border flex items-center justify-between" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                <p className="text-sm hidden sm:block" style={{ color: COLORS.gray }}>
                    총 <span className="font-medium" style={{ color: COLORS.navy }}>{filteredData.length}</span>개 중{' '}
                    <span className="font-medium" style={{ color: COLORS.navy }}>{(currentPage - 1) * itemsPerPage + 1}</span> -{' '}
                    <span className="font-medium" style={{ color: COLORS.navy }}>{Math.min(currentPage * itemsPerPage, filteredData.length)}</span>
                </p>

                <nav className="flex justify-between w-full sm:w-auto gap-2" aria-label="Pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            borderColor: `${COLORS.navy}20`,
                            color: COLORS.navy,
                            backgroundColor: 'white'
                        }}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> 이전
                    </button>
                    <span className="sm:hidden flex items-center text-sm font-medium" style={{ color: COLORS.navy }}>
                        {currentPage} / {totalPages || 1}
                    </span>
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="flex-1 sm:flex-none relative inline-flex justify-center items-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            borderColor: `${COLORS.navy}20`,
                            color: COLORS.navy,
                            backgroundColor: 'white'
                        }}
                    >
                        다음 <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                </nav>
            </div>
        </div>
    );
};
