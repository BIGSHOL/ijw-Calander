/**
 * SheetsLinkPanel - 시간표 "내보내기/가져오기" 통합 메뉴
 *
 * 하나의 드롭다운으로 통합 (구 SheetsLinkPanel + TimetableHeader '내보내기' 메뉴 병합):
 *   1) 저장     — 이미지로 저장 / 엑셀로 저장
 *   2) 구글 시트 — 시트 열기(전체) / 시트에 지금 반영(수동 동기화) / 마지막 동기화 시각
 *   3) 가져오기  — 엑셀 파일에서 / 구글 시트에서 / 가져오기 이력·되돌리기
 *   4) 공유     — 공유 링크 관리
 *
 * 권한:
 *   - 시트 열기·동기화: 관리자(isAdmin)
 *   - 공유 링크 관리: master(isMaster)
 *   - 저장/가져오기: 해당 핸들러가 전달될 때만 노출
 *
 * 구글 시트 동기화는 평소 클라이언트 자동 푸시가 담당하며,
 * '시트에 지금 반영'은 수동 즉시 반영용이다.
 */

import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, ExternalLink, RefreshCw, ChevronDown, Clock, AlertCircle, Image as ImageIcon, Upload, Link2, RotateCcw } from 'lucide-react';
import { useSheetsSync } from '../../../../hooks/useSheetsSync';
import { Timestamp } from 'firebase/firestore';
import type { ExportTimetableParams } from '../utils/excelExport';

