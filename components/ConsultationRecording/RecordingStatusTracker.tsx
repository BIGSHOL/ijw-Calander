import React from 'react';
import { Upload, AudioLines, Brain, CheckCircle2, Loader2 } from 'lucide-react';
import type { ConsultationReport } from '../../types';

interface RecordingStatusTrackerProps {
  report: ConsultationReport;
}

const STEPS = [
  { key: 'uploading', label: '파일 업로드', icon: Upload },
  { key: 'transcribing', label: '음성 인식', icon: AudioLines },
  { key: 'analyzing', label: 'AI 분석', icon: Brain },
  { key: 'completed', label: '완료', icon: CheckCircle2 },
] as const;

function getStepIndex(status: string): number {
  const idx = STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

export function RecordingStatusTracker({ report }: RecordingStatusTrackerProps) {
  const currentIndex = getStepIndex(report.status);

  return (
    <div className="bg-white rounded-sm border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-6">처리 진행 상황</h3>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <React.Fragment key={step.key}>
              {/* 연결선 */}
              {index > 0 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}

              {/* 단계 원형 */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isCompleted ? 'bg-green-100 text-green-600' : ''}
                    ${isCurrent ? 'bg-accent-100 text-accent-600 ring-2 ring-accent-300' : ''}
                    ${isPending ? 'bg-gray-100 text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} />
                  ) : isCurrent ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <span className={`text-xs font-medium ${isCurrent ? 'text-accent-700' : isPending ? 'text-gray-400' : 'text-green-600'}`}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 상태 메시지 */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          {report.statusMessage || '처리 중입니다...'}
        </p>
        {report.durationSeconds && report.status === 'analyzing' && (
          <p className="text-xs text-gray-400 mt-1">
            녹음 길이: {Math.floor(report.durationSeconds / 60)}분 {report.durationSeconds % 60}초
          </p>
        )}
      </div>
    </div>
  );
}
