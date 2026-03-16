import React from 'react';
import { formatReportContent } from './formatReportContent';

interface Props {
  content: unknown;
  className?: string;
}

/**
 * 보고서 텍스트를 줄바꿈 정규화 + [?] 하이라이트와 함께 렌더링
 * - formatReportContent로 줄바꿈 정규화
 * - [?] 마커를 노란 배경으로 하이라이트 (ASR 오류 표시)
 */
export function HighlightedReportText({ content, className = '' }: Props) {
  const text = formatReportContent(content);
  const parts = text.split(/(\[\?\])/g);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part === '[?]' ? (
          <mark
            key={i}
            className="bg-yellow-200 text-yellow-900 px-0.5 rounded-sm font-medium"
            title="음성인식 불확실 — 원본 녹음 확인 필요"
          >
            [?]
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
