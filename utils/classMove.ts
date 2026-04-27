/**
 * classMoves 컬렉션 — 반 이동 트랜잭션 (create/cancel/restore)
 *
 * 한 번에 양쪽 enrollment 를 atomic 하게 업데이트해서 일관성 보장.
 * - createMove: A.endDate=moveDate-1, B 새로 생성(startDate=moveDate), classMove pending.
 * - cancelMove: classMove.status='cancelled', B.cancelledAt=today, A.endDate 제거(또는 moveDate-1 유지 옵션).
 * - restoreMove: classMove.status='pending', B.cancelledAt 제거, A.endDate=moveDate-1 복원.
 *
 * 사용처:
 *  - 시간표 드래그 이동, MoveSelectionModal, useEnglishClassUpdater 등 이동 진입점에서 createMove
 *  - 학생 모달의 "취소된 예약" 섹션에서 cancelMove/restoreMove
 *  - Phase 1 의 단일 enrollment cancel 동작도 단독으로 동작 (classMove 없는 일반 enrollment 도 취소 가능)
 */

import {
    doc,
    collection,
    writeBatch,
    getDoc,
    serverTimestamp,
    deleteField,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ClassMove } from '../types/classMove';

const MOVES_COLLECTION = 'classMoves';

function todayKST(): string {
    return new Date().toISOString().split('T')[0];
}

