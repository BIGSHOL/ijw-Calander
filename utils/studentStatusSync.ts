/**
 * 학생 상태 동기화 유틸리티
 *
 * enrollment.onHold와 student.status의 동기화를 관리합니다.
 *
 * 규칙:
 * - 모든 enrollments가 onHold=true이면 student.status='on_hold'
 * - 하나라도 활성 enrollment가 있으면 student.status='active'
 * - 퇴원/예비 상태는 명시적으로 설정된 경우에만 유지
 */

import { getDocs, doc, updateDoc, collection, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface StudentStatusSyncResult {
  success: boolean;
  previousStatus: string;
  newStatus: string;
  reason: string;
}

/**
 * 학생의 모든 enrollments를 확인하고 student.status를 동기화합니다.
 *
 * @param studentId - 학생 ID
 * @param currentStudentStatus - 현재 학생 상태 (optional, 없으면 DB에서 조회)
 * @returns 동기화 결과
 */
export async function syncStudentStatus(
  studentId: string,
  currentStudentStatus?: string
): Promise<StudentStatusSyncResult> {
  try {
    // 1. 모든 enrollments 조회 (퇴원하지 않은 것만)
    const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
    const enrollmentsSnapshot = await getDocs(enrollmentsRef);

    const activeEnrollments = enrollmentsSnapshot.docs
      .map(doc => doc.data())
      .filter(e => !e.withdrawalDate);  // 퇴원하지 않은 enrollment만

    // 2. student 문서에서 현재 상태 조회 (제공되지 않은 경우)
    let previousStatus = currentStudentStatus;
    if (!previousStatus) {
      const studentDoc = await getDocs(
        query(collection(db, 'students'), where('__name__', '==', studentId))
      );
      if (studentDoc.docs.length > 0) {
        previousStatus = studentDoc.docs[0].data().status || 'active';
      } else {
        previousStatus = 'active';
      }
    }

    // 3. 상태 결정 로직
    let newStatus = previousStatus;
    let reason = '';

    // 3-1. 퇴원/예비 상태는 변경하지 않음 (명시적으로 설정된 상태)
    if (previousStatus === 'withdrawn' || previousStatus === 'prospect' || previousStatus === 'prospective') {
      return {
        success: true,
        previousStatus,
        newStatus: previousStatus,
        reason: '퇴원/예비 상태는 자동 변경하지 않음'
      };
    }

    // 3-2. enrollments가 없으면 상태 유지
    if (activeEnrollments.length === 0) {
      return {
        success: true,
        previousStatus,
        newStatus: previousStatus,
        reason: '활성 enrollments 없음 - 상태 유지'
      };
    }

    // 3-3. 모든 enrollments가 onHold=true이면 on_hold
    const allOnHold = activeEnrollments.every(e => e.onHold === true);
    if (allOnHold) {
      newStatus = 'on_hold';
      reason = '모든 수강 과목이 대기 상태';
    }
    // 3-4. 하나라도 활성 enrollment가 있으면 active
    else {
      newStatus = 'active';
      reason = '활성 수강 과목 존재';
    }

    // 4. 상태가 변경된 경우에만 DB 업데이트
    if (newStatus !== previousStatus) {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, { status: newStatus });

      return {
        success: true,
        previousStatus,
        newStatus,
        reason: `${reason} (자동 동기화)`
      };
    }

    return {
      success: true,
      previousStatus,
      newStatus,
      reason: '상태 변경 불필요'
    };

  } catch (error) {
    console.error('학생 상태 동기화 실패:', error);
    return {
      success: false,
      previousStatus: currentStudentStatus || 'unknown',
      newStatus: currentStudentStatus || 'unknown',
      reason: `오류: ${error}`
    };
  }
}

/**
 * enrollment의 onHold 상태를 변경하고 student.status를 자동 동기화합니다.
 *
 * @param studentId - 학생 ID
 * @param enrollmentId - enrollment ID
 * @param onHold - 새 onHold 값
 * @param currentStudentStatus - 현재 학생 상태 (optional)
 * @returns 동기화 결과
 */
export async function updateEnrollmentHoldWithSync(
  studentId: string,
  enrollmentId: string,
  onHold: boolean,
  currentStudentStatus?: string
): Promise<StudentStatusSyncResult> {
  try {
    // 1. enrollment onHold 업데이트
    const enrollmentRef = doc(db, 'students', studentId, 'enrollments', enrollmentId);
    await updateDoc(enrollmentRef, { onHold });

    // 2. student.status 자동 동기화
    return await syncStudentStatus(studentId, currentStudentStatus);

  } catch (error) {
    console.error('enrollment onHold 업데이트 실패:', error);
    return {
      success: false,
      previousStatus: currentStudentStatus || 'unknown',
      newStatus: currentStudentStatus || 'unknown',
      reason: `오류: ${error}`
    };
  }
}

/**
 * 여러 enrollments의 onHold 상태를 일괄 변경하고 student.status를 동기화합니다.
 *
 * @param studentId - 학생 ID
 * @param updates - {enrollmentId: onHold} 형태의 객체
 * @param currentStudentStatus - 현재 학생 상태 (optional)
 * @returns 동기화 결과
 */
export async function batchUpdateEnrollmentHoldWithSync(
  studentId: string,
  updates: Record<string, boolean>,
  currentStudentStatus?: string
): Promise<StudentStatusSyncResult> {
  try {
    // 1. 모든 enrollments 업데이트
    const updatePromises = Object.entries(updates).map(([enrollmentId, onHold]) => {
      const enrollmentRef = doc(db, 'students', studentId, 'enrollments', enrollmentId);
      return updateDoc(enrollmentRef, { onHold });
    });

    await Promise.all(updatePromises);

    // 2. student.status 자동 동기화
    return await syncStudentStatus(studentId, currentStudentStatus);

  } catch (error) {
    console.error('일괄 enrollment onHold 업데이트 실패:', error);
    return {
      success: false,
      previousStatus: currentStudentStatus || 'unknown',
      newStatus: currentStudentStatus || 'unknown',
      reason: `오류: ${error}`
    };
  }
}
