/**
 * 학생 문서 ID 정규화 모달
 * - Firebase 자동 생성 ID를 이름_학교_학년 형식으로 변환
 * - 이미 올바른 ID가 존재하면 중복 문서 삭제
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2, CheckCircle, Trash2, ArrowRight } from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';

interface NormalizeStudentIdsModalProps {
  onClose: () => void;
}

type MigrationAction = 'DELETE' | 'MOVE';

interface MigrationItem {
  oldId: string;
  newId: string;
  studentName: string;
  school: string;
  grade: string;
  action: MigrationAction;
  hasConsultations: number;
}

interface AnalysisResult {
  total: number;
  alreadyCorrect: number;
  toDelete: MigrationItem[];
  toMove: MigrationItem[];
}

/**
 * 문서 ID가 이름_학교_학년 형식인지 확인
 * - 한글+영문+숫자 이름 지원 (예: 김규민A, 이수진B)
 * - 최소 2개의 _ 구분자가 있어야 함
 */
function isValidDocIdFormat(docId: string): boolean {
  // 이름_학교_학년 형식: 최소 2개의 언더스코어가 있고, 한글로 시작
  const pattern = /^[가-힣][가-힣A-Za-z0-9]*_[^_]+_[^_]+$/;
  return pattern.test(docId);
}

/**
 * 학생 데이터로 새 문서 ID 생성
 */
function generateNewDocId(student: UnifiedStudent): string {
  const name = student.name || '미상';
  const school = student.school || '미정';
  const grade = student.grade || '0';
  return `${name}_${school}_${grade}`;
}

