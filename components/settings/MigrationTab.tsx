import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, ArrowRight, Wrench } from 'lucide-react';
import { db } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  Timestamp,
  collectionGroup,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';

interface MigrationStats {
  mathEnrollments: number;
  englishEnrollments: number;
  studentsProcessed: Set<string>;
  errors: string[];
}

interface FixSubjectStats {
  total: number;
  math: number;
  english: number;
  updated: number;
  errors: string[];
}

const MigrationTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [useNewStructure, setUseNewStructure] = useState(() => {
    const stored = localStorage.getItem('useNewDataStructure');
    // 기본값: true (새 구조 사용)
    if (stored === null) {
      localStorage.setItem('useNewDataStructure', 'true');
      return true;
    }
    return stored === 'true';
  });

  // 영어 수업 subject 수정 관련 상태
  const [isFixingSubjects, setIsFixingSubjects] = useState(false);
  const [fixSubjectStats, setFixSubjectStats] = useState<FixSubjectStats | null>(null);
  const [fixSubjectLogs, setFixSubjectLogs] = useState<string[]>([]);

  // 롤백 관련 상태
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackLogs, setRollbackLogs] = useState<string[]>([]);

  // 완전 초기화 관련 상태
  const [isResetting, setIsResetting] = useState(false);
  const [resetLogs, setResetLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const addFixLog = (message: string) => {
    setFixSubjectLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const addRollbackLog = (message: string) => {
    setRollbackLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const addResetLog = (message: string) => {
    setResetLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // 탭 권한 업데이트: 새로운 탭(classes, student-consultations)을 권한에 추가
  const handleUpdateTabPermissions = async () => {
    if (!window.confirm('Firebase의 system/config 문서에서 tabPermissions를 업데이트하시겠습니까?\n\n새로운 탭(수업 관리, 상담 관리)이 네비게이션에 표시됩니다.')) {
      return;
    }

    try {
      addLog('🔧 탭 권한 업데이트 시작...');

      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);

      if (!configSnap.exists()) {
        addLog('❌ system/config 문서가 존재하지 않습니다.');
        alert('system/config 문서를 먼저 생성해야 합니다.');
        return;
      }

      const currentConfig = configSnap.data();
      const currentPermissions = currentConfig.tabPermissions || {};

      addLog('📋 현재 권한 설정 확인 완료');

      // 업데이트할 권한 설정
      const updatedPermissions = {
        ...currentPermissions,
        master: [
          'calendar', 'timetable', 'attendance', 'payment', 'gantt',
          'consultation', 'students', 'grades',
          'classes', 'student-consultations'  // ✨ 새로 추가
        ],
        admin: [
          'calendar', 'timetable', 'attendance', 'payment',
          'students', 'grades',
          'classes', 'student-consultations'  // ✨ 새로 추가
        ],
        manager: [
          'calendar', 'attendance', 'students', 'grades',
          'classes', 'student-consultations'  // ✨ 새로 추가
        ],
        math_lead: [
          'timetable', 'attendance', 'students', 'grades',
          'classes', 'student-consultations'  // ✨ 새로 추가
        ],
        english_lead: [
          'timetable', 'attendance', 'students', 'grades',
          'classes', 'student-consultations'  // ✨ 새로 추가
        ],
      };

      await updateDoc(configRef, {
        tabPermissions: updatedPermissions
      });

      addLog('✅ 탭 권한 업데이트 완료!');
      addLog('💡 브라우저를 새로고침하면 새로운 탭이 표시됩니다.');

      alert('탭 권한이 업데이트되었습니다!\n\n브라우저를 새로고침(F5)하면 "수업 관리"와 "상담 관리" 탭이 네비게이션에 표시됩니다.');

    } catch (error: any) {
      addLog(`❌ 오류: ${error.message}`);
      alert(`오류 발생: ${error.message}`);
    }
  };

  // 롤백: 모든 enrollments 삭제
  const handleRollback = async () => {
    if (!window.confirm('⚠️ 경고: 모든 enrollments 데이터가 삭제됩니다.\n\n기존 구조(수업목록, english_schedules)로 돌아갑니다.\n\n정말 진행하시겠습니까?')) {
      return;
    }

    setIsRollingBack(true);
    setRollbackLogs([]);

    try {
      addRollbackLog('🔄 롤백 시작: 모든 enrollments 삭제 중...');

      const snapshot = await getDocs(collectionGroup(db, 'enrollments'));
      addRollbackLog(`📋 발견: ${snapshot.docs.length}개 enrollment`);

      let deleted = 0;
      const batchSize = 500;
      const batches: any[] = [];

      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = snapshot.docs.slice(i, i + batchSize);
        batches.push(batch);
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await Promise.all(batch.map(async (docSnapshot) => {
          await deleteDoc(docSnapshot.ref);
          deleted++;
        }));
        addRollbackLog(`   삭제 진행: ${deleted}/${snapshot.docs.length}`);
      }

      addRollbackLog(`✅ 완료: ${deleted}개 enrollment 삭제됨`);
      addRollbackLog('💡 데이터 구조 전환 토글을 끄고 페이지를 새로고침하세요.');

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });

    } catch (error: any) {
      addRollbackLog(`❌ 오류: ${error.message}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  // 완전 초기화: students 컬렉션 전체 삭제
  const handleCompleteReset = async () => {
    const confirmText = 'DELETE';
    const userInput = window.prompt(
      `⚠️⚠️⚠️ 위험: students 컬렉션 전체 삭제 ⚠️⚠️⚠️\n\n` +
      `이 작업은 되돌릴 수 없습니다!\n` +
      `- 모든 학생 문서가 삭제됩니다\n` +
      `- 모든 enrollments가 삭제됩니다\n` +
      `- 처음부터 다시 마이그레이션해야 합니다\n\n` +
      `계속하려면 "${confirmText}"를 정확히 입력하세요:`
    );

    if (userInput !== confirmText) {
      alert('취소되었습니다.');
      return;
    }

    setIsResetting(true);
    setResetLogs([]);

    try {
      addResetLog('🔥 완전 초기화 시작: students 컬렉션 삭제 중...');

      const studentsSnapshot = await getDocs(collection(db, 'students'));
      addResetLog(`📋 발견: ${studentsSnapshot.docs.length}개 학생 문서`);

      let deletedStudents = 0;
      let deletedEnrollments = 0;
      const batchSize = 100;

      // 배치 단위로 처리
      for (let i = 0; i < studentsSnapshot.docs.length; i += batchSize) {
        const batch = studentsSnapshot.docs.slice(i, i + batchSize);

        for (const studentDoc of batch) {
          try {
            // 먼저 enrollments 서브컬렉션 삭제
            const enrollmentsSnapshot = await getDocs(
              collection(db, `students/${studentDoc.id}/enrollments`)
            );

            for (const enrollmentDoc of enrollmentsSnapshot.docs) {
              await deleteDoc(enrollmentDoc.ref);
              deletedEnrollments++;
            }

            // 그 다음 학생 문서 삭제
            await deleteDoc(studentDoc.ref);
            deletedStudents++;

            if (deletedStudents % 10 === 0) {
              addResetLog(`   진행중: ${deletedStudents}/${studentsSnapshot.docs.length} 학생, ${deletedEnrollments}개 enrollment 삭제`);
            }
          } catch (error: any) {
            addResetLog(`❌ ${studentDoc.id} 삭제 실패: ${error.message}`);
          }
        }
      }

      addResetLog(`✅ 완료: ${deletedStudents}개 학생 문서, ${deletedEnrollments}개 enrollment 삭제됨`);
      addResetLog('💡 이제 처음부터 마이그레이션을 실행할 수 있습니다.');
      addResetLog('💡 데이터 구조 전환 토글을 끄고 페이지를 새로고침하세요.');

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });

    } catch (error: any) {
      addResetLog(`❌ 치명적 오류: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // 과목 추론 함수 (수업 이름 패턴 기반)
  const inferSubjectFromClassName = (className: string): 'math' | 'english' => {
    // 영어 패턴 확인 (우선순위 높음)
    const englishPatterns = [
      /^DP/, /^PL/, /^LE/, /^RTT/, /^RW/, /^GR/, /^VT/,  // 영어 레벨 약어
      /^JP/, /^KW/, /^LT/, /^MEC/, /^PJ/, /^RTS/,  // 영어 레벨 약어 추가
      /E_/,  // E_ 포함 (중등E_, 고등E_, 중고E_ 등)
      /phonics/i, /grammar/i, /reading/i, /writing/i,
      /초등\s*브릿지/,  // 초등 브릿지
      /중등E/,  // 중등E
      /고등E/,  // 고등E
      /중고E/,  // 중고E
    ];

    for (const pattern of englishPatterns) {
      if (pattern.test(className)) {
        return 'english';
      }
    }

    // 수학 패턴 확인
    const mathPatterns = [
      /수학/, /개념/, /유형/, /심화/, /최상위/, /사고력/,
      /M_/,  // M_로 시작 (수학)
    ];

    for (const pattern of mathPatterns) {
      if (pattern.test(className)) {
        return 'math';
      }
    }

    // 기본값: 수학
    return 'math';
  };

  // 영어 수업 subject 수정 함수
  const handleFixEnglishSubjects = async () => {
    setIsFixingSubjects(true);
    setFixSubjectLogs([]);

    const newStats: FixSubjectStats = {
      total: 0,
      math: 0,
      english: 0,
      updated: 0,
      errors: []
    };

    try {
      addFixLog('🚀 영어 수업 subject 수정 시작');
      addFixLog('📋 enrollments 조회 중...');

      const snapshot = await getDocs(collectionGroup(db, 'enrollments'));
      newStats.total = snapshot.docs.length;
      addFixLog(`✅ 발견: ${newStats.total}개\n`);

      for (const enrollmentDoc of snapshot.docs) {
        const data = enrollmentDoc.data();
        const currentSubject = data.subject || 'math';
        const className = data.className || '';
        const studentId = enrollmentDoc.ref.parent.parent?.id || 'unknown';
        const inferredSubject = inferSubjectFromClassName(className);

        // 통계
        if (currentSubject === 'math') {
          newStats.math++;
        } else {
          newStats.english++;
        }

        // 수정 필요한 경우
        if (currentSubject !== inferredSubject) {
          try {
            addFixLog(`🔄 ${className} (${studentId}): ${currentSubject} → ${inferredSubject}`);

            await updateDoc(enrollmentDoc.ref, {
              subject: inferredSubject,
              updatedAt: Timestamp.now(),
              subjectFixedAt: Timestamp.now()
            });

            newStats.updated++;
          } catch (error: any) {
            const errorMsg = `${className} (${studentId}): ${error.message}`;
            addFixLog(`❌ ${errorMsg}`);
            newStats.errors.push(errorMsg);
          }
        }
      }

      setFixSubjectStats(newStats);
      addFixLog('\n✅ 수정 완료!');
      addFixLog(`📊 총 ${newStats.total}개 enrollment 확인`);
      addFixLog(`🔄 ${newStats.updated}개 영어로 수정됨`);

      if (newStats.errors.length > 0) {
        addFixLog(`⚠️ ${newStats.errors.length}개 에러 발생`);
      }

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });
      addFixLog('💡 캐시가 무효화되었습니다. 페이지를 새로고침하면 변경사항이 반영됩니다.');

    } catch (error: any) {
      addFixLog(`❌ 치명적 오류: ${error.message}`);
    } finally {
      setIsFixingSubjects(false);
    }
  };

  const migrateMathTimetable = async (stats: MigrationStats) => {
    addLog('📘 수학 시간표 마이그레이션 시작...');

    const mathClassesSnapshot = await getDocs(collection(db, '수업목록'));
    addLog(`   발견된 수학 수업: ${mathClassesSnapshot.docs.length}개`);

    // 첫 번째 문서 구조 디버깅
    if (mathClassesSnapshot.docs.length > 0) {
      const firstDoc = mathClassesSnapshot.docs[0];
      const firstData = firstDoc.data();
      addLog(`   📋 첫 번째 문서 ID: ${firstDoc.id}`);
      addLog(`   📋 문서 구조: ${JSON.stringify(Object.keys(firstData))}`);
      addLog(`   📋 전체 데이터 샘플: ${JSON.stringify(firstData).substring(0, 200)}...`);
    }

    for (const classDoc of mathClassesSnapshot.docs) {
      const classData = classDoc.data();
      // 실제 데이터는 studentIds 필드에 저장되어 있음
      const students = classData.studentIds || classData.students || [];

      addLog(`   처리 중: ${classData.className || classData.name} (학생 ${students.length}명)`);

      for (const studentName of students) {
        try {
          // students 컬렉션에 학생 문서가 없으면 생성
          const studentDocRef = doc(db, 'students', studentName);
          const studentDoc = await getDoc(studentDocRef);

          if (!studentDoc.exists()) {
            await setDoc(studentDocRef, {
              name: studentName,
              createdAt: Timestamp.now()
            });
            addLog(`   ✨ 학생 문서 생성: ${studentName}`);
          }

          // enrollment 생성 (덮어쓰기를 위해 classDoc.id 사용)
          const enrollmentRef = doc(
            db,
            `students/${studentName}/enrollments`,
            classDoc.id
          );

          // [DEBUG] Schedule Field Hunting
          let finalSchedule = classData.schedule || [];

          // 1. 공백일 경우 다른 필드 확인
          if (!finalSchedule || finalSchedule.length === 0) {
            if (classData.times && classData.times.length > 0) {
              finalSchedule = classData.times;
              addLog(`   ⚠️ 'schedule' 없음 -> 'times' 사용: ${JSON.stringify(finalSchedule)}`);
            } else if (classData.time && classData.time.length > 0) {
              finalSchedule = classData.time;
              addLog(`   ⚠️ 'schedule' 없음 -> 'time' 사용: ${JSON.stringify(finalSchedule)}`);
            } else if (classData.slots && classData.slots.length > 0) {
              finalSchedule = classData.slots;
              addLog(`   ⚠️ 'schedule' 없음 -> 'slots' 사용: ${JSON.stringify(finalSchedule)}`);
            }
          } else {
            // Schedule이 있을 때 포맷 로깅 (첫 5개만)
            if (stats.mathEnrollments < 5) {
              addLog(`   ✅ Schedule 정규 필드 발견: ${JSON.stringify(finalSchedule)}`);
            }
          }

          await setDoc(enrollmentRef, {
            subject: 'math',
            className: classData.className || classData.name || classDoc.id,
            teacherId: classData.teacher || '',
            schedule: finalSchedule,
            days: classData.days || [],
            period: classData.period || null,
            room: classData.room || null,
            startDate: classData.startDate || null,
            endDate: classData.endDate || null,
            color: classData.color || null,
            migratedAt: Timestamp.now(),
            migratedFrom: 'math_timetable',
            originalClassId: classDoc.id
          });

          stats.mathEnrollments++;
          stats.studentsProcessed.add(studentName);

        } catch (error: any) {
          const errorMsg = `수학 - ${classData.name} - ${studentName}: ${error.message}`;
          addLog(`   ❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }
    }

    addLog(`✅ 수학 마이그레이션 완료: ${stats.mathEnrollments}개 enrollment 생성`);
  };

  const migrateEnglishTimetable = async (stats: MigrationStats) => {
    addLog('📗 영어 시간표 마이그레이션 시작...');
    addLog('   ⚠️  영어 시간표는 학생 정보를 포함하지 않습니다.');
    addLog('   ℹ️  이미 생성된 students 문서에 영어 enrollment가 있는지 확인 중...');

    // 샘플로 첫 5명의 학생에서 영어 enrollment 확인
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const sampleSize = Math.min(5, studentsSnapshot.docs.length);
    let englishEnrollmentsFound = 0;

    for (let i = 0; i < sampleSize; i++) {
      const studentDoc = studentsSnapshot.docs[i];
      const enrollmentsSnapshot = await getDocs(
        collection(db, `students/${studentDoc.id}/enrollments`)
      );
      const englishCount = enrollmentsSnapshot.docs.filter(
        doc => doc.data().subject === 'english'
      ).length;
      if (englishCount > 0) {
        englishEnrollmentsFound += englishCount;
        addLog(`   ✓ ${studentDoc.id}: 영어 수업 ${englishCount}개 발견`);
      }
    }

    if (englishEnrollmentsFound > 0) {
      addLog(`   ✅ 학생들에게 이미 영어 enrollments가 존재합니다.`);
      addLog(`   💡 영어 시간표 마이그레이션은 필요하지 않습니다.`);
    } else {
      addLog(`   ⚠️  샘플 학생에게서 영어 enrollments를 찾을 수 없습니다.`);
      addLog(`   ℹ️  영어 수업은 별도로 수동 등록이 필요할 수 있습니다.`);
    }

    addLog(`✅ 영어 시간표 확인 완료`);
  };

  const handleMigrate = async () => {
    setIsRunning(true);
    setLogs([]);

    const newStats: MigrationStats = {
      mathEnrollments: 0,
      englishEnrollments: 0,
      studentsProcessed: new Set(),
      errors: []
    };

    try {
      addLog('🚀 데이터 마이그레이션 시작');
      addLog('⚠️  기존 데이터는 보존됩니다. 새로운 enrollments 컬렉션이 생성됩니다.');

      await migrateMathTimetable(newStats);
      await migrateEnglishTimetable(newStats);

      setStats(newStats);
      addLog('✅ 마이그레이션 완료!');
      addLog(`📊 총 ${newStats.mathEnrollments + newStats.englishEnrollments}개 enrollment 생성`);
      addLog(`👥 처리된 학생: ${newStats.studentsProcessed.size}명`);

      if (newStats.errors.length > 0) {
        addLog(`⚠️ ${newStats.errors.length}개 에러 발생`);
      }

    } catch (error: any) {
      addLog(`❌ 치명적 오류: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleStructure = () => {
    const newValue = !useNewStructure;
    setUseNewStructure(newValue);
    localStorage.setItem('useNewDataStructure', newValue.toString());

    // 캐시 무효화로 새로운 데이터 구조 즉시 적용
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments-as-classes'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });

    if (newValue) {
      addLog('🔄 새 데이터 구조로 전환됨 (캐시 무효화됨)');
      addLog('💡 시간표 화면을 새로고침하면 새 구조의 데이터가 표시됩니다.');
    } else {
      addLog('🔄 기존 데이터 구조로 전환됨 (캐시 무효화됨)');
      addLog('💡 시간표 화면을 새로고침하면 기존 구조의 데이터가 표시됩니다.');
    }

    // 페이지 리로드 권장 알림
    setTimeout(() => {
      if (window.confirm('데이터 구조 전환이 완료되었습니다.\n\n시간표에 즉시 반영하려면 페이지를 새로고침해야 합니다.\n\n지금 새로고침하시겠습니까?')) {
        window.location.reload();
      }
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8" />
          <h2 className="text-2xl font-bold">데이터 마이그레이션</h2>
        </div>
        <p className="text-blue-100 text-sm">
          학생 중심 데이터 구조로 전환합니다. 기존 데이터는 보존됩니다.
        </p>
      </div>

      {/* 데이터 구조 전환 토글 */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">데이터 구조 전환</h3>
            <p className="text-sm text-gray-600">
              마이그레이션 후 새 데이터 구조를 테스트할 수 있습니다
            </p>
          </div>
          <button
            onClick={handleToggleStructure}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${useNewStructure ? 'bg-green-600' : 'bg-gray-300'
              }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${useNewStructure ? 'translate-x-7' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        <div className={`p-3 rounded-lg border-2 ${useNewStructure ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2 text-sm">
            {useNewStructure ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">새 데이터 구조 사용 중</span>
                <span className="text-green-600">(students/enrollments)</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-800">기존 데이터 구조 사용 중</span>
                <span className="text-gray-600">(수업목록/english_schedules)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 마이그레이션 버튼 */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">1단계: 마이그레이션 실행</h3>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">실행 전 확인사항:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>기존 데이터는 삭제되지 않습니다</li>
                  <li>새로운 students/enrollments 컬렉션이 생성됩니다</li>
                  <li>마이그레이션 중 브라우저를 닫지 마세요</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleMigrate}
            disabled={isRunning}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                마이그레이션 진행 중...
              </>
            ) : (
              <>
                <ArrowRight className="w-5 h-5" />
                마이그레이션 시작
              </>
            )}
          </button>
        </div>
      </div>

      {/* 로그 */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">실행 로그</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      {stats && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">마이그레이션 결과</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.mathEnrollments}</div>
              <div className="text-sm text-gray-600">수학 수업</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{stats.englishEnrollments}</div>
              <div className="text-sm text-gray-600">영어 수업</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{stats.studentsProcessed.size}</div>
              <div className="text-sm text-gray-600">처리된 학생</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{stats.errors.length}</div>
              <div className="text-sm text-gray-600">에러</div>
            </div>
          </div>

          {stats.errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-red-800 mb-2">발생한 에러:</div>
              <ul className="text-xs text-red-700 space-y-1">
                {stats.errors.slice(0, 10).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
                {stats.errors.length > 10 && (
                  <li className="text-red-600 font-semibold">... 외 {stats.errors.length - 10}개</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 탭 권한 업데이트 */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-800">탭 권한 업데이트</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">새로운 탭 추가:</p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  <li><strong>수업 관리</strong> (수업 그룹) - 수업 CRUD, 학생 배정</li>
                  <li><strong>상담 관리</strong> (학생 그룹) - 재원생 학부모/학생 상담 기록</li>
                </ul>
                <p className="font-semibold mb-2">업데이트 내용:</p>
                <p>Firebase의 system/config 문서에서 tabPermissions를 업데이트하여 새로운 탭을 네비게이션에 표시합니다.</p>
                <p className="mt-2 text-blue-700 text-xs">
                  ✅ Master, Admin, Manager, Math Lead, English Lead 권한에 자동 추가됩니다.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleUpdateTabPermissions}
            className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            탭 권한 업데이트 (수업 관리, 상담 관리)
          </button>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              💡 <strong>업데이트 후:</strong> 브라우저를 새로고침(F5)하면 네비게이션에 새 탭이 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 영어 수업 Subject 수정 */}
      <div className="bg-white rounded-lg border-2 border-orange-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-6 h-6 text-orange-600" />
          <h3 className="text-lg font-bold text-gray-800">영어 수업 Subject 수정</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-orange-800">
                <p className="font-semibold mb-2">문제:</p>
                <p className="mb-3">모든 enrollments의 subject가 'math'로 저장되어 있어, 영어 수업도 수학 탭에 표시됨</p>
                <p className="font-semibold mb-2">해결:</p>
                <p className="mb-2">수업 이름(className) 패턴을 기반으로 영어 수업을 자동 감지하여 subject를 'english'로 수정</p>
                <p className="font-semibold mb-1">영어 수업 패턴:</p>
                <ul className="list-disc list-inside space-y-1 text-orange-700 text-xs ml-2">
                  <li>DP, PL, LE, RTT, RW, GR, VT로 시작</li>
                  <li>JP, KW, LT, MEC, PJ, RTS로 시작</li>
                  <li>E_ 포함 (중등E_, 고등E_, 중고E_ 등)</li>
                  <li>"초등 브릿지", "중등E", "고등E", "중고E" 포함</li>
                  <li>phonics, grammar, reading, writing 포함</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleFixEnglishSubjects}
            disabled={isFixingSubjects}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${
              isFixingSubjects
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isFixingSubjects ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                수정 진행 중...
              </>
            ) : (
              <>
                <Wrench className="w-5 h-5" />
                영어 수업 Subject 수정 시작
              </>
            )}
          </button>
        </div>
      </div>

      {/* 영어 수업 수정 로그 */}
      {fixSubjectLogs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">Subject 수정 로그</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {fixSubjectLogs.map((log, index) => (
              <div key={index} className="text-gray-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 영어 수업 수정 결과 */}
      {fixSubjectStats && (
        <div className="bg-white rounded-lg border-2 border-orange-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Subject 수정 결과</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-600">{fixSubjectStats.total}</div>
              <div className="text-sm text-gray-600">총 Enrollments</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{fixSubjectStats.math}</div>
              <div className="text-sm text-gray-600">수학</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">{fixSubjectStats.english}</div>
              <div className="text-sm text-gray-600">영어</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{fixSubjectStats.updated}</div>
              <div className="text-sm text-gray-600">수정됨</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{fixSubjectStats.errors.length}</div>
              <div className="text-sm text-gray-600">에러</div>
            </div>
          </div>

          {fixSubjectStats.errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-red-800 mb-2">발생한 에러:</div>
              <ul className="text-xs text-red-700 space-y-1">
                {fixSubjectStats.errors.slice(0, 10).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
                {fixSubjectStats.errors.length > 10 && (
                  <li className="text-red-600 font-semibold">... 외 {fixSubjectStats.errors.length - 10}개</li>
                )}
              </ul>
            </div>
          )}

          <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
            <p className="text-sm font-semibold text-yellow-800">
              💡 다음 단계: 브라우저를 새로고침하고 수업 배정 모달에서 영어/수학 탭이 올바르게 분리되었는지 확인하세요.
            </p>
          </div>
        </div>
      )}

      {/* 롤백: Enrollments만 삭제 */}
      <div className="bg-white rounded-lg border-2 border-yellow-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-6 h-6 text-yellow-600" />
          <h3 className="text-lg font-bold text-gray-800">롤백 (Enrollments만 삭제)</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-2">이 작업은:</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  <li>모든 enrollments를 삭제합니다 (학생 문서는 보존)</li>
                  <li>기존 구조(수업목록)로 돌아갈 수 있습니다</li>
                  <li>다시 마이그레이션을 실행할 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleRollback}
            disabled={isRollingBack}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${
              isRollingBack
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            {isRollingBack ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                롤백 진행 중...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Enrollments 삭제 (롤백)
              </>
            )}
          </button>
        </div>
      </div>

      {/* 롤백 로그 */}
      {rollbackLogs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">롤백 로그</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {rollbackLogs.map((log, index) => (
              <div key={index} className="text-gray-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 완전 초기화: Students 컬렉션 전체 삭제 */}
      <div className="bg-white rounded-lg border-2 border-red-300 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-bold text-gray-800">완전 초기화 (Students 컬렉션 삭제)</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-bold mb-2 text-red-900">⚠️⚠️⚠️ 위험: 되돌릴 수 없습니다! ⚠️⚠️⚠️</p>
                <p className="font-semibold mb-2">이 작업은:</p>
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  <li>모든 학생 문서를 삭제합니다</li>
                  <li>모든 enrollments를 삭제합니다</li>
                  <li>처음부터 다시 마이그레이션해야 합니다</li>
                  <li><strong>기존 데이터(수업목록)는 보존됩니다</strong></li>
                </ul>
                <p className="mt-3 font-semibold text-red-900">
                  데이터가 너무 손상되어 처음부터 다시 시작하고 싶을 때만 사용하세요.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCompleteReset}
            disabled={isResetting}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors ${
              isResetting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isResetting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                초기화 진행 중...
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5" />
                완전 초기화 (Students 컬렉션 삭제)
              </>
            )}
          </button>
        </div>
      </div>

      {/* 완전 초기화 로그 */}
      {resetLogs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">완전 초기화 로그</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {resetLogs.map((log, index) => (
              <div key={index} className="text-gray-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 다음 단계 안내 */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-3">2단계: 테스트 및 검증</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>✅ 위의 "데이터 구조 전환" 토글을 켜서 새 데이터를 테스트하세요</p>
          <p>✅ 학생 관리 탭에서 학생 목록이 정상적으로 보이는지 확인하세요</p>
          <p>✅ 시간표에서 학생 정보가 올바르게 표시되는지 확인하세요</p>
          <p>✅ 문제가 없으면 토글을 켜둔 상태로 사용하세요</p>
        </div>
      </div>
    </div>
  );
};

export default MigrationTab;
