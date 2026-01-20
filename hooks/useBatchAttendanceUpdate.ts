/**
 * Batch Attendance Update Hook
 *
 * 양방향 동기화(attendance_records ↔ daily_attendance)에서
 * Race Condition을 방지하기 위해 Firestore Batch Write를 사용합니다.
 * 또한 변경 이력을 attendance_history 컬렉션에 기록합니다.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseConfig';
import { writeBatch, doc, collection, getDoc } from 'firebase/firestore';
import { AttendanceStatus, AttendanceHistory } from '../types';
import { mapAttendanceStatusToValue } from '../utils/attendanceSync';

interface BatchUpdateParams {
  // Daily Attendance 정보
  date: string;
  recordId: string;
  status: AttendanceStatus;
  updatedBy: string;

  // Attendance Records 정보 (역동기화용)
  studentId: string;
  yearMonth: string;

  // 추가 정보
  studentName: string;
  classId: string;
  className: string;
  reason?: string;
}

export function useBatchAttendanceUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: BatchUpdateParams) => {
      const {
        date,
        recordId,
        status,
        updatedBy,
        studentId,
        studentName,
        classId,
        className,
        yearMonth,
        reason,
      } = params;

      // 이전 상태 조회 (히스토리 기록용)
      const dailyAttendanceRef = doc(
        db,
        'daily_attendance',
        date,
        'records',
        recordId
      );
      const previousDoc = await getDoc(dailyAttendanceRef);
      const previousStatus = previousDoc.exists() ? previousDoc.data().status as AttendanceStatus : null;

      // Firestore Batch Write 시작
      const batch = writeBatch(db);

      // 1. daily_attendance/{date}/records/{recordId} 업데이트
      batch.update(dailyAttendanceRef, {
        status,
        updatedBy,
        updatedAt: new Date().toISOString(),
      });

      // 2. attendance_records/{studentId}/{yearMonth} 업데이트
      const attendanceRecordRef = doc(
        db,
        'attendance_records',
        studentId,
        yearMonth
      );

      const attendanceValue = mapAttendanceStatusToValue(status);

      batch.update(attendanceRecordRef, {
        [`dates.${date}`]: attendanceValue,
        updatedAt: new Date().toISOString(),
      });

      // 3. attendance_history 기록 추가
      const historyRef = doc(collection(db, 'attendance_history'));
      const historyData: Omit<AttendanceHistory, 'id'> = {
        date,
        studentId,
        studentName,
        classId,
        className,
        previousStatus,
        newStatus: status,
        changedBy: updatedBy,
        reason,
        timestamp: new Date().toISOString(),
      };

      batch.set(historyRef, historyData);

      // 4. Batch Write 실행 (원자적 업데이트)
      await batch.commit();

      return { date, recordId, status };
    },
    onSuccess: (data) => {
      // Query 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['dailyAttendance', data.date] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => {
      console.error('Batch attendance update failed:', error);
    },
  });
}
