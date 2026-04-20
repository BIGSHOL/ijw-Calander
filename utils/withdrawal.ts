/**
 * 퇴원 / 재원 복구 원자화 유틸
 *
 * 배경: 기존 로직은 학생 문서의 status 변경과 enrollment 일괄 업데이트가 분리돼 있어
 *       중간에 실패하거나 필터 조건(`!d.withdrawalDate && !d.endDate`)에 걸리는 enrollment만
 *       선택적으로 업데이트되어 "마지막에 삭제된 반 기준으로만 퇴원" 같은 부분 퇴원 버그가 발생했다.
 *
 * 해결: Firestore writeBatch로 학생 문서 + 모든 enrollments를 원자적으로 업데이트한다.
 *       endDate가 이미 설정된 enrollment도 withdrawalDate는 반드시 기록한다 (반이동 후 퇴원 케이스 대응).
 *       Firestore batch 한도(500 ops)를 초과하면 여러 batch로 나눠 처리한다.
 */

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

const BATCH_LIMIT = 400; // 500 한도, 학생 문서 업데이트 포함해 여유 두고 400

export interface WithdrawStudentInput {
  studentId: string;
  withdrawalDate: string; // YYYY-MM-DD
  withdrawalReason?: string;
  withdrawalMemo?: string;
  withdrawalConsultation?: {
    adminCalledParent?: boolean;
    teacherCalledParent?: boolean;
    talkedWithStudent?: boolean;
  };
}

export interface WithdrawStudentResult {
  updatedEnrollments: number;
}

/**
 * 학생 퇴원 처리를 원자화한다.
 * - 학생 문서: status='withdrawn', withdrawalDate, endDate 등 기록
 * - 모든 enrollment: withdrawalDate 기록, endDate가 없으면 withdrawalDate로 채움
 *   (이미 endDate가 있으면 덮어쓰지 않음 — 반이동 이력 보존)
 */
export async function withdrawStudent(
  input: WithdrawStudentInput
): Promise<WithdrawStudentResult> {
  const { studentId, withdrawalDate, withdrawalReason, withdrawalMemo, withdrawalConsultation } = input;

  const studentRef = doc(db, 'students', studentId);
  const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
  const snapshot = await getDocs(enrollmentsRef);

  // enrollment 업데이트 payload 준비
  const enrollmentUpdates = snapshot.docs.map((d) => {
    const data = d.data();
    const payload: Record<string, unknown> = {
      withdrawalDate,
      updatedAt: serverTimestamp(),
    };
    // endDate가 없을 때만 채움 (반이동 등 기존 종료일 보존)
    if (!data.endDate) {
      payload.endDate = withdrawalDate;
    }
    return { ref: d.ref, payload };
  });

  // 학생 문서 업데이트 payload
  const studentPayload: Record<string, unknown> = {
    status: 'withdrawn',
    withdrawalDate,
    endDate: withdrawalDate,
    updatedAt: serverTimestamp(),
  };
  if (withdrawalReason !== undefined) studentPayload.withdrawalReason = withdrawalReason;
  if (withdrawalMemo !== undefined) studentPayload.withdrawalMemo = withdrawalMemo;
  if (withdrawalConsultation !== undefined) studentPayload.withdrawalConsultation = withdrawalConsultation;

  // 배치 분할: 학생 문서 1 + enrollments N을 BATCH_LIMIT 단위로 나눈다
  // 학생 문서는 첫 배치에 포함
  let studentUpdated = false;
  for (let i = 0; i < enrollmentUpdates.length || !studentUpdated; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    if (!studentUpdated) {
      batch.update(studentRef, studentPayload);
      studentUpdated = true;
    }
    const chunk = enrollmentUpdates.slice(i, i + BATCH_LIMIT);
    chunk.forEach(({ ref, payload }) => batch.update(ref, payload));
    await batch.commit();
    if (chunk.length === 0) break;
  }

  return { updatedEnrollments: enrollmentUpdates.length };
}

export interface ReactivateStudentInput {
  studentId: string;
  /** true(default): 모든 enrollment의 withdrawalDate/endDate 제거. false: 학생 문서만 복구 */
  clearEnrollments?: boolean;
}

/**
 * 재원 복구를 원자화한다.
 * - 학생 문서: status='active', 퇴원 관련 필드 제거
 * - clearEnrollments=true (기본): 모든 enrollment의 withdrawalDate/endDate 제거
 *   → 반이동 등으로 정상 종료됐던 enrollment까지 되살아날 수 있으므로 주의.
 *     안전을 위해 "withdrawalDate와 endDate가 동일한 경우에만" 복구 대상으로 본다
 *     (= 퇴원 처리로 같이 세팅된 경우만, 반이동으로 endDate만 있던 것은 유지).
 */
export async function reactivateStudent(
  input: ReactivateStudentInput
): Promise<{ restoredEnrollments: number }> {
  const { studentId, clearEnrollments = true } = input;

  const studentRef = doc(db, 'students', studentId);
  const studentPayload: Record<string, unknown> = {
    status: 'active',
    endDate: deleteField(),
    withdrawalDate: deleteField(),
    withdrawalReason: deleteField(),
    withdrawalMemo: deleteField(),
    withdrawalConsultation: deleteField(),
    updatedAt: serverTimestamp(),
  };

  let restoreTargets: { ref: any; payload: Record<string, unknown> }[] = [];

  if (clearEnrollments) {
    const enrollmentsRef = collection(db, 'students', studentId, 'enrollments');
    const snapshot = await getDocs(enrollmentsRef);
    restoreTargets = snapshot.docs
      .filter((d) => {
        const data = d.data();
        // 퇴원 처리로 함께 설정된 경우만 복구(= withdrawalDate가 있고 endDate==withdrawalDate)
        if (!data.withdrawalDate) return false;
        return !data.endDate || data.endDate === data.withdrawalDate;
      })
      .map((d) => ({
        ref: d.ref,
        payload: {
          withdrawalDate: deleteField(),
          endDate: deleteField(),
          updatedAt: serverTimestamp(),
        },
      }));
  }

  let studentUpdated = false;
  for (let i = 0; i < restoreTargets.length || !studentUpdated; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    if (!studentUpdated) {
      batch.update(studentRef, studentPayload);
      studentUpdated = true;
    }
    const chunk = restoreTargets.slice(i, i + BATCH_LIMIT);
    chunk.forEach(({ ref, payload }) => batch.update(ref, payload));
    await batch.commit();
    if (chunk.length === 0) break;
  }

  return { restoredEnrollments: restoreTargets.length };
}
