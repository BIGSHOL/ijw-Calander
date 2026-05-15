/**
 * SheetsLinkPanel - Google 스프레드시트 동기화 드롭다운
 *
 * 사용 위치: TimetableHeader 우측 (엑셀 내보내기 옆)
 *
 * 권한별 동작:
 * - master/admin: 전체 시트 열기 + 내 시트(있을 경우) + 강사 시트 선택 + "지금 동기화"
 * - 일반 강사: 내 시트 열기만
 *
 * 상태:
 * - loading: 매핑 구독 중
 * - syncing: 수동 동기화 진행 중
 */

import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, ExternalLink, RefreshCw, ChevronDown, Users, User as UserIcon, Clock, AlertCircle } from 'lucide-react';
import { useSheetsSync } from '../../../../hooks/useSheetsSync';
import { Timestamp } from 'firebase/firestore';
import type { ExportTimetableParams } from '../utils/excelExport';

interface SheetsLinkPanelProps {
    /** 현재 로그인 사용자의 staffId (강사 시트 매칭용) */
    currentStaffId?: string | null;
    /** 관리자 권한 (master/admin) */
    isAdmin: boolean;
    /** 현재 시간표 데이터로 xlsx 생성 파라미터 반환 (엑셀 내보내기와 동일) */
    getSheetsExportParams?: () => ExportTimetableParams;
}

const formatRelativeTime = (ts?: Timestamp): string => {
    if (!ts || !ts.toMillis) return '동기화 전';
    const ms = ts.toMillis();
    const diff = Date.now() - ms;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `${sec}초 전`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hour = Math.round(min / 60);
    if (hour < 24) return `${hour}시간 전`;
    const day = Math.round(hour / 24);
    return `${day}일 전`;
};

/**
 * 영어 에러 메시지를 한글로 변환 (이미 한글이면 그대로).
 * Functions에서 translateError가 적용되지 않은 옛 메시지 + 클라이언트 발생 에러용.
 */
const translateErrorMessage = (msg?: string | null): string => {
    if (!msg) return '';
    if (/[가-힣]/.test(msg)) return msg;

    const lower = msg.toLowerCase();
    if (lower.includes('storage quota')) {
        return 'Google Drive 저장 공간이 부족합니다. 원장님 Drive에 폴더를 만들고 서비스 계정에 편집자 권한을 부여한 뒤 등록해주세요.';
    }
    if (lower.includes('rate limit')) return 'Google API 호출 제한 초과. 잠시 후 자동 재시도됩니다.';
    if (lower.includes('quota exceeded')) return 'Google API 일일 할당량을 초과했습니다.';
    if (lower.includes('forbidden') || lower.includes('permission-denied')) {
        return '권한이 없습니다. 관리자만 수동 동기화할 수 있습니다.';
    }
    if (lower.includes('not found') || lower.includes('not-found')) {
        return '함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.';
    }
    if (lower.includes('unauthenticated')) return '로그인이 필요합니다.';
    if (lower.includes('jwt')) return 'Google API 인증 실패. 관리자에게 문의해주세요.';
    if (lower.includes('network') || lower.includes('timeout') || lower.includes('failed to fetch')) {
        return '네트워크 오류. 잠시 후 다시 시도해주세요.';
    }
    if (lower.includes('internal')) return '서버 내부 오류가 발생했습니다.';
    return `동기화 오류: ${msg}`;
};