interface SheetsLinkPanelProps {
    /** 관리자 권한 (master/admin) — 시트 열기·동기화 노출 */
    isAdmin: boolean;
    /** master 권한 — 공유 링크 관리 노출 */
    isMaster?: boolean;
    /** 현재 시간표 데이터로 xlsx 생성 파라미터 반환 (시트 동기화용) */
    getSheetsExportParams?: () => ExportTimetableParams;
    // 저장
    onExportImage?: () => void;
    onExportExcel?: () => void;
    // 가져오기
    onImportExcel?: () => void;
    onImportFromSheet?: () => void;
    onOpenImportHistory?: () => void;
    // 공유
    onOpenEmbedManager?: () => void;
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

const SheetsLinkPanel: React.FC<SheetsLinkPanelProps> = ({
    isAdmin,
    isMaster,
    getSheetsExportParams,
    onExportImage,
    onExportExcel,
    onImportExcel,
    onImportFromSheet,
    onOpenImportHistory,
    onOpenEmbedManager,
}) => {
    const { mapping, loading, error, syncNow, syncing } = useSheetsSync();
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

    const runAndClose = (fn?: () => void) => {
        if (fn) {
            fn();
            setIsOpen(false);
        }
    };

    const fullSheet = mapping?.all || null;

    // 그룹별 노출 여부
    const hasSave = !!(onExportImage || onExportExcel);
    const hasSheetGroup = isAdmin;
    const hasImport = !!(onImportExcel || onImportFromSheet || onOpenImportHistory);
    const hasShare = !!(isMaster && onOpenEmbedManager);

    // 보여줄 게 아무것도 없으면 버튼 자체를 숨김
    if (!hasSave && !hasSheetGroup && !hasImport && !hasShare) return null;

    const itemCls = 'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors';
    const labelCls = 'px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-400 tracking-wide';

    return (
        <div ref={dropdownRef} className="relative">
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-300 hover:text-white border border-white/20 rounded-sm hover:bg-white/10 transition-colors"
                title="내보내기 · 가져오기 · 구글 시트"
            >
                <FileSpreadsheet size={12} />
                <span>내보내기/가져오기</span>
                <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                    {/* 그룹 1: 저장 */}
                    {hasSave && <div className={labelCls}>저장</div>}
                    {onExportImage && (
                        <button onClick={() => runAndClose(onExportImage)} className={itemCls}>
                            <ImageIcon size={14} className="text-gray-500 shrink-0" />
                            <span className="flex-1 text-left">이미지로 저장</span>
                        </button>
                    )}
                    {onExportExcel && (
                        <button onClick={() => runAndClose(onExportExcel)} className={itemCls}>
                            <FileSpreadsheet size={14} className="text-gray-500 shrink-0" />
                            <span className="flex-1 text-left">엑셀로 저장</span>
                        </button>
                    )}

                    {/* 그룹 2: 구글 시트 (관리자) */}
                    {hasSheetGroup && hasSave && <div className="my-1 border-t border-gray-100" />}
                    {hasSheetGroup && <div className={labelCls}>구글 시트</div>}
                    {hasSheetGroup && fullSheet && (
                        <button
                            onClick={() => handleOpenSheet(fullSheet.url)}
                            className={itemCls}
                            title="동기화된 전체 시간표 시트 열기"
                        >
                            <ExternalLink size={14} className="text-indigo-500 shrink-0" />
                            <span className="flex-1 text-left">시트 열기</span>
                        </button>
                    )}
                    {hasSheetGroup && (
                        <button
                            onClick={handleSyncNow}
                            disabled={syncing}
                            className={`${itemCls} disabled:opacity-50`}
                            title="현재 시간표를 시트에 즉시 반영합니다 (평소엔 자동 반영)"
                        >
                            <RefreshCw size={14} className={`text-blue-500 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
                            <span className="flex-1 text-left">{syncing ? '반영 중...' : '시트에 지금 반영'}</span>
                        </button>
                    )}
                    {hasSheetGroup && mapping?.lastFullSyncAt && (
                        <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                            <Clock size={10} />
                            <span>마지막 동기화: {formatRelativeTime(mapping.lastFullSyncAt)}</span>
                        </div>
                    )}
                    {hasSheetGroup && !loading && !fullSheet && (
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 leading-snug">
                            아직 시트가 없습니다. '시트에 지금 반영'을 눌러 생성하세요.
                        </div>
                    )}

                    {/* 그룹 3: 가져오기 */}
                    {hasImport && (hasSave || hasSheetGroup) && <div className="my-1 border-t border-gray-100" />}
                    {hasImport && <div className={labelCls}>가져오기</div>}
                    {onImportExcel && (
                        <button
                            onClick={() => runAndClose(onImportExcel)}
                            className={itemCls}
                            title="내보낸 엑셀 파일을 수정해서 다시 가져오기 (라운드트립)"
                        >
                            <Upload size={14} className="text-gray-500 shrink-0" />
                            <span className="flex-1 text-left">엑셀 파일에서 가져오기</span>
                        </button>
                    )}
                    {onImportFromSheet && (
                        <button
                            onClick={() => runAndClose(onImportFromSheet)}
                            className={itemCls}
                            title="Google 스프레드시트 URL을 입력해 그 시트의 변경을 가져오기"
                        >
                            <Upload size={14} className="text-green-600 shrink-0" />
                            <span className="flex-1 text-left">구글 시트에서 가져오기</span>
                        </button>
                    )}
                    {onOpenImportHistory && (
                        <button
                            onClick={() => runAndClose(onOpenImportHistory)}
                            className={itemCls}
                            title="가져오기 이력 + 되돌리기 (자동 스냅샷으로 1클릭 복원)"
                        >
                            <RotateCcw size={14} className="text-gray-500 shrink-0" />
                            <span className="flex-1 text-left">가져오기 이력 / 되돌리기</span>
                        </button>
                    )}

                    {/* 그룹 4: 공유 */}
                    {hasShare && (hasSave || hasSheetGroup || hasImport) && <div className="my-1 border-t border-gray-100" />}
                    {hasShare && (
                        <button onClick={() => runAndClose(onOpenEmbedManager)} className={itemCls}>
                            <Link2 size={14} className="text-gray-500 shrink-0" />
                            <span className="flex-1 text-left">공유 링크 관리</span>
                        </button>
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
