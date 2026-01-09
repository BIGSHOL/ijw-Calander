import React, { useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { db } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';

interface MigrationStats {
  mathEnrollments: number;
  englishEnrollments: number;
  studentsProcessed: Set<string>;
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

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
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
