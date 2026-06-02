import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { collection, doc, getDocs, onSnapshot, orderBy, query, limit, where, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';
import { openRecorderPopup } from '../utils/recorderPopup';
import type { ConsultationReportSection, SpeakerUtterance } from '../types/consultationReport';

const functions = getFunctions(getApp(), 'asia-northeast3');
const processRegistrationRecording = httpsCallable<
  {
    storagePath: string;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    fileName: string;
    studentContext?: Record<string, unknown>;
  },
  { reportId: string; status: string; extractedData?: Record<string, unknown> }
>(functions, 'processRegistrationRecording', { timeout: 600_000 }); // 10분 (120MB+ 파일 대응)

const regenerateMergedRegistrationReport = httpsCallable<
  { reportIds: string[] },
  { reportId: string; status: string }
>(functions, 'regenerateMergedRegistrationReport', { timeout: 540_000 }); // 9분

export interface RegistrationExtractedData {
  studentName?: string;
  schoolName?: string;
  grade?: string;
  parentPhone?: string;
  parentName?: string;
  parentRelation?: string;
  address?: string;
  birthDate?: string;
  consultationPath?: string;
  enrollmentReason?: string;
  siblings?: string;
  shuttleBusRequest?: string | boolean;
  safetyNotes?: string;
  careerGoal?: string;
  subject?: string;
  status?: string;
  notes?: string;
  nonRegistrationReason?: string;
  followUpDate?: string;
  followUpContent?: string;
  mathConsultation?: SubjectExtracted;
  englishConsultation?: SubjectExtracted;
  koreanConsultation?: SubjectExtracted;
  scienceConsultation?: SubjectExtracted;
}

interface SubjectExtracted {
  levelTestScore?: string;
  engLevel?: string;
  englishTestType?: string;
  academyHistory?: string;
  learningProgress?: string;
  examResults?: string;
  recommendedClass?: string;
  homeRoomTeacher?: string;
  firstClassDate?: string;
  notes?: string;
}

interface UploadProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

type ProcessStatus = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'completed' | 'error' | 'failed';

/**
 * 단일 보고서의 전체 데이터 (Firestore doc 스냅샷 + 메타).
 * 다중 보고서 모델에서 보고서별로 인덱싱되어 보관됨.
 */
export interface ReportFullData {
  id: string;
  status: ProcessStatus;
  statusMessage?: string;
  report?: ConsultationReportSection;
  speakerRoles?: Record<string, string>;
  transcription?: string;
  speakerLabels?: SpeakerUtterance[];
  durationSeconds?: number;
  studentName?: string;
  consultationDate?: string;
  consultantName?: string;
  isMerged?: boolean;
  mergedFrom?: string[];
  mergedAt?: number;
  createdAt?: number;
  fileName?: string;
  storagePath?: string;
}

/**
 * 등록 상담 녹음 업로드 → AI 분석 → 폼 자동 채우기 데이터 추출
 */
export function useRegistrationRecording() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedData, setExtractedData] = useState<RegistrationExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // === 다중 보고서 상태 (v2) ===
  // reportIds: 시간순 정렬된 보고서 ID 배열 (마지막 = 가장 최근)
  // reportsData: ID로 인덱싱된 전체 데이터 맵 (onSnapshot 실시간 갱신)
  // activeReportId: 현재 분석 결과 패널에서 표시 중인 보고서 ID
  // newlyAnalyzedReportId: 가장 최근 신규 분석된 보고서 ID (extractedData 머지 트리거용)
  const [reportIds, setReportIds] = useState<string[]>([]);
  const [reportsData, setReportsData] = useState<Record<string, ReportFullData>>({});
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [newlyAnalyzedReportId, setNewlyAnalyzedReportId] = useState<string | null>(null);

  // 활성 보고서 데이터 (호환용 derived state — 기존 코드의 recording.reportData 사용처 유지)
  const reportData = activeReportId ? (reportsData[activeReportId] ?? null) : null;

  // Firestore 실시간 상태 감시 — N개 보고서 동시 구독
  // 의존성: reportIds 배열 변경 시 재구독. join(',')로 배열 ID 안정화.
  useEffect(() => {
    if (reportIds.length === 0) return;
    const unsubs = reportIds.map(id =>
      onSnapshot(
        doc(db, 'registration_recording_reports', id),
        (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          const next: ReportFullData = {
            id,
            status: (data.status as ProcessStatus) || 'idle',
            statusMessage: data.statusMessage || '',
            report: data.report || undefined,
            speakerRoles: data.speakerRoles || undefined,
            transcription: data.transcription || undefined,
            speakerLabels: data.speakerLabels || undefined,
            durationSeconds: data.durationSeconds || undefined,
            studentName: data.studentName || undefined,
            consultationDate: data.consultationDate || undefined,
            consultantName: data.counselorName || undefined,
            isMerged: !!data.isMerged,
            mergedFrom: data.mergedFrom || undefined,
            mergedAt: data.mergedAt || undefined,
            createdAt: data.createdAt,
            fileName: data.fileName || undefined,
            storagePath: data.storagePath || undefined,
          };
          setReportsData(prev => ({ ...prev, [id]: next }));

          // 신규 분석된 보고서(newlyAnalyzedReportId)의 완료/에러 상태를 훅 레벨 status로 노출 (호환)
          // 기존 분석된 보고서가 다시 업데이트되더라도 status를 흔들지 않음
          if (id === newlyAnalyzedReportId) {
            setStatus(next.status);
            setStatusMessage(next.statusMessage || '');
            if (next.status === 'completed' && data.extractedData) {
              setExtractedData(data.extractedData as RegistrationExtractedData);
            }
            if (next.status === 'error') {
              setError(data.errorMessage || '처리 중 오류가 발생했습니다.');
            }
          }
        }
      )
    );
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportIds.join(','), newlyAnalyzedReportId]);

  const uploadAndProcess = useCallback(async (params: {
    file: File;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    studentContext?: Record<string, unknown>;
  }) => {
    const { file, studentName, consultationDate, counselorName, studentContext } = params;

    setStatus('uploading');
    setError(null);
    setExtractedData(null);
    setUploadProgress({ percent: 0, bytesTransferred: 0, totalBytes: file.size });

    const ext = file.name.split('.').pop() || 'mp3';
    const safeName = studentName.replace(/[^가-힣a-zA-Z0-9]/g, '_');
    const storagePath = `registration-recordings/${safeName}_${consultationDate}_${Date.now()}.${ext}`;

    try {
      // 1. Storage 업로드
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'audio/mpeg',
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            setUploadProgress({
              percent: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          },
          reject,
          () => resolve()
        );
      });

      setUploadProgress(null);
      setStatus('transcribing');

      // 2. Cloud Function 호출
      const result = await processRegistrationRecording({
        storagePath,
        studentName,
        consultationDate,
        counselorName,
        fileName: file.name,
        ...(studentContext ? { studentContext } : {}),
      });

      // v2: 새 보고서 ID를 배열에 push (기존 보고서는 유지)
      const newId = result.data.reportId;
      setReportIds(prev => prev.includes(newId) ? prev : [...prev, newId]);
      setActiveReportId(newId);
      setNewlyAnalyzedReportId(newId); // 폼 자동채우기 트리거 대상

      if (result.data.extractedData) {
        setExtractedData(result.data.extractedData as RegistrationExtractedData);
        setStatus('completed');
      }

      return result.data;
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg);
      throw err;
    } finally {
      setUploadProgress(null);
    }
  }, []);

  // ===== 브라우저 녹음 기능 =====
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPopupRecording, setIsPopupRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 팝업 녹음 시작 (우선)
  // (실시간 전사용 AssemblyAI 토큰 발급은 제거됨 — 녹음 후 batch transcription 으로 대체)
  const startPopupRecording = useCallback((options?: { fileToken?: string }): Promise<File> => {
    return new Promise((resolve, reject) => {
      const opened = openRecorderPopup(
        '등록상담 녹음',
        {
          onComplete: (file) => {
            setIsPopupRecording(false);
            resolve(file);
          },
          onError: (message) => {
            setIsPopupRecording(false);
            reject(new Error(message));
          },
          onClose: () => {
            setIsPopupRecording(false);
            reject(new Error('녹음 창이 닫혔습니다.'));
          },
        },
        { fileToken: options?.fileToken },
      );

      if (!opened) {
        reject(new Error('POPUP_BLOCKED'));
      } else {
        setIsPopupRecording(true);
      }
    });
  }, []);

  // 인라인 녹음 (fallback)
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // MediaRecorder 에러 핸들링 (조용히 멈추는 것 방지)
      recorder.onerror = (event: Event) => {
        console.error('[MediaRecorder] 녹음 오류:', event);
        setError('녹음 중 오류가 발생했습니다. 다시 시도해주세요.');
        if (recorder.state !== 'inactive') {
          recorder.stream.getTracks().forEach(t => t.stop());
          recorder.stop();
        }
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start(1000); // 1초마다 데이터 수집
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch {
      setError('마이크 접근 권한이 필요합니다.');
    }
  }, []);

  const stopRecording = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('녹음이 활성화되지 않았습니다.'));
        return;
      }

      recorder.onstop = () => {
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const file = new File([blob], `consultation_${Date.now()}.${ext}`, { type: recorder.mimeType });
        // 마이크 스트림 해제
        recorder.stream.getTracks().forEach(t => t.stop());
        resolve(file);
      };

      recorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setStatusMessage('');
    setExtractedData(null);
    setReportIds([]);
    setReportsData({});
    setActiveReportId(null);
    setNewlyAnalyzedReportId(null);
    setError(null);
    setUploadProgress(null);
    setRecordingDuration(0);
  }, []);

  // 추가 녹음 분석 시작 직전에 호출 — 현재 분석 사이클만 초기화하고 기존 보고서는 유지
  // reset()과의 차이: reportIds/reportsData/activeReportId는 그대로 둠
  const startNewAnalysis = useCallback(() => {
    setStatus('idle');
    setStatusMessage('');
    setExtractedData(null);
    setNewlyAnalyzedReportId(null);
    setError(null);
    setUploadProgress(null);
    setRecordingDuration(0);
  }, []);

  // 다중 보고서 ID 일괄 로드 (모달 재오픈 시 v2 복원용)
  // recordingReportIds 배열을 받아 N개 onSnapshot 구독
  const loadExistingReports = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setReportIds(prev => {
      // 이미 동일 배열이면 재설정 안 함 (불필요한 재구독 방지)
      if (prev.length === ids.length && prev.every((x, i) => x === ids[i])) return prev;
      return ids;
    });
    // 활성 보고서가 미설정이면 가장 최근(마지막) 보고서를 활성화
    setActiveReportId(prev => prev ?? ids[ids.length - 1]);
  }, []);

  // 기존 보고서 ID로 분석 결과 로드 (호환 유지 — v1 단일 ID API)
  // 내부적으로 loadExistingReports([id]) 호출
  const loadExistingReport = useCallback((existingReportId: string | null | undefined) => {
    if (!existingReportId) return;
    loadExistingReports([existingReportId]);
  }, [loadExistingReports]);

  // 보고서를 UI에서 제거 (Firestore doc은 보존 — Storage 파일도 보존)
  const removeReport = useCallback((id: string) => {
    setReportIds(prev => prev.filter(x => x !== id));
    setReportsData(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveReportId(prev => {
      if (prev !== id) return prev;
      // 활성 보고서가 제거되면 다른 보고서로 자동 전환
      const remaining = reportIds.filter(x => x !== id);
      return remaining[remaining.length - 1] ?? null;
    });
  }, [reportIds]);

  // 다중 보고서 통합 재생성 (Cloud Function 호출)
  // 선택된 보고서들의 전사본을 시간순 합쳐 통합 전용 프롬프트로 Claude 재분석
  const regenerateMergedReport = useCallback(async (idsToMerge: string[]) => {
    if (!idsToMerge || idsToMerge.length < 2) {
      throw new Error('통합하려면 최소 2개 보고서가 필요합니다.');
    }
    setStatus('analyzing');
    setStatusMessage(`${idsToMerge.length}개 보고서 통합 분석 중...`);
    setError(null);
    try {
      const result = await regenerateMergedRegistrationReport({ reportIds: idsToMerge });
      const newId = result.data.reportId;
      setReportIds(prev => prev.includes(newId) ? prev : [...prev, newId]);
      setActiveReportId(newId);
      setNewlyAnalyzedReportId(newId);
      return result.data;
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg);
      throw err;
    }
  }, []);

  // 학생이름 + 상담일자 매칭으로 분석 보고서 찾아 reportData에 직접 주입
  // (recordingReportId 미저장 레거시 데이터 + 학생상담 측 분석된 데이터 자동 연결)
  //
  // 검색 우선순위:
  //   1. registration_recording_reports — 등록상담 자체 분석 (report 필드 있는 경우)
  //   2. consultation_reports — 학생상담 측 구조화 분석 ("등록상담 녹음에서 불러와서 상담분석"으로 생성)
  // Firestore 컴포지트 인덱스 불필요: studentName 단일 where + 클라이언트 필터
  const loadAnalysisReportByMatch = useCallback(async (
    studentNameToMatch: string,
    consultationDateToMatch: string
  ): Promise<{ collectionName: string; id: string } | null> => {
    if (!studentNameToMatch || !consultationDateToMatch) return null;
    // 날짜 정규화: consultations(ISO+time) vs reports(date-only) 형식 차이 흡수
    const normalizeDate = (s?: string) => (s || '').slice(0, 10);
    const targetDate = normalizeDate(consultationDateToMatch);

    for (const collectionName of ['registration_recording_reports', 'consultation_reports']) {
      try {
        const q = query(
          collection(db, collectionName),
          where('studentName', '==', studentNameToMatch),
          limit(20)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) continue;
        type ReportDoc = {
          id: string;
          consultationDate?: string;
          status?: string;
          report?: unknown;
          createdAt?: number;
          speakerRoles?: Record<string, string>;
          transcription?: string;
          speakerLabels?: unknown;
          durationSeconds?: number;
          consultantName?: string;
          counselorName?: string;
          extractedData?: Record<string, unknown>;
        };
        const matches = snapshot.docs
          .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as ReportDoc)
          .filter(d =>
            normalizeDate(d.consultationDate) === targetDate &&
            d.status === 'completed' &&
            !!d.report // report 필드 있는 doc만
          )
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

        if (matches[0]) {
          const match = matches[0];
          if (collectionName === 'registration_recording_reports') {
            // 같은 컬렉션 — onSnapshot 구독으로 정상 로드 (v2 다중 모델 사용)
            loadExistingReports([match.id]);
          } else {
            // consultation_reports — 다른 컬렉션이라 onSnapshot 못함. reportsData에 직접 주입.
            // ID는 활성 ID로 설정하되 reportIds에는 넣지 않음 (구독 안 됨)
            const injectedData: ReportFullData = {
              id: match.id,
              status: 'completed',
              report: match.report as ConsultationReportSection | undefined,
              speakerRoles: match.speakerRoles,
              transcription: match.transcription,
              speakerLabels: match.speakerLabels as SpeakerUtterance[] | undefined,
              durationSeconds: match.durationSeconds,
              studentName: studentNameToMatch,
              consultationDate: match.consultationDate,
              consultantName: match.consultantName || match.counselorName,
            };
            setReportsData(prev => ({ ...prev, [match.id]: injectedData }));
            setActiveReportId(match.id);
          }
          if (match.extractedData) {
            setExtractedData(match.extractedData as RegistrationExtractedData);
          }
          return { collectionName, id: match.id };
        }
      } catch (err) {
        console.warn(`[useRegistrationRecording] ${collectionName} 매칭 실패:`, err);
      }
    }
    return null;
  }, []);

  // 기존 storagePath로 분석 (교차 분석용 — 파일 업로드 건너뜀)
  const processFromPath = useCallback(async (params: {
    storagePath: string;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    fileName: string;
    studentContext?: Record<string, unknown>;
  }) => {
    const { storagePath, studentName, consultationDate, counselorName, fileName, studentContext } = params;

    setStatus('transcribing');
    setStatusMessage('다른 녹음에서 불러오는 중...');
    setError(null);
    setExtractedData(null);

    try {
      const result = await processRegistrationRecording({
        storagePath,
        studentName,
        consultationDate,
        counselorName,
        fileName,
        ...(studentContext ? { studentContext } : {}),
      });

      // v2: 새 보고서 ID를 배열에 push
      const newId = result.data.reportId;
      setReportIds(prev => prev.includes(newId) ? prev : [...prev, newId]);
      setActiveReportId(newId);
      setNewlyAnalyzedReportId(newId);

      if (result.data.extractedData) {
        setExtractedData(result.data.extractedData as RegistrationExtractedData);
        setStatus('completed');
      }

      return result.data;
    } catch (err: unknown) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(msg);
      throw err;
    }
  }, []);

  return {
    uploadAndProcess,
    processFromPath,
    loadExistingReport,
    loadExistingReports,
    loadAnalysisReportByMatch,
    removeReport,
    regenerateMergedReport,
    uploadProgress,
    status,
    statusMessage,
    extractedData,
    reportData,                                          // 활성 보고서 데이터 (호환)
    reportId: activeReportId,                            // 활성 보고서 ID (호환)
    reportIds,                                           // v2: 전체 보고서 ID 배열
    reportsData,                                         // v2: 보고서별 데이터 맵
    activeReportId,                                      // v2: 명시 활성 ID
    setActiveReportId,                                   // v2: 탭 전환 setter
    newlyAnalyzedReportId,                               // v2: 가장 최근 신규 분석 ID
    error,
    reset,
    startNewAnalysis,                                    // v2: 추가 분석 시 부분 reset (기존 보고서 유지)
    // 브라우저 녹음 (팝업 우선, 인라인 fallback)
    isRecording: isRecording || isPopupRecording,
    isPopupRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    startPopupRecording,
  };
}

/**
 * 등록 상담 녹음 보고서 목록 조회 (교차 분석 불러오기 모달용)
 */
export function useRegistrationRecordingReports() {
  return useQuery<Array<{
    id: string;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    fileName: string;
    storagePath: string;
    status: string;
    durationSeconds?: number;
    createdAt: number;
  }>>({
    queryKey: ['registration_recording_reports'],
    queryFn: async () => {
      const q = query(
        collection(db, 'registration_recording_reports'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as any);
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 등록 상담 녹음 보고서 삭제 (Firestore 문서 + Storage 파일)
 */
export function useDeleteRegistrationRecordingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: { id: string; storagePath?: string }) => {
      if (report.storagePath) {
        try {
          const storageRef = ref(storage, report.storagePath);
          await deleteObject(storageRef);
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code !== 'storage/object-not-found') {
            throw err;
          }
        }
      }
      await deleteDoc(doc(db, 'registration_recording_reports', report.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registration_recording_reports'] });
    },
  });
}
