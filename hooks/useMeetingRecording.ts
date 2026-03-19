import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { collection, doc, onSnapshot, query, orderBy, limit, getDocs, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db, storage } from '../firebaseConfig';
import type { MeetingReport } from '../types';

const functions = getFunctions(getApp(), 'asia-northeast3');
const processMeetingRecording = httpsCallable<
  {
    reportId?: string;
    storagePath: string;
    title: string;
    attendees: string[];
    meetingDate: string;
    recorder: string;
    fileName: string;
  },
  { reportId: string; status: string }
>(functions, 'processMeetingRecording', { timeout: 600_000 });

const reanalyzeMeetingReportFn = httpsCallable<
  { reportId: string },
  { success: boolean }
>(functions, 'reanalyzeMeetingReport', { timeout: 360_000 });

const COLLECTION = 'meeting_reports';

interface UploadProgress {
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

/**
 * 회의 녹음 파일 업로드 및 분석 요청
 */
export function useUploadMeetingRecording() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const uploadAndProcess = useCallback(async (params: {
    file: File;
    title: string;
    attendees: string[];
    meetingDate: string;
    recorder: string;
  }): Promise<{ reportId: string }> => {
    const { file, title, attendees, meetingDate, recorder } = params;

    const ext = file.name.split('.').pop() || 'mp3';
    const safeTitle = title.replace(/[^가-힣a-zA-Z0-9]/g, '_').slice(0, 30);
    const storagePath = `meeting-recordings/${safeTitle}_${meetingDate}_${Date.now()}.${ext}`;

    setIsUploading(true);
    setUploadProgress({ percent: 0, bytesTransferred: 0, totalBytes: file.size });

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
            const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress({ percent, bytesTransferred: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes });
          },
          reject,
          () => resolve()
        );
      });

      setIsUploading(false);
      setUploadProgress(null);

      // 2. Firestore 초기 문서 생성
      const reportRef = doc(collection(db, COLLECTION));
      const now = Date.now();
      await setDoc(reportRef, {
        title,
        attendees,
        meetingDate,
        recorder: recorder || '',
        fileName: file.name,
        storagePath,
        fileSizeBytes: file.size,
        status: 'uploading',
        statusMessage: '분석 서버에 요청 중...',
        createdAt: now,
        updatedAt: now,
        createdBy: '',
      });

      // 3. Cloud Function 호출 (fire-and-forget)
      processMeetingRecording({
        reportId: reportRef.id,
        storagePath,
        title,
        attendees,
        meetingDate,
        recorder: recorder || '',
        fileName: file.name,
      }).catch((err) => {
        console.error('[processMeetingRecording] Error:', err);
      });

      return { reportId: reportRef.id };
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(null);
    }
  }, []);

  return { uploadAndProcess, uploadProgress, isUploading, isProcessing };
}

/**
 * 특정 회의 리포트의 실시간 상태 감시 (onSnapshot)
 */
export function useMeetingReportStatus(reportId: string | null) {
  const [report, setReport] = useState<MeetingReport | null>(null);
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
          setReport({ id: snapshot.id, ...snapshot.data() } as MeetingReport);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('회의 리포트 상태 감시 오류:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reportId]);

  return { report, isLoading };
}

/**
 * 회의 녹음 분석 리포트 목록 조회
 */
export function useMeetingReports() {
  return useQuery<MeetingReport[]>({
    queryKey: ['meeting_reports'],
    queryFn: async () => {
      const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MeetingReport));
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * 회의 리포트 제목 수정
 */
export function useUpdateMeetingReportTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await updateDoc(doc(db, COLLECTION, id), { title, updatedAt: Date.now() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_reports'] });
    },
  });
}

/**
 * 기존 회의록을 새 알고리즘으로 재분석
 */
export function useReanalyzeMeetingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await reanalyzeMeetingReportFn({ reportId });
      return reportId;
    },
    onMutate: async (reportId: string) => {
      await queryClient.cancelQueries({ queryKey: ['meeting_reports'] });
      const previousReports = queryClient.getQueriesData<MeetingReport[]>({ queryKey: ['meeting_reports'] });
      queryClient.setQueriesData<MeetingReport[]>(
        { queryKey: ['meeting_reports'] },
        (old) => old?.map(r => r.id === reportId ? { ...r, status: 'analyzing' as const, statusMessage: '새 알고리즘으로 재분석 중...' } : r),
      );
      return { previousReports };
    },
    onError: (_err, _reportId, context) => {
      if (context?.previousReports) {
        for (const [key, data] of context.previousReports) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_reports'] });
    },
  });
}

/**
 * 멈춘 회의록 재처리 (음성인식부터 다시 시작)
 * uploading/transcribing 상태에서 멈춘 보고서에 사용
 */
export function useRetryMeetingProcessing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Pick<MeetingReport, 'id' | 'storagePath' | 'title' | 'attendees' | 'meetingDate' | 'recorder' | 'fileName'>) => {
      if (!report.storagePath) {
        throw new Error('storagePath가 없습니다. 파일을 다시 업로드해주세요.');
      }
      await processMeetingRecording({
        reportId: report.id,
        storagePath: report.storagePath,
        title: report.title || '',
        attendees: report.attendees || [],
        meetingDate: report.meetingDate || '',
        recorder: report.recorder || '',
        fileName: report.fileName || '',
      });
      return report.id;
    },
    onMutate: async (report) => {
      await queryClient.cancelQueries({ queryKey: ['meeting_reports'] });
      queryClient.setQueriesData<MeetingReport[]>(
        { queryKey: ['meeting_reports'] },
        (old) => old?.map(r => r.id === report.id ? { ...r, status: 'transcribing' as const, statusMessage: '음성 인식을 다시 시작합니다...' } : r),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_reports'] });
    },
  });
}

/**
 * 회의 녹음 리포트 삭제 (Firestore + Storage)
 */
export function useDeleteMeetingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (report: Pick<MeetingReport, 'id' | 'storagePath'>) => {
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
      await deleteDoc(doc(db, COLLECTION, report.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting_reports'] });
    },
  });
}
