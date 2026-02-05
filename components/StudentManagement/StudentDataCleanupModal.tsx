/**
 * StudentDataCleanupModal - 학생 데이터 정리 모달
 *
 * 기능:
 * 1. 숫자 ID 중복 학생 분석 및 삭제
 * 2. ID-이름 불일치 감지
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, AlertTriangle, Check, Database, RefreshCw, BarChart3, Users } from 'lucide-react';
import { collection, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { useQueryClient } from '@tanstack/react-query';

interface StudentDataCleanupModalProps {
  onClose: () => void;
}

interface NumericStudent {
  id: string;
  name: string;
  school: string;
  grade: string;
  status: string;
  enrollmentCount: number;
  hasSemantic: boolean;  // 시맨틱 ID가 이미 존재하는지
  semanticId: string;
}

interface AnalysisResult {
  total: number;
  numericIds: NumericStudent[];
  duplicates: NumericStudent[];     // 시맨틱 ID가 있는 숫자 ID (삭제 대상)
  uniqueNumeric: NumericStudent[];  // 시맨틱 ID가 없는 숫자 ID (유지)
}

type Step = 'analyzing' | 'ready' | 'deleting' | 'done';

const StudentDataCleanupModal: React.FC<StudentDataCleanupModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('analyzing');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [deleteResult, setDeleteResult] = useState({ deleted: 0, errors: 0 });

  // 숫자 ID 판별
  const isNumericId = (id: string): boolean => /^\d{4,6}$/.test(id);

  // 학교명 정규화 (초등학교 → 초, 중학교 → 중, 고등학교 → 고)
  const normalizeSchool = (school?: string): string => {
    if (!school) return '';
    return school.trim()
      .replace(/초등학교$/g, '초')
      .replace(/중학교$/g, '중')
      .replace(/고등학교$/g, '고');
  };

  // 학교 약칭 보정 맵 (runAnalysis에서 설정)
  const [schoolCorrections, setSchoolCorrections] = useState<Map<string, string>>(new Map());

  // 학교명 정규화 + 약칭 보정 통합
  const fullNormalizeSchool = (school: string, corrections?: Map<string, string>): string => {
    const normalized = normalizeSchool(school);
    if (corrections && corrections.has(normalized)) {
      return corrections.get(normalized)!;
    }
    return normalized;
  };

  // 시맨틱 ID 생성 (학교명 정규화 + 약칭 보정 적용)
  const toSemanticId = (student: UnifiedStudent, corrections?: Map<string, string>): string => {
    const name = (student.name || '').trim();
    const school = fullNormalizeSchool(student.school || '', corrections);
    const grade = (student.grade || '').trim();
    return `${name}_${school}_${grade}`;
  };

  // 분석 실행
  const runAnalysis = useCallback(async () => {
    setStep('analyzing');

    const studentsRef = collection(db, 'students');
    const snapshot = await getDocs(studentsRef);

    // 학교 약칭 보정 맵 생성
    const schoolCounts = new Map<string, number>();
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as UnifiedStudent;
      const idParts = docSnap.id.split('_');
      const isSemanticDocId = idParts.length >= 2 && !/^\d+$/.test(docSnap.id) && !/^[a-zA-Z0-9]{15,}$/.test(docSnap.id);
      if (isSemanticDocId) {
        const s = normalizeSchool(idParts[1]);
        if (s) schoolCounts.set(s, (schoolCounts.get(s) || 0) + 1);
      }
      const s = normalizeSchool(data.school);
      if (s) schoolCounts.set(s, (schoolCounts.get(s) || 0) + 1);
    }
    const allSchools = Array.from(schoolCounts.keys());
    const corrections = new Map<string, string>();
    for (const shortName of allSchools) {
      if (shortName.length > 2) continue; // 3자 이상은 정상 (침산초, 종로초 등)
      const matches = allSchools.filter(l => l.length > shortName.length && l.endsWith(shortName));
      if (matches.length === 1) {
        corrections.set(shortName, matches[0]);
      } else if (matches.length > 1) {
        matches.sort((a, b) => (schoolCounts.get(b) || 0) - (schoolCounts.get(a) || 0));
        corrections.set(shortName, matches[0]);
      }
    }
    setSchoolCorrections(corrections);

    const semanticIds = new Set<string>();
    const numericStudents: NumericStudent[] = [];

    // 1차: 시맨틱 ID 수집
    for (const docSnap of snapshot.docs) {
      const id = docSnap.id;
      const data = docSnap.data() as UnifiedStudent;

      if (!isNumericId(id)) {
        semanticIds.add(id);
        semanticIds.add(toSemanticId(data, corrections));
      }
    }

    // 2차: 숫자 ID 분석
    for (const docSnap of snapshot.docs) {
      const id = docSnap.id;
      if (!isNumericId(id)) continue;

      const data = docSnap.data() as UnifiedStudent;
      const semanticId = toSemanticId(data, corrections);
      const hasSemantic = semanticIds.has(semanticId);

      numericStudents.push({
        id,
        name: data.name || '',
        school: data.school || '',
        grade: data.grade || '',
        status: data.status || 'active',
        enrollmentCount: data.enrollments?.length || 0,
        hasSemantic,
        semanticId
      });
    }

    const duplicates = numericStudents.filter(s => s.hasSemantic);
    const uniqueNumeric = numericStudents.filter(s => !s.hasSemantic);

    setResult({
      total: snapshot.size,
      numericIds: numericStudents,
      duplicates,
      uniqueNumeric
    });
    setStep('ready');
  }, []);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  // 삭제 실행
  const handleDelete = async (deleteAll: boolean = false) => {
    if (!result) return;

    const toDelete = deleteAll ? result.numericIds : result.duplicates;

    if (toDelete.length === 0) {
      alert('삭제할 학생이 없습니다.');
      return;
    }

    const message = deleteAll
      ? `⚠️ 숫자 ID 학생 ${toDelete.length}명 전체를 삭제합니다.\n시맨틱 ID가 없는 학생도 삭제됩니다!`
      : `중복된 숫자 ID 학생 ${toDelete.length}명을 삭제합니다.`;

    if (!confirm(message + '\n\n정말로 진행하시겠습니까?')) {
      return;
    }

    setStep('deleting');
    setProgress({ current: 0, total: toDelete.length });

    let deleted = 0;
    let errors = 0;

    for (const student of toDelete) {
      try {
        // enrollments 서브컬렉션 삭제
        const enrollmentsRef = collection(db, 'students', student.id, 'enrollments');
        const enrollmentsSnap = await getDocs(enrollmentsRef);

        if (enrollmentsSnap.size > 0) {
          const batch = writeBatch(db);
          enrollmentsSnap.docs.forEach(enrollDoc => {
            batch.delete(enrollDoc.ref);
          });
          await batch.commit();
        }

        // 학생 문서 삭제
        await deleteDoc(doc(db, 'students', student.id));
        deleted++;
      } catch (error) {
        console.error(`삭제 오류 (${student.id}):`, error);
        errors++;
      }

      setProgress({ current: deleted + errors, total: toDelete.length });
    }

    // 캐시 무효화
    queryClient.invalidateQueries({ queryKey: ['students'] });

    setDeleteResult({ deleted, errors });
    setStep('done');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
      <div
        className="bg-white rounded-sm shadow-2xl w-[650px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-primary text-white rounded-t-sm">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <h3 className="font-bold">학생 데이터 정리</h3>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'deleting'}
            className="text-white/70 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Analyzing */}
          {step === 'analyzing' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-gray-600">학생 데이터 분석 중...</p>
            </div>
          )}

          {/* Ready */}
          {step === 'ready' && result && (
            <>
              {/* Section: 통계 요약 */}
              <div className="border-b border-gray-200">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-bold text-gray-700">통계 요약</h4>
                </div>
                <div className="px-4 py-3">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{result.total}</div>
                      <div className="text-xs text-gray-500">전체 학생</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{result.numericIds.length}</div>
                      <div className="text-xs text-gray-500">숫자 ID</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{result.duplicates.length}</div>
                      <div className="text-xs text-gray-500">중복 (삭제 대상)</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{result.uniqueNumeric.length}</div>
                      <div className="text-xs text-gray-500">고유 숫자 ID</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: 중복 학생 목록 */}
              <div className="flex-1 overflow-y-auto">
                {result.duplicates.length > 0 && (
                  <div className="border-b border-gray-200">
                    <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <h4 className="text-sm font-bold text-red-700">
                        삭제 대상: 시맨틱 ID가 이미 존재하는 숫자 ID 학생
                      </h4>
                    </div>
                    <div className="p-4">
                      <div className="border rounded-sm overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1.5 text-left">숫자 ID</th>
                              <th className="px-2 py-1.5 text-left">이름</th>
                              <th className="px-2 py-1.5 text-left">학교</th>
                              <th className="px-2 py-1.5 text-left">학년</th>
                              <th className="px-2 py-1.5 text-center">수강</th>
                              <th className="px-2 py-1.5 text-left">원본 ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.duplicates.slice(0, 50).map(s => (
                              <tr key={s.id} className="border-t hover:bg-red-50">
                                <td className="px-2 py-1.5 font-mono text-red-600">{s.id}</td>
                                <td className="px-2 py-1.5">{s.name}</td>
                                <td className="px-2 py-1.5">{s.school}</td>
                                <td className="px-2 py-1.5">{s.grade}</td>
                                <td className="px-2 py-1.5 text-center">{s.enrollmentCount}</td>
                                <td className="px-2 py-1.5 text-gray-500 truncate max-w-[150px]">
                                  {s.semanticId}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.duplicates.length > 50 && (
                          <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 text-center">
                            ... 외 {result.duplicates.length - 50}명
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {result.duplicates.length === 0 && (
                  <div className="border-b border-gray-200">
                    <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <h4 className="text-sm font-bold text-green-700">삭제 대상 없음</h4>
                    </div>
                    <div className="p-4 text-center text-gray-500">
                      <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p>삭제할 중복 학생이 없습니다.</p>
                    </div>
                  </div>
                )}

                {/* Section: 고유 숫자 ID 학생 */}
                {result.uniqueNumeric.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <h4 className="text-sm font-bold text-green-700">
                        유지될 학생: 시맨틱 ID가 없는 숫자 ID ({result.uniqueNumeric.length}명)
                      </h4>
                    </div>
                    <div className="p-4">
                      <div className="border rounded-sm overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1.5 text-left">숫자 ID</th>
                              <th className="px-2 py-1.5 text-left">이름</th>
                              <th className="px-2 py-1.5 text-left">학교</th>
                              <th className="px-2 py-1.5 text-left">학년</th>
                              <th className="px-2 py-1.5 text-center">수강</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.uniqueNumeric.slice(0, 20).map(s => (
                              <tr key={s.id} className="border-t hover:bg-green-50">
                                <td className="px-2 py-1.5 font-mono text-green-600">{s.id}</td>
                                <td className="px-2 py-1.5">{s.name}</td>
                                <td className="px-2 py-1.5">{s.school}</td>
                                <td className="px-2 py-1.5">{s.grade}</td>
                                <td className="px-2 py-1.5 text-center">{s.enrollmentCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.uniqueNumeric.length > 20 && (
                          <div className="px-2 py-1.5 bg-gray-50 text-xs text-gray-500 text-center">
                            ... 외 {result.uniqueNumeric.length - 20}명
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => runAnalysis()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  다시 분석
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    닫기
                  </button>
                  {result.uniqueNumeric.length > 0 && (
                    <button
                      onClick={() => handleDelete(true)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-sm text-sm font-bold hover:bg-orange-600 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      숫자 ID 전체 삭제 ({result.numericIds.length})
                    </button>
                  )}
                  {result.duplicates.length > 0 && (
                    <button
                      onClick={() => handleDelete(false)}
                      className="px-4 py-2 bg-red-500 text-white rounded-sm text-sm font-bold hover:bg-red-600 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      중복만 삭제 ({result.duplicates.length})
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Deleting */}
          {step === 'deleting' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
              <div className="w-64 h-2 bg-gray-200 rounded-sm overflow-hidden mb-3">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">삭제 중...</p>
              <p className="text-xs text-gray-400">{progress.current} / {progress.total}</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-sm flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-primary mb-4">삭제 완료!</h4>
              <div className="text-center space-y-1 text-sm text-gray-600 mb-6">
                <p>삭제된 학생: <strong className="text-red-600">{deleteResult.deleted}</strong>명</p>
                {deleteResult.errors > 0 && (
                  <p>오류: <strong className="text-orange-600">{deleteResult.errors}</strong>건</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-accent text-primary rounded-sm text-sm font-bold hover:bg-[#e5a711]"
              >
                완료
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDataCleanupModal;
