/**
 * 영어 수업 subject 수정 페이지
 *
 * 사용법:
 * 1. 앱에서 /fix-english-subjects 경로로 이동
 * 2. "수정 시작" 버튼 클릭
 * 3. 결과 확인 후 페이지 새로고침
 */

import { useState } from 'react';
import { ClipboardList, BarChart3, FileText } from 'lucide-react';
import { collectionGroup, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

interface Stats {
  total: number;
  math: number;
  english: number;
  updated: number;
  errors: string[];
}

const FixEnglishSubjects = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const inferSubject = (className: string): 'math' | 'english' => {
    const englishPatterns = [
      /^DP/, /^PL/, /^LE/, /^RTT/, /^RW/, /^GR/, /^VT/,
      /^E_/, /phonics/i, /grammar/i, /reading/i, /writing/i,
      /초등\s*브릿지/, /중등E/,
    ];

    for (const pattern of englishPatterns) {
      if (pattern.test(className)) {
        return 'english';
      }
    }

    return 'math';
  };

  const handleFix = async () => {
    setIsRunning(true);
    setLogs([]);

    const newStats: Stats = {
      total: 0,
      math: 0,
      english: 0,
      updated: 0,
      errors: []
    };

    try {
      addLog('🚀 영어 수업 subject 수정 시작');
      addLog('enrollments 조회 중...');

      const snapshot = await getDocs(collectionGroup(db, 'enrollments'));
      newStats.total = snapshot.docs.length;
      addLog(`✅ 발견: ${newStats.total}개\n`);

      for (const enrollmentDoc of snapshot.docs) {
        const data = enrollmentDoc.data();
        const currentSubject = data.subject || 'math';
        const className = data.className || '';
        const studentId = enrollmentDoc.ref.parent.parent?.id || 'unknown';
        const inferredSubject = inferSubject(className);

        // 통계
        if (currentSubject === 'math') {
          newStats.math++;
        } else {
          newStats.english++;
        }

        // 수정 필요한 경우
        if (currentSubject !== inferredSubject) {
          try {
            addLog(`🔄 ${className} (${studentId}): ${currentSubject} → ${inferredSubject}`);

            await updateDoc(enrollmentDoc.ref, {
              subject: inferredSubject,
              updatedAt: Timestamp.now(),
              subjectFixedAt: Timestamp.now()
            });

            newStats.updated++;
          } catch (error: any) {
            const errorMsg = `${className} (${studentId}): ${error.message}`;
            addLog(`❌ ${errorMsg}`);
            newStats.errors.push(errorMsg);
          }
        }
      }

      addLog('\n✅ 수정 완료!');
      setStats(newStats);

    } catch (error: any) {
      addLog(`❌ 오류: ${error.message}`);
      console.error('오류:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-sm shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-4">영어 수업 Subject 수정</h1>

          <div className="mb-6 p-4 bg-blue-50 rounded">
            <p className="text-sm text-gray-700 mb-2">
              <strong>문제:</strong> 모든 enrollments의 subject가 'math'로 저장되어 있음
            </p>
            <p className="text-sm text-gray-700">
              <strong>해결:</strong> className 패턴을 기반으로 영어 수업을 자동 감지하여 subject 수정
            </p>
          </div>

          <div className="mb-6">
            <h2 className="font-semibold mb-2">영어 수업 패턴:</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>DP, PL, LE, RTT, RW, GR, VT로 시작</li>
              <li>E_로 시작</li>
              <li>"초등 브릿지", "중등E" 포함</li>
              <li>phonics, grammar, reading, writing 포함</li>
            </ul>
          </div>

          <button
            onClick={handleFix}
            disabled={isRunning}
            className={`px-6 py-3 rounded-sm font-semibold ${
              isRunning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRunning ? '실행 중...' : '수정 시작'}
          </button>

          {stats && (
            <div className="mt-6 p-4 bg-gray-100 rounded">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                결과
              </h2>
              <div className="space-y-1 text-sm">
                <p>총 enrollments: <strong>{stats.total}개</strong></p>
                <p>수학 (math): <strong>{stats.math}개</strong></p>
                <p>영어 (english): <strong>{stats.english}개</strong></p>
                <p className="text-green-600 font-semibold">
                  영어로 수정됨: <strong>{stats.updated}개</strong>
                </p>
                <p className="text-red-600">
                  에러: <strong>{stats.errors.length}개</strong>
                </p>
              </div>

              {stats.errors.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-red-600 mb-2">⚠️ 에러 목록:</h3>
                  <ul className="text-xs space-y-1">
                    {stats.errors.map((error, index) => (
                      <li key={index} className="text-red-600">
                        {index + 1}. {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 p-3 bg-yellow-50 rounded">
                <p className="text-sm font-semibold text-yellow-800">
                  💡 다음 단계: 브라우저를 새로고침하고 수업 배정 모달에서 확인하세요.
                </p>
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                로그
              </h2>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FixEnglishSubjects;
