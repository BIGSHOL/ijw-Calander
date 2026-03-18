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
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}분 ${sec}초`;
}

/** statusMessage에서 퍼센트(%) 추출 */
function extractPercent(msg: string): number | null {
  const match = msg.match(/\((\d+)%\)/);
  return match ? parseInt(match[1]) : null;
}

export function RecordingStatusTracker({ report }: RecordingStatusTrackerProps) {
  const currentIndex = getStepIndex(report.status);
  const isError = report.status === 'error';
  const isFailed = report.status === 'failed';
  const isCompleted = report.status === 'completed';
  const isInProgress = !isCompleted && !isError && !isFailed;

  // 실시간 경과시간
  const [elapsed, setElapsed] = React.useState('');
  React.useEffect(() => {
    if (!isInProgress) return;
    const update = () => setElapsed(formatElapsed(report.createdAt));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [report.status, report.createdAt, isInProgress]);

  // statusMessage에서 퍼센트 추출
  const percent = report.statusMessage ? extractPercent(report.statusMessage) : null;

  return (
    <div className="bg-white rounded-sm border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-gray-900">처리 진행 상황</h3>
        {isInProgress && elapsed && (
          <span className="text-xs text-gray-400 font-mono">{elapsed}</span>
        )}
      </div>

      {/* 단계 표시 */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isStepCompleted = index < currentIndex;
          const isCurrent = index === currentIndex && !isError && !isFailed;
          const isPending = index > currentIndex || isError || isFailed;
          const isErrorStep = (isError || isFailed) && index === currentIndex;

          return (
            <React.Fragment key={step.key}>
              {index > 0 && (
                <div className={`flex-1 h-0.5 mx-2 ${isStepCompleted ? 'bg-green-400' : isErrorStep ? 'bg-red-300' : 'bg-gray-200'}`} />
              )}

              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isStepCompleted ? 'bg-green-100 text-green-600' : ''}
                    ${isCurrent ? 'bg-accent-100 text-accent-600 ring-2 ring-accent-300' : ''}
                    ${isErrorStep ? 'bg-red-100 text-red-600 ring-2 ring-red-300' : ''}
                    ${isPending && !isErrorStep ? 'bg-gray-100 text-gray-400' : ''}
                  `}
                >
                  {isStepCompleted ? (
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

      {/* 현재 단계 진행률 바 */}
      {isInProgress && percent != null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">{STEPS[currentIndex]?.label}</span>
            <span className="text-xs text-accent-600 font-medium">{percent}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 상태 메시지 */}
      <div className="text-center space-y-1">
        <p className={`text-sm ${isError ? 'text-red-600' : isFailed ? 'text-amber-600' : 'text-gray-600'}`}>
          {report.statusMessage || '처리 중입니다...'}
        </p>
        {report.durationSeconds != null && report.durationSeconds > 0 && !report.statusMessage?.includes(formatDuration(report.durationSeconds)) && (
          <p className="text-xs text-gray-400">
            녹음 길이: {formatDuration(report.durationSeconds)}
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
