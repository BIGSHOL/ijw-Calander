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

interface RemarksPopoverProps {
    notes: string[];
    /** 버튼 라벨 (기본 '비고') */
    label?: string;
}

export const RemarksPopover: React.FC<RemarksPopoverProps> = ({ notes, label = '비고' }) => {
    const [isOpen, setIsOpen] = useState(false);

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
                    <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-sm shadow-2xl border border-amber-200 z-[126] overflow-hidden">
                        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                            <Info size={12} /> 비고
                        </div>
                        <ul className="p-3 space-y-1.5">
                            {notes.map((n, i) => (
                                <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                                    <span className="text-amber-600 shrink-0">•</span>
                                    <span className="break-keep">{n}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};