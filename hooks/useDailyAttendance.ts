// hooks/useDailyAttendance.ts - React Query hooks for Daily Attendance
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { DailyAttendanceRecord, AttendanceStatus, DailyAttendanceStats } from '../types';

// Firestore collection path: daily_attendance/{date}/records/{recordId}
const COLLECTION_NAME = 'daily_attendance';

// ================== READ HOOKS ==================

/**
 * Hook to fetch daily attendance records for a specific date
 * @param date - Date string in 'YYYY-MM-DD' format
 */
export const useDailyAttendanceByDate = (date: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dailyAttendance', date],
    queryFn: async (): Promise<DailyAttendanceRecord[]> => {
      if (!date) return [];

      const recordsRef = collection(db, COLLECTION_NAME, date, 'records');
      const q = query(recordsRef, orderBy('className'), orderBy('studentName'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as DailyAttendanceRecord));
    },
    enabled: enabled && !!date,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 30,   // Keep in memory for 30 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to fetch attendance records for a date range (e.g., weekly/monthly view)
 * @param startDate - Start date in 'YYYY-MM-DD' format
 * @param endDate - End date in 'YYYY-MM-DD' format
 */
export const useDailyAttendanceByRange = (
  startDate: string,
  endDate: string,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: ['dailyAttendanceRange', startDate, endDate],
    queryFn: async (): Promise<Record<string, DailyAttendanceRecord[]>> => {
      if (!startDate || !endDate) return {};

      const result: Record<string, DailyAttendanceRecord[]> = {};

      // Generate date range
      const dates: string[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      // Fetch records for each date in parallel
      await Promise.all(
        dates.map(async (date) => {
          try {
            const recordsRef = collection(db, COLLECTION_NAME, date, 'records');
            const snapshot = await getDocs(recordsRef);
            result[date] = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
            } as DailyAttendanceRecord));
          } catch (error) {
            console.warn(`Failed to fetch attendance for ${date}:`, error);
            result[date] = [];
          }
        })
      );

      return result;
    },
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to calculate attendance statistics for a specific date
 */
export const useDailyAttendanceStats = (date: string, enabled: boolean = true) => {
  const { data: records = [], isLoading } = useDailyAttendanceByDate(date, enabled);

  const stats: DailyAttendanceStats = {
    date,
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    earlyLeave: records.filter(r => r.status === 'early_leave').length,
    excused: records.filter(r => r.status === 'excused').length,
    attendanceRate: records.length > 0
      ? Math.round((records.filter(r => r.status === 'present' || r.status === 'late').length / records.length) * 100)
      : 0,
  };

  return { stats, isLoading };
};

// ================== WRITE MUTATIONS ==================

/**
 * Mutation to create or update an attendance record
 */
export const useCreateDailyAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<DailyAttendanceRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const now = new Date().toISOString();
      const recordId = record.id || `${record.studentId}_${record.classId}`;

      const docRef = doc(db, COLLECTION_NAME, record.date, 'records', recordId);

      const data: DailyAttendanceRecord = {
        ...record,
        id: recordId,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(docRef, data, { merge: true });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dailyAttendance', data.date] });
    },
  });
};

/**
 * Mutation to update attendance status
 */
export const useUpdateDailyAttendanceStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      date,
      recordId,
      status,
      note,
      checkInTime,
      checkOutTime,
      updatedBy,
    }: {
      date: string;
      recordId: string;
      status: AttendanceStatus;
      note?: string;
      checkInTime?: string;
      checkOutTime?: string;
      updatedBy: string;
    }) => {
      const docRef = doc(db, COLLECTION_NAME, date, 'records', recordId);

      const updateData: Partial<DailyAttendanceRecord> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (note !== undefined) updateData.note = note;
      if (checkInTime !== undefined) updateData.checkInTime = checkInTime;
      if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime;

      await setDoc(docRef, updateData, { merge: true });
      return { date, recordId, status };
    },
    onMutate: async ({ date, recordId, status, note, checkInTime, checkOutTime }) => {
      await queryClient.cancelQueries({ queryKey: ['dailyAttendance', date] });
      const previousData = queryClient.getQueryData(['dailyAttendance', date]);

      // Optimistic update
      queryClient.setQueryData(['dailyAttendance', date], (old: DailyAttendanceRecord[] | undefined) => {
        if (!old) return old;
        return old.map(record => {
          if (record.id === recordId) {
            return {
              ...record,
              status,
              note: note !== undefined ? note : record.note,
              checkInTime: checkInTime !== undefined ? checkInTime : record.checkInTime,
              checkOutTime: checkOutTime !== undefined ? checkOutTime : record.checkOutTime,
              updatedAt: new Date().toISOString(),
            };
          }
          return record;
        });
      });

      return { previousData };
    },
    onError: (_err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['dailyAttendance', variables.date], context.previousData);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dailyAttendance', variables.date] });
    },
  });
};

/**
 * Mutation to delete an attendance record
 */
export const useDeleteDailyAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, recordId }: { date: string; recordId: string }) => {
      const docRef = doc(db, COLLECTION_NAME, date, 'records', recordId);
      await deleteDoc(docRef);
      return { date, recordId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dailyAttendance', variables.date] });
    },
  });
};

/**
 * Mutation to bulk create attendance records (e.g., initialize day for a class)
 */
export const useBulkCreateDailyAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (records: Array<Omit<DailyAttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>>) => {
      const now = new Date().toISOString();

      await Promise.all(
        records.map(async (record) => {
          const recordId = `${record.studentId}_${record.classId}`;
          const docRef = doc(db, COLLECTION_NAME, record.date, 'records', recordId);

          const data: DailyAttendanceRecord = {
            ...record,
            id: recordId,
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(docRef, data);
        })
      );

      return records;
    },
    onSuccess: (data) => {
      // Invalidate all affected dates
      const dates = [...new Set(data.map(r => r.date))];
      dates.forEach(date => {
        queryClient.invalidateQueries({ queryKey: ['dailyAttendance', date] });
      });
    },
  });
};
