import React, { useState, useMemo } from 'react';
import { UnifiedStudent, ConsultationRecord } from '../../types';
import { useStudents } from '../../hooks/useStudents';

import { useConvertToActive, useUpdateProspect } from '../../hooks/useProspectConversion';
import {
    Target, Users, Calendar, Phone, School, Clock,
    UserCheck, Edit2, ChevronRight, RefreshCw, Loader2,
    AlertCircle, CheckCircle, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const COLORS = {
    navy: '#081429',
    yellow: '#fdb813',
    orange: '#f97316',
};

type ProspectStatus = 'contacted' | 'pending_registration' | 'pending_test' | 'on_hold';

const PROSPECT_STATUS_CONFIG: Record<ProspectStatus, { label: string; color: string; bgColor: string }> = {
    contacted: { label: '상담 완료', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    pending_registration: { label: '등록 예정', color: 'text-green-700', bgColor: 'bg-green-100' },
    pending_test: { label: '테스트 예정', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    on_hold: { label: '보류', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const ProspectManagementTab: React.FC = () => {
    const { students, loading, refreshStudents } = useStudents(true);

    const convertToActive = useConvertToActive();
    const updateProspect = useUpdateProspect();

    const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
    // 선택된 학생 객체는 students 리스트에서 실시간으로 가져옴 (상태 변경 반영을 위해)
    const selectedProspect = useMemo(() => students.find(s => s.id === selectedProspectId) || null, [students, selectedProspectId]);
    const [statusFilter, setStatusFilter] = useState<'all' | ProspectStatus>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertStartDate, setConvertStartDate] = useState(new Date().toISOString().split('T')[0]);

    // 예비원생만 필터링
    const prospects = useMemo(() => {
        let result = students.filter(s => s.status === 'prospect');

        if (statusFilter !== 'all') {
            result = result.filter(s => s.prospectStatus === statusFilter);
        }

        // 등록 예정일 순으로 정렬
        result.sort((a, b) => {
            if (a.plannedStartDate && b.plannedStartDate) {
                return a.plannedStartDate.localeCompare(b.plannedStartDate);
            }
            if (a.plannedStartDate) return -1;
            if (b.plannedStartDate) return 1;
            return a.name.localeCompare(b.name);
        });

        return result;
    }, [students, statusFilter]);



    // 상태별 통계
    const stats = useMemo(() => {
        const all = students.filter(s => s.status === 'prospect');
        return {
            total: all.length,
            contacted: all.filter(s => s.prospectStatus === 'contacted').length,
            pending_registration: all.filter(s => s.prospectStatus === 'pending_registration').length,
            pending_test: all.filter(s => s.prospectStatus === 'pending_test').length,
            on_hold: all.filter(s => s.prospectStatus === 'on_hold').length,
        };
    }, [students]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshStudents();
        setIsRefreshing(false);
    };

    const handleStatusChange = (studentId: string, newStatus: ProspectStatus) => {
        updateProspect.mutate({ studentId, prospectStatus: newStatus });
    };

    const handleConvertToActive = () => {
        if (!selectedProspect || !convertStartDate) return;

        convertToActive.mutate({
            studentId: selectedProspect.id,
            startDate: convertStartDate,
            enrollments: selectedProspect.enrollments || [],
        }, {
            onSuccess: () => {
                alert(`[${selectedProspect.name}] 학생이 재원생으로 전환되었습니다.`);
                setShowConvertModal(false);
                setSelectedProspectId(null);
            },
            onError: (error) => {
                console.error('전환 오류:', error);
                alert('재원생 전환에 실패했습니다.');
            }
        });
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), 'MM/dd(eee)', { locale: ko });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                    <p className="text-gray-600">예비원생 목록을 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 헤더 */}
            <div className="bg-[#081429] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Target className="w-6 h-6 text-orange-400" />
                    <h1 className="text-lg font-bold text-white">예비원생 관리</h1>
                    <span className="text-sm text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full">
                        {stats.total}명
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* 상태 필터 */}
                    <div className="flex bg-white/10 rounded-lg p-0.5">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${statusFilter === 'all' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            전체 ({stats.total})
                        </button>
                        {(Object.keys(PROSPECT_STATUS_CONFIG) as ProspectStatus[]).map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${statusFilter === status ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {PROSPECT_STATUS_CONFIG[status].label} ({stats[status]})
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="flex-1 overflow-hidden flex">
                {/* 좌측: 예비원생 목록 */}
                <div className={`w-full md:w-[400px] border-r border-gray-200 bg-white flex flex-col ${selectedProspect ? 'hidden md:flex' : 'flex'
                    }`}>
                    <div className="flex-1 overflow-y-auto">
                        {prospects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                                <Target className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-lg font-medium">예비원생이 없습니다</p>
                                <p className="text-sm mt-2 text-center">
                                    등록 상담 탭에서 상담 기록을<br />예비원생으로 등록할 수 있습니다.
                                </p>
                            </div>
                        ) : (
                            prospects.map(prospect => {

                                const statusConfig = PROSPECT_STATUS_CONFIG[prospect.prospectStatus as ProspectStatus] || PROSPECT_STATUS_CONFIG.contacted;

                                return (
                                    <div
                                        key={prospect.id}
                                        onClick={() => setSelectedProspectId(prospect.id)}
                                        className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-orange-50 ${selectedProspect?.id === prospect.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <span className="font-bold text-gray-900">{prospect.name}</span>
                                                <span className="ml-2 text-sm text-gray-500">{prospect.grade}</span>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            {prospect.school && (
                                                <span className="flex items-center gap-1">
                                                    <School className="w-3 h-3" />
                                                    {prospect.school}
                                                </span>
                                            )}
                                            {prospect.plannedStartDate && (
                                                <span className="flex items-center gap-1 text-orange-600 font-medium">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(prospect.plannedStartDate)} 예정
                                                </span>
                                            )}
                                        </div>

                                        {prospect.plannedSubjects && prospect.plannedSubjects.length > 0 && (
                                            <div className="flex gap-1 mt-2">
                                                {prospect.plannedSubjects.map(subject => (
                                                    <span
                                                        key={subject}
                                                        className={`px-2 py-0.5 text-xs rounded ${subject === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                            }`}
                                                    >
                                                        {subject === 'math' ? '수학' : '영어'}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 우측: 상세 정보 */}
                <div className={`flex-1 bg-white flex flex-col ${selectedProspect ? 'flex' : 'hidden md:flex'}`}>
                    {selectedProspect ? (
                        <>
                            {/* 상세 헤더 */}
                            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{selectedProspect.name}</h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedProspect.school} {selectedProspect.grade}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowConvertModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
                                    >
                                        <UserCheck className="w-4 h-4" />
                                        재원생 전환
                                    </button>
                                </div>
                            </div>

                            {/* 상세 정보 */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* 상태 변경 */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <Filter className="w-4 h-4" />
                                        진행 상태
                                    </h3>
                                    <div className="flex gap-2 flex-wrap">
                                        {(Object.keys(PROSPECT_STATUS_CONFIG) as ProspectStatus[]).map(status => {
                                            const config = PROSPECT_STATUS_CONFIG[status];
                                            const isSelected = selectedProspect.prospectStatus === status;
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChange(selectedProspect.id, status)}
                                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${isSelected
                                                        ? `${config.bgColor} ${config.color} border-current`
                                                        : 'bg-gray-50 text-gray-600 border-transparent hover:border-gray-300'
                                                        }`}
                                                >
                                                    {config.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 등록 예정 정보 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">등록 예정일</p>
                                        <p className="font-bold text-gray-900">
                                            {selectedProspect.plannedStartDate || '미정'}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">등록 예정 과목</p>
                                        <div className="flex gap-1">
                                            {selectedProspect.plannedSubjects?.map(s => (
                                                <span key={s} className={`px-2 py-0.5 text-xs rounded ${s === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {s === 'math' ? '수학' : '영어'}
                                                </span>
                                            )) || <span className="text-gray-400">미정</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* 후속 조치 */}
                                {selectedProspect.followUpDate && (
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-yellow-700">
                                            <Clock className="w-4 h-4" />
                                            <span className="font-bold">후속 조치 예정</span>
                                            <span className="ml-auto text-sm">{formatDate(selectedProspect.followUpDate)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* 메모 */}
                                {selectedProspect.prospectNotes && (
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-700 mb-2">상담 메모</h3>
                                        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                                            {selectedProspect.prospectNotes}
                                        </div>
                                    </div>
                                )}


                            </div>

                            {/* 모바일 뒤로가기 */}
                            <div className="md:hidden p-4 border-t border-gray-200">
                                <button
                                    onClick={() => setSelectedProspectId(null)}
                                    className="w-full py-2 text-gray-600 font-medium"
                                >
                                    ← 목록으로
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <Target className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg">예비원생을 선택하세요</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 재원생 전환 모달 */}
            {showConvertModal && selectedProspect && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="bg-green-600 px-6 py-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserCheck className="w-5 h-5" />
                                재원생 전환
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                <strong className="text-gray-900">{selectedProspect.name}</strong> 학생을 재원생으로 전환합니다.
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Calendar className="inline-block w-4 h-4 mr-1" />
                                    등록일 (수업 시작일)
                                </label>
                                <input
                                    type="date"
                                    value={convertStartDate}
                                    onChange={(e) => setConvertStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                            </div>

                            {selectedProspect.plannedSubjects && selectedProspect.plannedSubjects.length > 0 && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-xs text-gray-500 mb-1">등록 예정 과목</p>
                                    <div className="flex gap-2">
                                        {selectedProspect.plannedSubjects.map(subject => (
                                            <span
                                                key={subject}
                                                className={`px-2 py-1 text-xs font-medium rounded ${subject === 'math' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                    }`}
                                            >
                                                {subject === 'math' ? '수학' : '영어'}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        ※ 수업 배치는 학생 관리 탭에서 별도로 진행해주세요.
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowConvertModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConvertToActive}
                                disabled={convertToActive.isPending}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                            >
                                {convertToActive.isPending ? '전환 중...' : '재원생으로 전환'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProspectManagementTab;
