/**
 * migrateToUnifiedClasses.ts
 *
 * Phase 1: 통일된 classes 컬렉션 생성
 *
 * 목표:
 * - 수학/영어 수업을 하나의 통일된 구조로 마이그레이션
 * - 기존 데이터는 보존 (삭제하지 않음)
 * - 향후 다른 과목(과학, 국어 등) 추가 가능한 구조
 *
 * 데이터 소스:
 * - 수업목록/{classId} → 수학 수업 (studentList 포함)
 * - english_schedules/{teacher} → 영어 시간표 정보
 *
 * 타겟 구조:
 * - classes/{classId} → 통일된 수업 문서
 *
 * 실행 방법:
 * Browser Console: await migrateToUnifiedClasses(true)  // Dry Run
 * Browser Console: await migrateToUnifiedClasses(false) // Execute
 */

import {
    collection,
    getDocs,
    doc,
    writeBatch,
    getDoc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TimetableClass, TimetableStudent } from '../types';

// 컬렉션 이름
const COL_CLASSES_OLD = '수업목록';
const COL_ENGLISH_SCHEDULES = 'english_schedules';
const COL_CLASSES_NEW = 'classes';

// 과목 타입
type SubjectType = 'math' | 'english' | 'science' | 'korean' | 'other';

// 통일된 수업 스케줄 슬롯
interface ScheduleSlot {
    day: string;           // 요일 (월, 화, 수, 목, 금, 토, 일)
    periodId: string;      // 교시 ID
    startTime?: string;    // 시작 시간 (HH:mm)
    endTime?: string;      // 종료 시간 (HH:mm)
    room?: string;         // 강의실 (슬롯별로 다를 수 있음)
    teacher?: string;      // 담당 강사 (영어는 요일별로 다를 수 있음)
}

// 통일된 수업 문서 구조
interface UnifiedClass {
    id: string;
    className: string;
    subject: SubjectType;
    teacher: string;              // 주 담당 강사
    assistants?: string[];        // 보조 강사 (영어 원어민 등)
    room?: string;                // 기본 강의실
    schedule: ScheduleSlot[];     // 통일된 스케줄
    color?: string;
    isActive: boolean;

    // 레거시 호환
    legacySchedule?: string[];    // 기존 "월 1교시" 형식

    // 메타데이터
    migratedFrom: 'math' | 'english';
    originalDocId: string;
    createdAt: string;
    updatedAt: string;
}

interface MigrationResult {
    totalMathClasses: number;
    totalEnglishClasses: number;
    migratedMathClasses: number;
    migratedEnglishClasses: number;
    skippedDuplicates: number;
    errors: string[];
}

/**
 * 과목 추론 (수업명/문서ID 기반)
 */
function inferSubject(className: string, docId: string): SubjectType {
    const lowerName = className.toLowerCase();
    const lowerDocId = docId.toLowerCase();

    // 영어 패턴
    if (lowerDocId.startsWith('영어_') ||
        lowerName.includes('english') ||
        /^(dp|pl|rtt|lt|rts|ls|le|kw|pj|jp|sp|mec)/i.test(className)) {
        return 'english';
    }

    // 기본값: 수학
    return 'math';
}

/**
 * 기존 schedule 문자열을 ScheduleSlot으로 변환
 * "월 1-1" → { day: "월", periodId: "1-1" }
 */
function parseScheduleString(scheduleStr: string): ScheduleSlot | null {
    if (!scheduleStr || typeof scheduleStr !== 'string') return null;

    const parts = scheduleStr.trim().split(' ');
    if (parts.length < 2) return null;

    const day = parts[0];
    const periodId = parts.slice(1).join(' ');

    if (!['월', '화', '수', '목', '금', '토', '일'].includes(day)) {
        return null;
    }

    return {
        day,
        periodId,
    };
}

/**
 * 영어 스케줄 키 파싱
 * "Sarah-5-월" → { teacher: "Sarah", periodId: "5", day: "월" }
 */
function parseEnglishScheduleKey(key: string): { teacher: string; periodId: string; day: string } | null {
    const parts = key.split('-');
    if (parts.length !== 3) return null;

    const [teacher, periodId, day] = parts;
    if (!['월', '화', '수', '목', '금', '토', '일'].includes(day)) {
        return null;
    }

    return { teacher, periodId, day };
}

/**
 * 수학 수업 마이그레이션
 */
