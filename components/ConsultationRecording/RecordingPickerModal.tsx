import React, { useState } from 'react';
import { Search, FileText, Clock, Loader2, ArrowRight, Trash2, CheckSquare, Square, X } from 'lucide-react';
import Modal from '../Common/Modal';
import { useConsultationReports, useDeleteConsultationReport } from '../../hooks/useConsultationRecording';
import { useRegistrationRecordingReports, useDeleteRegistrationRecordingReport } from '../../hooks/useRegistrationRecording';

export interface SelectedRecording {
  id: string;
  source: 'consultation' | 'registration';
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const consultationQuery = useConsultationReports();
  const registrationQuery = useRegistrationRecordingReports();
  const deleteConsultation = useDeleteConsultationReport();
  const deleteRegistration = useDeleteRegistrationRecordingReport();

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const targets = filtered.filter(r => selectedIds.has(r.id));
    const warning = `선택한 ${targets.length}건의 녹음을 영구 삭제합니다.\n\n` +
      `• 원본 음성 파일이 Storage에서 제거됩니다.\n` +
      `• 분석 보고서(텍스트, 발화 분리, 요약)가 함께 삭제됩니다.\n` +
      `• 한 번 삭제하면 복구할 수 없습니다.\n\n` +
      `계속 진행하시겠습니까?`;
    if (!window.confirm(warning)) return;

    setIsDeleting(true);
    try {
      for (const t of targets) {
        if (source === 'consultation') {
          await deleteConsultation.mutateAsync({ id: t.id, storagePath: t.storagePath });
        } else {
          await deleteRegistration.mutateAsync({ id: t.id, storagePath: t.storagePath });
        }
      }
      exitSelectMode();
    } catch (err) {
      console.error('[RecordingPickerModal] 삭제 실패:', err);
      window.alert('일부 항목 삭제에 실패했습니다. 콘솔을 확인해 주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${sourceLabel} 녹음 불러오기`}
      size="md"
      compact
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs text-gray-500 flex-1">
          {source === 'consultation'
            ? '상담녹음 탭의 녹음을 선택하면 등록상담용 프롬프트로 재분석합니다.'
            : '등록상담의 녹음을 선택하면 상담분석용 프롬프트로 재분석합니다.'}
        </p>
        {!selectMode ? (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-sm border border-red-300 text-red-600 hover:bg-red-50 shrink-0"
          >
            <Trash2 size={12} /> 선택 삭제
          </button>
        ) : (
          <button
            type="button"
            onClick={exitSelectMode}
            className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-sm border border-gray-300 text-gray-600 hover:bg-gray-50 shrink-0"
          >
            <X size={12} /> 취소
          </button>
        )}
      </div>

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
          {filtered.map(item => {
            const isChecked = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (selectMode) {
                    toggleSelect(item.id);
                  } else {
                    onSelect({
                      id: item.id,
                      source,
                      storagePath: item.storagePath,
                      studentName: item.studentName,
                      consultationDate: item.consultationDate,
                      consultantName: item.consultantName,
                      fileName: item.fileName,
                    });
                    onClose();
                  }
                }}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left ${
                  selectMode && isChecked ? 'bg-red-50' : 'hover:bg-accent-50'
                }`}
              >
                {selectMode ? (
                  isChecked
                    ? <CheckSquare size={16} className="text-red-600 flex-shrink-0" />
                    : <Square size={16} className="text-gray-400 flex-shrink-0" />
                ) : (
                  <FileText size={16} className="text-green-500 flex-shrink-0" />
                )}
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
                {!selectMode && <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {selectMode && (
        <div className="mt-3 flex items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded-sm">
          <span className="text-xs font-bold text-red-700">
            {selectedIds.size > 0 ? `${selectedIds.size}건 선택됨` : '삭제할 항목을 체크하세요'}
          </span>
          <button
            type="button"
            disabled={selectedIds.size === 0 || isDeleting}
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-sm bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {isDeleting ? '삭제 중...' : `선택 삭제 (${selectedIds.size})`}
          </button>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-2 text-right">{filtered.length}건</p>
    </Modal>
  );
}
