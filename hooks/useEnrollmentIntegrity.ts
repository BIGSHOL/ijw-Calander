/**
 * Enrollment 데이터 무결성 자동 검증/수정 훅
 *
 * 앱 로드 시 enrollment ↔ class 데이터 일관성을 검증하고
 * 스케줄 불일치, classId 누락, teacher 불일치 등을 자동 수정합니다.
 *
 * 방지 대상:
 * 1. enrollment schedule ≠ class schedule (attendanceDays 없는 경우)
 * 2. enrollment classId ≠ class doc ID
 * 3. enrollment teacher ≠ class teacher
 */

import { useEffect, useRef } from 'react';
import { collection, collectionGroup, getDocs, updateDoc, query, where, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { UserProfile } from '../types';

// schedule 비교용 정규화
function normalizeSchedule(schedule: any[]): string {
  if (!schedule || schedule.length === 0) return '';
  return schedule.map((s: any) => {
    if (typeof s === 'string') return s;
    if (s.day && s.periodId) return `${s.day} ${s.periodId}`;
    return '';
  }).sort().join(',');
}

// 하루 1회만 실행 (localStorage 기반)
function shouldRunToday(): boolean {
  const key = 'enrollment_integrity_last_run';
  const lastRun = localStorage.getItem(key);
  const today = new Date().toISOString().split('T')[0];
  if (lastRun === today) return false;
  localStorage.setItem(key, today);
  return true;
}

/**
 * 앱 로드 시 하루 1회 enrollment 무결성 검증 및 자동 수정
 * master/admin 역할만 실행 (쓰기 권한 필요)
 */
export function useEnrollmentIntegrity(userProfile: UserProfile | null) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (!userProfile) return;
    // master/admin만 실행 (Firestore 쓰기 권한)
    const role = userProfile.role;
    if (role !== 'master' && role !== 'admin') return;
    if (!shouldRunToday()) return;

    hasRun.current = true;
    runIntegrityCheck().catch(() => {
      // 실패해도 앱 동작에 영향 없음
    });
  }, [userProfile]);
}

async function runIntegrityCheck() {
  // 1. 모든 classes 로드
  const classesSnap = await getDocs(collection(db, 'classes'));
  const classByNameSubject = new Map<string, {
    id: string;
    className: string;
    subject: string;
    teacher: string;
    schedule: any[];
  }>();

  classesSnap.forEach(docSnap => {
    const data = docSnap.data();
    const key = `${data.className || ''}__${data.subject || ''}`;
    classByNameSubject.set(key, {
      id: docSnap.id,
      className: data.className || '',
      subject: data.subject || '',
      teacher: data.teacher || '',
      schedule: data.schedule || [],
    });
  });

  // 2. 모든 활성 enrollments 로드
  const enrollmentsSnap = await getDocs(collectionGroup(db, 'enrollments'));

  let fixCount = 0;
  const maxFixes = 50; // 한 번에 최대 50건까지만 수정 (비용 제한)

  for (const enrollDoc of enrollmentsSnap.docs) {
    if (fixCount >= maxFixes) break;

    const data = enrollDoc.data();
    // 종료된 enrollment 건너뛰기
    if (data.endDate || data.withdrawalDate) continue;

    const className = data.className || '';
    const subject = data.subject || '';
    const key = `${className}__${subject}`;
    const cls = classByNameSubject.get(key);
    if (!cls) continue; // 고아 enrollment은 여기서 처리하지 않음

    const updates: Record<string, any> = {};

    // 검사 1: classId 누락/불일치
    if (!data.classId || data.classId !== cls.id) {
      updates.classId = cls.id;
    }

    // 검사 2: teacher/staffId 불일치
    if (cls.teacher && data.teacher && data.teacher !== cls.teacher) {
      updates.teacher = cls.teacher;
      updates.staffId = cls.teacher;
    }

    // 검사 3: schedule 불일치 (attendanceDays 유무 관계없이 항상 class schedule과 일치)
    if (data.schedule && data.schedule.length > 0) {
      const enrollSchedule = normalizeSchedule(data.schedule);
      const classSchedule = normalizeSchedule(cls.schedule);

      if (enrollSchedule !== classSchedule && classSchedule !== '') {
        updates.schedule = cls.schedule.map((s: any) => {
          if (typeof s === 'string') return s;
          return `${s.day} ${s.periodId}`;
        });
      }
    }

    // 수정 필요하면 업데이트
    if (Object.keys(updates).length > 0) {
      try {
        updates.updatedAt = new Date().toISOString();
        updates._autoFixed = true; // 자동 수정 플래그
        await updateDoc(enrollDoc.ref, updates);
        fixCount++;
      } catch {
        // 개별 수정 실패는 무시
      }
    }
  }

  if (fixCount > 0) {
    console.info(`[enrollment-integrity] ${fixCount}건 자동 수정 완료`);
  }
}
