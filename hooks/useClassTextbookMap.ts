import { useQuery } from '@tanstack/react-query';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TextbookDistribution, TextbookBilling } from './useTextbooks';
import { useMemo } from 'react';

export interface ClassTextbookInfo {
  textbookName: string;
  distributedAt: string;
}

export interface StudentTextbookBillingInfo {
  month: string;
  textbookName: string;
}

export function useClassTextbookMap() {
  const { data: distributions } = useQuery<TextbookDistribution[]>({
    queryKey: ['textbookDistributions'],
    queryFn: async () => {
      const q = query(
        collection(db, 'textbook_distributions'),
        orderBy('distributedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookDistribution));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: billings } = useQuery<TextbookBilling[]>({
    queryKey: ['textbookBillings'],
    queryFn: async () => {
      const q = query(
        collection(db, 'textbook_billings'),
        orderBy('importedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TextbookBilling));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { byClassId, byClassName } = useMemo(() => {
    const byId = new Map<string, ClassTextbookInfo>();
    const byName = new Map<string, ClassTextbookInfo>();

    if (!distributions) return { byClassId: byId, byClassName: byName };

    for (const dist of distributions) {
      if (dist.classId && !byId.has(dist.classId)) {
        byId.set(dist.classId, {
          textbookName: dist.textbookName,
          distributedAt: dist.distributedAt,
        });
      }
      if (dist.className && !byName.has(dist.className)) {
        byName.set(dist.className, {
          textbookName: dist.textbookName,
          distributedAt: dist.distributedAt,
        });
      }
    }

    return { byClassId: byId, byClassName: byName };
  }, [distributions]);

  // 학생명 → 최신 교재 수납 (month desc 정렬이므로 첫 번째 = 최신)
  const byStudentName = useMemo(() => {
    const map = new Map<string, StudentTextbookBillingInfo>();
    if (!billings) return map;

    for (const bill of billings) {
      if (!bill.studentName) continue;
      const existing = map.get(bill.studentName);
      if (!existing || bill.month > existing.month) {
        map.set(bill.studentName, {
          month: bill.month,
          textbookName: bill.textbookName,
        });
      }
    }
    return map;
  }, [billings]);

  return { byClassId, byClassName, byStudentName };
}
