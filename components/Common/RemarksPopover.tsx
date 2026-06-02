/**
 * RemarksPopover — 근거 데이터 모달 헤더에 '비고' 버튼 + 클릭 시 팝오버로 안내문 표시
 *
 * 사용 패턴:
 *   <RemarksPopover notes={['고등부 학생은 상담 대상에서 제외됩니다.', '...']} />
 *
 * - 모달 헤더 (닫기 버튼 옆)에 배치
 * - 클릭 시 절대 위치 팝오버로 비고 목록 표시
 * - 백드롭 클릭 시 닫힘
 */
import React, { useState } from 'react';
import { Info } from 'lucide-react';

export interface RemarksDetailItem {
    /** 라벨(좌측, 굵게) */
    label: string;
    /** 보조 설명(우측, 작게) */
    sublabel?: string;
}

export interface RemarksDetailSection {
    /** 섹션 헤더 (이 노트와 함께 표시될 학생 목록 등의 제목) */
    heading: string;
    /** 학생/항목 리스트 */
    items: RemarksDetailItem[];
}

interface RemarksPopoverProps {
    notes: string[];
    /** 노트별 상세 섹션 (notes[i] 와 details[i] 가 짝). 펼쳐서 표시 */
    details?: (RemarksDetailSection | null | undefined)[];
    /** 버튼 라벨 (기본 '비고') */
    label?: string;
}

export const RemarksPopover: React.FC<RemarksPopoverProps> = ({ notes, details, label = '비고' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    if (!notes || notes.length === 0) return null;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-sm border transition-colors ${
                    isOpen
                        ? 'bg-amber-200 text-amber-800 border-amber-300'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
                title="비고 보기"
            >
                <Info size={11} />
                {label}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[125]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-sm shadow-2xl border border-amber-200 z-[126] overflow-hidden">
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                            <Info size={12} /> 비고
                        </div>
                        <ul className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                            {notes.map((n, i) => {
                                const section = details?.[i];
                                const hasDetails = !!section && section.items.length > 0;
                                const isExpanded = expandedIdx === i;
                                return (
                                    <li key={i} className="text-xs text-gray-700">
                                        <div className="flex gap-1.5 items-start">
                                            <span className="text-amber-600 shrink-0">•</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="break-keep">{n}</span>
                                                    {hasDetails && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedIdx(isExpanded ? null : i)}
                                                            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200"
                                                        >
                                                            {isExpanded ? '접기' : `목록 (${section!.items.length})`}
                                                        </button>
                                                    )}
                                                </div>
                                                {hasDetails && isExpanded && (
                                                    <div className="mt-1.5 ml-0 border-l-2 border-amber-200 pl-2">
                                                        <div className="text-[10px] font-bold text-amber-700 mb-1">{section!.heading}</div>
                                                        <ul className="space-y-0.5">
                                                            {section!.items.map((it, j) => (
                                                                <li key={j} className="text-[11px] text-gray-700 flex items-baseline justify-between gap-2">
                                                                    <span className="font-medium text-gray-900 truncate">{it.label}</span>
                                                                    {it.sublabel && (
                                                                        <span className="text-[10px] text-gray-400 shrink-0">{it.sublabel}</span>
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};