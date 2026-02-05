import React, { useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, X, Settings, Eye, Edit, SlidersHorizontal,
    ArrowRightLeft, Copy, Upload, Save, Link2
} from 'lucide-react';
import { UnifiedStudent, TimetableClass } from '../../../../types';

interface TimetableHeaderProps {
    weekLabel: string;
    goToPrevWeek: () => void;
    goToNextWeek: () => void;
    goToThisWeek: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    viewType: 'teacher' | 'room' | 'class';
    setIsTeacherOrderModalOpen: (isOpen: boolean) => void;
    setIsViewSettingsOpen: (isOpen: boolean) => void;
    pendingMovesCount: number;
    handleSavePendingMoves: () => void;
    handleCancelPendingMoves: () => void;
    isSaving: boolean;
    // 조회/수정 모드
    mode: 'view' | 'edit';
    setMode: (mode: 'view' | 'edit') => void;
    canEdit: boolean;
    // 시뮬레이션 모드
    isSimulationMode?: boolean;
    onToggleSimulation?: () => void;
    onCopyLiveToDraft?: () => void;
    onPublishDraftToLive?: () => void;
    onOpenScenarioModal?: () => void;
    // 공유 링크 (마스터 전용)
    isMaster?: boolean;
    onOpenEmbedManager?: () => void;
    // 학생 데이터 (카운트용)
    studentMap?: Record<string, UnifiedStudent>;
    currentWeekStart?: Date;
    filteredClasses?: TimetableClass[];
}

