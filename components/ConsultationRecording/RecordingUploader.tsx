import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Mic, MicOff, Calendar, User, Users, X, Square, ArrowDownToLine, ExternalLink } from 'lucide-react';
import { useUploadConsultationRecording } from '../../hooks/useConsultationRecording';
import { useStudents } from '../../hooks/useStudents';
import { format } from 'date-fns';
import { getKoreanErrorMessage } from '../../utils/errorMessages';
import { startRecoverySession, saveChunk, checkRecovery, recoverRecording, clearRecovery } from '../../utils/recordingRecovery';
import { openRecorderPopup } from '../../utils/recorderPopup';
import { RecordingPickerModal, type SelectedRecording } from './RecordingPickerModal';

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'];
const ACCEPTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

interface RecordingUploaderProps {
  onUploadStart: (reportId: string) => void;
}

function formatTimer(sec: number) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// 선택된 학생 태그
interface StudentTag {
  id: string;   // 기존 학생이면 Firestore ID, 직접 입력이면 ''
  name: string;
}

export function RecordingUploader({ onUploadStart }: RecordingUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { uploadAndProcess, processFromPath, uploadProgress, isUploading, isProcessing } = useUploadConsultationRecording();
  const { students } = useStudents();

  // 복수 학생 태그
  const [selectedStudents, setSelectedStudents] = useState<StudentTag[]>([]);
  const [studentInput, setStudentInput] = useState('');
  const [consultantName, setConsultantName] = useState('');
  const [consultationDate, setConsultationDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 녹음 상태
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPopupRecording, setIsPopupRecording] = useState(false);

  // 실시간 전사 기능 제거됨 (불안정한 WebSocket 스트리밍 → 녹음 후 batch 전사로 전환)
  // 녹음 chunk 복구용 인덱스만 유지
  const chunkIndexRef = useRef(0);

  // 녹음 복구
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null);

  // 교차 분석 모달
  const [showPickerModal, setShowPickerModal] = useState(false);

  const handleImportFromRegistration = async (recording: SelectedRecording) => {
    if (!consultationDate) {
      setError('상담 날짜를 선택해주세요.');
      return;
    }
    setError('');

    // 첫 번째 학생의 상세 정보
    const studentIds = selectedStudents.map(s => s.id).filter(Boolean);
    const firstStudent = studentIds[0]
      ? (students || []).find(s => s.id === studentIds[0])
      : undefined;
    const studentContext = firstStudent ? {
      schoolName: firstStudent.school || '',
      grade: firstStudent.grade || '',
      parentName: firstStudent.parentName || '',
      parentRelation: firstStudent.parentRelation || '',
      parentPhone: firstStudent.parentPhone || '',
      address: firstStudent.address || '',
      birthDate: firstStudent.birthDate || '',
      gender: firstStudent.gender || '',
    } : undefined;

    try {
      const result = await processFromPath({
        storagePath: recording.storagePath,
        studentName: selectedStudents.map(s => s.name).join(', ') || recording.studentName || '미등록 상담',
        consultantName: consultantName.trim() || recording.consultantName,
        consultationDate: consultationDate || recording.consultationDate,
        fileName: recording.fileName,
        studentContext,
      });
      onUploadStart(result.reportId);
    } catch (err: any) {
      setError(getKoreanErrorMessage(err, '불러오기 중 오류가 발생했습니다.'));
    }
  };

  // 학생명 자동완성 필터 (이미 선택된 학생 제외)
  const selectedIds = new Set(selectedStudents.map(s => s.id).filter(Boolean));
  const selectedNames = new Set(selectedStudents.map(s => s.name));
  const filteredStudents = studentInput.trim()
    ? (students || [])
        .filter(s =>
          s.status === 'active' &&
          s.name?.includes(studentInput.trim()) &&
          !selectedIds.has(s.id) &&
          !selectedNames.has(s.name)
        )
        .slice(0, 8)
    : [];

  // 학생 태그 추가
  const addStudentTag = (tag: StudentTag) => {
    if (!tag.name.trim()) return;
    // 중복 방지
    if (tag.id && selectedIds.has(tag.id)) return;
    if (selectedNames.has(tag.name.trim())) return;
    setSelectedStudents(prev => [...prev, { id: tag.id, name: tag.name.trim() }]);
    setStudentInput('');
    setShowSuggestions(false);
  };

  // Enter 키로 직접 입력 추가
  const handleStudentInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && studentInput.trim()) {
      e.preventDefault();
      addStudentTag({ id: '', name: studentInput.trim() });
    }
    // Backspace로 마지막 태그 삭제
    if (e.key === 'Backspace' && !studentInput && selectedStudents.length > 0) {
      setSelectedStudents(prev => prev.slice(0, -1));
    }
  };

  // 학생 태그 삭제
  const removeStudentTag = (index: number) => {
    setSelectedStudents(prev => prev.filter((_, i) => i !== index));
  };

  // 녹음 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 녹음 중 탭 닫기/새로고침 방지
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRecording]);

  // 탭 비활성화 후 복귀 시 MediaRecorder 상태 체크 (녹음 중단 감지)
  useEffect(() => {
    if (!isRecording) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
          setError('탭 전환 중 녹음이 중단되었습니다. 녹음된 부분은 저장되었습니다.');
          setIsRecording(false);
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRecording]);

  // 이전 녹음 복구 확인
  useEffect(() => {
    checkRecovery('consultation').then(meta => {
      if (meta) {
        recoverRecording('consultation').then(file => {
          if (file) setRecoveryFile(file);
        });
      }
    });
  }, []);

  // 실시간 전사 관련 함수 제거됨
  // (startRealtimeTranscription / stopRealtimeTranscription / getAssemblyToken)
  // 사유: AssemblyAI v3 streaming WebSocket 이 학원 환경에서 자주 끊기거나 빈 응답.
  //       녹음 후 batch transcription(processConsultationRecording)에서 더 정확한 결과 도출.

  // 팝업 녹음 완료 → 자동 업로드+분석 시작
  const autoSubmitFile = useCallback(async (file: File) => {
    if (!consultationDate) {
      setSelectedFile(file);
      setError('상담 날짜를 선택한 후 분석 시작을 눌러주세요.');
      return;
    }

    const studentNames = selectedStudents.map(s => s.name);
    const studentIds = selectedStudents.map(s => s.id).filter(Boolean);
    const firstStudent = studentIds[0]
      ? (students || []).find(s => s.id === studentIds[0])
      : undefined;
    const studentContext = firstStudent ? {
      schoolName: firstStudent.school || '',
      grade: firstStudent.grade || '',
      parentName: firstStudent.parentName || '',
      parentRelation: firstStudent.parentRelation || '',
      parentPhone: firstStudent.parentPhone || '',
      address: firstStudent.address || '',
      birthDate: firstStudent.birthDate || '',
      gender: firstStudent.gender || '',
      siblings: (firstStudent.siblings || []).length > 0
        ? (students || []).filter(s => firstStudent.siblings?.includes(s.id)).map(s => s.name).join(', ')
        : '',
    } : undefined;

    try {
      const result = await uploadAndProcess({
        file,
        studentId: studentIds[0] || '',
        studentName: studentNames.join(', ') || '미등록 상담',
        studentNames,
        studentIds,
        consultantName: consultantName.trim(),
        consultationDate,
        studentContext,
      });
      clearRecovery('consultation');
      onUploadStart(result.reportId);
    } catch (err: any) {
      // 자동 업로드 실패 시 파일을 selectedFile에 보관
      setSelectedFile(file);
      setError(getKoreanErrorMessage(err, '자동 업로드 중 오류가 발생했습니다. 분석 시작을 다시 눌러주세요.'));
    }
  }, [consultationDate, selectedStudents, consultantName, students, uploadAndProcess, onUploadStart]);

  // 팝업 녹음 시작 (우선 시도)
  const startPopupRecording = useCallback(() => {
    setError('');
    const opened = openRecorderPopup(
      '상담 녹음',
      {
        onComplete: (file, _duration, _transcriptPreview) => {
          setIsPopupRecording(false);
          // 녹음 완료 → 자동으로 업로드+분석 시작
          autoSubmitFile(file);
        },
        onError: (message) => {
          setError(message);
          setIsPopupRecording(false);
        },
        onClose: () => {
          setIsPopupRecording(false);
        },
      },
    );

    if (opened) {
      setIsPopupRecording(true);
      setSelectedFile(null);
    }
    return opened;
  }, [autoSubmitFile]);

  // 녹음 버튼 클릭 핸들러: 팝업 우선, 차단 시 인라인 fallback
  const handleRecordClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }
    // 팝업 시도
    const opened = startPopupRecording();
    if (!opened) {
      // 팝업 차단됨 → 인라인 녹음 fallback
      startRecording();
    }
  }, [isRecording, startPopupRecording]);

  // 인라인 녹음 시작 (팝업 차단 시 fallback)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      chunkIndexRef.current = 0;

      // mimeType 명시적 지정 (브라우저 호환성)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });

      // IndexedDB 복구 세션 시작
      await startRecoverySession('consultation', mimeType);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          // IndexedDB에 비동기 저장 (실패해도 녹음 계속)
          saveChunk('consultation', chunkIndexRef.current, e.data);
          chunkIndexRef.current++;
        }
      };

      recorder.onstop = () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `녹음_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.${ext}`, {
          type: mimeType,
        });
        setSelectedFile(file);
        stream.getTracks().forEach(t => t.stop());
        // 복구 데이터는 분석 시작 시 삭제 (정지 후 나가도 복구 가능)
      };

      // MediaRecorder 에러 핸들링 (조용히 멈추는 것 방지)
      recorder.onerror = (event: Event) => {
        console.error('[MediaRecorder] 녹음 오류:', event);
        setError('녹음 중 오류가 발생했습니다. 다시 시도해주세요.');
        stopRecording();
      };

      // 1초마다 청크 생성 (IndexedDB 저장 간격)
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordSeconds(0);
      setSelectedFile(null);
      setError('');

      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
    } catch {
      setError('마이크 접근이 거부되었습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  // 녹음 정지
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `파일 크기가 200MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    const isValidType = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);
    if (!isValidType) {
      return '지원하지 않는 파일 형식입니다. (mp3, m4a, wav, webm, ogg만 가능)';
    }
    return null;
  };

  const handleFileSelect = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!consultationDate) {
      setError('상담 날짜를 선택해주세요.');
      return;
    }
    if (!selectedFile) {
      setError('녹음 파일을 선택해주세요.');
      return;
    }

    setError('');
    // 복수 학생 이름/ID 조합
    const studentNames = selectedStudents.map(s => s.name);
    const studentIds = selectedStudents.map(s => s.id).filter(Boolean);

    // 첫 번째 학생의 상세 정보를 studentContext로 구성
    const firstStudent = studentIds[0]
      ? (students || []).find(s => s.id === studentIds[0])
      : undefined;
    const studentContext = firstStudent ? {
      schoolName: firstStudent.school || '',
      grade: firstStudent.grade || '',
      parentName: firstStudent.parentName || '',
      parentRelation: firstStudent.parentRelation || '',
      parentPhone: firstStudent.parentPhone || '',
      address: firstStudent.address || '',
      birthDate: firstStudent.birthDate || '',
      gender: firstStudent.gender || '',
      siblings: (firstStudent.siblings || []).length > 0
        ? (students || []).filter(s => firstStudent.siblings?.includes(s.id)).map(s => s.name).join(', ')
        : '',
    } : undefined;

    try {
      const result = await uploadAndProcess({
        file: selectedFile,
        studentId: studentIds[0] || '',
        studentName: studentNames.join(', ') || '미등록 상담',
        studentNames,
        studentIds,
        consultantName: consultantName.trim(),
        consultationDate,
        studentContext,
      });
      // 분석 시작 성공 → 복구 데이터 삭제
      clearRecovery('consultation');
      onUploadStart(result.reportId);
    } catch (err: any) {
      setError(getKoreanErrorMessage(err, '업로드 중 오류가 발생했습니다.'));
    }
  };

  const isSubmitting = isUploading || isProcessing;
  const isBusy = isSubmitting || isPopupRecording;

  return (
    <div className="bg-white rounded-sm border shadow-sm">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Mic size={18} className="text-accent-500" />
          새 상담 녹음 분석
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          직접 녹음하거나 파일을 업로드하면 자동으로 음성인식 → AI 분석 → 보고서 생성이 진행됩니다.
        </p>
      </div>

      {/* 녹음 복구 배너 */}
      {recoveryFile && (
        <div className="mx-5 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800">이전 녹음이 복구되었습니다</p>
            <p className="text-xs text-amber-600 mt-0.5">
              비정상 종료로 저장된 녹음 파일입니다. ({(recoveryFile.size / 1024 / 1024).toFixed(1)}MB)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setSelectedFile(recoveryFile);
                setRecoveryFile(null);
                clearRecovery('consultation');
              }}
              className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-sm hover:bg-amber-700"
            >
              사용
            </button>
            <button
              onClick={() => {
                setRecoveryFile(null);
                clearRecovery('consultation');
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-700 rounded-sm hover:bg-amber-100"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* 메타데이터 입력 */}
        <div className="space-y-3">
          {/* 학생 이름 (복수 가능, 선택사항) */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              <Users size={12} className="inline mr-1" />
              학생 이름 <span className="text-gray-400 font-normal">(선택 — 형제 등 복수 가능, 등록상담은 생략 가능)</span>
            </label>
            <div className={`flex flex-wrap items-center gap-1.5 min-h-[38px] px-2 py-1.5 border rounded-sm focus-within:ring-1 focus-within:ring-accent-400 ${isSubmitting || isRecording ? 'bg-gray-50' : 'bg-white'}`}>
              {selectedStudents.map((tag, i) => (
                <span key={`${tag.id || tag.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-100 text-accent-800 text-sm rounded-sm">
                  {tag.name}
                  {!isSubmitting && !isRecording && (
                    <button type="button" onClick={() => removeStudentTag(i)} className="hover:text-red-500">
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              <input
                type="text"
                value={studentInput}
                onChange={(e) => {
                  setStudentInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={handleStudentInputKeyDown}
                placeholder={selectedStudents.length ? '' : '학생 이름 입력 후 Enter (또는 목록에서 선택)'}
                className="flex-1 min-w-[120px] py-0.5 text-sm bg-transparent outline-none"
                disabled={isSubmitting || isRecording}
              />
            </div>
            {showSuggestions && filteredStudents.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-sm shadow-lg max-h-40 overflow-auto">
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent-50 flex justify-between"
                    onMouseDown={() => addStudentTag({ id: s.id, name: s.name })}
                  >
                    <span>{s.name}</span>
                    <span className="text-gray-400 text-xs">{s.school} {s.grade}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 상담 날짜 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <Calendar size={12} className="inline mr-1" />
                상담 날짜 *
              </label>
              <input
                type="date"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
                disabled={isSubmitting || isRecording}
              />
            </div>

            {/* 상담자 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <User size={12} className="inline mr-1" />
                상담자
              </label>
              <input
                type="text"
                value={consultantName}
                onChange={(e) => setConsultantName(e.target.value)}
                placeholder="상담자 이름 (선택)"
                className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-accent-400"
                disabled={isSubmitting || isRecording}
              />
            </div>
          </div>
        </div>

        {/* 녹음 버튼 */}
        <div className="flex flex-col items-center py-4">
          {isPopupRecording ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-red-100 border-2 border-red-400 text-red-600 animate-pulse">
                <ExternalLink size={28} />
              </div>
              <p className="text-sm text-red-500 mt-2 font-medium">
                별도 창에서 녹음 중...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                녹음 창을 닫지 마세요
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleRecordClick}
                disabled={isSubmitting}
                className={`
                  w-20 h-20 rounded-full flex items-center justify-center transition-all
                  ${isRecording
                    ? 'bg-red-100 border-2 border-red-400 text-red-600 animate-pulse hover:bg-red-200'
                    : 'bg-gray-100 border-2 border-gray-300 text-gray-500 hover:bg-gray-200 hover:border-gray-400'
                  }
                  ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={28} />}
              </button>
              <p className="text-sm text-gray-500 mt-2">
                {isRecording ? '녹음 중 — 누르면 정지' : '눌러서 녹음 시작'}
              </p>
              {isRecording && (
                <p className="text-xs text-amber-500 mt-0.5">(인라인 모드 — 팝업 차단 시)</p>
              )}
              {(isRecording || recordSeconds > 0) && (
                <p className={`text-2xl font-mono mt-1 ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
                  {formatTimer(recordSeconds)}
                </p>
              )}
            </>
          )}
        </div>

        {/* 녹음 중 단순 표시 (실시간 전사 제거 — 녹음 후 batch 분석으로 정확한 결과 도출) */}
        {isRecording && (
          <div className="bg-gray-50 border rounded-sm px-4 py-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-600">
              녹음 중 · 정지 후 자동으로 AI 분석이 시작됩니다
            </span>
          </div>
        )}

        {/* 구분선 */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 border-t" />
          <span>또는 파일 업로드</span>
          <div className="flex-1 border-t" />
        </div>

        {/* 파일 업로드 영역 */}
        <div
          className={`
            border-2 border-dashed rounded-sm p-6 text-center transition-colors cursor-pointer
            ${isDragOver ? 'border-accent-400 bg-accent-50' : 'border-gray-300 hover:border-gray-400'}
            ${isSubmitting || isRecording ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <Upload size={24} className="mx-auto text-gray-400 mb-1" />
          <p className="text-sm text-gray-600">파일을 드래그하거나 클릭하여 선택</p>
          <p className="text-xs text-gray-400 mt-0.5">MP3, M4A, WAV, WebM, OGG (최대 200MB)</p>
        </div>

        {/* 선택된 파일 표시 */}
        {selectedFile && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-sm px-4 py-2.5">
            <Mic size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 truncate">{selectedFile.name}</p>
              <p className="text-xs text-green-600">{(selectedFile.size / 1024 / 1024).toFixed(1)}MB</p>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              className="p-1 hover:bg-green-100 rounded-sm flex-shrink-0"
            >
              <X size={16} className="text-green-500" />
            </button>
          </div>
        )}

        {/* 업로드 진행률 */}
        {uploadProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>업로드 중...</span>
              <span>{uploadProgress.percent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-500 transition-all duration-300"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* 등록상담 녹음 불러오기 */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 border-t" />
          <span>또는 등록상담 녹음 불러오기</span>
          <div className="flex-1 border-t" />
        </div>

        <button
          type="button"
          onClick={() => setShowPickerModal(true)}
          disabled={isSubmitting || isRecording}
          className="w-full py-2.5 rounded-sm text-sm font-medium border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <ArrowDownToLine size={14} />
          등록상담 녹음에서 불러와서 상담분석
        </button>

        <RecordingPickerModal
          isOpen={showPickerModal}
          onClose={() => setShowPickerModal(false)}
          source="registration"
          onSelect={handleImportFromRegistration}
        />

        {/* 에러 메시지 */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-sm">{error}</p>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || isRecording || !selectedFile}
          className={`
            w-full py-3 rounded-sm font-medium text-sm transition-colors
            ${isSubmitting || isRecording || !selectedFile
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-[#081429] text-white hover:bg-[#0f2340]'
            }
          `}
        >
          {isUploading ? '업로드 중...' : isProcessing ? '분석 요청 중...' : '분석 시작'}
        </button>
      </div>
    </div>
  );
}
