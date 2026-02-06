/**
 * StudentDataCleanupModal - 학생 데이터 정리 모달
 *
 * 기능:
 * 1. 숫자 ID 중복 학생 분석 및 삭제
 * 2. 미수강 + 이력없는 학생 일괄 삭제
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Trash2, AlertTriangle, Check, Database, RefreshCw, BarChart3, Users, UserMinus } from 'lucide-react';
import { collection, collectionGroup, getDocs, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { useQueryClient } from '@tanstack/react-query';

type TabType = 'numericId' | 'noHistory';

interface StudentDataCleanupModalProps {
  onClose: () => void;
  students?: UnifiedStudent[]; // 미수강 탭용
  initialTab?: TabType; // 초기 탭 지정
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

const StudentDataCleanupModal: React.FC<StudentDataCleanupModalProps> = ({ onClose, students = [], initialTab = 'numericId' }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [step, setStep] = useState<Step>('analyzing');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [deleteResult, setDeleteResult] = useState({ deleted: 0, errors: 0 });

  // ── 미수강 이력없는 학생 탭 상태 ──
  const [noHistoryStudents, setNoHistoryStudents] = useState<UnifiedStudent[]>([]);
  const [noHistoryChecked, setNoHistoryChecked] = useState<Set<string>>(new Set());
  const [noHistoryStep, setNoHistoryStep] = useState<Step>('analyzing');
  const [noHistoryProgress, setNoHistoryProgress] = useState({ current: 0, total: 0 });
  const [noHistoryDeleteResult, setNoHistoryDeleteResult] = useState({ deleted: 0, errors: 0 });

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
    if (activeTab === 'numericId') {
      runAnalysis();
    }
  }, [runAnalysis, activeTab]);

  // ── 미수강 이력없는 학생 분석 (Firestore 직접 조회) ──
  useEffect(() => {
    if (activeTab !== 'noHistory') return;
    setNoHistoryStep('analyzing');

    (async () => {
      try {
        // collectionGroup으로 모든 enrollments를 직접 조회하여 학생 ID 수집
        const enrollSnap = await getDocs(collectionGroup(db, 'enrollments'));
        const studentsWithEnrollment = new Set<string>();
        enrollSnap.docs.forEach(d => {
          // 경로: students/{studentId}/enrollments/{enrollmentId}
          const parts = d.ref.path.split('/');
          if (parts.length >= 2) studentsWithEnrollment.add(parts[1]);
        });

        // 퇴원 아닌 학생 중 enrollment가 하나도 없는 학생만 필터
        const noHistory = students.filter(s =>
          s.status !== 'withdrawn' && !studentsWithEnrollment.has(s.id)
        );
        setNoHistoryStudents(noHistory);
        setNoHistoryChecked(new Set(noHistory.map(s => s.id)));
        setNoHistoryStep('ready');
      } catch (err) {
        console.error('Failed to analyze enrollments:', err);
        setNoHistoryStep('ready');
      }
    })();
  }, [activeTab, students]);

  const handleNoHistoryDelete = async () => {
    const toDelete = noHistoryStudents.filter(s => noHistoryChecked.has(s.id));
    if (toDelete.length === 0) {
      alert('삭제할 학생이 없습니다.');
      return;
    }
    if (!confirm(`⚠️ 수업 이력이 없는 학생 ${toDelete.length}명을 완전히 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다.`)) return;
    if (!confirm(`정말로 ${toDelete.length}명을 삭제하시겠습니까?`)) return;

    setNoHistoryStep('deleting');
    setNoHistoryProgress({ current: 0, total: toDelete.length });

    let deleted = 0;
    let errors = 0;

    // 500개씩 배치 처리
    const BATCH_SIZE = 500;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const chunk = toDelete.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const s of chunk) {
        batch.delete(doc(db, 'students', s.id));
      }
      try {
        await batch.commit();
        deleted += chunk.length;
      } catch (error) {
        console.error('배치 삭제 오류:', error);
        // 개별 삭제 시도
        for (const s of chunk) {
          try {
            await deleteDoc(doc(db, 'students', s.id));
            deleted++;
          } catch {
            errors++;
          }
        }
      }
      setNoHistoryProgress({ current: deleted + errors, total: toDelete.length });
    }

    queryClient.invalidateQueries({ queryKey: ['students'] });
    setNoHistoryDeleteResult({ deleted, errors });
    setNoHistoryStep('done');
  };

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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('numericId')}
            className={`flex-1 px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'numericId'
                ? 'text-primary border-b-2 border-accent bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            숫자 ID 정리
          </button>
          <button
            onClick={() => setActiveTab('noHistory')}
            className={`flex-1 px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'noHistory'
                ? 'text-primary border-b-2 border-accent bg-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <UserMinus className="w-3.5 h-3.5" />
            미수강 이력없는 학생
            {noHistoryStep === 'ready' && noHistoryStudents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">
                {noHistoryStudents.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ═══════ 숫자 ID 탭 ═══════ */}
          {activeTab === 'numericId' && <>

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

          </>}

          {/* ═══════ 미수강 이력없는 학생 탭 ═══════ */}
          {activeTab === 'noHistory' && <>

          {noHistoryStep === 'analyzing' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-gray-600">학생 데이터 분석 중...</p>
            </div>
          )}

          {noHistoryStep === 'ready' && (
            <>
              {/* 요약 */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{students.filter(s => s.status !== 'withdrawn').length}</div>
                    <div className="text-xs text-gray-500">재원생</div>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{noHistoryStudents.length}</div>
                    <div className="text-xs text-gray-500">이력 없음</div>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{noHistoryChecked.size}</div>
                    <div className="text-xs text-gray-500">삭제 선택</div>
                  </div>
                </div>
                {noHistoryStudents.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">수업 배정 이력이 한 번도 없는 재원 학생입니다.</p>
                )}
              </div>

              {/* 학생 목록 */}
              <div className="flex-1 overflow-y-auto">
                {noHistoryStudents.length > 0 ? (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setNoHistoryChecked(new Set(noHistoryStudents.map(s => s.id)))}
                        className="text-xs px-2 py-1 rounded-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        전체 선택
                      </button>
                      <button
                        onClick={() => setNoHistoryChecked(new Set())}
                        className="text-xs px-2 py-1 rounded-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        전체 해제
                      </button>
                    </div>
                    <div className="border rounded-sm overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 w-8">
                              <input
                                type="checkbox"
                                checked={noHistoryChecked.size === noHistoryStudents.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNoHistoryChecked(new Set(noHistoryStudents.map(s => s.id)));
                                  } else {
                                    setNoHistoryChecked(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-2 py-1.5 text-left">이름</th>
                            <th className="px-2 py-1.5 text-left">학교</th>
                            <th className="px-2 py-1.5 text-left">학년</th>
                            <th className="px-2 py-1.5 text-left">상태</th>
                            <th className="px-2 py-1.5 text-left">등록일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {noHistoryStudents.map(s => (
                            <tr key={s.id} className={`border-t hover:bg-red-50 ${noHistoryChecked.has(s.id) ? 'bg-red-50/50' : ''}`}>
                              <td className="px-2 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={noHistoryChecked.has(s.id)}
                                  onChange={(e) => {
                                    const next = new Set(noHistoryChecked);
                                    if (e.target.checked) next.add(s.id); else next.delete(s.id);
                                    setNoHistoryChecked(next);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-2 py-1.5 font-medium">{s.name}</td>
                              <td className="px-2 py-1.5 text-gray-600">
                                {(s.school || '').replace('초등학교', '초').replace('중학교', '중').replace('고등학교', '고')}
                              </td>
                              <td className="px-2 py-1.5">{s.grade || '-'}</td>
                              <td className="px-2 py-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  s.status === 'active' ? 'bg-green-100 text-green-700' :
                                  s.status === 'on_hold' ? 'bg-yellow-100 text-yellow-700' :
                                  s.status === 'prospect' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {s.status === 'active' ? '재원' : s.status === 'on_hold' ? '휴원' : s.status === 'prospect' || s.status === 'prospective' ? '예비' : (s.status as string) === 'pending' ? '미확인' : s.status || '미지정'}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-400">
                                {s.startDate ? new Date(s.startDate).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-12">
                    <Check className="w-12 h-12 text-green-500 mb-2" />
                    <p className="text-gray-500">이력 없는 학생이 없습니다.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {noHistoryStudents.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {noHistoryChecked.size}명 선택됨
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 border border-gray-300 rounded-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      닫기
                    </button>
                    <button
                      onClick={handleNoHistoryDelete}
                      disabled={noHistoryChecked.size === 0}
                      className="px-4 py-2 bg-red-500 text-white rounded-sm text-sm font-bold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      {noHistoryChecked.size}명 삭제
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {noHistoryStep === 'deleting' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
              <div className="w-64 h-2 bg-gray-200 rounded-sm overflow-hidden mb-3">
                <div
                  className="h-full bg-red-500 transition-all duration-300"
                  style={{ width: `${noHistoryProgress.total ? (noHistoryProgress.current / noHistoryProgress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">삭제 중...</p>
              <p className="text-xs text-gray-400">{noHistoryProgress.current} / {noHistoryProgress.total}</p>
            </div>
          )}

          {noHistoryStep === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-sm flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-primary mb-4">삭제 완료!</h4>
              <div className="text-center space-y-1 text-sm text-gray-600 mb-6">
                <p>삭제된 학생: <strong className="text-red-600">{noHistoryDeleteResult.deleted}</strong>명</p>
                {noHistoryDeleteResult.errors > 0 && (
                  <p>오류: <strong className="text-orange-600">{noHistoryDeleteResult.errors}</strong>건</p>
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

          </>}

        </div>
      </div>
    </div>
  );
};

export default StudentDataCleanupModal;
