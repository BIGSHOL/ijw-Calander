import React, { useMemo, useState } from 'react';
import {
    X, AlertTriangle, AlertCircle, CheckCircle2,
    UserPlus, UserMinus, ArrowRight, PenLine, Calendar, FileSpreadsheet, Palette,
} from 'lucide-react';
import type { ImportedExcel, ImportChanges } from './utils/excelImport';
import { useEscapeClose } from '../../../hooks/useEscapeClose';

interface ExcelImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    imported: ImportedExcel | null;
    changes: ImportChanges | null;
    /** 현재 화면의 주차 라벨 (다른 주차 파일 차단용) */
    currentWeekLabel: string;
    /** 현재 Firestore에 존재하는 class id 집합 (무결성 검증용) */
    knownClassIds: Set<string>;
    /** 학생ID → 학생 객체 (이름/학교 표시용) */
    studentMap: Record<string, { name?: string; school?: string; grade?: string }>;
    /** 수업ID → className (표시용) — filteredClasses 등에서 빌드 */
    classNameById: Map<string, string>;
    /** 적용 — Phase 4 에서 구현 (현재는 콘솔 로그) */
    onApply: (changes: ImportChanges) => Promise<void> | void;
}

const LARGE_CHANGE_THRESHOLD = 30;

export const ExcelImportPreviewModal: React.FC<ExcelImportPreviewModalProps> = ({
    isOpen, onClose,
    imported, changes,
    currentWeekLabel, knownClassIds, studentMap, classNameById,
    onApply,
}) => {
    useEscapeClose(onClose);
    const [isApplying, setIsApplying] = useState(false);

    // 검증
    const validation = useMemo(() => {
        if (!imported || !changes) {
            return { isDifferentWeek: false, unknownClassIds: new Set<string>(), totalChanges: 0, isLargeChange: false, unmatchedAdditionCount: 0 };
        }
        const isDifferentWeek = imported.weekLabel !== currentWeekLabel;
        const unknownClassIds = new Set<string>();
        imported.entries.forEach(e => {
            if (e.classId && !knownClassIds.has(e.classId)) unknownClassIds.add(e.classId);
        });
        const totalChanges =
            changes.studentAdditions.length +
            changes.studentRemovals.length +
            changes.studentMoves.length +
            changes.classNameRenames.length +
            changes.classColorChanges.length;
        const isLargeChange = totalChanges >= LARGE_CHANGE_THRESHOLD;
        const unmatchedAdditionCount = changes.studentAdditions.filter(a => !a.matchedStudentId).length;
        return { isDifferentWeek, unknownClassIds, totalChanges, isLargeChange, unmatchedAdditionCount };
    }, [imported, changes, currentWeekLabel, knownClassIds]);

    if (!isOpen || !imported || !changes) return null;

    const studentLabel = (studentId: string): string => {
        const s = studentMap[studentId];
        if (!s) return studentId;
        return `${s.name || studentId}${s.school ? ` / ${s.grade || ''}${s.school}` : ''}`;
    };

    const classLabel = (classId: string): string => {
        return classNameById.get(classId) || `(미확인: ${classId.slice(0, 8)}...)`;
    };

    const handleApply = async () => {
        // 임계값 경고
        if (validation.isLargeChange) {
            if (!confirm(
                `⚠ 변경 ${validation.totalChanges}건은 매우 많은 양입니다.\n\n정말로 적용하시겠습니까?\n(적용 직전 자동 스냅샷이 저장되어 되돌릴 수 있습니다)`
            )) return;
        }
        // 다른 주차 차단
        if (validation.isDifferentWeek) {
            if (!confirm(
                `⚠ 가져온 파일은 "${imported.weekLabel}" 주차이고 현재 화면은 "${currentWeekLabel}" 입니다.\n\n다른 주차 파일을 적용하면 의도하지 않은 변경이 발생할 수 있습니다.\n그래도 진행하시겠습니까?`
            )) return;
        }
        // unknown classId 경고
        if (validation.unknownClassIds.size > 0) {
            if (!confirm(
                `⚠ ${validation.unknownClassIds.size}개의 수업ID가 현재 데이터에 없습니다.\n(이미 삭제된 수업이거나 다른 환경의 파일일 수 있음)\n\n그래도 진행하시겠습니까?`
            )) return;
        }
        // 매칭 안 된 추가 학생 경고
        if (validation.unmatchedAdditionCount > 0) {
            if (!confirm(
                `⚠ ${validation.unmatchedAdditionCount}건의 추가 학생이 매칭되지 않아 무시됩니다.\n(이름/학년이 학생 DB와 일치하지 않거나 동명이인)\n\n나머지만 적용할까요?`
            )) return;
        }

        setIsApplying(true);
        try {
            await onApply(changes);
        } catch (err: any) {
            console.error('[ExcelImport] 적용 실패:', err);
            alert(`적용 실패:\n${err?.message || err}`);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-sm w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet size={18} className="text-amber-600" />
                        <div>
                            <h2 className="text-sm font-bold text-primary">엑셀 가져오기 — 변경점 검토</h2>
                            <p className="text-xs text-gray-500">
                                {imported.subjectFilter} · {imported.weekLabel} · 기준일 {imported.referenceDate}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-500">
                        <X size={18} />
                    </button>
                </div>

                {/* 검증 경고 영역 */}
                <div className="px-4 py-2 space-y-1.5 border-b border-gray-100 bg-gray-50">
                    {validation.isDifferentWeek && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-sm px-3 py-2 text-xs">
                            <Calendar size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-red-800">
                                <strong>다른 주차 파일</strong> — 가져온 파일: <code>{imported.weekLabel}</code> /
                                현재 화면: <code>{currentWeekLabel}</code>
                            </div>
                        </div>
                    )}
                    {validation.unknownClassIds.size > 0 && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-xs">
                            <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-amber-800">
                                <strong>미확인 수업 {validation.unknownClassIds.size}개</strong> — 현재 데이터에 없는 수업ID가 메타에 있음 (이미 삭제된 수업 또는 다른 환경 파일)
                            </div>
                        </div>
                    )}
                    {validation.isLargeChange && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-sm px-3 py-2 text-xs">
                            <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-amber-800">
                                <strong>대량 변경 {validation.totalChanges}건</strong> — 의도한 변경인지 확인하세요 (임계값 {LARGE_CHANGE_THRESHOLD}건 이상)
                            </div>
                        </div>
                    )}
                    {!validation.isDifferentWeek && validation.unknownClassIds.size === 0 && !validation.isLargeChange && validation.totalChanges > 0 && (
                        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 text-xs">
                            <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div className="text-emerald-800">검증 통과 — {validation.totalChanges}건 변경 준비됨</div>
                        </div>
                    )}
                    {validation.totalChanges === 0 && (
                        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-sm px-3 py-2 text-xs">
                            <CheckCircle2 size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-blue-800">변경 사항 없음 — 가져온 파일이 현재 데이터와 동일합니다</div>
                        </div>
                    )}
                </div>

                {/* 변경점 목록 */}
                <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
                    {/* 학생 추가 */}
                    {changes.studentAdditions.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                <UserPlus size={12} /> 학생 추가 ({changes.studentAdditions.length}건)
                            </h3>
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-sm divide-y divide-emerald-100">
                                {changes.studentAdditions.map((a, i) => (
                                    <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                        <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[10px] ${a.matchedStudentId ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {a.matchedStudentId ? 'MATCH' : 'UNMATCHED'}
                                        </span>
                                        <span className="font-medium">{a.text}</span>
                                        <ArrowRight size={10} className="text-gray-400" />
                                        <span className="text-gray-700">{classLabel(a.targetClassId)}</span>
                                        {a.candidates && a.candidates.length > 1 && (
                                            <span className="text-xs text-orange-600">동명이인 {a.candidates.length}명</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 학생 삭제 */}
                    {changes.studentRemovals.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                                <UserMinus size={12} /> 학생 삭제 ({changes.studentRemovals.length}건)
                            </h3>
                            <div className="bg-red-50/50 border border-red-100 rounded-sm divide-y divide-red-100">
                                {changes.studentRemovals.map((r, i) => (
                                    <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-red-100 text-red-700">REMOVE</span>
                                        <span className="font-medium">{studentLabel(r.studentId)}</span>
                                        <span className="text-gray-500">←</span>
                                        <span className="text-gray-700">{classLabel(r.sourceClassId)}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 학생 이동 */}
                    {changes.studentMoves.length > 0 && (() => {
                        const teacherChangedCount = changes.studentMoves.filter(m => m.teacherChanged).length;
                        return (
                            <section>
                                <h3 className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                                    <ArrowRight size={12} /> 학생 이동 ({changes.studentMoves.length}건)
                                    {teacherChangedCount > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-700 text-[10px] font-normal">
                                            담임 변경 {teacherChangedCount}건 포함
                                        </span>
                                    )}
                                </h3>
                                <div className="bg-blue-50/50 border border-blue-100 rounded-sm divide-y divide-blue-100">
                                    {changes.studentMoves.map((m, i) => (
                                        <div key={i} className="px-2 py-1 text-xs flex items-center gap-2 flex-wrap">
                                            <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[10px] ${m.teacherChanged ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {m.teacherChanged ? '담임변경' : 'MOVE'}
                                            </span>
                                            <span className="font-medium">{studentLabel(m.studentId)}</span>
                                            {/* 출처 */}
                                            <span className="text-gray-700">
                                                {m.fromTeacher && <span className="text-gray-500">[{m.fromTeacher}·{m.fromDay || '?'}]</span>}{' '}
                                                {classLabel(m.fromClassId)}
                                            </span>
                                            <ArrowRight size={10} className="text-gray-400" />
                                            {/* 목적지 */}
                                            <span className="text-gray-700">
                                                {m.toTeacher && <span className={m.teacherChanged ? 'text-orange-600 font-bold' : 'text-gray-500'}>[{m.toTeacher}·{m.toDay || '?'}]</span>}{' '}
                                                {classLabel(m.toClassId)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        );
                    })()}

                    {/* 수업 색상 변경 */}
                    {changes.classColorChanges.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-pink-700 mb-1 flex items-center gap-1">
                                <Palette size={12} /> 수업 색상 변경 ({changes.classColorChanges.length}건)
                            </h3>
                            <div className="bg-pink-50/50 border border-pink-100 rounded-sm divide-y divide-pink-100">
                                {changes.classColorChanges.map((c, i) => {
                                    const argbToCss = (argb?: string) => {
                                        if (!argb) return 'transparent';
                                        const s = argb.length === 8 ? argb.slice(2) : argb;
                                        return `#${s}`;
                                    };
                                    return (
                                        <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-pink-100 text-pink-700">COLOR</span>
                                            <span className="font-medium">{c.className}</span>
                                            <span className="text-gray-400 ml-2">배경</span>
                                            <span
                                                className="inline-block w-4 h-4 border border-gray-300 rounded-sm"
                                                style={{ backgroundColor: argbToCss(c.oldBg) }}
                                                title={c.oldBg || '없음'}
                                            />
                                            {c.newBg && (
                                                <>
                                                    <ArrowRight size={10} className="text-gray-400" />
                                                    <span
                                                        className="inline-block w-4 h-4 border border-gray-400 rounded-sm"
                                                        style={{ backgroundColor: argbToCss(c.newBg) }}
                                                        title={c.newBg}
                                                    />
                                                </>
                                            )}
                                            <span className="text-gray-400 ml-2">글자</span>
                                            <span
                                                className="inline-block w-4 h-4 border border-gray-300 rounded-sm"
                                                style={{ backgroundColor: argbToCss(c.oldFg) }}
                                                title={c.oldFg || '없음'}
                                            />
                                            {c.newFg && (
                                                <>
                                                    <ArrowRight size={10} className="text-gray-400" />
                                                    <span
                                                        className="inline-block w-4 h-4 border border-gray-400 rounded-sm"
                                                        style={{ backgroundColor: argbToCss(c.newFg) }}
                                                        title={c.newFg}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* 반이름 변경 */}
                    {changes.classNameRenames.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                                <PenLine size={12} /> 반이름 변경 ({changes.classNameRenames.length}건)
                            </h3>
                            <div className="bg-purple-50/50 border border-purple-100 rounded-sm divide-y divide-purple-100">
                                {changes.classNameRenames.map((r, i) => (
                                    <div key={i} className="px-2 py-1 text-xs flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-purple-100 text-purple-700">RENAME</span>
                                        <span className="text-gray-700">{r.oldName}</span>
                                        <ArrowRight size={10} className="text-gray-400" />
                                        <span className="font-medium">{r.newName}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {changes.unmatchedAdditions.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-gray-600 mb-1">인식 못한 셀 ({changes.unmatchedAdditions.length}건) — 무시됨</h3>
                            <div className="bg-gray-50 border border-gray-200 rounded-sm divide-y divide-gray-200">
                                {changes.unmatchedAdditions.map((u, i) => (
                                    <div key={i} className="px-2 py-1 text-xs text-gray-500">
                                        ({u.row},{u.col}): "{u.text}"
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                    <div className="text-xs text-gray-500">
                        적용 전 자동 스냅샷이 저장됩니다
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            disabled={isApplying}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-sm bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={isApplying || validation.totalChanges === 0}
                            className="px-4 py-1.5 text-xs bg-amber-600 text-white rounded-sm hover:bg-amber-700 disabled:opacity-50 font-medium"
                        >
                            {isApplying ? '적용 중...' : `${validation.totalChanges}건 적용`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcelImportPreviewModal;
