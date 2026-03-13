import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TuitionHoliday } from '../types/tuition';
import { KOREAN_HOLIDAYS } from '../utils/tuitionHolidays';

const COLLECTION = 'holidays';
// 출석부와 동일한 쿼리키 사용 (동기화)
const QUERY_KEY = 'holidays';

export const useTuitionHolidays = () => {
  const queryClient = useQueryClient();

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as TuitionHoliday)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (holiday: Omit<TuitionHoliday, 'id'>) => {
      const docId = holiday.date;
      await setDoc(doc(db, COLLECTION, docId), { ...holiday, id: docId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionHolidays]', error),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, COLLECTION, id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionHolidays]', error),
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const holidayNames: Record<string, string> = {
        '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날',
        '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
        '10-09': '한글날', '12-25': '성탄절',
      };
      const getName = (date: string): string => {
        const monthDay = date.slice(5);
        if (holidayNames[monthDay]) return holidayNames[monthDay];
        const month = parseInt(date.slice(5, 7));
        if (month === 1 || month === 2) return '설날 연휴';
        if (month === 9) return '추석 연휴';
        if (date.includes('05-')) return '부처님오신날';
        return '대체공휴일';
      };
      for (const [yearStr, dates] of Object.entries(KOREAN_HOLIDAYS)) {
        const year = parseInt(yearStr);
        for (const date of dates) {
          await setDoc(doc(db, COLLECTION, date), {
            id: date, date, name: getName(date), year,
          });
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: (error: Error) => console.error('[useTuitionHolidays]', error),
  });

  // 공휴일 날짜 Set (계산용)
  const holidayDateSet = new Set(holidays.map(h => h.date));

  return {
    holidays,
    isLoading,
    holidayDateSet,
    saveHoliday: saveMutation.mutateAsync,
    deleteHoliday: deleteMutation.mutateAsync,
    migrateHolidays: migrateMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    isMigrating: migrateMutation.isPending,
  };
};
