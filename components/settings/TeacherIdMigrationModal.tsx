import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, getDocs, collectionGroup, writeBatch, doc } from 'firebase/firestore';
import { X, AlertTriangle, CheckCircle, RefreshCw, Download, Upload, Database, TrendingUp } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  englishName?: string;
}

interface EnrollmentDoc {
  id: string;
  studentId: string;
  teacherId: string;
  className?: string;
  subject?: string;
  path: string;
}

interface MatchResult {
  enrollment: EnrollmentDoc;
  matchedStaff?: StaffMember;
  matchType?: 'exact-name' | 'exact-english' | 'partial-name' | 'partial-english' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'none';
}

interface TeacherIdMigrationModalProps {
  onClose: () => void;
}

const TeacherIdMigrationModal: React.FC<TeacherIdMigrationModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<'preview' | 'manual-mapping' | 'migration'>('preview');
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });

  // Load preview
  const loadPreview = async () => {
    setLoading(true);
    try {
      // 1. Load staff
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        englishName: doc.data().englishName
      } as StaffMember));
      setStaff(staffData);

      // 2. Load enrollments
      const enrollmentsSnapshot = await getDocs(collectionGroup(db, 'enrollments'));
      const enrollments: EnrollmentDoc[] = [];
      enrollmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const pathParts = doc.ref.path.split('/');
        const studentId = pathParts[1];

        enrollments.push({
          id: doc.id,
          studentId,
          teacherId: data.teacherId || '',
          className: data.className,
          subject: data.subject,
          path: doc.ref.path
        });
      });

      // 3. Match
      const matchResults = enrollments.map(e => matchEnrollmentToStaff(e, staffData));
      setResults(matchResults);

    } catch (error) {
      console.error('Error loading preview:', error);
      alert('미리보기 로드 실패: ' + error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  // Matching logic
  const matchEnrollmentToStaff = (
    enrollment: EnrollmentDoc,
    staffList: StaffMember[]
  ): MatchResult => {
    const teacherId = enrollment.teacherId;

    if (!teacherId) {
      return { enrollment, confidence: 'none' };
    }

    // 1. Exact match on name
    let matched = staffList.find(s => s.name === teacherId);
    if (matched) {
      return {
        enrollment,
        matchedStaff: matched,
        matchType: 'exact-name',
        confidence: 'high'
      };
    }

    // 2. Exact match on englishName
    matched = staffList.find(s => s.englishName === teacherId);
    if (matched) {
      return {
        enrollment,
        matchedStaff: matched,
        matchType: 'exact-english',
        confidence: 'high'
      };
    }

    // 3. Partial match on name
    matched = staffList.find(s =>
      s.name.toLowerCase().includes(teacherId.toLowerCase()) ||
      teacherId.toLowerCase().includes(s.name.toLowerCase())
    );
    if (matched) {
      return {
        enrollment,
        matchedStaff: matched,
        matchType: 'partial-name',
        confidence: 'medium'
      };
    }

    // 4. Partial match on englishName
    matched = staffList.find(s =>
      s.englishName && (
        s.englishName.toLowerCase().includes(teacherId.toLowerCase()) ||
        teacherId.toLowerCase().includes(s.englishName.toLowerCase())
      )
    );
    if (matched) {
      return {
        enrollment,
        matchedStaff: matched,
        matchType: 'partial-english',
        confidence: 'medium'
      };
    }

    return { enrollment, confidence: 'none' };
  };

  // Statistics
  const stats = {
    total: results.length,
    high: results.filter(r => r.confidence === 'high').length,
    medium: results.filter(r => r.confidence === 'medium').length,
    none: results.filter(r => r.confidence === 'none').length
  };

  // Group unmatched by teacherId
  const unmatchedGroups = new Map<string, EnrollmentDoc[]>();
  results.filter(r => r.confidence === 'none').forEach(r => {
    const key = r.enrollment.teacherId || '(empty)';
    if (!unmatchedGroups.has(key)) {
      unmatchedGroups.set(key, []);
    }
    unmatchedGroups.get(key)!.push(r.enrollment);
  });

  // Handle manual mapping
  const handleManualMapping = (teacherId: string, staffId: string) => {
    setManualMappings(prev => ({
      ...prev,
      [teacherId]: staffId
    }));
  };

  // Apply manual mappings to results
  const getFinalResults = (): MatchResult[] => {
    return results.map(r => {
      if (r.confidence === 'none' && manualMappings[r.enrollment.teacherId]) {
        const staffId = manualMappings[r.enrollment.teacherId];
        const matchedStaff = staff.find(s => s.id === staffId);
        return {
          ...r,
          matchedStaff,
          matchType: 'none',
          confidence: 'high' as const
        };
      }
      return r;
    });
  };

  // Run migration
  const runMigration = async () => {
    if (!confirm('정말 마이그레이션을 실행하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    setMigrating(true);
    setStep('migration');

    try {
      const finalResults = getFinalResults();
      const toMigrate = finalResults.filter(r => r.confidence === 'high' && r.matchedStaff);

      setMigrationProgress({ current: 0, total: toMigrate.length });

      let batch = writeBatch(db);
      let batchCount = 0;
      let totalUpdated = 0;

      for (const result of toMigrate) {
        const docRef = doc(db, result.enrollment.path);

        batch.update(docRef, {
          staffId: result.matchedStaff!.id,
          teacherId_deprecated: result.enrollment.teacherId,
          migrated: true,
          migratedAt: new Date().toISOString()
        });

        batchCount++;

        // Firestore batch limit: 500
        if (batchCount === 500) {
          await batch.commit();
          totalUpdated += batchCount;
          setMigrationProgress({ current: totalUpdated, total: toMigrate.length });
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
        totalUpdated += batchCount;
        setMigrationProgress({ current: totalUpdated, total: toMigrate.length });
      }

      alert(`✅ 마이그레이션 완료!\n\n${totalUpdated}개 문서 업데이트됨`);
      onClose();

    } catch (error) {
      console.error('Migration error:', error);
      alert('마이그레이션 실패: ' + error);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
        <div className="bg-white rounded-sm shadow-xl p-8 max-w-md w-full">
          <div className="flex items-start justify-center pt-[8vh] mb-4">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
          <p className="text-center text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100] p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-bold text-[#081429]">teacherId → staffId 마이그레이션</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 'preview' && '자동 매칭 결과를 확인하세요'}
              {step === 'manual-mapping' && '매칭되지 않은 항목을 수동으로 매칭하세요'}
              {step === 'migration' && '마이그레이션 진행 중...'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Statistics */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-sm shadow-sm">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">전체 Enrollments</div>
            </div>
            <div className="bg-green-50 p-4 rounded-sm shadow-sm">
              <div className="text-2xl font-bold text-green-700">{stats.high}</div>
              <div className="text-sm text-green-600">자동 매칭 성공</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-sm shadow-sm">
              <div className="text-2xl font-bold text-yellow-700">{stats.medium}</div>
              <div className="text-sm text-yellow-600">검토 필요</div>
            </div>
            <div className="bg-red-50 p-4 rounded-sm shadow-sm">
              <div className="text-2xl font-bold text-red-700">{stats.none}</div>
              <div className="text-sm text-red-600">매칭 실패</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Section: High confidence matches */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                    자동 매칭 성공 ({stats.high}개)
                  </h3>
                </div>
                <div className="bg-green-50 rounded-sm p-4 max-h-48 overflow-auto">
                  {results.filter(r => r.confidence === 'high').slice(0, 10).map((r, idx) => (
                    <div key={idx} className="text-sm py-1 flex items-center gap-2">
                      <span className="text-gray-600">{r.enrollment.teacherId}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-green-700">{r.matchedStaff?.id}</span>
                      <span className="text-gray-500">({r.matchedStaff?.name})</span>
                    </div>
                  ))}
                  {stats.high > 10 && (
                    <div className="text-sm text-gray-500 mt-2">... 외 {stats.high - 10}개</div>
                  )}
                </div>
              </div>

              {/* Section: Medium confidence matches */}
              {stats.medium > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-yellow-200">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">
                      검토 필요 ({stats.medium}개)
                    </h3>
                  </div>
                  <div className="bg-yellow-50 rounded-sm p-4 space-y-2">
                    {results.filter(r => r.confidence === 'medium').map((r, idx) => (
                      <div key={idx} className="text-sm py-2 border-b border-yellow-200 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{r.enrollment.teacherId}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-yellow-700">{r.matchedStaff?.id}</span>
                          <span className="text-gray-500">({r.matchedStaff?.name})</span>
                          <span className="text-xs text-yellow-600 ml-auto">{r.matchType}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{r.enrollment.path}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section: No matches */}
              {stats.none > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-200">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
                      매칭 실패 - 수동 처리 필요 ({stats.none}개)
                    </h3>
                  </div>
                  <div className="bg-red-50 rounded-sm p-4 space-y-3">
                    {Array.from(unmatchedGroups.entries()).map(([teacherId, enrollments]) => (
                      <div key={teacherId} className="border-b border-red-200 pb-3 last:border-0">
                        <div className="font-medium text-red-700 mb-2">
                          teacherId: "{teacherId}" ({enrollments.length}개 enrollment)
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          {enrollments.slice(0, 2).map((e, idx) => (
                            <div key={idx}>• {e.path}</div>
                          ))}
                          {enrollments.length > 2 && (
                            <div>... 외 {enrollments.length - 2}개</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'manual-mapping' && (
            <div className="space-y-6">
              {/* Section: Manual mapping */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-blue-200">
                  <Database className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
                    수동 매칭 설정
                  </h3>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-2">매칭되지 않은 teacherId</h4>
                  <p className="text-sm text-blue-700">각 teacherId에 대해 올바른 Staff를 선택하세요</p>
                </div>

                <div className="space-y-4">
                  {Array.from(unmatchedGroups.entries()).map(([teacherId, enrollments]) => (
                    <div key={teacherId} className="border rounded-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-900">teacherId: {teacherId}</div>
                          <div className="text-sm text-gray-500">{enrollments.length}개 enrollment</div>
                        </div>
                        <select
                          value={manualMappings[teacherId] || ''}
                          onChange={(e) => handleManualMapping(teacherId, e.target.value)}
                          className="px-3 py-2 border rounded-sm"
                        >
                          <option value="">-- Staff 선택 --</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.englishName || 'no english'}) - ID: {s.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                        예시 경로: {enrollments[0].path}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'migration' && (
            <div>
              {/* Section: Migration progress */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-blue-200">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
                  마이그레이션 진행 상황
                </h3>
              </div>
              <div className="flex flex-col items-start justify-center pt-[8vh] py-12">
                <RefreshCw className="w-16 h-16 animate-spin text-blue-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">마이그레이션 진행 중...</h3>
                <p className="text-gray-600 mb-4">
                  {migrationProgress.current} / {migrationProgress.total}
                </p>
                <div className="w-full max-w-md bg-gray-200 rounded-sm h-4">
                  <div
                    className="bg-blue-500 h-4 rounded-sm transition-all"
                    style={{
                      width: `${(migrationProgress.current / migrationProgress.total) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {step === 'preview' && stats.none > 0 && (
              <span className="text-red-600">⚠️ {stats.none}개 항목을 수동으로 매칭해야 합니다</span>
            )}
            {step === 'manual-mapping' && (
              <span>
                {Object.keys(manualMappings).length} / {unmatchedGroups.size} 매칭 완료
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-sm hover:bg-gray-100"
              disabled={migrating}
            >
              취소
            </button>
            {step === 'preview' && stats.none > 0 && (
              <button
                onClick={() => setStep('manual-mapping')}
                className="px-4 py-2 bg-yellow-500 text-white rounded-sm hover:bg-yellow-600"
              >
                수동 매칭 진행
              </button>
            )}
            {step === 'preview' && stats.none === 0 && (
              <button
                onClick={runMigration}
                className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600"
              >
                마이그레이션 실행
              </button>
            )}
            {step === 'manual-mapping' && (
              <>
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 border rounded-sm hover:bg-gray-100"
                >
                  뒤로
                </button>
                <button
                  onClick={runMigration}
                  disabled={Object.keys(manualMappings).length < unmatchedGroups.size}
                  className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  마이그레이션 실행
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherIdMigrationModal;