async function migrateMathClasses(
    dryRun: boolean,
    existingClassNames: Set<string>
): Promise<{ migrated: number; skipped: number; errors: string[] }> {
    console.log('\n📘 수학 수업 마이그레이션...');

    const result = { migrated: 0, skipped: 0, errors: [] as string[] };

    try {
        const snapshot = await getDocs(collection(db, COL_CLASSES_OLD));
        const batch = writeBatch(db);
        let batchCount = 0;
        const MAX_BATCH = 450;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as TimetableClass;
            const className = data.className || docSnap.id;

            // 영어 수업은 스킵 (별도 처리)
            if (docSnap.id.startsWith('영어_') || inferSubject(className, docSnap.id) === 'english') {
                continue;
            }

            // 중복 체크
            const newDocId = `math_${className}`;
            if (existingClassNames.has(newDocId)) {
                console.log(`   ⏭️ 스킵 (중복): ${className}`);
                result.skipped++;
                continue;
            }

            // 스케줄 변환
            const scheduleSlots: ScheduleSlot[] = [];
            if (data.schedule && Array.isArray(data.schedule)) {
                data.schedule.forEach(s => {
                    const slot = parseScheduleString(s);
                    if (slot) {
                        slot.room = data.room;
                        slot.teacher = data.teacher;
                        scheduleSlots.push(slot);
                    }
                });
            }

            const now = new Date().toISOString();
            const unifiedClass: Omit<UnifiedClass, 'id'> = {
                className,
                subject: 'math',
                teacher: data.teacher || '',
                room: data.room,
                schedule: scheduleSlots,
                color: data.color,
                isActive: true,
                legacySchedule: data.schedule,
                migratedFrom: 'math',
                originalDocId: docSnap.id,
                createdAt: now,
                updatedAt: now,
            };

            if (!dryRun) {
                const newDocRef = doc(db, COL_CLASSES_NEW, newDocId);
                batch.set(newDocRef, unifiedClass);
                batchCount++;

                if (batchCount >= MAX_BATCH) {
                    await batch.commit();
                    console.log(`   💾 배치 커밋: ${batchCount}개`);
                    batchCount = 0;
                }
            }

            existingClassNames.add(newDocId);
            result.migrated++;

            if (dryRun && result.migrated <= 5) {
                console.log(`   [${className}] teacher: ${data.teacher}, schedule: ${scheduleSlots.length}개 슬롯`);
            }
        }

        if (!dryRun && batchCount > 0) {
            await batch.commit();
            console.log(`   💾 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`✅ 수학 마이그레이션 완료: ${result.migrated}개 (스킵: ${result.skipped}개)`);

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`수학 마이그레이션 실패: ${errMsg}`);
        console.error(`❌ 수학 마이그레이션 오류:`, error);
    }

    return result;
}

/**
 * 영어 수업 마이그레이션
 * english_schedules에서 클래스별로 그룹화하여 마이그레이션
 */
async function migrateEnglishClasses(
    dryRun: boolean,
    existingClassNames: Set<string>
): Promise<{ migrated: number; skipped: number; errors: string[] }> {
    console.log('\n📗 영어 수업 마이그레이션...');

    const result = { migrated: 0, skipped: 0, errors: [] as string[] };

    // 클래스별 데이터 수집
    // className -> { teachers: Set<string>, scheduleSlots: ScheduleSlot[], room?: string }
    const classDataMap = new Map<string, {
        teachers: Set<string>;
        scheduleSlots: ScheduleSlot[];
        room?: string;
        homeroomTeacher?: string;
        teacherCounts: Record<string, number>;
    }>();

    try {
        const snapshot = await getDocs(collection(db, COL_ENGLISH_SCHEDULES));

        // 1단계: 모든 스케줄 데이터 수집
        snapshot.forEach(docSnap => {
            const teacherName = docSnap.id;
            const data = docSnap.data();

            // 각 필드(셀)를 순회
            Object.entries(data).forEach(([fieldKey, cellData]: [string, any]) => {
                if (!cellData || typeof cellData !== 'object') return;

                const className = cellData.className;
                if (!className) return;

                // LAB 수업 스킵
                if (className.toUpperCase() === 'LAB' || className.toUpperCase().includes('LAB')) return;

                // 키 파싱 (강사-교시-요일)
                const parsed = parseEnglishScheduleKey(fieldKey);
                if (!parsed) return;

                // 클래스 데이터 초기화
                if (!classDataMap.has(className)) {
                    classDataMap.set(className, {
                        teachers: new Set(),
                        scheduleSlots: [],
                        teacherCounts: {},
                    });
                }

                const classInfo = classDataMap.get(className)!;
                classInfo.teachers.add(teacherName);
                classInfo.room = classInfo.room || cellData.room;

                // 강사별 카운트 (담임 결정용)
                classInfo.teacherCounts[teacherName] = (classInfo.teacherCounts[teacherName] || 0) + 1;

                // 스케줄 슬롯 추가
                classInfo.scheduleSlots.push({
                    day: parsed.day,
                    periodId: parsed.periodId,
                    teacher: teacherName,
                    room: cellData.room,
                });

                // 머지된 수업도 처리
                if (cellData.merged && Array.isArray(cellData.merged)) {
                    cellData.merged.forEach((m: any) => {
                        if (m.className && !m.className.toUpperCase().includes('LAB')) {
                            if (!classDataMap.has(m.className)) {
                                classDataMap.set(m.className, {
                                    teachers: new Set(),
                                    scheduleSlots: [],
                                    teacherCounts: {},
                                });
                            }

                            const mergedClassInfo = classDataMap.get(m.className)!;
                            mergedClassInfo.teachers.add(teacherName);
                            mergedClassInfo.room = mergedClassInfo.room || m.room;
                            mergedClassInfo.teacherCounts[teacherName] = (mergedClassInfo.teacherCounts[teacherName] || 0) + 1;

                            mergedClassInfo.scheduleSlots.push({
                                day: parsed.day,
                                periodId: parsed.periodId,
                                teacher: teacherName,
                                room: m.room,
                            });
                        }
                    });
                }
            });
        });

        console.log(`   📊 ${classDataMap.size}개 영어 클래스 발견`);

        // 2단계: 클래스별로 마이그레이션
        const batch = writeBatch(db);
        let batchCount = 0;
        const MAX_BATCH = 450;

        for (const [className, classInfo] of classDataMap) {
            const newDocId = `english_${className}`;

            // 중복 체크
            if (existingClassNames.has(newDocId)) {
                console.log(`   ⏭️ 스킵 (중복): ${className}`);
                result.skipped++;
                continue;
            }

            // 담임 결정 (가장 많이 가르치는 강사)
            const teacherEntries = Object.entries(classInfo.teacherCounts);
            teacherEntries.sort((a, b) => b[1] - a[1]);
            const homeroomTeacher = teacherEntries[0]?.[0] || '';

            // 보조 강사 목록 (담임 제외)
            const assistants = Array.from(classInfo.teachers).filter(t => t !== homeroomTeacher);

            // 중복 스케줄 슬롯 제거
            const uniqueSlots: ScheduleSlot[] = [];
            const slotKeys = new Set<string>();
            classInfo.scheduleSlots.forEach(slot => {
                const key = `${slot.day}-${slot.periodId}-${slot.teacher}`;
                if (!slotKeys.has(key)) {
                    slotKeys.add(key);
                    uniqueSlots.push(slot);
                }
            });

            const now = new Date().toISOString();
            const unifiedClass: Omit<UnifiedClass, 'id'> = {
                className,
                subject: 'english',
                teacher: homeroomTeacher,
                assistants: assistants.length > 0 ? assistants : undefined,
                room: classInfo.room,
                schedule: uniqueSlots,
                isActive: true,
                migratedFrom: 'english',
                originalDocId: `english_schedules_aggregated`,
                createdAt: now,
                updatedAt: now,
            };

            if (!dryRun) {
                const newDocRef = doc(db, COL_CLASSES_NEW, newDocId);
                batch.set(newDocRef, unifiedClass);
                batchCount++;

                if (batchCount >= MAX_BATCH) {
                    await batch.commit();
                    console.log(`   💾 배치 커밋: ${batchCount}개`);
                    batchCount = 0;
                }
            }

            existingClassNames.add(newDocId);
            result.migrated++;

            if (dryRun && result.migrated <= 5) {
                console.log(`   [${className}] teacher: ${homeroomTeacher}, assistants: ${assistants.join(', ') || 'none'}, slots: ${uniqueSlots.length}개`);
            }
        }

        if (!dryRun && batchCount > 0) {
            await batch.commit();
            console.log(`   💾 최종 배치 커밋: ${batchCount}개`);
        }

        console.log(`✅ 영어 마이그레이션 완료: ${result.migrated}개 (스킵: ${result.skipped}개)`);

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`영어 마이그레이션 실패: ${errMsg}`);
        console.error(`❌ 영어 마이그레이션 오류:`, error);
    }

    return result;
}

/**
 * 기존 classes 컬렉션 확인
 */
async function getExistingClassIds(): Promise<Set<string>> {
    const existing = new Set<string>();

    try {
        const snapshot = await getDocs(collection(db, COL_CLASSES_NEW));
        snapshot.forEach(doc => {
            existing.add(doc.id);
        });
        console.log(`📋 기존 classes 컬렉션: ${existing.size}개 문서`);
    } catch (error) {
        console.log(`📋 classes 컬렉션 없음 (새로 생성 예정)`);
    }

    return existing;
}

/**
 * 메인 마이그레이션 함수
 */
export async function migrateToUnifiedClasses(dryRun = true): Promise<MigrationResult> {
    const result: MigrationResult = {
        totalMathClasses: 0,
        totalEnglishClasses: 0,
        migratedMathClasses: 0,
        migratedEnglishClasses: 0,
        skippedDuplicates: 0,
        errors: [],
    };

    console.log('\n' + '='.repeat(60));
    console.log(`🚀 Phase 1: 통일된 classes 컬렉션 마이그레이션`);
    console.log(`   모드: ${dryRun ? 'DRY RUN (테스트)' : 'LIVE (실제 실행)'}`);
    console.log('='.repeat(60));

    const startTime = Date.now();

    try {
        // 기존 classes 확인
        const existingClassIds = await getExistingClassIds();

        // 수학 수업 카운트
        const mathSnapshot = await getDocs(collection(db, COL_CLASSES_OLD));
        result.totalMathClasses = mathSnapshot.docs.filter(d =>
            !d.id.startsWith('영어_') && inferSubject(d.data().className || d.id, d.id) === 'math'
        ).length;

        // 수학 마이그레이션
        const mathResult = await migrateMathClasses(dryRun, existingClassIds);
        result.migratedMathClasses = mathResult.migrated;
        result.skippedDuplicates += mathResult.skipped;
        result.errors.push(...mathResult.errors);

        // 영어 마이그레이션
        const englishResult = await migrateEnglishClasses(dryRun, existingClassIds);
        result.migratedEnglishClasses = englishResult.migrated;
        result.totalEnglishClasses = englishResult.migrated + englishResult.skipped;
        result.skippedDuplicates += englishResult.skipped;
        result.errors.push(...englishResult.errors);

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`마이그레이션 실패: ${errMsg}`);
        console.error('❌ 마이그레이션 오류:', error);
    }

    // 결과 출력
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 마이그레이션 결과');
    console.log('='.repeat(60));
    console.log(`수학 수업: ${result.migratedMathClasses} / ${result.totalMathClasses}개 마이그레이션`);
    console.log(`영어 수업: ${result.migratedEnglishClasses} / ${result.totalEnglishClasses}개 마이그레이션`);
    console.log(`스킵 (중복): ${result.skippedDuplicates}개`);
    console.log(`에러: ${result.errors.length}개`);
    console.log(`소요 시간: ${duration}초`);

    if (result.errors.length > 0) {
        console.log('\n⚠️ 발생한 에러:');
        result.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    if (dryRun) {
        console.log('\n💡 실제 실행하려면: await migrateToUnifiedClasses(false)');
    } else {
        console.log('\n✅ 마이그레이션 완료! classes 컬렉션이 생성되었습니다.');
        console.log('💡 다음 단계: hooks/useUnifiedClasses.ts를 사용하여 새 데이터 로드');
    }

    console.log('='.repeat(60));

    return result;
}

// 브라우저 콘솔 export
if (typeof window !== 'undefined') {
    (window as any).migrateToUnifiedClasses = migrateToUnifiedClasses;
    console.log('✅ migrateToUnifiedClasses 로드됨');
    console.log('   사용법: await migrateToUnifiedClasses(true)  // Dry Run');
    console.log('          await migrateToUnifiedClasses(false) // 실행');
}

export type { UnifiedClass, ScheduleSlot, SubjectType, MigrationResult };
