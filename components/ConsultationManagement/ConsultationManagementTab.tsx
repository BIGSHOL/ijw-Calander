import React, { useState, useMemo } from 'react';
import { useStudentConsultations, StudentConsultationFilters } from '../../hooks/useStudentConsultations';
import { ConsultationCategory, CATEGORY_CONFIG } from '../../types';
import ConsultationList from './ConsultationList';
import AddConsultationModal from './AddConsultationModal';

/**
 * 상담 관리 메인 탭
 * - 재원생 대상 학부모/학생 상담 기록 관리
 * - 필터링 및 검색 기능
 * - 브랜드 컬러: 곤색(#081429), 노란색(#fdb813)
 */
const ConsultationManagementTab: React.FC = () => {
    const [filters, setFilters] = useState<StudentConsultationFilters>({});
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { consultations, loading, error, refetch } = useStudentConsultations(filters);

    // 검색 쿼리 적용
    const filteredConsultations = useMemo(() => {
        if (!searchQuery.trim()) return consultations;
        const lowerQuery = searchQuery.toLowerCase();
        return consultations.filter(c =>
            c.studentName.toLowerCase().includes(lowerQuery) ||
            c.title.toLowerCase().includes(lowerQuery) ||
            c.content.toLowerCase().includes(lowerQuery)
        );
    }, [consultations, searchQuery]);

    // 날짜 범위 프리셋
    const applyDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (preset === 'today') {
            setFilters(prev => ({ ...prev, dateRange: { start: todayStr, end: todayStr } }));
        } else if (preset === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            const startStr = weekAgo.toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, dateRange: { start: startStr, end: todayStr } }));
        } else if (preset === 'month') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            const startStr = monthAgo.toISOString().split('T')[0];
            setFilters(prev => ({ ...prev, dateRange: { start: startStr, end: todayStr } }));
        } else {
            setFilters(prev => ({ ...prev, dateRange: undefined }));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-[#081429] text-white px-6 py-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">상담 관리</h1>
                    <p className="text-sm text-gray-300 mt-1">재원생 학부모/학생 상담 기록</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-[#fdb813] text-[#081429] px-6 py-2 rounded-lg font-semibold hover:bg-[#e5a711] transition-colors flex items-center gap-2"
                >
                    <span className="text-lg">+</span>
                    <span>새 상담 기록</span>
                </button>
            </div>

            {/* 필터 섹션 */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 상담 유형 */}
                    <div>
                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                            상담 유형
                        </label>
                        <select
                            value={filters.type || ''}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                type: e.target.value as 'parent' | 'student' | undefined || undefined
                            }))}
                            className="w-full border border-[#081429] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                        >
                            <option value="">전체</option>
                            <option value="parent">학부모 상담</option>
                            <option value="student">학생 상담</option>
                        </select>
                    </div>

                    {/* 날짜 범위 */}
                    <div>
                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                            날짜 범위
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => applyDatePreset('today')}
                                className="flex-1 border border-[#081429] rounded-lg px-2 py-2 text-xs hover:bg-[#081429] hover:text-white transition-colors"
                            >
                                오늘
                            </button>
                            <button
                                onClick={() => applyDatePreset('week')}
                                className="flex-1 border border-[#081429] rounded-lg px-2 py-2 text-xs hover:bg-[#081429] hover:text-white transition-colors"
                            >
                                이번 주
                            </button>
                            <button
                                onClick={() => applyDatePreset('month')}
                                className="flex-1 border border-[#081429] rounded-lg px-2 py-2 text-xs hover:bg-[#081429] hover:text-white transition-colors"
                            >
                                이번 달
                            </button>
                            <button
                                onClick={() => applyDatePreset('all')}
                                className="flex-1 border border-[#081429] rounded-lg px-2 py-2 text-xs hover:bg-[#081429] hover:text-white transition-colors"
                            >
                                전체
                            </button>
                        </div>
                    </div>

                    {/* 카테고리 */}
                    <div>
                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                            카테고리
                        </label>
                        <select
                            value={filters.category || ''}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                category: e.target.value as ConsultationCategory | undefined || undefined
                            }))}
                            className="w-full border border-[#081429] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                        >
                            <option value="">전체</option>
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                <option key={key} value={key}>
                                    {config.icon} {config.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 후속 조치 */}
                    <div>
                        <label className="block text-sm font-medium text-[#373d41] mb-2">
                            후속 조치
                        </label>
                        <select
                            value={filters.followUpStatus || 'all'}
                            onChange={(e) => setFilters(prev => ({
                                ...prev,
                                followUpStatus: e.target.value as any
                            }))}
                            className="w-full border border-[#081429] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                        >
                            <option value="all">전체</option>
                            <option value="needed">필요</option>
                            <option value="pending">대기 중</option>
                            <option value="done">완료</option>
                        </select>
                    </div>
                </div>

                {/* 검색창 */}
                <div className="mt-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="학생명, 제목, 내용으로 검색..."
                        className="w-full border border-[#081429] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#fdb813]"
                    />
                </div>
            </div>

            {/* 상담 목록 */}
            <div className="px-6 py-6">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        <p className="font-semibold">오류가 발생했습니다</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <ConsultationList
                    consultations={filteredConsultations}
                    loading={loading}
                    onRefresh={refetch}
                />
            </div>

            {/* 새 상담 기록 모달 */}
            {showAddModal && (
                <AddConsultationModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        refetch();
                    }}
                />
            )}
        </div>
    );
};

export default ConsultationManagementTab;
