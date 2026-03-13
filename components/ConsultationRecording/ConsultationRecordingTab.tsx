import React, { useState } from 'react';
import { Mic, FileText, History } from 'lucide-react';
import { RecordingUploader } from './RecordingUploader';
import { RecordingStatusTracker } from './RecordingStatusTracker';
import { ReportViewer } from './ReportViewer';
import { ReportHistoryList } from './ReportHistoryList';
import { useConsultationReportStatus } from '../../hooks/useConsultationRecording';
import type { UserProfile } from '../../types';

type ViewMode = 'upload' | 'history';

interface ConsultationRecordingTabProps {
  userProfile?: UserProfile | null;
}

export default function ConsultationRecordingTab({ userProfile }: ConsultationRecordingTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const { report } = useConsultationReportStatus(activeReportId);

  const handleSelectFromHistory = (reportId: string) => {
    setActiveReportId(reportId);
    setViewMode('upload');
  };

  const isInProgress = report && report.status !== 'completed' && report.status !== 'error' && report.status !== 'failed';

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <h1 className="text-lg font-bold text-[#081429] flex items-center gap-2">
          <Mic size={20} />
          상담녹음분석
        </h1>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewMode('upload')}
            className={`px-3 py-1.5 text-sm rounded-sm flex items-center gap-1 transition-colors ${
              viewMode === 'upload'
                ? 'bg-[#081429] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileText size={14} /> 새 분석
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-3 py-1.5 text-sm rounded-sm flex items-center gap-1 transition-colors ${
              viewMode === 'history'
                ? 'bg-[#081429] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <History size={14} /> 분석 내역
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'upload' ? (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* 업로드 폼 (진행 중이 아닐 때) */}
            {!isInProgress && (
              <RecordingUploader
                onUploadStart={(reportId) => setActiveReportId(reportId)}
              />
            )}

            {/* 처리 상태 추적 */}
            {isInProgress && report && (
              <RecordingStatusTracker report={report} />
            )}

            {/* 완료된 리포트 */}
            {report?.status === 'completed' && (
              <>
                <ReportViewer report={report} />
                <div className="text-center">
                  <button
                    onClick={() => setActiveReportId(null)}
                    className="px-4 py-2 text-sm text-gray-600 bg-white border rounded-sm hover:bg-gray-50"
                  >
                    새 분석 시작
                  </button>
                </div>
              </>
            )}

            {/* 분석 불가 (텍스트 부족/음성 인식 실패) */}
            {report?.status === 'failed' && (
              <div className="bg-amber-50 border border-amber-200 rounded-sm p-5 text-center">
                <p className="text-amber-800 font-medium">분석할 수 없는 녹음입니다</p>
                <p className="text-amber-600 text-sm mt-1">{report.statusMessage}</p>
                <button
                  onClick={() => setActiveReportId(null)}
                  className="mt-4 px-4 py-2 bg-amber-100 text-amber-800 rounded-sm text-sm hover:bg-amber-200"
                >
                  다른 파일로 다시 시도
                </button>
              </div>
            )}

            {/* 에러 */}
            {report?.status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-sm p-5 text-center">
                <p className="text-red-800 font-medium">분석 중 오류가 발생했습니다</p>
                <p className="text-red-600 text-sm mt-1">{report.errorMessage}</p>
                <button
                  onClick={() => setActiveReportId(null)}
                  className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-sm text-sm hover:bg-red-200"
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <ReportHistoryList onSelectReport={handleSelectFromHistory} userProfile={userProfile || null} />
          </div>
        )}
      </div>
    </div>
  );
}