const SheetsLinkPanel: React.FC<SheetsLinkPanelProps> = ({ currentStaffId, isAdmin, getSheetsExportParams }) => {
    const { mapping, loading, error, syncNow, syncing, mySheet } = useSheetsSync(currentStaffId);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOpenSheet = (url?: string) => {
        if (!url) return;
        window.open(url, '_blank', 'noopener');
        setIsOpen(false);
    };

    const handleSyncNow = async () => {
        try {
            // 현재 시간표 데이터로 xlsx 생성 → 전송 (엑셀 내보내기와 100% 동일)
            const params = getSheetsExportParams ? getSheetsExportParams() : undefined;
            await syncNow(params);
        } catch (err) {
            // 에러는 hook 내부에서 setError로 처리됨
        }
    };

    const fullSheet = mapping?.all || null;
    const teacherEntries = mapping?.byTeacherId
        ? Object.entries(mapping.byTeacherId)
              .filter(([, entry]) => entry.isActive !== false)
              .sort(([, a], [, b]) => (a.teacherName || '').localeCompare(b.teacherName || '', 'ko'))
        : [];

    const hasAnySheet = fullSheet || mySheet || teacherEntries.length > 0;

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded transition-colors disabled:opacity-50"
                title="Google 스프레드시트로 시간표 보기"
            >
                <FileSpreadsheet size={14} />
                <span>스프레드시트</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                    {loading && (
                        <div className="px-3 py-2 text-xs text-gray-500">로딩 중...</div>
                    )}

                    {!loading && !hasAnySheet && (
                        <div className="px-3 py-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertCircle size={12} className="text-amber-500" />
                                <span className="font-medium text-gray-700">아직 시트가 생성되지 않았습니다</span>
                            </div>
                            <div className="text-gray-500 leading-snug">
                                {isAdmin
                                    ? "아래 '지금 동기화'를 눌러 시트를 생성하세요."
                                    : "관리자에게 동기화 실행을 요청해주세요."}
                            </div>
                        </div>
                    )}

                    {/* 전체 시트 (관리자만) */}
                    {!loading && isAdmin && fullSheet && (
                        <button
                            onClick={() => handleOpenSheet(fullSheet.url)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            title="모든 강사의 시간표가 포함된 전체 시트"
                        >
                            <Users size={14} className="text-indigo-500 shrink-0" />
                            <span className="flex-1 text-left font-medium">전체 시트 열기</span>
                            <ExternalLink size={12} className="text-gray-400" />
                        </button>
                    )}

                    {/* 내 시트 (강사 본인) */}
                    {!loading && mySheet && (
                        <button
                            onClick={() => handleOpenSheet(mySheet.url)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                            title={mySheet.teacherName ? `${mySheet.teacherName} 선생님 시트` : '내 시트'}
                        >
                            <UserIcon size={14} className="text-green-500 shrink-0" />
                            <span className="flex-1 text-left font-medium">내 시트 열기</span>
                            <ExternalLink size={12} className="text-gray-400" />
                        </button>
                    )}

                    {/* 관리자: 다른 강사 시트 선택 */}
                    {!loading && isAdmin && teacherEntries.length > 0 && (
                        <>
                            <div className="my-1 border-t border-gray-100" />
                            <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                강사별 시트
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                                {teacherEntries.map(([teacherId, entry]) => (
                                    <button
                                        key={teacherId}
                                        onClick={() => handleOpenSheet(entry.url)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <UserIcon size={12} className="text-gray-400 shrink-0" />
                                        <span className="flex-1 text-left truncate">{entry.teacherName || teacherId}</span>
                                        <ExternalLink size={10} className="text-gray-400" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* 동기화 액션 (관리자만) */}
                    {!loading && isAdmin && (
                        <>
                            <div className="my-1 border-t border-gray-100" />
                            <button
                                onClick={handleSyncNow}
                                disabled={syncing}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
                                title="Firestore의 최신 시간표 데이터를 시트에 즉시 반영합니다."
                            >
                                <RefreshCw size={14} className={`text-blue-500 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                                <span className="flex-1 text-left font-medium">
                                    {syncing ? '동기화 중...' : '지금 동기화'}
                                </span>
                            </button>
                        </>
                    )}

                    {/* 마지막 동기화 시각 */}
                    {!loading && mapping?.lastFullSyncAt && (
                        <div className="px-3 py-1.5 mt-1 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Clock size={10} />
                            <span>마지막 동기화: {formatRelativeTime(mapping.lastFullSyncAt)}</span>
                        </div>
                    )}

                    {/* 에러 표시 */}
                    {error && (
                        <div className="px-3 py-1.5 mt-1 border-t border-red-100 bg-red-50 text-[10px] text-red-700 flex items-start gap-1.5">
                            <AlertCircle size={10} className="shrink-0 mt-0.5" />
                            <span className="flex-1 leading-snug">{translateErrorMessage(error)}</span>
                        </div>
                    )}

                    {mapping?.lastError && !error && (
                        <div className="px-3 py-1.5 mt-1 border-t border-amber-100 bg-amber-50 text-[10px] text-amber-700 flex items-start gap-1.5">
                            <AlertCircle size={10} className="shrink-0 mt-0.5" />
                            <span className="flex-1 leading-snug">최근 동기화 오류: {translateErrorMessage(mapping.lastError)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SheetsLinkPanel;
