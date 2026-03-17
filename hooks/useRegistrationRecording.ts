import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { collection, doc, getDocs, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';
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
 * 등록 상담 녹음 업로드 → AI 분석 → 폼 자동 채우기 데이터 추출
 */
export function useRegistrationRecording() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [extractedData, setExtractedData] = useState<RegistrationExtractedData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 분석 보고서 전체 데이터
  const [reportData, setReportData] = useState<{
    report?: ConsultationReportSection;
    speakerRoles?: Record<string, string>;
    transcription?: string;
    speakerLabels?: SpeakerUtterance[];
    durationSeconds?: number;
    studentName?: string;
    consultationDate?: string;
    consultantName?: string;
  } | null>(null);

  // Firestore 실시간 상태 감시
  useEffect(() => {
    if (!reportId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'registration_recording_reports', reportId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        setStatus(data.status || 'idle');
        setStatusMessage(data.statusMessage || '');
        if (data.status === 'completed') {
          if (data.extractedData) {
            setExtractedData(data.extractedData as RegistrationExtractedData);
          }
          setReportData({
            report: data.report || undefined,
            speakerRoles: data.speakerRoles || undefined,
            transcription: data.transcription || undefined,
            speakerLabels: data.speakerLabels || undefined,
            durationSeconds: data.durationSeconds || undefined,
            studentName: data.studentName || undefined,
            consultationDate: data.consultationDate || undefined,
            consultantName: data.counselorName || undefined,
          });
        }
        if (data.status === 'error') {
          setError(data.errorMessage || '처리 중 오류가 발생했습니다.');
        }
      }
    );
    return () => unsubscribe();
  }, [reportId]);

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

      setReportId(result.data.reportId);

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
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    setReportId(null);
    setReportData(null);
    setError(null);
    setUploadProgress(null);
    setRecordingDuration(0);
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

      setReportId(result.data.reportId);

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
    uploadProgress,
    status,
    statusMessage,
    extractedData,
    reportData,
    reportId,
    error,
    reset,
    // 브라우저 녹음
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
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
