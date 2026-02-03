import React, { useState, useMemo, useEffect } from 'react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';
import { Edit2, Trash2, ChevronLeft, ChevronRight, User, Banknote, X, ClipboardList, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';

interface ConsultationTableProps {
    data: ConsultationRecord[];
    onEdit: (record: ConsultationRecord) => void;
    onDelete: (id: string) => void;
    onConvertToStudent?: (record: ConsultationRecord) => void; // 원생 전환 콜백
    currentUserId?: string; // 현재 로그인 사용자 ID
    canEdit?: boolean; // 상담 수정 권한 (본인 상담 또는 전체 상담)
    canManage?: boolean; // 모든 상담 관리 권한 (true면 모든 상담 수정/삭제 가능)
    canConvert?: boolean; // 원생 전환 권한
    searchTerm?: string; // 검색어 (부모에서 전달)
    showSettings?: boolean; // 보기설정 패널 표시 여부
    onShowSettingsChange?: (show: boolean) => void; // 보기설정 토글 콜백
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
// 핵심 8개 컬럼 (새 디폴트)
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
    'studentName', 'schoolGrade', 'parentPhone', 'consultationDate',
    'subject', 'counselor', 'status', 'notes'
];

// localStorage에서 저장된 컬럼 설정 로드
const loadSavedColumns = (): Set<ColumnKey> => {
    try {
        const saved = storage.getString(STORAGE_KEYS.CONSULTATION_TABLE_COLUMNS);
        if (saved) {
            const parsed = JSON.parse(saved) as ColumnKey[];
            const validKeys = parsed.filter(key => COLUMNS.some(c => c.key === key));
            if (validKeys.length > 0) {
                return new Set(validKeys);
            }
        }
        // Migration from old key
        const old = localStorage.getItem('consultation_table_columns');
        if (old) {
            storage.setString(STORAGE_KEYS.CONSULTATION_TABLE_COLUMNS, old);
            localStorage.removeItem('consultation_table_columns');
            const parsed = JSON.parse(old) as ColumnKey[];
            const validKeys = parsed.filter(key => COLUMNS.some(c => c.key === key));
            if (validKeys.length > 0) {
                return new Set(validKeys);
            }
        }
    } catch (e) {
        console.warn('Failed to load column settings:', e);
    }
    return new Set(DEFAULT_VISIBLE_COLUMNS);
};

export const ConsultationTable: React.FC<ConsultationTableProps> = ({
    data, onEdit, onDelete, onConvertToStudent,
    currentUserId, canEdit = false, canManage = false, canConvert = false,
    searchTerm = '', showSettings = false, onShowSettingsChange
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadSavedColumns);
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);

    // 검색어 변경 시 페이지 초기화
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // 특정 상담에 대한 수정/삭제 권한 확인
    // canManage=true면 모든 상담 수정/삭제 가능
    // canEdit=true면 본인 작성 상담만 수정 가능
    const canEditRecord = (record: ConsultationRecord): boolean => {
        if (canManage) return true;
        if (canEdit && record.authorId === currentUserId) return true;
        return false;
    };

    // visibleColumns 변경 시 localStorage에 저장
    const updateVisibleColumns = (newColumns: Set<ColumnKey>) => {
        setVisibleColumns(newColumns);
        storage.setJSON(STORAGE_KEYS.CONSULTATION_TABLE_COLUMNS, [...newColumns]);
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
        updateVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));
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
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
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
            {/* Column Settings Panel */}
            {showSettings && (
                <div className="p-4 rounded-sm shadow-sm border" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: COLORS.navy }}>
                            <ClipboardList className="w-4 h-4" />
                            보기 설정
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={selectAllColumns}
                                className="text-xs px-2 py-1 rounded-sm transition-colors"
                                style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}
                            >
                                전체 선택
                            </button>
                            <button
                                onClick={resetColumns}
                                className="text-xs px-2 py-1 rounded-sm transition-colors"
                                style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}
                            >
                                기본값
                            </button>
                            <button onClick={() => onShowSettingsChange?.(false)} style={{ color: COLORS.gray }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {COLUMNS.map(col => (
                            <label
                                key={col.key}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-sm cursor-pointer transition-all text-sm border"
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
            <div className="hidden md:block rounded-sm shadow-sm border overflow-hidden flex-1" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                    <table className="w-full" style={{ minWidth: visibleColumnsList.length * 100 + 80 }}>
                        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                            <tr>
                                {visibleColumnsList.map(col => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className="px-2 py-1.5 text-left text-xxs font-medium whitespace-nowrap"
                                        style={{ color: COLORS.gray, minWidth: col.minWidth }}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th
                                    scope="col"
                                    className="px-2 py-1.5 text-right text-xxs font-medium sticky right-0 bg-gray-50"
                                    style={{ color: COLORS.gray, minWidth: '70px' }}
                                >
                                    관리
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentData.length > 0 ? (
                                currentData.map((record, idx) => (
                                    <tr
                                        key={record.id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                        style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                                    >
                                        {visibleColumnsList.map(col => (
                                            <td key={col.key} className="px-2 py-1.5 whitespace-nowrap text-xs" style={{ minWidth: col.minWidth }}>
                                                {getCellValue(record, col.key)}
                                            </td>
                                        ))}
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs font-medium sticky right-0 bg-inherit" style={{ minWidth: '70px' }}>
                                            <div className="flex justify-end space-x-1">
                                                {/* 수정 버튼 - canManage 또는 본인 작성 상담만 */}
                                                {canEditRecord(record) && (
                                                    <button
                                                        onClick={() => onEdit(record)}
                                                        className="p-1.5 rounded-sm transition-colors"
                                                        style={{ color: COLORS.navy }}
                                                        title="수정"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                )}
                                                {/* 원생 전환 버튼 - canConvert 권한 + 이미 전환된 경우 비활성화 */}
                                                {canConvert && onConvertToStudent && !record.registeredStudentId && (
                                                    <button
                                                        onClick={() => onConvertToStudent(record)}
                                                        className="p-1.5 rounded-sm transition-colors text-green-600 hover:bg-green-50"
                                                        title="원생으로 전환"
                                                    >
                                                        <UserPlus size={14} />
                                                    </button>
                                                )}
                                                {/* 전환 완료 표시 */}
                                                {record.registeredStudentId && (
                                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-sm whitespace-nowrap" title="이미 원생으로 전환됨">
                                                        ✓ 전환완료
                                                    </span>
                                                )}
                                                {/* 삭제 버튼 - canManage 또는 본인 작성 상담만 */}
                                                {canEditRecord(record) && (
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('정말로 삭제하시겠습니까?')) onDelete(record.id);
                                                        }}
                                                        className="text-red-500 p-1.5 hover:bg-red-50 rounded-sm transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
                        <div key={record.id} className="p-4 rounded-sm shadow-sm border flex flex-col gap-3" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold" style={{ color: COLORS.navy }}>{record.studentName}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}>{record.grade}</span>
                                    </div>
                                    <span className="text-sm" style={{ color: COLORS.gray }}>{record.schoolName}</span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-sm border ${CONSULTATION_STATUS_COLORS[record.status]}`}>
                                    {record.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded-sm" style={{ backgroundColor: `${COLORS.navy}05` }}>
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
                                    {/* 수정 버튼 - canManage 또는 본인 작성 상담만 */}
                                    {canEditRecord(record) && (
                                        <button
                                            onClick={() => onEdit(record)}
                                            className="p-2 rounded-sm"
                                            style={{ backgroundColor: `${COLORS.yellow}20`, color: COLORS.navy }}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {/* 삭제 버튼 - canManage 또는 본인 작성 상담만 */}
                                    {canEditRecord(record) && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('삭제하시겠습니까?')) onDelete(record.id);
                                            }}
                                            className="p-2 text-red-500 bg-red-50 rounded-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 rounded-sm text-center" style={{ backgroundColor: 'white', color: COLORS.gray }}>
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="p-3 rounded-sm shadow-sm border flex items-center justify-between" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                {/* 왼쪽: 항목 수 선택 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: COLORS.gray }}>페이지당</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="px-2 py-1 text-xs rounded-sm border transition-all"
                        style={{
                            borderColor: `${COLORS.navy}20`,
                            color: COLORS.navy,
                            backgroundColor: 'white'
                        }}
                    >
                        <option value={10}>10개</option>
                        <option value={20}>20개</option>
                        <option value={50}>50개</option>
                        <option value={100}>100개</option>
                    </select>
                    <span className="text-xs hidden sm:inline" style={{ color: COLORS.gray }}>
                        {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} / 총 {filteredData.length}개
                    </span>
                </div>

                {/* 오른쪽: 페이지 네비게이션 */}
                <nav className="flex items-center gap-1" aria-label="Pagination">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                        style={{ color: COLORS.navy }}
                    >
                        이전
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                                        currentPage === pageNum
                                            ? 'text-[#081429]'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    style={{
                                        backgroundColor: currentPage === pageNum ? COLORS.yellow : 'transparent'
                                    }}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                        style={{ color: COLORS.navy }}
                    >
                        다음
                    </button>
                </nav>
            </div>
        </div>
    );
};