/** moveDate 의 직전 날(YYYY-MM-DD) 반환 */
function dayBefore(date: string): string {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

export interface CreateMoveInput {
    studentId: string;
    studentName?: string;
    /** 기존(종료될) enrollment id */
    fromEnrollmentId: string;
    fromMeta?: { className?: string; subject?: string };
    /** 새로 생성할 enrollment 의 데이터 (startDate 는 자동으로 moveDate 로 설정됨) */
    toEnrollmentData: Record<string, any>;
    toMeta?: { className?: string; subject?: string };
    moveDate: string; // YYYY-MM-DD
    actorId?: string; // 작성자 (audit)
}

/**
 * 반 이동 생성. fromEnrollment 의 endDate 를 moveDate-1 로, toEnrollment 신규 생성, classMove record 생성.
 *
 * @returns 생성된 classMove id 와 toEnrollment id
 */
export async function createMove(input: CreateMoveInput): Promise<{ moveId: string; toEnrollmentId: string }> {
    const {
        studentId,
        studentName,
        fromEnrollmentId,
        fromMeta,
        toEnrollmentData,
        toMeta,
        moveDate,
        actorId,
    } = input;

    const fromRef = doc(db, `students/${studentId}/enrollments`, fromEnrollmentId);
    const fromSnap = await getDoc(fromRef);
    if (!fromSnap.exists()) {
        throw new Error(`fromEnrollment ${fromEnrollmentId} 가 존재하지 않습니다`);
    }
    const fromData = fromSnap.data();
    const endDateBeforeMove = dayBefore(moveDate);

    // 새 enrollment doc ref (id 자동 생성)
    const toEnrollmentsCol = collection(db, `students/${studentId}/enrollments`);
    const toRef = doc(toEnrollmentsCol);

    // classMove doc ref
    const movesCol = collection(db, MOVES_COLLECTION);
    const moveRef = doc(movesCol);

    const batch = writeBatch(db);

    // 1) fromEnrollment 종료일 set (이전 endDate 백업하지 않음 — fromMeta.endDateBeforeMove 에 저장)
    batch.update(fromRef, {
        endDate: endDateBeforeMove,
        updatedAt: new Date().toISOString(),
    });

    // 2) toEnrollment 생성 (startDate = moveDate)
    batch.set(toRef, {
        ...toEnrollmentData,
        startDate: moveDate,
        enrollmentDate: moveDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    // 3) classMove pending 생성
    const moveDoc: Omit<ClassMove, 'id'> = {
        studentId,
        studentName,
        fromEnrollmentId,
        toEnrollmentId: toRef.id,
        moveDate,
        fromMeta: {
            className: fromMeta?.className || fromData.className,
            subject: fromMeta?.subject || fromData.subject,
            endDateBeforeMove: typeof fromData.endDate === 'string' ? fromData.endDate : undefined,
        },
        toMeta,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: actorId,
    };
    batch.set(moveRef, moveDoc);

    await batch.commit();

    return { moveId: moveRef.id, toEnrollmentId: toRef.id };
}

export interface CancelMoveInput {
    moveId: string;
    actorId?: string;
    reason?: string;
}

/**
 * 반 이동 취소.
 * - classMove.status='cancelled' + cancelledAt set
 * - toEnrollment.cancelledAt set (UI 에서 "취소된 예약" 으로 표시)
 * - fromEnrollment.endDate 제거 (다시 무기한 활성으로 복원)
 *
 * 단 fromEnrollment 의 원래 endDate(이동 전부터 따로 종료 예정이었던 경우)는 fromMeta.endDateBeforeMove 로 복원.
 */
export async function cancelMove(input: CancelMoveInput): Promise<void> {
    const { moveId, actorId, reason } = input;
    const today = todayKST();

    const moveRef = doc(db, MOVES_COLLECTION, moveId);
    const moveSnap = await getDoc(moveRef);
    if (!moveSnap.exists()) throw new Error(`classMove ${moveId} 없음`);
    const move = moveSnap.data() as ClassMove;
    if (move.status === 'cancelled') return; // idempotent

    const fromRef = doc(db, `students/${move.studentId}/enrollments`, move.fromEnrollmentId);
    const toRef = doc(db, `students/${move.studentId}/enrollments`, move.toEnrollmentId);

    const batch = writeBatch(db);

    // classMove 취소 마크
    batch.update(moveRef, {
        status: 'cancelled',
        cancelledAt: today,
        cancelledBy: actorId || null,
        cancelReason: reason || null,
        updatedAt: new Date().toISOString(),
    });

    // toEnrollment 취소 (cancel ≠ delete; 데이터/audit 보존)
    batch.update(toRef, {
        cancelledAt: today,
        cancelledBy: actorId || null,
        updatedAt: new Date().toISOString(),
    });

    // fromEnrollment 종료 해제 — endDateBeforeMove 가 있으면 그 값으로, 없으면 deleteField()
    const restorePrev = move.fromMeta?.endDateBeforeMove;
    batch.update(fromRef, {
        endDate: restorePrev ?? deleteField(),
        updatedAt: new Date().toISOString(),
    });

    await batch.commit();
}

export interface RestoreMoveInput {
    moveId: string;
    actorId?: string;
}

/**
 * 취소된 이동을 복원.
 * - classMove.status='pending' + cancelledAt 제거
 * - toEnrollment.cancelledAt 제거 (다시 활성)
 * - fromEnrollment.endDate=moveDate-1 복원
 */
export async function restoreMove(input: RestoreMoveInput): Promise<void> {
    const { moveId, actorId } = input;

    const moveRef = doc(db, MOVES_COLLECTION, moveId);
    const moveSnap = await getDoc(moveRef);
    if (!moveSnap.exists()) throw new Error(`classMove ${moveId} 없음`);
    const move = moveSnap.data() as ClassMove;
    if (move.status !== 'cancelled') return; // already active

    const fromRef = doc(db, `students/${move.studentId}/enrollments`, move.fromEnrollmentId);
    const toRef = doc(db, `students/${move.studentId}/enrollments`, move.toEnrollmentId);
    const endDateBefore = dayBefore(move.moveDate);

    const batch = writeBatch(db);

    batch.update(moveRef, {
        status: 'pending',
        cancelledAt: deleteField(),
        cancelledBy: deleteField(),
        cancelReason: deleteField(),
        updatedAt: new Date().toISOString(),
        restoredBy: actorId || null,
        restoredAt: new Date().toISOString(),
    });

    batch.update(toRef, {
        cancelledAt: deleteField(),
        cancelledBy: deleteField(),
        updatedAt: new Date().toISOString(),
    });

    batch.update(fromRef, {
        endDate: endDateBefore,
        updatedAt: new Date().toISOString(),
    });

    await batch.commit();
}

/**
 * 단일 enrollment 의 cancelledAt 만 제거 (classMove 없는 일반 예약 복원)
 *
 * Phase 1 의 단일 enrollment 취소 케이스 — classMove pair 가 없는 단독 enrollment 의 취소를 무를 때.
 */
export async function restoreCancelledEnrollment(
    studentId: string,
    enrollmentId: string,
    actorId?: string,
): Promise<void> {
    const ref = doc(db, `students/${studentId}/enrollments`, enrollmentId);
    const batch = writeBatch(db);
    batch.update(ref, {
        cancelledAt: deleteField(),
        cancelledBy: deleteField(),
        cancelReason: deleteField(),
        updatedAt: new Date().toISOString(),
        restoredBy: actorId || null,
        restoredAt: new Date().toISOString(),
    });
    await batch.commit();
}

// serverTimestamp 가 unused 경고 안 뜨게 export (필요시 외부에서도 사용)
export { serverTimestamp };