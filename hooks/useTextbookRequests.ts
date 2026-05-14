import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, addDoc, where } from 'firebase/firestore';
import { TEXTBOOK_CATALOG, TextbookCatalogItem, DEFAULT_SUBJECT } from '../data/textbookCatalog';

// ===== Types =====

export interface TextbookRequest {
  id: string;
  studentName: string;
  teacherName: string;
  requestDate: string;
  bookName: string;
  bookDetail?: string;
  price: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: string;
  isCompleted?: boolean;
  completedAt?: string;
  isPaid?: boolean;
  paidAt?: string;
  isOrdered?: boolean;
  orderedAt?: string;
  copiedToBilling?: boolean;
  copiedAt?: string;
}

export interface AccountSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

// ===== Helpers =====

/**
 * 단일 교재 요청서를 textbook_billings 컬렉션으로 자동 upsert.
 * - 등록+납부+주문 모두 ✓ 이고 아직 copiedToBilling=false 일 때 호출
 * - 동일 키(학생명+교재명+월) 존재 시 신규 추가 안 함 (멱등성)
 * - 성공 시 요청서에 copiedToBilling=true, copiedAt=now 설정
 * - 참조: 메이크에듀 동기화 후 자동 매칭과 동일한 학생/교재 키 정책 사용
 */
async function autoCopySingleRequestToBilling(req: TextbookRequest): Promise<void> {
  // 학생 정보 조회 (grade, school) — 이름 일치 첫 건
  const studentsSnap = await getDocs(collection(db, 'students'));
  let studentInfo = { id: '', grade: '', school: '' };
  for (const d of studentsSnap.docs) {
    const data = d.data() as { name?: string; grade?: string; school?: string };
    if (data.name === req.studentName) {
      studentInfo = { id: d.id, grade: data.grade || '', school: data.school || '' };
      break;
    }
  }

  // 청구월: requestDate(YYYY-MM-DD) → YYYYMM
  const month = (req.requestDate || '').slice(0, 7).replace('-', '');
  if (!month) return;

  // 중복 키 체크 (학생명 + 교재명 + 월)
  const existingSnap = await getDocs(query(
    collection(db, 'textbook_billings'),
    where('studentName', '==', req.studentName),
    where('textbookName', '==', req.bookName),
    where('month', '==', month),
  ));

  const now = new Date().toISOString();
  if (existingSnap.empty) {
    await addDoc(collection(db, 'textbook_billings'), {
      studentId: studentInfo.id,
      studentName: req.studentName,
      grade: studentInfo.grade,
      school: studentInfo.school,
      textbookName: req.bookName,
      amount: req.price,
      month,
      matched: true,
      importedAt: now,
      sourceRequestId: req.id,
    });
  }

  // 요청서에 복사 완료 플래그
  await updateDoc(doc(db, 'textbook_requests', req.id), {
    copiedToBilling: true,
    copiedAt: now,
  });
}

// ===== Hook =====

