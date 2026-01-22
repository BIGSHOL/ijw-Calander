/**
 * 출결번호 일괄 생성 마이그레이션 모달
 * - 기존 학생들의 출결번호를 자동 생성하여 업데이트
 * - 학부모 전화번호 뒤 4자리 기반 생성
 */

import React, { useState } from 'react';
import { Hash, X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { generateBulkAttendanceNumbers } from '../../utils/attendanceNumberGenerator';

interface AttendanceNumberMigrationModalProps {
  onClose: () => void;
  onComplete?: () => void;
}

const AttendanceNumberMigrationModal: React.FC<AttendanceNumberMigrationModalProps> = ({
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<'confirm' | 'migrating' | 'done'>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [totalStudents, setTotalStudents] = useState(0);
  const [studentsWithoutAttendance, setStudentsWithoutAttendance] = useState(0);
  const [generatedNumbers, setGeneratedNumbers] = useState<Map<string, string>>(new Map());

  // 미리보기: 출결번호 생성 시뮬레이션
  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);

      if (snapshot.empty) {
        throw new Error('학생 데이터가 없습니다.');
      }

      const students = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        parentPhone: docSnap.data().parentPhone,
        attendanceNumber: docSnap.data().attendanceNumber,
        name: docSnap.data().name,
      }));

      setTotalStudents(students.length);

      const withoutAttendance = students.filter(s => !s.attendanceNumber);
      setStudentsWithoutAttendance(withoutAttendance.length);

      if (withoutAttendance.length === 0) {
        setError('모든 학생에게 이미 출결번호가 설정되어 있습니다.');
        setLoading(false);
        return;
      }

      // 출결번호 생성 미리보기
      const numberMap = generateBulkAttendanceNumbers(students);
      setGeneratedNumbers(numberMap);

      setLoading(false);
    } catch (err: any) {
      console.error('미리보기 오류:', err);
      setError(err.message || '미리보기 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 마이그레이션 실행
  const handleMigrate = async () => {
    if (studentsWithoutAttendance === 0) return;

    setStep('migrating');
    setProgress(0);

    try {
      const studentsRef = collection(db, 'students');
      const snapshot = await getDocs(studentsRef);

      const students = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        parentPhone: docSnap.data().parentPhone,
        attendanceNumber: docSnap.data().attendanceNumber,
      }));

      // 출결번호 생성
      const attendanceNumberMap = generateBulkAttendanceNumbers(students);

      // Firestore 배치 업데이트
      const batchSize = 500;
      const studentIds = Array.from(attendanceNumberMap.keys());
      const batches = Math.ceil(studentIds.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = writeBatch(db);
        const start = i * batchSize;
        const end = Math.min(start + batchSize, studentIds.length);
        const batchIds = studentIds.slice(start, end);

        batchIds.forEach(studentId => {
          const attendanceNumber = attendanceNumberMap.get(studentId);
          // 기존에 출결번호가 없는 학생만 업데이트
          const student = students.find(s => s.id === studentId);
          if (attendanceNumber && !student?.attendanceNumber) {
            const docRef = doc(studentsRef, studentId);
            batch.update(docRef, {
              attendanceNumber,
              updatedAt: new Date().toISOString(),
            });
          }
        });

        await batch.commit();
        setProgress(Math.round(((i + 1) / batches) * 100));
      }

      setStep('done');
      onComplete?.();
    } catch (err: any) {
      console.error('마이그레이션 오류:', err);
      setError(`마이그레이션 중 오류 발생: ${err.message}`);
      setStep('confirm');
    }
  };

  // 컴포넌트 마운트 시 미리보기 자동 실행
  React.useEffect(() => {
    handlePreview();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-[#081429] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Hash size={20} className="text-[#fdb813]" />
            출결번호 일괄 생성
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">오류</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* 1단계: 확인 및 미리보기 */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-[#fdb813] mx-auto mb-3" />
                  <p className="text-gray-600">학생 데이터 분석 중...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">총 학생 수</div>
                      <div className="text-2xl font-bold text-gray-900">{totalStudents}명</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm">
                      <div className="text-sm text-yellow-700 mb-1">출결번호 미설정</div>
                      <div className="text-2xl font-bold text-yellow-700">{studentsWithoutAttendance}명</div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">📋 출결번호 생성 규칙:</p>
                    <ul className="text-sm text-blue-800 space-y-1 ml-4">
                      <li>• 학부모 전화번호 뒤 4자리 사용</li>
                      <li>• 중복 시 끝에 1, 2, 3... 자동 추가</li>
                      <li>• 전화번호 없으면 랜덤 4자리 생성</li>
                      <li>• 기존 출결번호는 유지됨</li>
                    </ul>
                  </div>

                  {studentsWithoutAttendance > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700 font-medium mb-3">
                        생성될 출결번호 샘플 (처음 10명):
                      </p>
                      <div className="space-y-1 text-xs">
                        {Array.from(generatedNumbers.entries())
                          .slice(0, 10)
                          .map(([id, number], idx) => (
                            <div key={id} className="flex items-center gap-2 text-gray-600">
                              <span className="text-gray-400">{idx + 1}.</span>
                              <span className="font-mono font-bold text-[#fdb813]">{number}</span>
                              <span className="text-gray-400">({id})</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ 주의사항:</p>
                    <ul className="text-sm text-yellow-700 space-y-1 ml-4">
                      <li>• 이미 출결번호가 있는 학생은 변경되지 않습니다</li>
                      <li>• 생성된 출결번호는 학생 식별용으로 사용됩니다</li>
                      <li>• 실행 후 되돌릴 수 없으니 신중히 결정하세요</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2단계: 마이그레이션 중 */}
          {step === 'migrating' && (
            <div className="text-center space-y-6">
              <Loader2 className="w-16 h-16 animate-spin text-[#fdb813] mx-auto" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">출결번호 생성 중...</h3>
                <p className="text-gray-600 text-sm">잠시만 기다려주세요.</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#fdb813] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{progress}% 완료</p>
            </div>
          )}

          {/* 3단계: 완료 */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[#081429]">출결번호 생성 완료!</h3>
                <p className="text-gray-600 mt-2">
                  <span className="text-green-600 font-bold">{studentsWithoutAttendance}명</span>의 학생에게 출결번호가 생성되었습니다.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                <p className="text-sm text-green-700 font-medium mb-2">✅ 완료 사항:</p>
                <ul className="text-sm text-green-600 space-y-1 ml-4">
                  <li>• 총 {totalStudents}명 중 {studentsWithoutAttendance}명 출결번호 생성</li>
                  <li>• 기존 출결번호 {totalStudents - studentsWithoutAttendance}명 유지</li>
                  <li>• 중복 방지 처리 완료</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {step === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleMigrate}
                disabled={loading || studentsWithoutAttendance === 0}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-bold ${
                  loading || studentsWithoutAttendance === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#fdb813] text-[#081429] hover:bg-[#fdb813]/90'
                }`}
              >
                <Hash size={16} />
                {studentsWithoutAttendance}명 출결번호 생성
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#081429] text-white hover:bg-[#081429]/90 rounded-lg transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceNumberMigrationModal;
