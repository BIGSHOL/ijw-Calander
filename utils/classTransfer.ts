/**
 * 반 이동(Class Transfer) 원자화 유틸
 *
 * 배경: 기존에는 "A반 제외(endDate 설정) → B반 추가(setDoc)"이 두 번의 네트워크 왕복으로 분리돼 있어
 *       - 중간 상태에서 양쪽 반에 모두 속하거나
 *       - 한쪽만 성공하고 다른 쪽이 실패해 데이터가 어긋나는 케이스가 있었다.
 *
 * 해결: writeBatch로 from enrollment(들)의 endDate 설정 + to enrollment 생성/갱신을 하나의 원자 연산으로 처리.
 *
 * 한계: Firestore batch는 cross-collection OK이지만 각 문서별 존재 여부를 보장하려면
 *       호출자가 classId 등 기본 정보를 넘겨줘야 한다.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface TransferClassInput {
  studentId: string;
  /** 이동 기준일 (YYYY-MM-DD). 이전 반은 이 날짜로 endDate, 새 반은 startDate */
  transferDate: string;

  /** 이전 반 식별 정보 */
  fromSubject: string;
  fromClassName: string;
  /** 이전 enrollment 문서 id들(알려져 있으면 쿼리 생략) */
  fromEnrollmentIds?: string[];

  /** 새 반 정보 — setDoc으로 생성 */
  toClass: {
    id: string;          // 새 enrollment 문서 id (= classId)
    subject: string;
    className: string;
    staffId?: string;
    teacher?: string;
    schedule?: string[];
  };

  isSlotTeacher?: boolean;
}

export interface TransferClassResult {
  endedEnrollments: number;
  createdEnrollmentId: string;
}

/**
 * 학생을 A반(fromClassName)에서 B반(toClass)으로 이동시킨다.
 * 한 번의 writeBatch로 처리되므로 중간 상태가 외부에 노출되지 않는다.
 *
 * 주의:
 * - 같은 fromClassName의 복수 enrollment(요일별)도 모두 endDate가 세팅된다.
 * - toClass.id가 이미 enrollment로 존재하면 내용이 덮어쓰여진다(setDoc merge 아님, 새 startDate 기준).
 */
export async function transferClass(input: TransferClassInput): Promise<TransferClassResult> {
  const {
    studentId,
    transferDate,
    fromSubject,
    fromClassName,
    fromEnrollmentIds,
    toClass,
    isSlotTeacher,
  } = input;

  if (fromSubject !== toClass.subject) {
    throw new Error('반 이동은 동일 과목 내에서만 허용됩니다.');
  }
  if (fromClassName === toClass.className) {
    throw new Error('이동할 반이 현재 반과 같습니다.');
  }

  const enrollmentsCol = collection(db, 'students', studentId, 'enrollments');

  // 1. 이전 반 enrollment들 찾기
  let fromRefs: ReturnType<typeof doc>[] = [];
  if (fromEnrollmentIds && fromEnrollmentIds.length > 0) {
    fromRefs = fromEnrollmentIds.map((id) => doc(enrollmentsCol, id));
  } else {
    const q = query(
      enrollmentsCol,
      where('subject', '==', fromSubject),
      where('className', '==', fromClassName)
    );
    const snap = await getDocs(q);
    fromRefs = snap.docs
      .filter((d) => !d.data().endDate)
      .map((d) => d.ref);
  }

  // 2. batch 구성
  const batch = writeBatch(db);

  fromRefs.forEach((ref) => {
    batch.update(ref, {
      endDate: transferDate,
      updatedAt: serverTimestamp(),
    });
  });

  const newRef = doc(enrollmentsCol, toClass.id);
  const payload: Record<string, unknown> = {
    classId: toClass.id,
    subject: toClass.subject,
    className: toClass.className,
    schedule: toClass.schedule ?? [],
    days: [],
    period: null,
    room: null,
    startDate: transferDate,
    endDate: null,
    color: null,
    createdAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  };
  if (toClass.staffId !== undefined) payload.staffId = toClass.staffId;
  if (toClass.teacher !== undefined) payload.teacher = toClass.teacher;
  if (isSlotTeacher !== undefined) payload.isSlotTeacher = isSlotTeacher;

  batch.set(newRef, payload);

  await batch.commit();

  return {
    endedEnrollments: fromRefs.length,
    createdEnrollmentId: toClass.id,
  };
}
