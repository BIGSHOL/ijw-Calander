import React from 'react';
import { formatReportContent } from './formatReportContent';

interface Props {
  content: unknown;
  className?: string;
}

/**
 * 보고서 텍스트를 줄바꿈 정규화 + ASR 오류 하이라이트와 함께 렌더링
 * - [?의심 텍스트] → 의심 텍스트 전체를 노란 배경으로 하이라이트
 * - [?] (구형식) → [?]만 하이라이트 (하위호환)
 */
export function HighlightedReportText({ content, className = '' }: Props) {
  const text = formatReportContent(content);

  // [?텍스트] (새 형식) 또는 [?] (구 형식) 모두 매칭
  const parts = text.split(/(\[\?[^\]]*\])/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const match = part.match(/^\[\?([^\]]*)\]$/);
        if (match) {
          const inner = match[1];
          return (
            <mark
              key={i}
              className="bg-yellow-200 text-yellow-900 px-0.5 rounded-sm"
              title="음성인식 불확실 — 원본 녹음 확인 필요"
            >
              {inner || '[?]'}
            </mark>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}
