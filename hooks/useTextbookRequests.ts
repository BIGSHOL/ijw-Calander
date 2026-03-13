import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
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

      await updateDoc(doc(db, 'textbook_requests', id), updatesWithTimestamps);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['textbookRequests'] }),
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

  // 수납 자동 매칭: billing 데이터로 미납 요청 자동 업데이트
  const autoMatchBillings = async (billings: { studentName: string; textbookName: string }[]) => {
    const currentRequests = queryClient.getQueryData<TextbookRequest[]>(['textbookRequests']) || requests;
    const unpaidRequests = currentRequests.filter(r => !r.isPaid);
    if (unpaidRequests.length === 0 || billings.length === 0) return { matched: 0 };

    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const batch = writeBatch(db);
    let matched = 0;
    const matchedIds = new Set<string>();

    for (const billing of billings) {
      const normalizedStudent = normalize(billing.studentName);
      const normalizedBook = normalize(billing.textbookName);

      const match = unpaidRequests.find(r => {
        if (matchedIds.has(r.id)) return false;
        const nameMatch = normalize(r.studentName) === normalizedStudent;
        if (!nameMatch) return false;
        const reqBook = normalize(r.bookName);
        return reqBook.includes(normalizedBook) || normalizedBook.includes(reqBook);
      });

      if (match) {
        matchedIds.add(match.id);
        batch.update(doc(db, 'textbook_requests', match.id), {
          isPaid: true,
          paidAt: new Date().toISOString(),
        });
        matched++;
      }
    }

    if (matched > 0) {
      await batch.commit();
      queryClient.invalidateQueries({ queryKey: ['textbookRequests'] });
    }

    return { matched };
  };

  // 완료된 요청 → 수납 내역(textbook_billings)으로 복사
  const copyToBillings = useMutation({
    mutationFn: async (targetRequests: TextbookRequest[]) => {
      // 학생 정보 조회 (grade, school 매핑용)
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, { id: string; grade: string; school: string }>();
      studentsSnap.docs.forEach(d => {
        const data = d.data();
        studentMap.set(data.name, {
          id: d.id,
          grade: data.grade || '',
          school: data.school || '',
        });
      });

      // 기존 billing 중복 체크
      const billingsSnap = await getDocs(collection(db, 'textbook_billings'));
      const existingKeys = new Set<string>();
      billingsSnap.docs.forEach(d => {
        const data = d.data();
        existingKeys.add(`${data.studentName}_${data.textbookName}_${data.month}`);
      });

      const now = new Date().toISOString();
      const batch = writeBatch(db);
      let copied = 0;
      let skipped = 0;
      const copiedIds: string[] = [];

      for (const req of targetRequests) {
        const month = req.requestDate.slice(0, 7).replace('-', ''); // YYYY-MM-DD → YYYYMM
        const key = `${req.studentName}_${req.bookName}_${month}`;

        if (existingKeys.has(key)) {
          skipped++;
          // 이미 복사된 건이지만 copiedToBilling 플래그만 갱신
          if (!req.copiedToBilling) copiedIds.push(req.id);
          continue;
        }

        const student = studentMap.get(req.studentName);
        const billingRef = doc(collection(db, 'textbook_billings'));
        batch.set(billingRef, {
          studentId: student?.id || '',
          studentName: req.studentName,
          grade: student?.grade || '',
          school: student?.school || '',
          textbookName: req.bookName,
          amount: req.price,
          month,
          matched: true,
          importedAt: now,
          sourceRequestId: req.id,
        });
        existingKeys.add(key);
        copiedIds.push(req.id);
        copied++;
      }

      // 요청서에 copiedToBilling 플래그 설정
      for (const id of copiedIds) {
        batch.update(doc(db, 'textbook_requests', id), {
          copiedToBilling: true,
          copiedAt: now,
        });
      }

      if (copied > 0 || copiedIds.length > 0) {
        await batch.commit();
      }

      return { copied, skipped };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textbookRequests'] });
      queryClient.invalidateQueries({ queryKey: ['textbookBillings'] });
    },
    onError: (error: Error) => { console.error('copyToBillings failed:', error); },
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
    autoMatchBillings,
    copyToBillings,
  };
}