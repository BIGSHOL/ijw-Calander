import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, where, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';
import type { ConsultationReport } from '../types';

const functions = getFunctions(getApp(), 'asia-northeast3');
const processConsultationRecording = httpsCallable<
  {
    reportId?: string;
    storagePath: string;
    studentId: string;
    studentName: string;
    consultantName: string;
    consultationDate: string;
    fileName: string;
    studentContext?: Record<string, unknown>;
  },
  { reportId: string; status: string }
>(functions, 'processConsultationRecording', { timeout: 600_000 }); // 10분 (120MB+ 파일 대응)

const reanalyzeConsultationReport = httpsCallable<
  { reportId: string },
  { success: boolean }
>(functions, 'reanalyzeConsultationReport', { timeout: 360_000 }); // 6분

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
    studentNames?: string[];
    studentIds?: string[];
    consultantName: string;
    consultationDate: string;
    studentContext?: Record<string, unknown>;
  }): Promise<{ reportId: string }> => {
    const { file, studentId, studentName, studentNames, studentIds, consultantName, consultationDate, studentContext } = params;

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

      // 2. Firestore에 초기 문서 생성 (즉시 reportId 확보)
      const reportRef = doc(collection(db, COLLECTION));
      const now = Date.now();
      await setDoc(reportRef, {
        studentId: studentId || '',
        studentName,
        studentNames: studentNames || [],
        studentIds: studentIds || [],
        consultantName: consultantName || '',
        consultationDate,
        fileName: file.name,
        storagePath,
        fileSizeBytes: file.size,
        status: 'uploading',
        statusMessage: '분석 서버에 요청 중...',
        createdAt: now,
        updatedAt: now,
        createdBy: '', // Cloud Function에서 auth.uid로 덮어씀
      });

      // 3. Cloud Function 호출 (fire-and-forget — onSnapshot으로 추적)
      processConsultationRecording({
        reportId: reportRef.id,
        storagePath,
        studentId,
        studentName,
        consultantName,
        consultationDate,
        fileName: file.name,
        ...(studentContext ? { studentContext } : {}),
      }).catch((err) => {
        console.error('[processConsultationRecording] Error:', err);
      });

      return { reportId: reportRef.id };
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(null);
    }
  }, []);

  // 기존 storagePath로 분석 (교차 분석용 — 파일 업로드 건너뜀)
  const processFromPath = useCallback(async (params: {
    storagePath: string;
    studentName: string;
    consultantName: string;
    consultationDate: string;
    fileName: string;
    studentId?: string;
    studentContext?: Record<string, unknown>;
  }): Promise<{ reportId: string }> => {
    const { storagePath, studentName, consultantName, consultationDate, fileName, studentId, studentContext } = params;

    setIsProcessing(true);

    try {
      const reportRef = doc(collection(db, COLLECTION));
      const now = Date.now();
      await setDoc(reportRef, {
        studentId: studentId || '',
        studentName,
        studentNames: [],
        studentIds: [],
        consultantName: consultantName || '',
        consultationDate,
        fileName,
        storagePath,
        fileSizeBytes: 0,
        status: 'uploading',
        statusMessage: '다른 녹음에서 불러오는 중...',
        crossAnalysis: true,
        createdAt: now,
        updatedAt: now,
        createdBy: '',
      });

      processConsultationRecording({
        reportId: reportRef.id,
        storagePath,
        studentId: studentId || '',
        studentName,
        consultantName,
        consultationDate,
        fileName,
        ...(studentContext ? { studentContext } : {}),
      }).catch((err) => {
        console.error('[processConsultationRecording from path] Error:', err);
      });

      return { reportId: reportRef.id };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { uploadAndProcess, processFromPath, uploadProgress, isUploading, isProcessing };
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
 * 상담 녹음 리포트 이름 수정
 */
export function useUpdateConsultationReportName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, studentName }: { id: string; studentName: string }) => {
      await updateDoc(doc(db, COLLECTION, id), { studentName, updatedAt: Date.now() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_reports'] });
    },
  });
}

/**
 * 기존 리포트를 새 알고리즘으로 재분석
 * - 낙관적 업데이트: 즉시 "analyzing" 상태로 표시
 * - 완료/에러 시 쿼리 무효화
 */
export function useReanalyzeReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await reanalyzeConsultationReport({ reportId });
      return reportId;
    },
    onMutate: async (reportId: string) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['consultation_reports'] });

      // 현재 캐시 스냅샷
      const previousReports = queryClient.getQueriesData<ConsultationReport[]>({ queryKey: ['consultation_reports'] });

      // 낙관적 업데이트: 해당 리포트 상태를 analyzing으로 변경
      queryClient.setQueriesData<ConsultationReport[]>(
        { queryKey: ['consultation_reports'] },
        (old) => old?.map(r => r.id === reportId ? { ...r, status: 'analyzing' as const, statusMessage: '새 알고리즘으로 재분석 중...' } : r),
      );

      return { previousReports };
    },
    onError: (_err, _reportId, context) => {
      // 에러 시 이전 캐시 복원
      if (context?.previousReports) {
        for (const [key, data] of context.previousReports) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation_reports'] });
    },
  });
}

/**
 * 상담 녹음 분석 보고서 섹션 내용 수정
 * - 섹션 단위로 수정 + 수정자/수정시간 기록
 * - collectionName: 기본 consultation_reports, 등록상담은 registration_recording_reports
 */
export function useUpdateConsultationReportContent(collectionName: string = COLLECTION) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reportId, sectionKey, content, editedBy, editedByName }: {
      reportId: string;
      sectionKey: string;
      content: string;
      editedBy: string;
      editedByName: string;
    }) => {
      await updateDoc(doc(db, collectionName, reportId), {
        [`report.${sectionKey}`]: content,
        lastEditedBy: editedBy,
        lastEditedByName: editedByName,
        lastEditedAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [collectionName] });
    },
  });
}

/**
 * 상담 녹음 리포트 삭제 (Firestore 문서 + Storage 파일)
 */
export function useDeleteConsultationReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Pick<ConsultationReport, 'id' | 'storagePath'> & { crossAnalysis?: boolean }) => {
      // 1. Storage 파일 삭제 (교차 분석이 아닌 경우에만 — 원본 보고서에서 관리)
      if (report.storagePath && !report.crossAnalysis) {
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
