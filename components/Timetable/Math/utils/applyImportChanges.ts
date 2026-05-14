/**
 * 시간표 엑셀 가져오기 — 변경점을 Firestore 에 적용
 *
 * 처리:
 *  1. 학생 추가 (enrollExistingStudent 패턴): students/{sid}/enrollments/{cid} setDoc
 *  2. 학생 삭제 (smartRemoveStudent 패턴): endDate/withdrawalDate 설정
 *  3. 학생 이동: 기존 enrollment 종료 (isTransferred=true) + 새 enrollment 생성 (isTransferredIn=true)
 *  4. 반이름 변경: classes/{classId}.className 업데이트 + 그 수업의 모든 enrollment 동기화
 *  5. 수업 색상 변경: classes/{classId}.bgColor / textColor 업데이트
 *
 * 안전: 호출 전에 createSnapshot() 으로 변경 전 상태 백업해야 함.
 */

import {
    collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';
import { logTimetableChange } from '../../../../hooks/useTimetableLog';
import { syncStudentStatus } from '../../../../utils/studentStatusSync';
import type { ImportChanges, ImportedExcel } from './excelImport';


const COL_STUDENTS = 'students';
const COL_CLASSES = 'classes';

export interface ApplyOptions {
    /** 사용자 식별 (audit 필드) */
    actorId?: string;
    actorName?: string;
}

export interface ApplyResult {
    appliedAdditions: number;
    appliedRemovals: number;
    appliedMoves: number;
    appliedRenames: number;
    appliedColorChanges: number;
    errors: string[];
}

/** ARGB → #RRGGBB 변환 (저장은 #RRGGBB 형식이 기존 패턴) */
function argbToHex(argb?: string): string | undefined {
    if (!argb) return undefined;
    const s = argb.length === 8 ? argb.slice(2) : argb;
    return `#${s.toUpperCase()}`;
}

/**
 * classes.schedule (object array 일 수 있음) → enrollment.schedule (string array)
 * useClassOperations 의 enrollExistingStudent 와 동일 패턴.
 * enrollment.schedule 은 string array 여야 parseScheduleSlots 가 동작함.
 */
function normalizeSchedule(schedule: any): string[] {
    if (!Array.isArray(schedule)) return [];
    return schedule.map((s: any) =>
        typeof s === 'string' ? s : `${s.day || ''} ${s.periodId || ''}`.trim()
    ).filter(Boolean);
}

export async function applyImportChanges(
    changes: ImportChanges,
    /** 메타 — 반이름 변경 시 영향 받는 학생 ID 식별용 (없으면 학생 전체 순회 fallback) */
    imported: ImportedExcel | null,
    options: ApplyOptions = {},
): Promise<ApplyResult> {
    // 메타에서 classId 별 영향 받는 학생 ID 집합 추출 (반이름 변경 최적화용)
    const studentsByClassId = new Map<string, Set<string>>();
    if (imported) {
        imported.entries.forEach(e => {
            if (e.kind !== 'student' || !e.studentId || !e.sourceClassId) return;
            const set = studentsByClassId.get(e.sourceClassId) || new Set<string>();
            set.add(e.studentId);
            studentsByClassId.set(e.sourceClassId, set);
        });
    }
    const errors: string[] = [];
    let appliedAdditions = 0;
    let appliedRemovals = 0;
    let appliedMoves = 0;
    let appliedRenames = 0;
    let appliedColorChanges = 0;

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // classes 캐시 — 같은 classId 여러 번 조회 방지
    const classCache = new Map<string, any>();
    const fetchClass = async (classId: string) => {
        if (classCache.has(classId)) return classCache.get(classId);
        const snap = await getDoc(doc(db, COL_CLASSES, classId));
        const data = snap.exists() ? snap.data() : null;
        classCache.set(classId, data);
        return data;
    };

    // ───── 1) 학생 추가 ─────
    for (const add of changes.studentAdditions) {
        if (!add.matchedStudentId) {
            errors.push(`추가 실패 (매칭 실패): ${add.text}`);
            continue;
        }
        try {
            const cls = await fetchClass(add.targetClassId);
            if (!cls) {
                errors.push(`추가 실패 (수업 없음): ${add.text} → ${add.targetClassId}`);
                continue;
            }
            const enrRef = doc(db, COL_STUDENTS, add.matchedStudentId, 'enrollments', add.targetClassId);
            const existing = await getDoc(enrRef);
            if (existing.exists()) {
                const data = existing.data();
                if (data.endDate || data.withdrawalDate) {
                    // 부활 처리
                    await updateDoc(enrRef, {
                        endDate: null,
                        withdrawalDate: null,
                        enrollmentDate: today,
                        startDate: today,
                        updatedAt: now,
                        updatedBy: options.actorName || options.actorId || '',
                        restoredAt: now,
                    });
                } else {
                    // 이미 활성 — skip
                    continue;
                }
            } else {
                await setDoc(enrRef, {
                    classId: add.targetClassId,
                    className: cls.className || '',
                    subject: cls.subject || 'math',
                    teacher: cls.teacher || '',
                    staffId: cls.teacher || '',
                    schedule: normalizeSchedule(cls.schedule),
                    enrollmentDate: today,
                    startDate: today,
                    createdAt: now,
                    createdBy: options.actorName || options.actorId || '',
                });
            }
            // 시간표 변경 이력 (학생 카드 입학일 표시 등에 활용)
            logTimetableChange({
                action: 'student_enroll',
                subject: cls.subject || 'math',
                className: cls.className || '',
                studentId: add.matchedStudentId,
                studentName: add.text,
                details: `엑셀 가져오기로 학생 등록: ${add.text} → ${cls.className || ''}`,
                after: { className: cls.className || '', enrollmentDate: today },
            });
            appliedAdditions++;
        } catch (err: any) {
            errors.push(`추가 실패: ${add.text} — ${err?.message || err}`);
        }
    }

    // ───── 2) 학생 이동 (실제 반이동 프로세스와 동일) ─────
    // useStudentDragDrop.ts 의 반이동 로직 패턴:
    //   1. 기존 enrollment 종료: endDate/withdrawalDate=어제, isTransferred=true (batch merge)
    //   2. 새 enrollment 생성 (doc ID = toClassId): preservedData spread + 새 반 정보 덮어쓰기
    //   3. syncStudentStatus 호출 (퇴원생 → 활성 복구)
    //
    // doc ID 정확히 찾기 — classId 직접 조회 → fallback className query
    const getEnrollmentDocId = async (studentId: string, classId: string, className: string): Promise<string> => {
        const directRef = doc(db, COL_STUDENTS, studentId, 'enrollments', classId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) return classId;
        // className 으로 query fallback
        const q = query(
            collection(db, COL_STUDENTS, studentId, 'enrollments'),
            where('className', '==', className),
        );
        const qSnap = await getDocs(q);
        const activeDoc = qSnap.docs.find(d => !d.data().endDate && !d.data().withdrawalDate);
        if (activeDoc) return activeDoc.id;
        return classId;
    };

    // 어제 날짜 (오늘부터 새 반 시작)
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    const movedStudentIds = new Set<string>();
    for (const move of changes.studentMoves) {
        try {
            const fromCls = await fetchClass(move.fromClassId);
            const toCls = await fetchClass(move.toClassId);
            if (!toCls) {
                errors.push(`이동 실패 (도착 수업 없음): ${move.studentNameSnapshot}`);
                continue;
            }

            // (a) fromClassId 의 모든 활성 enrollment 수집 (중복 방지)
            //     같은 학생이 같은 classId 에 여러 doc 을 가질 수 있음 (autoDocId, classId-doc 등)
            //     모두 종료해야 중복 enrollment 남지 않음
            const fromEnrCol = collection(db, COL_STUDENTS, move.studentId, 'enrollments');
            const fromAllSnap = await getDocs(fromEnrCol);
            const activeFromRefs: any[] = [];
            let existingData: any = null;
            fromAllSnap.docs.forEach(d => {
                const data = d.data();
                const matches = data.classId === move.fromClassId || d.id === move.fromClassId;
                if (!matches) return;
                if (data.endDate || data.withdrawalDate) return; // 이미 종료된 건 skip
                activeFromRefs.push(d.ref);
                // 첫 번째 활성 enrollment 의 데이터를 preservedData 로
                if (!existingData) existingData = data;
            });

            // (b) toDay 에서 attendanceDays 추출 (월/목 → ['월','목'], 단일 '월' → ['월'])
            const newAttendanceDays = move.toDay
                ? move.toDay.split('/').filter(d => /^[월화수목금토일]$/.test(d))
                : [];

            // (c) batch 작성 — 기존 종료 + 새 enrollment
            const batch = writeBatch(db);

            // 기존 종료 (어제 날짜) — 같은 classId 의 모든 활성 enrollment 일괄 종료 (중복 방지)
            activeFromRefs.forEach(ref => {
                batch.set(ref, {
                    endDate: yesterday,
                    withdrawalDate: yesterday,
                    isTransferred: true,
                    updatedAt: now,
                }, { merge: true });
            });

            // toClassId 의 기존 활성 enrollment 중 doc ID 가 toClassId 가 아닌 것은 정리
            //  → 그렇지 않으면 우리가 새로 만드는 doc(=toClassId) 와 함께 두 개 활성 = 중복
            const targetDocId = move.toClassId;
            fromAllSnap.docs.forEach(d => {
                const data = d.data();
                const matches = data.classId === targetDocId || d.id === targetDocId;
                if (!matches) return;
                if (data.endDate || data.withdrawalDate) return; // 이미 종료된 건 skip
                if (d.id === targetDocId) return; // doc ID = toClassId 인 건 우리가 곧 setDoc 으로 덮어씀
                // 다른 doc ID 의 활성 enrollment → 종료 (중복 차단)
                batch.set(d.ref, {
                    endDate: yesterday,
                    withdrawalDate: yesterday,
                    updatedAt: now,
                }, { merge: true });
            });

            // 새 enrollment (doc ID = toClassId)
            const newEnrRef = doc(db, COL_STUDENTS, move.studentId, 'enrollments', move.toClassId);
            if (existingData) {
                // preservedData spread — 종료/대기 플래그는 제거
                const { endDate, withdrawalDate, isTransferred, onHold, isScheduled, ...preservedData } = existingData;
                void endDate; void withdrawalDate; void isTransferred; void onHold; void isScheduled;
                batch.set(newEnrRef, {
                    ...preservedData,
                    classId: move.toClassId,
                    className: toCls.className || '',
                    teacher: toCls.teacher || '',
                    staffId: toCls.teacher || '',
                    schedule: normalizeSchedule(toCls.schedule),
                    isSlotTeacher: false,
                    attendanceDays: newAttendanceDays,
                    enrollmentDate: today,
                    startDate: today,
                    createdAt: now,
                    updatedAt: now,
                });
            } else {
                batch.set(newEnrRef, {
                    classId: move.toClassId,
                    className: toCls.className || '',
                    subject: toCls.subject || 'math',
                    teacher: toCls.teacher || '',
                    staffId: toCls.teacher || '',
                    schedule: normalizeSchedule(toCls.schedule),
                    attendanceDays: newAttendanceDays,
                    enrollmentDate: today,
                    startDate: today,
                    createdAt: now,
                });
            }

            await batch.commit();

            // (d) 시간표 변경 이력 (학생 카드 입학일 표시 등에 활용)
            logTimetableChange({
                action: 'student_transfer',
                subject: toCls.subject || 'math',
                className: toCls.className || '',
                studentId: move.studentId,
                studentName: move.studentNameSnapshot,
                details: `엑셀 가져오기로 반이동: ${fromCls?.className || move.fromClassId} → ${toCls.className || ''}`,
                before: { className: fromCls?.className || '', attendanceDays: existingData?.attendanceDays || [] },
                after: { className: toCls.className || '', attendanceDays: newAttendanceDays, enrollmentDate: today },
            });

            movedStudentIds.add(move.studentId);
            appliedMoves++;
        } catch (err: any) {
            errors.push(`이동 실패: ${move.studentNameSnapshot} — ${err?.message || err}`);
        }
    }

    // 이동한 학생들 status 동기화 (퇴원생 → 활성 자동 복구)
    await Promise.all(
        Array.from(movedStudentIds).map(sid =>
            syncStudentStatus(sid).catch(err => console.error('[syncStudentStatus]', sid, err))
        )
    );

    // ───── 3) 학생 삭제 (퇴원 처리, smartRemoveStudent 패턴) ─────
    const removedStudentIds = new Set<string>();
    for (const rem of changes.studentRemovals) {
        try {
            const sourceCls = await fetchClass(rem.sourceClassId);
            // 정확한 enrollment doc ID 찾기
            const docId = await getEnrollmentDocId(
                rem.studentId,
                rem.sourceClassId,
                sourceCls?.className || '',
            );
            const enrRef = doc(db, COL_STUDENTS, rem.studentId, 'enrollments', docId);
            const snap = await getDoc(enrRef);
            if (!snap.exists()) {
                errors.push(`삭제 실패 (enrollment 없음): ${rem.studentNameSnapshot}`);
                continue;
            }
            await updateDoc(enrRef, {
                endDate: today,
                withdrawalDate: today,
                updatedAt: now,
            });

            logTimetableChange({
                action: 'student_withdraw',
                subject: sourceCls?.subject || 'math',
                className: sourceCls?.className || '',
                studentId: rem.studentId,
                studentName: rem.studentNameSnapshot,
                details: `엑셀 가져오기로 학생 퇴원: ${rem.studentNameSnapshot} ← ${sourceCls?.className || ''}`,
                before: { className: sourceCls?.className || '' },
                after: { withdrawalDate: today },
            });

            removedStudentIds.add(rem.studentId);
            appliedRemovals++;
        } catch (err: any) {
            errors.push(`삭제 실패: ${rem.studentNameSnapshot} — ${err?.message || err}`);
        }
    }
    // 삭제한 학생들도 status 동기화 (모든 enrollment 퇴원이면 'withdrawn' 으로)
    await Promise.all(
        Array.from(removedStudentIds).map(sid =>
            syncStudentStatus(sid).catch(err => console.error('[syncStudentStatus]', sid, err))
        )
    );

    // ───── 4) 반이름 변경 ─────
    // 순서 중요: enrollment.className 동기화 먼저 → 성공 시 classes 업데이트
    //   (반대로 하면 classes 만 바뀌고 enrollment 동기화 실패 시 학생 매칭이 깨져 사라져 보임)
    for (const rename of changes.classNameRenames) {
        const renameLabel = `${rename.oldName} → ${rename.newName} (classId=${rename.classId.slice(0, 8)})`;
        console.log(`[rename] 시작: ${renameLabel}`);
        try {
            // (a) 모든 enrollment 수집 (className 동기화 대상)
            //     우선순위:
            //       1. collectionGroup + classId (인덱스 있을 때, 가장 빠름)
            //       2. 메타에서 추출한 영향 받는 학생들의 enrollments 만 조회 (수십 명)
            //          → 학생별 enrollments 서브컬렉션 전체 조회 후 classId 필드 매칭
            //          → addDoc 으로 자동 ID 생성된 enrollment 도 잡힘
            //       3. (최후 fallback) 전체 학생 순회 — 메타 없을 때만
            let enrollmentRefs: any[] = [];
            let usedFallback = false;
            try {
                const enrQuery = query(
                    collectionGroup(db, 'enrollments'),
                    where('classId', '==', rename.classId),
                );
                const enrSnaps = await getDocs(enrQuery);
                enrollmentRefs = enrSnaps.docs.map(d => d.ref);
                console.log(`[rename] collectionGroup 성공: ${enrollmentRefs.length}개 enrollment 발견`);
            } catch (idxErr: any) {
                usedFallback = true;
                console.warn(`[rename] collectionGroup 실패 (인덱스 없음) → 메타 기반 학생 순회 fallback`, idxErr?.message);

                // 메타에서 이 classId 의 영향 받는 학생 ID 추출
                const targetStudentIds = studentsByClassId.get(rename.classId);
                const targetStudentArr = targetStudentIds ? Array.from(targetStudentIds) : null;

                if (targetStudentArr && targetStudentArr.length > 0) {
                    console.log(`[rename] 메타 기반 fallback: ${targetStudentArr.length}명 학생 enrollments 조회`);
                    await Promise.all(
                        targetStudentArr.map(async studentId => {
                            try {
                                const enrCol = collection(db, COL_STUDENTS, studentId, 'enrollments');
                                const snap = await getDocs(enrCol);
                                snap.docs.forEach(eDoc => {
                                    const data = eDoc.data();
                                    // doc ID == classId 또는 classId 필드 매칭 (addDoc 자동 ID 도 포함)
                                    if (data.classId === rename.classId || eDoc.id === rename.classId) {
                                        enrollmentRefs.push(eDoc.ref);
                                    }
                                });
                            } catch { /* skip */ }
                        })
                    );
                } else {
                    // 최후 fallback — 메타 없거나 학생 추출 실패 → 전체 학생 순회 (느림)
                    console.warn(`[rename] 메타에 학생 정보 없음 — 전체 학생 순회 (느림)`);
                    const studentsSnap = await getDocs(collection(db, COL_STUDENTS));
                    console.log(`[rename] 학생 ${studentsSnap.docs.length}명 순회 중...`);
                    await Promise.all(
                        studentsSnap.docs.map(async sDoc => {
                            try {
                                const enrCol = collection(db, COL_STUDENTS, sDoc.id, 'enrollments');
                                const snap = await getDocs(enrCol);
                                snap.docs.forEach(eDoc => {
                                    const data = eDoc.data();
                                    if (data.classId === rename.classId || eDoc.id === rename.classId) {
                                        enrollmentRefs.push(eDoc.ref);
                                    }
                                });
                            } catch { /* skip */ }
                        })
                    );
                }
                console.log(`[rename] fallback 완료: ${enrollmentRefs.length}개 enrollment 발견`);
            }

            if (enrollmentRefs.length === 0) {
                console.warn(`[rename] ⚠ 동기화할 enrollment 가 0개 — class 만 업데이트 (학생 사라짐 위험 있음)`);
            }

            // (b) enrollment.className 동기화 (먼저 — 학생 매칭 유지)
            const syncResults = await Promise.allSettled(
                enrollmentRefs.map(ref => updateDoc(ref, {
                    className: rename.newName,
                    updatedAt: now,
                }))
            );
            const syncFailures = syncResults.filter(r => r.status === 'rejected');
            if (syncFailures.length > 0) {
                console.error(`[rename] enrollment 동기화 ${syncFailures.length}건 실패`, syncFailures);
                errors.push(`반이름 변경 — enrollment 동기화 ${syncFailures.length}건 실패: ${renameLabel}`);
                continue; // class 업데이트 skip (데이터 불일치 방지)
            }
            console.log(`[rename] enrollment 동기화 완료 (${enrollmentRefs.length}건, fallback=${usedFallback})`);

            // (c) class 문서 className 업데이트 (enrollment 동기화 성공 후)
            const renameClassData = await fetchClass(rename.classId);
            await updateDoc(doc(db, COL_CLASSES, rename.classId), {
                className: rename.newName,
                updatedAt: now,
                updatedBy: options.actorName || options.actorId || '',
            });
            console.log(`[rename] ✓ 완료: ${renameLabel}`);

            logTimetableChange({
                action: 'class_update',
                subject: renameClassData?.subject || 'math',
                className: rename.newName,
                details: `엑셀 가져오기로 반이름 변경: ${rename.oldName} → ${rename.newName}`,
                before: { className: rename.oldName },
                after: { className: rename.newName },
            });

            appliedRenames++;
        } catch (err: any) {
            console.error(`[rename] ✗ 실패: ${renameLabel}`, err);
            errors.push(`반이름 변경 실패: ${renameLabel} — ${err?.message || err}`);
        }
    }

    // ───── 5) 수업 색상 변경 ─────
    for (const cc of changes.classColorChanges) {
        try {
            const updates: Record<string, any> = {
                updatedAt: now,
                updatedBy: options.actorName || options.actorId || '',
            };
            if (cc.newBg) updates.bgColor = argbToHex(cc.newBg);
            if (cc.newFg) updates.textColor = argbToHex(cc.newFg);
            const colorClassData = await fetchClass(cc.classId);
            await updateDoc(doc(db, COL_CLASSES, cc.classId), updates);

            logTimetableChange({
                action: 'class_update',
                subject: colorClassData?.subject || 'math',
                className: cc.className,
                details: `엑셀 가져오기로 수업 색상 변경: ${cc.className}`,
                before: { bgColor: argbToHex(cc.oldBg), textColor: argbToHex(cc.oldFg) },
                after: { bgColor: argbToHex(cc.newBg), textColor: argbToHex(cc.newFg) },
            });

            appliedColorChanges++;
        } catch (err: any) {
            errors.push(`색상 변경 실패: ${cc.className} — ${err?.message || err}`);
        }
    }

    return {
        appliedAdditions,
        appliedRemovals,
        appliedMoves,
        appliedRenames,
        appliedColorChanges,
        errors,
    };
}

/**
 * 영향 받는 (studentId, classId) 페어 + classId 추출
 * — createSnapshot 호출 전 백업 대상 식별용
 */
export function collectAffectedRefs(changes: ImportChanges): {
    pairs: Array<{ studentId: string; classId: string }>;
    classIds: string[];
} {
    const pairs: Array<{ studentId: string; classId: string }> = [];
    const classIdSet = new Set<string>();

    changes.studentAdditions.forEach(a => {
        if (a.matchedStudentId && a.targetClassId) {
            pairs.push({ studentId: a.matchedStudentId, classId: a.targetClassId });
        }
    });
    changes.studentRemovals.forEach(r => {
        if (r.studentId && r.sourceClassId) {
            pairs.push({ studentId: r.studentId, classId: r.sourceClassId });
        }
    });
    changes.studentMoves.forEach(m => {
        if (m.studentId) {
            if (m.fromClassId) pairs.push({ studentId: m.studentId, classId: m.fromClassId });
            if (m.toClassId) pairs.push({ studentId: m.studentId, classId: m.toClassId });
        }
    });
    changes.classNameRenames.forEach(r => {
        if (r.classId) classIdSet.add(r.classId);
    });
    changes.classColorChanges.forEach(c => {
        if (c.classId) classIdSet.add(c.classId);
    });

    return { pairs, classIds: Array.from(classIdSet) };
}
