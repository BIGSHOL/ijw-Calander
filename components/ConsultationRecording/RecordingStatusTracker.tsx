import React from 'react';
import { Upload, AudioLines, Brain, CheckCircle2, Loader2, AlertTriangle, XCircle } from 'lucide-react';
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

function formatElapsed(createdAt: number): string {
  const elapsed = Math.round((Date.now() - createdAt) / 1000);
  if (elapsed < 60) return `${elapsed}초`;
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return `${min}분 ${sec}초`;
}

export function RecordingStatusTracker({ report }: RecordingStatusTrackerProps) {
  const currentIndex = getStepIndex(report.status);
  const isError = report.status === 'error';
  const isFailed = report.status === 'failed';

  // 실시간 경과시간 표시
  const [elapsed, setElapsed] = React.useState('');
  React.useEffect(() => {
    if (report.status === 'completed' || isError || isFailed) return;
    const update = () => setElapsed(formatElapsed(report.createdAt));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [report.status, report.createdAt, isError, isFailed]);

  return (
    <div className="bg-white rounded-sm border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-gray-900">처리 진행 상황</h3>
        {elapsed && !isError && !isFailed && report.status !== 'completed' && (
          <span className="text-xs text-gray-400 font-mono">{elapsed} 경과</span>
        )}
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex && !isError && !isFailed;
          const isPending = index > currentIndex || isError || isFailed;
          const isErrorStep = (isError || isFailed) && index === currentIndex;

          return (
            <React.Fragment key={step.key}>
              {/* 연결선 */}
              {index > 0 && (
                <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-400' : isErrorStep ? 'bg-red-300' : 'bg-gray-200'}`} />
              )}

              {/* 단계 원형 */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isCompleted ? 'bg-green-100 text-green-600' : ''}
                    ${isCurrent ? 'bg-accent-100 text-accent-600 ring-2 ring-accent-300' : ''}
                    ${isErrorStep ? 'bg-red-100 text-red-600 ring-2 ring-red-300' : ''}
                    ${isPending && !isErrorStep ? 'bg-gray-100 text-gray-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} />
                  ) : isErrorStep ? (
                    isFailed ? <AlertTriangle size={20} /> : <XCircle size={20} />
                  ) : isCurrent ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  isCurrent ? 'text-accent-700'
                  : isErrorStep ? 'text-red-600'
                  : isPending ? 'text-gray-400'
                  : 'text-green-600'
                }`}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* 상태 메시지 */}
      <div className="text-center space-y-1">
        <p className={`text-sm ${isError ? 'text-red-600' : isFailed ? 'text-amber-600' : 'text-gray-600'}`}>
          {report.statusMessage || '처리 중입니다...'}
        </p>
        {report.durationSeconds != null && report.durationSeconds > 0 && (
          <p className="text-xs text-gray-400">
            녹음 길이: {Math.floor(report.durationSeconds / 60)}분 {report.durationSeconds % 60}초
            {report.fileSizeBytes > 0 && ` · ${(report.fileSizeBytes / 1024 / 1024).toFixed(1)}MB`}
          </p>
        )}
        {report.errorMessage && isError && (
          <p className="text-xs text-red-400 mt-2 bg-red-50 px-3 py-2 rounded-sm text-left break-all">
            {report.errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
