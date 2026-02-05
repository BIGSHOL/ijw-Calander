/**
 * 영어 수업 자동 배정 스크립트
 * - data/원생목록.xlsx의 영어 수업 정보를 기존 students에 매칭
 * - _excelEnglishClasses 필드를 참조하여 영어 enrollment 생성
 * - 수학 수업은 제외, 영어 수업만 처리
 *
 * 사용법:
 * npx ts-node scripts/assignEnglishClasses.ts [--dry-run]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Firebase Admin 초기화
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

let app;
if (!getApps().length) {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        app = initializeApp({
            credential: cert(serviceAccount)
        });
    } else {
        console.error('❌ serviceAccountKey.json 파일이 필요합니다.');
        console.log('   Firebase Console > 프로젝트 설정 > 서비스 계정 > 비공개 키 생성');
        process.exit(1);
    }
} else {
    app = getApps()[0];
}

const db = getFirestore(app, 'restore260202');

// =============== 영어 레벨 매핑 ===============

const ENGLISH_LEVEL_MAP: Record<string, string> = {
    'Dr. Phonics': 'DP',
    'Dr.Phonics': 'DP',
    "Pre Let's": 'PL',
    'Ready To Talk': 'RTT',
    "Let's Talk": 'LT',
    'Ready To Speak': 'RTS',
    "Let's Speak": 'LS',
    "Let's Express": 'LE',
    'Kopi Wang': 'KW',
    'Pre Junior': 'PJ',
    'Junior Plus': 'JP',
    'Middle School English Course': 'MEC',
    'PHONICS&ROOKIES': 'DP',
    'ROOKIES&LEADERS': 'PL',
};

// =============== 헬퍼 함수 ===============

/**
 * 영어 수업명 약어 변환
 * "Let's Express 1" → "LE1"
 */
function convertEnglishClass(fullName: string): string {
    const match = fullName.match(/(\d+)([a-z]?)$/i);
    const number = match ? match[1] : '';
    const suffix = match ? match[2].toLowerCase() : '';

    for (const [levelName, abbr] of Object.entries(ENGLISH_LEVEL_MAP)) {
        if (fullName.includes(levelName)) {
            return `${abbr}${number}${suffix}`;
        }
    }
    return fullName;
}

/**
 * Enrollment ID 생성 (일관된 형식)
 */
function generateEnrollmentId(className: string): string {
    return `english_${className.replace(/\s+/g, '_')}_${Date.now()}`;
}

// =============== 메인 로직 ===============

interface EnglishAssignmentResult {
    studentId: string;
    studentName: string;
    excelClasses: string[];
    assignedClasses: string[];
    skippedClasses: string[];
    errors: string[];
}

