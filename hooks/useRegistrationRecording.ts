import { useState, useCallback, useEffect, useRef } from 'react';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';

const functions = getFunctions(getApp(), 'asia-northeast3');
const processRegistrationRecording = httpsCallable<
  {
    storagePath: string;
    studentName: string;
    consultationDate: string;
    counselorName: string;
    fileName: string;
  },
  { reportId: string; status: string; extractedData?: Record<string, unknown> }
>(functions, 'processRegistrationRecording');

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
        if (data.status === 'completed' && data.extractedData) {
          setExtractedData(data.extractedData as RegistrationExtractedData);
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
  }) => {
    const { file, studentName, consultationDate, counselorName } = params;

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
    setError(null);
    setUploadProgress(null);
    setRecordingDuration(0);
  }, []);

  return {
    uploadAndProcess,
    uploadProgress,
    status,
    statusMessage,
    extractedData,
    error,
    reset,
    // 브라우저 녹음
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
  };
}
