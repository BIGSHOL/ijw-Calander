import React, { useState } from 'react';
import { FileText, History, PenLine } from 'lucide-react';
import { MeetingUploader } from './MeetingUploader';
import { RecordingStatusTracker } from '../ConsultationRecording/RecordingStatusTracker';
import { MeetingReportViewer } from './MeetingReportViewer';
import { MeetingHistoryList } from './MeetingHistoryList';
import { useMeetingReportStatus } from '../../hooks/useMeetingRecording';
import type { UserProfile } from '../../types';

type ViewMode = 'upload' | 'history';

interface MeetingMinutesTabProps {
  userProfile?: UserProfile | null;
}

export default function MeetingMinutesTab({ userProfile }: MeetingMinutesTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const { report } = useMeetingReportStatus(activeReportId);

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
          <PenLine size={20} />
          회의록
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
            <FileText size={14} /> 새 회의록
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-3 py-1.5 text-sm rounded-sm flex items-center gap-1 transition-colors ${
              viewMode === 'history'
                ? 'bg-[#081429] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <History size={14} /> 회의록 내역
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'upload' ? (
          <div className="max-w-3xl mx-auto space-y-4">
            {!isInProgress && (
              <MeetingUploader
                onUploadStart={(reportId) => setActiveReportId(reportId)}
              />
            )}

            {isInProgress && report && (
              <RecordingStatusTracker report={report as any} />
            )}

            {report?.status === 'completed' && (
              <>
                <MeetingReportViewer report={report} />
                <div className="text-center">
                  <button
                    onClick={() => setActiveReportId(null)}
                    className="px-4 py-2 text-sm text-gray-600 bg-white border rounded-sm hover:bg-gray-50"
                  >
                    새 회의록 시작
                  </button>
                </div>
              </>
            )}

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
            <MeetingHistoryList onSelectReport={handleSelectFromHistory} userProfile={userProfile || null} />
          </div>
        )}
      </div>
    </div>
  );
}