async function assignEnglishClasses(dryRun: boolean = false): Promise<void> {
    console.log('========================================');
    console.log('🎓 영어 수업 자동 배정 시작');
    console.log(`   모드: ${dryRun ? '미리보기 (Dry Run)' : '실제 실행'}`);
    console.log('========================================\n');

    // 1. _excelEnglishClasses가 있는 학생 조회
    console.log('📋 학생 데이터 조회 중...');
    const studentsSnapshot = await db.collection('students').get();

    const studentsWithEnglishClasses: Array<{
        id: string;
        name: string;
        excelEnglishClasses: string[];
        existingEnrollments: string[];
    }> = [];

    // 각 학생의 기존 영어 enrollment 확인
    for (const doc of studentsSnapshot.docs) {
        const data = doc.data();
        const excelClasses = data._excelEnglishClasses as string[] | undefined;

        if (excelClasses && excelClasses.length > 0) {
            // 기존 영어 enrollment 조회
            const enrollmentsSnapshot = await db
                .collection('students')
                .doc(doc.id)
                .collection('enrollments')
                .where('subject', '==', 'english')
                .get();

            const existingClassNames = enrollmentsSnapshot.docs.map(d => d.data().className);

            studentsWithEnglishClasses.push({
                id: doc.id,
                name: data.name,
                excelEnglishClasses: excelClasses,
                existingEnrollments: existingClassNames,
            });
        }
    }

    console.log(`   📊 영어 수업 정보가 있는 학생: ${studentsWithEnglishClasses.length}명\n`);

    if (studentsWithEnglishClasses.length === 0) {
        console.log('⚠️ 영어 수업 정보(_excelEnglishClasses)가 있는 학생이 없습니다.');
        console.log('   StudentMigrationModal로 엑셀 데이터를 먼저 마이그레이션하세요.');
        return;
    }

    // 2. 배정 처리
    const results: EnglishAssignmentResult[] = [];
    let totalAssigned = 0;
    let totalSkipped = 0;
    const totalErrors = 0;

    // 배치 처리
    const BATCH_SIZE = 500;
    let batch: WriteBatch | null = null;
    let batchCount = 0;

    for (const student of studentsWithEnglishClasses) {
        const result: EnglishAssignmentResult = {
            studentId: student.id,
            studentName: student.name,
            excelClasses: student.excelEnglishClasses,
            assignedClasses: [],
            skippedClasses: [],
            errors: [],
        };

        for (const className of student.excelEnglishClasses) {
            // 이미 해당 수업 enrollment가 있는지 확인
            if (student.existingEnrollments.includes(className)) {
                result.skippedClasses.push(`${className} (이미 등록됨)`);
                totalSkipped++;
                continue;
            }

            // 새 enrollment 생성
            if (!dryRun) {
                if (!batch || batchCount >= BATCH_SIZE) {
                    if (batch) {
                        await batch.commit();
                        console.log(`   ✅ 배치 커밋 완료 (${batchCount}건)`);
                    }
                    batch = db.batch();
                    batchCount = 0;
                }

                const enrollmentId = generateEnrollmentId(className);
                const enrollmentRef = db
                    .collection('students')
                    .doc(student.id)
                    .collection('enrollments')
                    .doc(enrollmentId);

                const enrollmentData = {
                    subject: 'english',
                    className: className,
                    staffId: '', // 강사는 수동 지정 필요
                    teacher: '', // 호환성
                    days: [],     // 스케줄은 수동 지정 필요
                    createdAt: new Date().toISOString(),
                    source: 'excel_migration', // 마이그레이션 소스 표시
                };

                batch.set(enrollmentRef, enrollmentData);
                batchCount++;
            }

            result.assignedClasses.push(className);
            totalAssigned++;
        }

        results.push(result);
    }

    // 마지막 배치 커밋
    if (batch && batchCount > 0 && !dryRun) {
        await batch.commit();
        console.log(`   ✅ 마지막 배치 커밋 완료 (${batchCount}건)`);
    }

    // 3. 결과 출력
    console.log('\n========================================');
    console.log('📊 배정 결과 요약');
    console.log('========================================');
    console.log(`총 처리 학생: ${studentsWithEnglishClasses.length}명`);
    console.log(`새로 배정된 수업: ${totalAssigned}건`);
    console.log(`건너뛴 수업 (중복): ${totalSkipped}건`);
    console.log(`오류: ${totalErrors}건`);

    // 상세 결과
    console.log('\n📝 상세 배정 내역:');
    console.log('----------------------------------------');

    for (const result of results) {
        if (result.assignedClasses.length > 0 || result.errors.length > 0) {
            console.log(`\n👤 ${result.studentName} (${result.studentId})`);
            console.log(`   Excel 영어 수업: ${result.excelClasses.join(', ')}`);

            if (result.assignedClasses.length > 0) {
                console.log(`   ✅ 배정됨: ${result.assignedClasses.join(', ')}`);
            }
            if (result.skippedClasses.length > 0) {
                console.log(`   ⏭️ 건너뜀: ${result.skippedClasses.join(', ')}`);
            }
            if (result.errors.length > 0) {
                console.log(`   ❌ 오류: ${result.errors.join(', ')}`);
            }
        }
    }

    // 영어 수업별 학생 수 통계
    console.log('\n📈 영어 수업별 배정 학생 수:');
    console.log('----------------------------------------');

    const classStats = new Map<string, number>();
    for (const result of results) {
        for (const className of result.assignedClasses) {
            classStats.set(className, (classStats.get(className) || 0) + 1);
        }
    }

    const sortedClasses = Array.from(classStats.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [className, count] of sortedClasses) {
        console.log(`   ${className}: ${count}명`);
    }

    if (dryRun) {
        console.log('\n⚠️ Dry Run 모드로 실행되어 실제 데이터는 변경되지 않았습니다.');
        console.log('   실제 배정을 진행하려면 --dry-run 옵션 없이 실행하세요.');
    } else {
        console.log('\n✅ 영어 수업 배정이 완료되었습니다!');
    }
}

// =============== 스크립트 실행 ===============

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

assignEnglishClasses(dryRun)
    .then(() => {
        console.log('\n스크립트 종료');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 스크립트 실행 중 오류:', error);
        process.exit(1);
    });