export function useTextbookRequests() {
  const queryClient = useQueryClient();

  // 요청서 목록
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['textbookRequests'],
    queryFn: async () => {
      const q = query(collection(db, 'textbook_requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookRequest));
    },
    staleTime: 5 * 60 * 1000,
  });

  // 계좌 설정
  const { data: accountSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['textbookAccountSettings'],
    queryFn: async () => {
      const docRef = doc(db, 'settings', 'textbook-account');
      const snap = await getDoc(docRef);
      if (snap.exists()) return snap.data() as AccountSettings;
      return { bankName: '', accountNumber: '', accountHolder: '' };
    },
    staleTime: 10 * 60 * 1000,
  });

  // 카탈로그 (Firestore 우선, 정적 데이터에 새 항목이 있으면 자동 병합)
  const { data: catalog = TEXTBOOK_CATALOG } = useQuery({
    queryKey: ['textbookCatalog'],
    queryFn: async () => {
      const docRef = doc(db, 'settings', 'textbook-catalog');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const list = snap.data().list as TextbookCatalogItem[];
        if (list && list.length > 0) {
          const result = list.map(item => ({ ...item, subject: item.subject || DEFAULT_SUBJECT }));
          // 정적 카탈로그에 새로 추가된 항목 자동 병합
          const existingNames = new Set(result.map(item => item.name));
          const newDefaults = TEXTBOOK_CATALOG
            .filter(item => !existingNames.has(item.name))
            .map(item => ({ ...item, subject: item.subject || DEFAULT_SUBJECT }));
          if (newDefaults.length > 0) return [...result, ...newDefaults];
          return result;
        }
      }
      return TEXTBOOK_CATALOG.map(item => ({ ...item, subject: item.subject || DEFAULT_SUBJECT }));
    },
    staleTime: 30 * 60 * 1000,
  });

  // 요청서 생성
  const createRequest = useMutation({
    mutationFn: async (data: Omit<TextbookRequest, 'id' | 'createdAt'>) => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 17);
      const sanitizedBookName = data.bookName.replace(/[^a-zA-Z0-9가-힣]/g, '');
      const id = `${data.teacherName}_${data.studentName}_${sanitizedBookName}_${timestamp}`;
      const request: TextbookRequest = {
        ...data,
        id,
        createdAt: now.toISOString(),
        isCompleted: false,
        isPaid: false,
        isOrdered: false,
      };
      await setDoc(doc(db, 'textbook_requests', id), request);
      return request;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookRequests'] }),
    onError: (error: Error) => { console.error('createRequest failed:', error); },
  });

  // 요청서 업데이트
  // 옵션 ②-a: 등록+납부+주문 모두 ✓ 이고 아직 textbook_billings 복사 안 됐으면 자동 upsert
  const updateRequest = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TextbookRequest> }) => {
      const now = new Date().toISOString();
      const updatesWithTimestamps: Record<string, unknown> = { ...updates };

      if (updates.isCompleted === true) updatesWithTimestamps.completedAt = now;
      else if (updates.isCompleted === false) updatesWithTimestamps.completedAt = null;

      if (updates.isPaid === true) updatesWithTimestamps.paidAt = now;
      else if (updates.isPaid === false) updatesWithTimestamps.paidAt = null;

      if (updates.isOrdered === true) updatesWithTimestamps.orderedAt = now;
      else if (updates.isOrdered === false) updatesWithTimestamps.orderedAt = null;

      const requestRef = doc(db, 'textbook_requests', id);
      await updateDoc(requestRef, updatesWithTimestamps);

      // 자동 textbook_billings 복사 (옵션 ②-a)
      const snap = await getDoc(requestRef);
      if (!snap.exists()) return;
      const req = { id, ...snap.data() } as TextbookRequest;
      if (req.isCompleted && req.isPaid && req.isOrdered && !req.copiedToBilling) {
        try {
          await autoCopySingleRequestToBilling(req);
        } catch (e) {
          // 자동 복사 실패해도 mutation 자체는 성공 유지 (수동 복사 가능)
          console.error('autoCopySingleRequestToBilling failed:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textbookRequests'] });
      queryClient.invalidateQueries({ queryKey: ['textbookBillings'] });
      queryClient.invalidateQueries({ queryKey: ['studentTextbookBillings'] });
    },
    onError: (error: Error) => { console.error('updateRequest failed:', error); },
  });

  // 요청서 삭제
  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'textbook_requests', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookRequests'] }),
    onError: (error: Error) => { console.error('deleteRequest failed:', error); },
  });

  // 계좌 설정 저장
  const saveAccountSettings = useMutation({
    mutationFn: async (settings: AccountSettings) => {
      await setDoc(doc(db, 'settings', 'textbook-account'), settings);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookAccountSettings'] }),
    onError: (error: Error) => { console.error('saveAccountSettings failed:', error); },
  });

  // 카탈로그 저장
  const saveCatalog = useMutation({
    mutationFn: async (items: TextbookCatalogItem[]) => {
      await setDoc(doc(db, 'settings', 'textbook-catalog'), {
        list: items,
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookCatalog'] }),
    onError: (error: Error) => { console.error('saveCatalog failed:', error); },
  });

  // 통계
  const stats = useMemo(() => {
    const total = requests.length;
    const notCompleted = requests.filter(r => !r.isCompleted).length;
    const notPaid = requests.filter(r => !r.isPaid).length;
    const notOrdered = requests.filter(r => !r.isOrdered).length;
    const fullyDone = requests.filter(r => r.isCompleted && r.isPaid && r.isOrdered).length;
    return { total, notCompleted, notPaid, notOrdered, fullyDone };
  }, [requests]);

  return {
    requests,
    requestsLoading,
    accountSettings: accountSettings || { bankName: '', accountNumber: '', accountHolder: '' },
    settingsLoading,
    catalog,
    stats,
    createRequest,
    updateRequest,
    deleteRequest,
    saveAccountSettings,
    saveCatalog,
  };
}