const TimetableHeader: React.FC<TimetableHeaderProps> = ({
    weekLabel,
    goToPrevWeek,
    goToNextWeek,
    goToThisWeek,
    searchQuery,
    setSearchQuery,
    viewType,
    setIsTeacherOrderModalOpen,
    setIsViewSettingsOpen,
    pendingMovesCount,
    handleSavePendingMoves,
    handleCancelPendingMoves,
    isSaving,
    mode,
    setMode,
    canEdit,
    isSimulationMode = false,
    onToggleSimulation,
    onCopyLiveToDraft,
    onPublishDraftToLive,
    onOpenScenarioModal,
    isMaster = false,
    onOpenEmbedManager,
    studentMap = {},
    currentWeekStart,
    filteredClasses = []
}) => {
    // 학생 수 카운트 계산 (현재 시간표에 등록된 학생만, 중복 제거)
    const studentCounts = useMemo(() => {
        // 시간표에 등록된 학생 ID 수집 (중복 제거를 위해 Set 사용)
        const activeStudentIds = new Set<string>();
        const onHoldStudentIds = new Set<string>();
        const withdrawnStudentIds = new Set<string>();

        const today = new Date().toISOString().split('T')[0];
        const weekEnd = currentWeekStart
            ? new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : today;

        // 각 수업의 학생 목록에서 학생 ID 수집 (ClassCard 로직과 동일)
        filteredClasses.forEach(cls => {
            cls.studentList?.forEach(student => {
                // 재원생: 퇴원일 없고 대기 아님
                if (!student.withdrawalDate && !student.onHold) {
                    activeStudentIds.add(student.id);
                }
                // 대기생: 대기 상태이고 퇴원일 없음
                else if (student.onHold && !student.withdrawalDate) {
                    onHoldStudentIds.add(student.id);
                }
                // 퇴원생: 퇴원일 있음
                else if (student.withdrawalDate) {
                    withdrawnStudentIds.add(student.id);
                }
            });
        });

        let withdrawnThisWeek = 0;

        // 퇴원 예정 학생 중 이번 주에 퇴원하는 학생 카운트
        withdrawnStudentIds.forEach(studentId => {
            const student = studentMap[studentId];
            if (student?.withdrawalDate && student.withdrawalDate >= today && student.withdrawalDate <= weekEnd) {
                withdrawnThisWeek++;
            }
        });

        return {
            activeCount: activeStudentIds.size,      // 재원생 (중복 제거됨)
            onHoldCount: onHoldStudentIds.size,      // 대기 (중복 제거됨)
            withdrawnThisWeek                         // 이번 주 퇴원 예정
        };
    }, [filteredClasses, studentMap, currentWeekStart]);

    return (
        <div className="bg-gray-50 h-10 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0 text-xs">
            {/* Left: Week Info */}
            <div className="flex items-center gap-3">
                <span className="text-gray-600 font-medium">{weekLabel}</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={goToPrevWeek}
                        className="p-1 border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <button
                        onClick={goToThisWeek}
                        className="px-2 py-0.5 text-xxs font-bold border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        이번주
                    </button>
                    <button
                        onClick={goToNextWeek}
                        className="p-1 border border-gray-300 rounded-sm hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* 학생 수 카운트 */}
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 rounded-sm">
                        <span className="text-xxs text-green-700 font-medium">재원</span>
                        <span className="text-xs font-bold text-green-800">{studentCounts.activeCount}</span>
                    </div>
                    {studentCounts.onHoldCount > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-sm">
                            <span className="text-xxs text-amber-700 font-medium">대기</span>
                            <span className="text-xs font-bold text-amber-800">{studentCounts.onHoldCount}</span>
                        </div>
                    )}
                    {studentCounts.withdrawnThisWeek > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded-sm">
                            <span className="text-xxs text-red-700 font-medium">퇴원 예정</span>
                            <span className="text-xs font-bold text-red-800">{studentCounts.withdrawnThisWeek}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Search and Actions */}
            <div className="flex items-center gap-2">
                {/* Simulation Mode Toggle */}
                {canEdit && onToggleSimulation && (
                    <>
                        <div
                            onClick={onToggleSimulation}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer transition-all ${isSimulationMode
                                ? 'bg-orange-50 border-orange-300 hover:bg-orange-100'
                                : 'bg-white border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <ArrowRightLeft size={14} className={isSimulationMode ? 'text-orange-600' : 'text-gray-500'} />
                            <span className={`text-xs font-bold ${isSimulationMode ? 'text-orange-700' : 'text-gray-600'}`}>
                                {isSimulationMode ? '시뮬레이션 모드' : '실시간 모드'}
                            </span>
                        </div>

                        {/* Simulation Actions */}
                        {isSimulationMode && (
                            <>
                                <button
                                    onClick={onCopyLiveToDraft}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-orange-300 text-orange-700 rounded-sm text-xs font-bold hover:bg-orange-50 shadow-sm transition-colors"
                                    title="현재 실시간 시간표를 복사해옵니다 (기존 시뮬레이션 데이터 덮어쓰기)"
                                >
                                    <Copy size={12} />
                                    현재 상태 가져오기
                                </button>
                                {canEdit && (
                                    <button
                                        onClick={onPublishDraftToLive}
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600 text-white rounded-sm text-xs font-bold hover:bg-orange-700 shadow-sm transition-colors"
                                        title="시뮬레이션 내용을 실제 시간표에 적용합니다 (주의)"
                                    >
                                        <Upload size={12} />
                                        실제 반영
                                    </button>
                                )}

                                <button
                                    onClick={onOpenScenarioModal}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-100 border border-purple-300 text-purple-700 rounded-sm text-xs font-bold hover:bg-purple-200 shadow-sm transition-colors"
                                    title="시나리오 저장/불러오기"
                                >
                                    <Save size={12} />
                                    시나리오
                                </button>
                            </>
                        )}

                        {/* Separator */}
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    </>
                )}

                {/* Mode Toggle - 조회/수정 모드 */}
                <div className="flex bg-gray-200 rounded-sm p-0.5">
                    <button
                        onClick={() => setMode('view')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'view' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Eye size={12} />
                        조회
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setMode('edit')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1 ${mode === 'edit' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Edit size={12} />
                            수정
                        </button>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {/* Search */}
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="학생 검색..."
                        className="pl-7 pr-6 py-1 w-32 text-xs border border-gray-300 rounded-sm bg-white text-gray-700 placeholder-gray-400 outline-none focus:border-[#fdb813] focus:ring-1 focus:ring-[#fdb813]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 mx-1"></div>

                {/* Order Settings */}
                {viewType === 'teacher' && (
                    <button
                        onClick={() => setIsTeacherOrderModalOpen(true)}
                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                        title="강사 순서 설정"
                    >
                        ↕️ 강사 순서
                    </button>
                )}

                {/* Embed Share Link - 마스터만 */}
                {isMaster && onOpenEmbedManager && (
                    <button
                        onClick={onOpenEmbedManager}
                        className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-300 text-indigo-700 rounded-sm text-xs font-bold hover:bg-indigo-100 transition-colors"
                        title="외부 공유 링크 관리"
                    >
                        <Link2 size={12} />
                        공유
                    </button>
                )}

                {/* View Settings */}
                <button
                    onClick={() => setIsViewSettingsOpen(true)}
                    className="px-2 py-1 border border-gray-300 rounded-sm text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                    title="보기 설정"
                >
                    <SlidersHorizontal size={12} />
                    보기
                </button>

                {/* Pending Moves */}
                {pendingMovesCount > 0 && (
                    <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-sm px-2 py-1">
                        <span className="text-xs font-bold text-orange-600">
                            {pendingMovesCount}건 변경
                        </span>
                        <button
                            onClick={handleSavePendingMoves}
                            disabled={isSaving}
                            className="px-2 py-0.5 bg-green-500 text-white rounded-sm text-xs font-bold hover:bg-green-600 disabled:opacity-50"
                        >
                            {isSaving ? '저장중...' : '💾 저장'}
                        </button>
                        <button
                            onClick={handleCancelPendingMoves}
                            disabled={isSaving}
                            className="px-2 py-0.5 bg-gray-500 text-white rounded-sm text-xs font-bold hover:bg-gray-600 disabled:opacity-50"
                        >
                            ↩ 취소
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimetableHeader;
