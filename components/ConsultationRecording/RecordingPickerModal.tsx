import React, { useState } from 'react';
import { Search, FileText, Clock, Loader2, ArrowRight } from 'lucide-react';
import Modal from '../Common/Modal';
import { useConsultationReports } from '../../hooks/useConsultationRecording';
import { useRegistrationRecordingReports } from '../../hooks/useRegistrationRecording';

export interface SelectedRecording {
  storagePath: string;
  studentName: string;
  consultationDate: string;
  consultantName: string;
  fileName: string;
}

interface RecordingPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 어느 컬렉션에서 불러올지 */
  source: 'consultation' | 'registration';
  onSelect: (recording: SelectedRecording) => void;
}

export function RecordingPickerModal({ isOpen, onClose, source, onSelect }: RecordingPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const consultationQuery = useConsultationReports();
  const registrationQuery = useRegistrationRecordingReports();

  const isLoading = source === 'consultation' ? consultationQuery.isLoading : registrationQuery.isLoading;

  // 통일된 형태로 변환 (완료 + storagePath 존재하는 항목만)
  const items = source === 'consultation'
    ? (consultationQuery.data || [])
        .filter(r => r.status === 'completed' && r.storagePath)
        .map(r => ({
          id: r.id,
          storagePath: r.storagePath,
          studentName: r.studentName || '',
          consultationDate: r.consultationDate || '',
          consultantName: r.consultantName || '',
          fileName: r.fileName || '',
          durationSeconds: r.durationSeconds,
          createdAt: r.createdAt,
        }))
    : (registrationQuery.data || [])
        .filter(r => r.status === 'completed' && r.storagePath)
        .map(r => ({
          id: r.id,
          storagePath: r.storagePath,
          studentName: r.studentName || '',
          consultationDate: r.consultationDate || '',
          consultantName: r.counselorName || '',
          fileName: r.fileName || '',
          durationSeconds: r.durationSeconds,
          createdAt: r.createdAt,
        }));

  // 검색 필터
  const filtered = searchQuery.trim()
    ? items.filter(r =>
        r.studentName?.includes(searchQuery) ||
        r.consultationDate?.includes(searchQuery) ||
        r.fileName?.includes(searchQuery)
      )
    : items;

  const sourceLabel = source === 'consultation' ? '상담녹음' : '등록상담';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${sourceLabel} 녹음 불러오기`}
      size="md"
      compact
    >
      <p className="text-xs text-gray-500 mb-3">
        {source === 'consultation'
          ? '상담녹음 탭의 녹음을 선택하면 등록상담용 프롬프트로 재분석합니다.'
          : '등록상담의 녹음을 선택하면 상담분석용 프롬프트로 재분석합니다.'}
      </p>

      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="학생명, 날짜, 파일명 검색"
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
        />
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <FileText size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? '검색 결과가 없습니다.' : `완료된 ${sourceLabel} 녹음이 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="divide-y max-h-[400px] overflow-auto border rounded-sm">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => {
                onSelect({
                  storagePath: item.storagePath,
                  studentName: item.studentName,
                  consultationDate: item.consultationDate,
                  consultantName: item.consultantName,
                  fileName: item.fileName,
                });
                onClose();
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent-50 transition-colors text-left"
            >
              <FileText size={16} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{item.studentName}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span>{item.consultationDate}</span>
                  {item.durationSeconds && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} /> {Math.floor(item.durationSeconds / 60)}분
                    </span>
                  )}
                  <span className="truncate">{item.fileName}</span>
                </div>
              </div>
              <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-2 text-right">{filtered.length}건</p>
    </Modal>
  );
}