const NormalizeStudentIdsModal: React.FC<NormalizeStudentIdsModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<'analyzing' | 'preview' | 'executing' | 'done'>('analyzing');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 분석 실행
  useEffect(() => {
    analyzeStudents();
  }, []);

  const analyzeStudents = async () => {
    try {
      setStep('analyzing');
      setError(null);

      // 1. 모든 학생 조회
      const studentsRef = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsRef);

      // 2. 정상 ID 목록 수집
      const existingCorrectIds = new Set<string>();
      const alreadyCorrectList: string[] = [];

      for (const docSnap of studentsSnapshot.docs) {
        if (isValidDocIdFormat(docSnap.id)) {
          existingCorrectIds.add(docSnap.id);
          alreadyCorrectList.push(docSnap.id);
        }
      }

      // 3. 변환 필요한 목록 생성
      const migrationList: MigrationItem[] = [];

      for (const docSnap of studentsSnapshot.docs) {
        const student = docSnap.data() as UnifiedStudent;
        const oldId = docSnap.id;

        if (isValidDocIdFormat(oldId)) continue;

        const newId = generateNewDocId(student);

        // oldId와 newId가 동일하면 변환 불필요 (이미 올바른 형식)
        if (oldId === newId) continue;

        if (existingCorrectIds.has(newId)) {
          migrationList.push({
            oldId,
            newId,
            studentName: student.name,
            school: student.school || '',
            grade: student.grade || '',
            action: 'DELETE',
            hasConsultations: 0
          });
        } else {
          existingCorrectIds.add(newId);
          migrationList.push({
            oldId,
            newId,
            studentName: student.name,
            school: student.school || '',
            grade: student.grade || '',
            action: 'MOVE',
            hasConsultations: 0
          });
        }
      }

      // 4. 상담 기록 확인
      const consultationsRef = collection(db, 'student_consultations');
      const consultationsSnapshot = await getDocs(consultationsRef);

      const consultationsByStudentId = new Map<string, string[]>();
      consultationsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.studentId) {
          const list = consultationsByStudentId.get(data.studentId) || [];
          list.push(docSnap.id);
          consultationsByStudentId.set(data.studentId, list);
        }
      });

      for (const item of migrationList) {
        item.hasConsultations = (consultationsByStudentId.get(item.oldId) || []).length;
      }

      setAnalysis({
        total: studentsSnapshot.size,
        alreadyCorrect: alreadyCorrectList.length,
        toDelete: migrationList.filter(m => m.action === 'DELETE'),
        toMove: migrationList.filter(m => m.action === 'MOVE'),
      });

      setStep('preview');
    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다.');
    }
  };

  const executeNormalization = async () => {
    if (!analysis) return;

    try {
      setStep('executing');
      setProgress(0);

      const allItems = [...analysis.toDelete, ...analysis.toMove];
      if (allItems.length === 0) {
        setStep('done');
        return;
      }

      // 학생 데이터 다시 로드 (최신 상태)
      const studentsRef = collection(db, 'students');
      const studentsSnapshot = await getDocs(studentsRef);
      const studentsMap = new Map<string, any>();
      studentsSnapshot.forEach(docSnap => {
        studentsMap.set(docSnap.id, docSnap.data());
      });

      // 상담 기록 로드
      const consultationsRef = collection(db, 'student_consultations');
      const consultationsSnapshot = await getDocs(consultationsRef);
      const consultationsByStudentId = new Map<string, string[]>();
      consultationsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.studentId) {
          const list = consultationsByStudentId.get(data.studentId) || [];
          list.push(docSnap.id);
          consultationsByStudentId.set(data.studentId, list);
        }
      });

      // 배치 처리
      const BATCH_SIZE = 400; // 상담 기록 업데이트도 있으므로 여유있게
      let processed = 0;

      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = allItems.slice(i, Math.min(i + BATCH_SIZE, allItems.length));

        for (const item of chunk) {
          const oldDocRef = doc(db, 'students', item.oldId);
          const consultationIds = consultationsByStudentId.get(item.oldId) || [];

          if (item.action === 'DELETE') {
            // 중복 문서 삭제
            batch.delete(oldDocRef);

            // 상담 기록 studentId 업데이트
            for (const consultationId of consultationIds) {
              const consultationRef = doc(db, 'student_consultations', consultationId);
              batch.update(consultationRef, {
                studentId: item.newId,
                _studentIdMigratedFrom: item.oldId,
              });
            }
          } else {
            // 새 ID로 이동
            const studentData = studentsMap.get(item.oldId);
            if (!studentData) continue;

            const newDocRef = doc(db, 'students', item.newId);
            batch.set(newDocRef, {
              ...studentData,
              id: item.newId,
              updatedAt: new Date().toISOString(),
              _migratedFrom: item.oldId,
            });

            batch.delete(oldDocRef);

            // 상담 기록 업데이트
            for (const consultationId of consultationIds) {
              const consultationRef = doc(db, 'student_consultations', consultationId);
              batch.update(consultationRef, {
                studentId: item.newId,
                _studentIdMigratedFrom: item.oldId,
              });
            }
          }

          processed++;
        }

        await batch.commit();
        setProgress(Math.round((processed / allItems.length) * 100));
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message || '실행 중 오류가 발생했습니다.');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-[#081429] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-[#fdb813]" />
            학생 문서 ID 정규화
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 분석 중 */}
          {step === 'analyzing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-[#081429] animate-spin mx-auto mb-4" />
              <p className="text-gray-600">학생 데이터 분석 중...</p>
            </div>
          )}

          {/* 미리보기 */}
          {step === 'preview' && analysis && (
            <div className="space-y-6">
              {/* 요약 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#081429]">{analysis.total}</div>
                  <div className="text-xs text-gray-500">전체 문서</div>
                  <div className="text-[10px] text-gray-400">(퇴원생 포함)</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{analysis.alreadyCorrect}</div>
                  <div className="text-xs text-gray-500">정상 ID</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{analysis.toDelete.length}</div>
                  <div className="text-xs text-gray-500">삭제 (중복)</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{analysis.toMove.length}</div>
                  <div className="text-xs text-gray-500">ID 변환</div>
                </div>
              </div>

              {/* 삭제 대상 */}
              {analysis.toDelete.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                    <Trash2 size={16} />
                    삭제 대상 (이미 올바른 ID가 존재하는 중복 문서)
                  </h3>
                  <div className="bg-red-50 rounded-lg border border-red-200 max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-red-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">이름</th>
                          <th className="px-3 py-2 text-left">학교</th>
                          <th className="px-3 py-2 text-left">학년</th>
                          <th className="px-3 py-2 text-center">상담</th>
                          <th className="px-3 py-2 text-left">삭제될 ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.toDelete.map((item, idx) => (
                          <tr key={idx} className="border-t border-red-200">
                            <td className="px-3 py-2">{item.studentName}</td>
                            <td className="px-3 py-2">{item.school || '-'}</td>
                            <td className="px-3 py-2">{item.grade || '-'}</td>
                            <td className="px-3 py-2 text-center">{item.hasConsultations}건</td>
                            <td className="px-3 py-2 font-mono text-xs break-all">{item.oldId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 이동 대상 */}
              {analysis.toMove.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
                    <ArrowRight size={16} />
                    ID 변환 대상
                  </h3>
                  <div className="bg-blue-50 rounded-lg border border-blue-200 max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">이름</th>
                          <th className="px-3 py-2 text-left">학교</th>
                          <th className="px-3 py-2 text-left">학년</th>
                          <th className="px-3 py-2 text-center">상담</th>
                          <th className="px-3 py-2 text-left">변환</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.toMove.map((item, idx) => (
                          <tr key={idx} className="border-t border-blue-200">
                            <td className="px-3 py-2">{item.studentName}</td>
                            <td className="px-3 py-2">{item.school || '-'}</td>
                            <td className="px-3 py-2">{item.grade || '-'}</td>
                            <td className="px-3 py-2 text-center">{item.hasConsultations}건</td>
                            <td className="px-3 py-2 font-mono text-xs break-all">
                              {item.oldId} → {item.newId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {analysis.toDelete.length === 0 && analysis.toMove.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900">모든 학생 ID가 이미 올바른 형식입니다!</p>
                </div>
              )}
            </div>
          )}

          {/* 실행 중 */}
          {step === 'executing' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-[#081429] animate-spin mx-auto mb-4" />
              <p className="text-gray-600 mb-4">정규화 실행 중...</p>
              <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#fdb813] h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">{progress}%</p>
            </div>
          )}

          {/* 완료 */}
          {step === 'done' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-xl font-bold text-gray-900 mb-2">정규화 완료!</p>
              <p className="text-gray-600">
                {analysis?.toDelete.length || 0}개 중복 문서 삭제, {analysis?.toMove.length || 0}개 ID 변환 완료
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          {step === 'preview' && analysis && (analysis.toDelete.length > 0 || analysis.toMove.length > 0) && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                취소
              </button>
              <button
                onClick={executeNormalization}
                className="px-6 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#081429]/90 font-medium"
              >
                정규화 실행
              </button>
            </>
          )}
          {(step === 'done' || (step === 'preview' && analysis && analysis.toDelete.length === 0 && analysis.toMove.length === 0)) && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#081429]/90 font-medium"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NormalizeStudentIdsModal;
