import React, { useState, useMemo, useEffect } from 'react';
import { ConsultationRecord, CONSULTATION_STATUS_COLORS } from '../../types';
import { Edit2, Trash2, ChevronLeft, ChevronRight, User, Banknote, X, ClipboardList, UserPlus, UserCheck, ExternalLink, Filter, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { storage, STORAGE_KEYS } from '../../utils/localStorage';

interface ConsultationTableProps {
    data: ConsultationRecord[];
    onEdit: (record: ConsultationRecord) => void;
    onDelete: (id: string) => void;
    onConvertToStudent?: (record: ConsultationRecord) => void; // 원생 전환 콜백
    onNavigateToStudent?: (studentId: string) => void; // 원생 프로필로 이동 콜백
    currentUserId?: string; // 현재 로그인 사용자 ID
    canEdit?: boolean; // 상담 수정 권한 (본인 상담 또는 전체 상담)
    canManage?: boolean; // 모든 상담 관리 권한 (true면 모든 상담 수정/삭제 가능)
    canConvert?: boolean; // 원생 전환 권한
    searchTerm?: string; // 검색어 (부모에서 전달)
    showSettings?: boolean; // 보기설정 패널 표시 여부
    onShowSettingsChange?: (show: boolean) => void; // 보기설정 토글 콜백
    showFilters?: boolean; // 필터 패널 표시 여부
    onShowFiltersChange?: (show: boolean) => void; // 필터 패널 토글 콜백
    conversionStatusMap?: Map<string, { status: 'converted' | 'matched' | 'pending' | 'ambiguous'; studentId?: string; candidates?: { id: string; name: string }[] }>; // 전환 상태 맵
    onLinkStudent?: (consultationId: string, studentId: string) => void; // 동명이인 선택 시 연결
}

// 필터 상태 타입
interface FilterState {
    status: string[];    // 등록여부
    subject: string[];   // 상담과목
    grade: string[];     // 학년
    counselor: string[]; // 상담자
    consultationPath: string[]; // 상담경로
    conversion: string[]; // 전환여부
}

const EMPTY_FILTERS: FilterState = {
    status: [],
    subject: [],
    grade: [],
    counselor: [],
    consultationPath: [],
    conversion: [],
};

const CONVERSION_LABELS: Record<string, string> = {
    converted: '전환완료',
    matched: '자동매칭',
    ambiguous: '동명이인',
    pending: '전환대기',
    none: '미해당',
};

// localStorage에서 저장된 필터 설정 로드
const loadSavedFilters = (): FilterState => {
    try {
        const saved = storage.getString(STORAGE_KEYS.CONSULTATION_TABLE_FILTERS);
        if (saved) {
            const parsed = JSON.parse(saved) as FilterState;
            return { ...EMPTY_FILTERS, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load filter settings:', e);
    }
    return EMPTY_FILTERS;
};

// 색상 테마
const COLORS = {
    navy: '#081429',
    yellow: '#fdb813',
    gray: '#373d41',
};

// 컬럼 정의
type ColumnKey =
    | 'createdAt' | 'receiver' | 'studentName' | 'school' | 'grade' | 'parentPhone' | 'address'
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
    { key: 'consultationDate', label: '상담일', defaultVisible: true, minWidth: '110px' },
    { key: 'studentName', label: '이름', defaultVisible: true, minWidth: '80px' },
    { key: 'school', label: '학교', defaultVisible: true, minWidth: '100px' },
    { key: 'grade', label: '학년', defaultVisible: true, minWidth: '60px' },
    { key: 'subject', label: '상담과목', defaultVisible: true, minWidth: '80px' },
    { key: 'parentPhone', label: '연락처', defaultVisible: true, minWidth: '120px' },
    { key: 'counselor', label: '상담자', defaultVisible: true, minWidth: '80px' },
    { key: 'status', label: '등록여부', defaultVisible: true, minWidth: '90px' },
    { key: 'notes', label: '내용', defaultVisible: true, minWidth: '150px' },
    { key: 'createdAt', label: '접수일', defaultVisible: false, minWidth: '90px' },
    { key: 'receiver', label: '수신자', defaultVisible: false, minWidth: '80px' },
    { key: 'address', label: '주소', defaultVisible: false, minWidth: '150px' },
    { key: 'registrar', label: '등록자', defaultVisible: false, minWidth: '80px' },
    { key: 'paymentAmount', label: '결제금액', defaultVisible: false, minWidth: '100px' },
    { key: 'paymentDate', label: '결제일', defaultVisible: false, minWidth: '90px' },
    { key: 'nonRegistrationReason', label: '미등록사유', defaultVisible: false, minWidth: '120px' },
    { key: 'followUpDate', label: '후속조치일', defaultVisible: false, minWidth: '100px' },
    { key: 'followUpContent', label: '후속조치 내용', defaultVisible: false, minWidth: '150px' },
    { key: 'consultationPath', label: '상담경로', defaultVisible: false, minWidth: '100px' },
];
// 핵심 9개 컬럼 (새 디폴트) - 상담일이 가장 왼쪽
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
    'consultationDate', 'studentName', 'school', 'grade', 'subject',
    'parentPhone', 'counselor', 'status', 'notes'
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
    data, onEdit, onDelete, onConvertToStudent, onNavigateToStudent,
    currentUserId, canEdit = false, canManage = false, canConvert = false,
    searchTerm = '', showSettings = false, onShowSettingsChange,
    showFilters = false, onShowFiltersChange,
    conversionStatusMap, onLinkStudent
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadSavedColumns);
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);
    const [filters, setFilters] = useState<FilterState>(loadSavedFilters);
    const [candidatePopover, setCandidatePopover] = useState<{ consultationId: string; candidates: { id: string; name: string }[] } | null>(null);

    // 검색어/필터 변경 시 페이지 초기화
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filters]);

    // 팝오버 외부 클릭 시 닫기
    useEffect(() => {
        if (!candidatePopover) return;
        const handleClick = () => setCandidatePopover(null);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [candidatePopover]);

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

    // 필터 변경 시 localStorage에 저장
    const updateFilters = (newFilters: FilterState) => {
        setFilters(newFilters);
        storage.setString(STORAGE_KEYS.CONSULTATION_TABLE_FILTERS, JSON.stringify(newFilters));
    };

    const toggleFilter = (key: keyof FilterState, value: string) => {
        const current = filters[key];
        const newValues = current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value];
        updateFilters({ ...filters, [key]: newValues });
    };

    const clearAllFilters = () => {
        updateFilters(EMPTY_FILTERS);
    };

    const activeFilterCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);

    // 데이터에서 동적 필터 옵션 추출
    const filterOptions = useMemo(() => {
        const statuses = new Set<string>();
        const subjects = new Set<string>();
        const grades = new Set<string>();
        const counselors = new Set<string>();
        const paths = new Set<string>();

        for (const r of data) {
            if (r.status) statuses.add(String(r.status));
            if (r.subject) subjects.add(r.subject);
            if (r.grade) grades.add(r.grade);
            if (r.counselor) counselors.add(r.counselor);
            if (r.consultationPath) paths.add(r.consultationPath);
        }

        return {
            status: [...statuses].sort(),
            subject: [...subjects].sort(),
            grade: [...grades].sort((a, b) => {
                const order = ['초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3'];
                return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
            }),
            counselor: [...counselors].filter(Boolean).sort(),
            consultationPath: [...paths].filter(Boolean).sort(),
        };
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(r => {
            // 텍스트 검색
            if (searchTerm) {
                const match = r.studentName.includes(searchTerm) ||
                    r.parentPhone.includes(searchTerm) ||
                    r.schoolName.includes(searchTerm) ||
                    r.counselor.includes(searchTerm) ||
                    r.registrar.includes(searchTerm);
                if (!match) return false;
            }
            // 필터 적용
            if (filters.status.length > 0 && !filters.status.includes(String(r.status))) return false;
            if (filters.subject.length > 0 && !filters.subject.includes(r.subject)) return false;
            if (filters.grade.length > 0 && !filters.grade.includes(r.grade)) return false;
            if (filters.counselor.length > 0 && !filters.counselor.includes(r.counselor)) return false;
            if (filters.consultationPath.length > 0 && !filters.consultationPath.includes(r.consultationPath)) return false;
            // 전환여부 필터
            if (filters.conversion.length > 0) {
                const info = conversionStatusMap?.get(r.id);
                const conversionKey = info?.status || 'none';
                if (!filters.conversion.includes(conversionKey)) return false;
            }
            return true;
        });
    }, [data, searchTerm, filters, conversionStatusMap]);

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
            case 'school':
                // 학교명을 짧게 표시 (초등학교 → 초, 중학교 → 중, 고등학교 → 고)
                const displaySchool = (record.schoolName || '')
                    .replace('초등학교', '초')
                    .replace('중학교', '중')
                    .replace('고등학교', '고');
                return <span className="text-slate-700">{displaySchool}</span>;
            case 'grade':
                return <span className="text-slate-700">{record.grade}</span>;
            case 'parentPhone':
                return <span className="text-slate-600">{record.parentPhone}</span>;
            case 'address':
                return <span className="text-slate-500 text-xs truncate max-w-[140px] block">{record.address || '-'}</span>;
            case 'consultationDate':
                return <span style={{ color: COLORS.navy }}>{formatDateWithDay(record.consultationDate)}</span>;
            case 'subject': {
                const subjectNames: Record<string, string> = { math: '수학', english: '영어', korean: '국어', science: '과학', etc: '기타' };
                const hasData = (detail: any) => detail && Object.values(detail).some((v: any) => v && String(v).trim() !== '');
                const extraSubjects: string[] = [];
                if (hasData(record.mathConsultation)) extraSubjects.push(subjectNames.math);
                if (hasData(record.englishConsultation)) extraSubjects.push(subjectNames.english);
                if (hasData(record.koreanConsultation)) extraSubjects.push(subjectNames.korean);
                if (hasData(record.scienceConsultation)) extraSubjects.push(subjectNames.science);
                if (hasData(record.etcConsultation)) extraSubjects.push(subjectNames.etc);
                // 메인 과목(드롭다운)과 동일한 건 제외
                const others = extraSubjects.filter(s => s !== record.subject);
                return (
                    <span className="font-semibold flex items-center gap-1" style={{ color: COLORS.gray }}>
                        {record.subject}
                        {others.length > 0 && (
                            <span
                                className="relative group inline-flex items-center text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1 py-0 leading-tight cursor-default"
                            >
                                +{others.length}
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                                    {others.join(', ')}
                                </span>
                            </span>
                        )}
                    </span>
                );
            }
            case 'counselor':
                return <span className="text-slate-600">{record.counselor || '-'}</span>;
            case 'status': {
                const statusStr = String(record.status);
                const statusLabel = statusStr === 'registered' ? '등록완료' : statusStr;
                const statusColor = CONSULTATION_STATUS_COLORS[statusStr] || 'bg-gray-100 text-gray-800 border-gray-200';
                return (
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-sm border ${statusColor}`}>
                        {statusLabel}
                    </span>
                );
            }
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

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-4 rounded-sm shadow-sm border" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: COLORS.navy }}>
                            <Filter className="w-4 h-4" />
                            필터
                            {activeFilterCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </h4>
                        <div className="flex gap-2">
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs px-2 py-1 rounded-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    초기화
                                </button>
                            )}
                            <button onClick={() => onShowFiltersChange?.(false)} style={{ color: COLORS.gray }}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {/* 등록여부 */}
                        {filterOptions.status.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">등록여부</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {filterOptions.status.map(s => {
                                        const label = s === 'registered' ? '등록완료' : s;
                                        const active = filters.status.includes(s);
                                        const statusColor = active ? (CONSULTATION_STATUS_COLORS[s] || 'bg-gray-200 text-gray-700') : '';
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => toggleFilter('status', s)}
                                                className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                    active
                                                        ? `${statusColor} border-transparent`
                                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {/* 상담과목 */}
                        {filterOptions.subject.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">상담과목</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {filterOptions.subject.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => toggleFilter('subject', s)}
                                            className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                filters.subject.includes(s)
                                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 학년 */}
                        {filterOptions.grade.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">학년</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {filterOptions.grade.map(g => (
                                        <button
                                            key={g}
                                            onClick={() => toggleFilter('grade', g)}
                                            className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                filters.grade.includes(g)
                                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 상담자 */}
                        {filterOptions.counselor.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">상담자</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {filterOptions.counselor.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => toggleFilter('counselor', c)}
                                            className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                filters.counselor.includes(c)
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 상담경로 */}
                        {filterOptions.consultationPath.length > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">상담경로</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {filterOptions.consultationPath.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => toggleFilter('consultationPath', p)}
                                            className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                filters.consultationPath.includes(p)
                                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* 전환여부 */}
                        {conversionStatusMap && conversionStatusMap.size > 0 && (
                            <div>
                                <span className="text-xs font-semibold text-gray-500 mb-1.5 block">전환여부</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(CONVERSION_LABELS).map(([key, label]) => {
                                        const colorMap: Record<string, string> = {
                                            converted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            matched: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                            ambiguous: 'bg-violet-100 text-violet-700 border-violet-200',
                                            pending: 'bg-amber-100 text-amber-700 border-amber-200',
                                            none: 'bg-gray-200 text-gray-700 border-gray-300',
                                        };
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleFilter('conversion', key)}
                                                className={`px-2.5 py-1 rounded-sm text-xs font-medium border transition-all ${
                                                    filters.conversion.includes(key)
                                                        ? colorMap[key]
                                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Active Filter Summary (when filter panel is closed) */}
            {!showFilters && activeFilterCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-1">
                    <span className="text-xs text-gray-400 shrink-0">필터:</span>
                    {filters.status.map(s => (
                        <span key={`s-${s}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {s === 'registered' ? '등록완료' : s}
                            <button onClick={() => toggleFilter('status', s)} className="hover:text-blue-900"><X size={10} /></button>
                        </span>
                    ))}
                    {filters.subject.map(s => (
                        <span key={`sub-${s}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {s}
                            <button onClick={() => toggleFilter('subject', s)} className="hover:text-indigo-900"><X size={10} /></button>
                        </span>
                    ))}
                    {filters.grade.map(g => (
                        <span key={`g-${g}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {g}
                            <button onClick={() => toggleFilter('grade', g)} className="hover:text-amber-900"><X size={10} /></button>
                        </span>
                    ))}
                    {filters.counselor.map(c => (
                        <span key={`c-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {c}
                            <button onClick={() => toggleFilter('counselor', c)} className="hover:text-emerald-900"><X size={10} /></button>
                        </span>
                    ))}
                    {filters.consultationPath.map(p => (
                        <span key={`p-${p}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            {p}
                            <button onClick={() => toggleFilter('consultationPath', p)} className="hover:text-purple-900"><X size={10} /></button>
                        </span>
                    ))}
                    {filters.conversion.map(c => (
                        <span key={`conv-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                            {CONVERSION_LABELS[c] || c}
                            <button onClick={() => toggleFilter('conversion', c)} className="hover:text-teal-900"><X size={10} /></button>
                        </span>
                    ))}
                    <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 shrink-0">
                        전체 해제
                    </button>
                </div>
            )}

            {/* Desktop Table View - Full Width with Horizontal Scroll */}
            <div className="hidden md:block rounded-sm shadow-sm border overflow-hidden flex-1" style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}>
                <div className="overflow-x-auto overflow-y-auto h-full">
                    <table className="w-full" style={{ minWidth: visibleColumnsList.reduce((sum, col) => sum + parseInt(col.minWidth || '80', 10), 50) }}>
                        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                            <tr>
                                {/* 전환 열 (항상 첫번째) */}
                                <th
                                    scope="col"
                                    className="px-2 py-1.5 text-center text-xxs font-medium whitespace-nowrap"
                                    style={{ color: COLORS.gray, minWidth: '50px', width: '50px' }}
                                >
                                    전환
                                </th>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentData.length > 0 ? (
                                currentData.map((record, idx) => (
                                    <tr
                                        key={record.id}
                                        onClick={() => onEdit(record)}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                        style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}
                                    >
                                        {/* 전환 열 (항상 첫번째) */}
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-center relative" style={{ minWidth: '50px', width: '50px' }}>
                                            {(() => {
                                                const info = conversionStatusMap?.get(record.id);
                                                if (info?.status === 'converted' || info?.status === 'matched') {
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (info.studentId) onNavigateToStudent?.(info.studentId);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-sm bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                                                            title={info.status === 'converted' ? '전환 완료 (연동됨)' : '전환 완료 (자동 매칭)'}
                                                        >
                                                            <UserCheck size={12} />
                                                            <ExternalLink size={10} />
                                                        </button>
                                                    );
                                                } else if (info?.status === 'ambiguous' && info.candidates) {
                                                    return (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCandidatePopover(
                                                                        candidatePopover?.consultationId === record.id
                                                                            ? null
                                                                            : { consultationId: record.id, candidates: info.candidates! }
                                                                    );
                                                                }}
                                                                className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-sm bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200 transition-colors"
                                                                title={`동명이인 ${info.candidates.length}명 - 클릭하여 선택`}
                                                            >
                                                                <Users size={12} />
                                                                {info.candidates.length}
                                                            </button>
                                                            {candidatePopover?.consultationId === record.id && (
                                                                <div className="absolute top-full left-0 mt-1 bg-white rounded-sm shadow-lg border border-gray-200 z-20 min-w-[120px]">
                                                                    <div className="px-2 py-1 text-[10px] text-gray-400 border-b">학생 선택</div>
                                                                    {candidatePopover.candidates.map(c => (
                                                                        <button
                                                                            key={c.id}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onLinkStudent?.(record.id, c.id);
                                                                                setCandidatePopover(null);
                                                                            }}
                                                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-violet-50 transition-colors flex items-center gap-1.5"
                                                                        >
                                                                            <User size={11} className="text-violet-500 shrink-0" />
                                                                            <span className="font-medium text-gray-800">{c.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                } else if (info?.status === 'pending') {
                                                    return (
                                                        <span
                                                            className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-sm bg-amber-100 text-amber-700 border border-amber-200"
                                                            title="등록 상태이나 매칭 학생 없음"
                                                        >
                                                            <UserPlus size={12} />
                                                            대기
                                                        </span>
                                                    );
                                                }
                                                return <span className="text-gray-300">-</span>;
                                            })()}
                                        </td>
                                        {visibleColumnsList.map(col => (
                                            <td key={col.key} className="px-2 py-1.5 whitespace-nowrap text-xs" style={{ minWidth: col.minWidth }}>
                                                {getCellValue(record, col.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumnsList.length + 2} className="px-6 py-12 text-center" style={{ color: COLORS.gray }}>
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
                        <div
                            key={record.id}
                            onClick={() => onEdit(record)}
                            className="p-4 rounded-sm shadow-sm border flex flex-col gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ backgroundColor: 'white', borderColor: `${COLORS.navy}15` }}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg font-bold" style={{ color: COLORS.navy }}>{record.studentName}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${COLORS.navy}10`, color: COLORS.navy }}>{record.grade}</span>
                                        {/* 원생 전환 배지 */}
                                        {(() => {
                                            const info = conversionStatusMap?.get(record.id);
                                            if (info?.status === 'converted' || info?.status === 'matched') {
                                                return (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (info.studentId) onNavigateToStudent?.(info.studentId);
                                                        }}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-sm bg-emerald-100 text-emerald-700"
                                                    >
                                                        <UserCheck size={12} />
                                                        전환완료
                                                    </button>
                                                );
                                            } else if (info?.status === 'ambiguous' && info.candidates) {
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-sm bg-violet-100 text-violet-700 border border-violet-200">
                                                        <Users size={12} />
                                                        동명이인 {info.candidates.length}
                                                    </span>
                                                );
                                            } else if (info?.status === 'pending') {
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-sm bg-amber-100 text-amber-700">
                                                        <UserPlus size={12} />
                                                        전환대기
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                    <span className="text-sm" style={{ color: COLORS.gray }}>
                                        {(record.schoolName || '').replace('초등학교', '초').replace('중학교', '중').replace('고등학교', '고')}
                                    </span>
                                </div>
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-sm border ${CONSULTATION_STATUS_COLORS[String(record.status)] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                                    {String(record.status) === 'registered' ? '등록완료' : record.status}
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
                                            ? 'text-primary'
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
