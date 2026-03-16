import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, where, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';
import type { ConsultationReport } from '../types';

const functions = getFunctions(getApp(), 'asia-northeast3');
const processConsultationRecording = httpsCallable<
  {
    storagePath: string;
    studentId: string;
    studentName: string;
    consultantName: string;
    consultationDate: string;
    fileName: string;
  },
  { reportId: string; status: string }
>(functions, 'processConsultationRecording');

const COLLECTION = 'consultation_reports';

// 업로드 진행률
interface UploadProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

/**
 * 상담 녹음 파일 업로드 및 분석 요청
 */
export function useUploadConsultationRecording() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadAndProcess = useCallback(async (params: {
    file: File;
    studentId: string;
    studentName: string;
    consultantName: string;
    consultationDate: string;
  }): Promise<{ reportId: string }> => {
    const { file, studentId, studentName, consultantName, consultationDate } = params;

    // 파일명: studentName_YYYY-MM-DD_timestamp.ext
    const ext = file.name.split('.').pop() || 'mp3';
    const safeName = studentName.replace(/[^가-힣a-zA-Z0-9]/g, '_');
    const storagePath = `consultation-recordings/${safeName}_${consultationDate}_${Date.now()}.${ext}`;

    setIsUploading(true);
    setUploadProgress({ percent: 0, bytesTransferred: 0, totalBytes: file.size });

    try {
      // 1. Storage에 업로드
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || 'audio/mpeg',
      });

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress({
              percent,
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          },
          reject,
          () => resolve()
        );
      });

      setIsUploading(false);
      setUploadProgress(null);
      setIsProcessing(true);

      // 2. Cloud Function 호출
      const result = await processConsultationRecording({
        storagePath,
        studentId,
        studentName,
        consultantName,
        consultationDate,
        fileName: file.name,
      });

      return { reportId: result.data.reportId };
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(null);
    }
  }, []);

  return { uploadAndProcess, uploadProgress, isUploading, isProcessing };
}

/**
 * 특정 리포트의 실시간 상태 감시 (onSnapshot)
 */
export function useConsultationReportStatus(reportId: string | null) {
  const [report, setReport] = useState<ConsultationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, COLLECTION, reportId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setReport({ id: snapshot.id, ...snapshot.data() } as ConsultationReport);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('리포트 상태 감시 오류:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reportId]);

  return { report, isLoading };
}

/**
 * 상담 녹음 분석 리포트 목록 조회
 */
export function useConsultationReports(studentId?: string) {
  return useQuery<ConsultationReport[]>({
    queryKey: ['consultation_reports', studentId || 'all'],
    queryFn: async () => {
      const constraints = studentId
        ? [where('studentId', '==', studentId), orderBy('createdAt', 'desc')]
        : [orderBy('createdAt', 'desc'), limit(100)];

      const q = query(collection(db, COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConsultationReport));
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 상담 녹음 리포트 삭제 (Firestore 문서 + Storage 파일)
 */
export function useDeleteConsultationReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Pick<ConsultationReport, 'id' | 'storagePath'>) => {
      // 1. Storage 파일 삭제 (존재하면)
      if (report.storagePath) {
        try {
          const storageRef = ref(storage, report.storagePath);
          await deleteObject(storageRef);
        } catch (err: unknown) {
          // 파일이 이미 없으면 무시
          if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code !== 'storage/object-not-found') {
            throw err;
          }
        }
      }
      // 2. Firestore 문서 삭제
      await deleteDoc(doc(db, COLLECTION, report.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_reports'] });
    },
  });
}
