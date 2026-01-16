/**
 * 사용자 관리 → 직원 관리 통합 마이그레이션 스크립트
 *
 * 목적: users 컬렉션의 데이터를 staff 컬렉션으로 통합
 * 실행 방법: 개발자 콘솔에서 호출
 */

import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { UserProfile, StaffMember } from '../types';

interface MigrationReport {
  totalUsers: number;
  totalStaff: number;
  matched: number;
  staffCreated: number;
  staffUpdated: number;
  errors: string[];
  timestamp: string;
}

/**
 * Phase 1: staff 컬렉션 스키마 확장
 * 기존 staff 문서에 새로운 필드 추가 (비파괴적)
 */
export async function migratePhase1_ExtendStaffSchema(): Promise<void> {
  console.log('📦 Phase 1: staff 컬렉션 스키마 확장 시작...');

  try {
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    const batch = writeBatch(db);
    let count = 0;

    staffSnapshot.forEach((docSnapshot) => {
      const staff = docSnapshot.data() as StaffMember;

      // 이미 새 필드가 있으면 스킵
      if (staff.systemRole !== undefined) {
        return;
      }

      // 신규 필드 추가 (기본값)
      batch.update(docSnapshot.ref, {
        systemRole: 'user', // 기본 역할
        approvalStatus: 'approved', // 기존 직원은 승인됨
        departmentPermissions: {},
        primaryDepartmentId: null,
        accountLinked: false,
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Phase 1 완료: ${count}개 staff 문서 업데이트`);
    } else {
      console.log('✅ Phase 1: 모든 staff가 이미 새 스키마를 가지고 있습니다.');
    }
  } catch (error) {
    console.error('❌ Phase 1 실패:', error);
    throw error;
  }
}

/**
 * Phase 2: UserProfile 데이터를 staff로 병합
 * 이메일 기반 매칭 + 신규 생성
 */
export async function migratePhase2_MergeUserData(): Promise<MigrationReport> {
  console.log('🔄 Phase 2: users 데이터를 staff로 병합 시작...');

  const report: MigrationReport = {
    totalUsers: 0,
    totalStaff: 0,
    matched: 0,
    staffCreated: 0,
    staffUpdated: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // 모든 users 가져오기
    const usersSnapshot = await getDocs(collection(db, 'users'));
    report.totalUsers = usersSnapshot.size;
    console.log(`📊 총 ${report.totalUsers}명의 사용자 발견`);

    // 모든 staff 가져오기 (이메일 매핑용)
    const staffSnapshot = await getDocs(collection(db, 'staff'));
    report.totalStaff = staffSnapshot.size;
    console.log(`📊 총 ${report.totalStaff}명의 직원 발견`);

    // 이메일로 매핑
    const staffByEmail = new Map<string, any>();
    staffSnapshot.forEach((doc) => {
      const staff = doc.data();
      if (staff.email) {
        staffByEmail.set(staff.email.toLowerCase(), { id: doc.id, data: staff });
      }
    });

    // 각 user를 처리
    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data() as UserProfile;

      try {
        const email = user.email.toLowerCase();
        const existingStaff = staffByEmail.get(email);

        if (existingStaff) {
          // 기존 staff 업데이트 (병합)
          const staffRef = doc(db, 'staff', existingStaff.id);
          await updateDoc(staffRef, {
            uid: user.uid,
            englishName: user.jobTitle || '', // jobTitle → englishName
            systemRole: user.role,
            approvalStatus: user.status,
            departmentPermissions: user.departmentPermissions || {},
            primaryDepartmentId: user.departmentId,
            teacherId: user.teacherId,
            favoriteDepartments: user.favoriteDepartments || [],
            updatedAt: new Date().toISOString(),
          });
          report.matched++;
          report.staffUpdated++;
          console.log(`✅ 업데이트: ${user.email} → ${existingStaff.id}`);
        } else {
          // 신규 staff 생성
          const newStaffRef = doc(collection(db, 'staff'));
          const newStaff: StaffMember = {
            id: newStaffRef.id,
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            englishName: user.jobTitle || '', // jobTitle → englishName
            email: user.email,
            role: 'staff', // 기본 직원 타입
            systemRole: user.role,
            approvalStatus: user.status,
            departmentPermissions: user.departmentPermissions || {},
            primaryDepartmentId: user.departmentId,
            teacherId: user.teacherId,
            favoriteDepartments: user.favoriteDepartments || [],
            hireDate: new Date().toISOString().split('T')[0],
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(newStaffRef, newStaff);
          report.staffCreated++;
          console.log(`✅ 생성: ${user.email} → ${newStaffRef.id}`);
        }
      } catch (error) {
        const errorMsg = `${user.email}: ${error}`;
        report.errors.push(errorMsg);
        console.error(`❌ 실패: ${errorMsg}`);
      }
    }

    console.log('\n📊 Phase 2 완료!');
    console.log(`- 총 사용자: ${report.totalUsers}`);
    console.log(`- 기존 직원: ${report.totalStaff}`);
    console.log(`- 매칭됨: ${report.matched}`);
    console.log(`- 신규 생성: ${report.staffCreated}`);
    console.log(`- 업데이트: ${report.staffUpdated}`);
    console.log(`- 오류: ${report.errors.length}`);

    if (report.errors.length > 0) {
      console.error('\n❌ 오류 목록:');
      report.errors.forEach(err => console.error(`  - ${err}`));
    }

    return report;
  } catch (error) {
    console.error('❌ Phase 2 실패:', error);
    throw error;
  }
}

/**
 * Phase 3: 마이그레이션 검증
 */
export async function migratePhase3_Verify(): Promise<MigrationReport> {
  console.log('🔍 Phase 3: 마이그레이션 검증 시작...');

  const report: MigrationReport = {
    totalUsers: 0,
    totalStaff: 0,
    matched: 0,
    staffCreated: 0,
    staffUpdated: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const staffSnapshot = await getDocs(collection(db, 'staff'));

    report.totalUsers = usersSnapshot.size;
    report.totalStaff = staffSnapshot.size;

    // 이메일 매핑 검증
    const userEmails = new Set<string>();
    usersSnapshot.forEach(doc => {
      const user = doc.data() as UserProfile;
      userEmails.add(user.email.toLowerCase());
    });

    const staffByEmail = new Map<string, any>();
    staffSnapshot.forEach(doc => {
      const staff = doc.data();
      if (staff.email) {
        staffByEmail.set(staff.email.toLowerCase(), { id: doc.id, data: staff });
      }
    });

    // 매칭 확인
    userEmails.forEach(email => {
      if (staffByEmail.has(email)) {
        const staff = staffByEmail.get(email);
        if (staff.data.uid) {
          report.matched++;
        } else {
          report.errors.push(`${email}: staff에 uid 없음`);
        }
      } else {
        report.errors.push(`${email}: staff에 없음`);
      }
    });

    console.log('\n📊 검증 결과:');
    console.log(`- 총 사용자: ${report.totalUsers}`);
    console.log(`- 총 직원: ${report.totalStaff}`);
    console.log(`- 연동됨: ${report.matched}`);
    console.log(`- 미연동: ${report.totalUsers - report.matched}`);
    console.log(`- 오류: ${report.errors.length}`);

    if (report.errors.length > 0) {
      console.warn('\n⚠️ 미연동 또는 오류:');
      report.errors.forEach(err => console.warn(`  - ${err}`));
    }

    if (report.matched === report.totalUsers) {
      console.log('\n✅ 완벽! 모든 사용자가 직원과 연동되었습니다.');
    }

    return report;
  } catch (error) {
    console.error('❌ Phase 3 실패:', error);
    throw error;
  }
}

/**
 * 전체 마이그레이션 실행 (Phase 1 + 2 + 3)
 */
export async function runFullMigration(): Promise<void> {
  console.log('🚀 전체 마이그레이션 시작...\n');

  try {
    // Phase 1
    await migratePhase1_ExtendStaffSchema();
    console.log('');

    // Phase 2
    const phase2Report = await migratePhase2_MergeUserData();
    console.log('');

    // Phase 3
    const phase3Report = await migratePhase3_Verify();
    console.log('');

    console.log('🎉 전체 마이그레이션 완료!');

    // 최종 리포트 저장 (선택적)
    const finalReport = {
      phase2: phase2Report,
      phase3: phase3Report,
    };

    console.log('\n📄 최종 리포트:', JSON.stringify(finalReport, null, 2));

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

// 개발자 콘솔에서 사용할 수 있도록 window 객체에 추가
if (typeof window !== 'undefined') {
  (window as any).migration = {
    phase1: migratePhase1_ExtendStaffSchema,
    phase2: migratePhase2_MergeUserData,
    phase3: migratePhase3_Verify,
    runFull: runFullMigration,
  };

  console.log('✅ 마이그레이션 스크립트 로드됨. 다음 명령으로 실행:');
  console.log('  - window.migration.phase1()  // 스키마 확장');
  console.log('  - window.migration.phase2()  // 데이터 병합');
  console.log('  - window.migration.phase3()  // 검증');
  console.log('  - window.migration.runFull() // 전체 실행');
}
