// 메이크에듀 상담내역 테스트 조회 + 매칭 + DB 저장 (관리자용)
import React, { useState, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { Loader2, Download, AlertCircle, CheckCircle2, Save, AlertTriangle } from 'lucide-react';
import { UserProfile, UnifiedStudent } from '../../types';
import { useStudents } from '../../hooks/useStudents';

interface ConsultationRow {
    studentName: string;
    school: string;
    grade: string;
    guardianPhone: string;
    studentPhone: string;
    consultantName: string;
    date: string;
    title: string;
    content: string;
    contentLength: number;
    contentRawLength: number;
}

interface ScrapeResult {
    success: boolean;
    yearMonth: string;
    fromYmd: string;
    toYmd: string;
    htmlLength: number;
    count: number;
    rows: ConsultationRow[];
    truncated: boolean;
}

interface MatchedRow extends ConsultationRow {
    matchedStudent: UnifiedStudent | null;
    matchReason: string; // 'parent_phone' | 'student_phone' | 'no_match'
    studentKey: string;  // 그룹화용 키 (이름|연락처)
}

interface Props {
    currentUser: UserProfile | null;
}

// 전화번호 정규화: 숫자만
const normalizePhone = (s?: string): string => (s || '').replace(/[^\d]/g, '');

// safeKey: doc ID 안전한 형태로
const safeKey = (s: string): string =>
    (s || '').replace(/[^\w가-힣]/g, '_').slice(0, 50) || 'unknown';

const ConsultationListTestTab: React.FC<Props> = ({ currentUser }) => {
    const today = new Date();
    const defaultYM = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [yearMonth, setYearMonth] = useState(defaultYM);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScrapeResult | null>(null);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const isAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin';
    const { students: allStudents } = useStudents(true);  // 퇴원생 포함

    // 매칭 로직: 이름 + (보호자 연락처 OR 원생 연락처)
    const matchedRows = useMemo<MatchedRow[]>(() => {
        if (!result) return [];

        // 학생 인덱스: 이름별로 빠르게 조회
        const byName = new Map<string, UnifiedStudent[]>();
        allStudents.forEach(s => {
            const arr = byName.get(s.name) || [];
            arr.push(s);
            byName.set(s.name, arr);
        });

        return result.rows.map(row => {
            const rowGuardian = normalizePhone(row.guardianPhone);
            const rowStudent = normalizePhone(row.studentPhone);
            const candidates = byName.get(row.studentName) || [];

            let matched: UnifiedStudent | null = null;
            let reason = 'no_match';

            for (const s of candidates) {
                const sParent = normalizePhone(s.parentPhone);
                const sParent2 = normalizePhone(s.parentPhone2);
                const sStudent = normalizePhone(s.studentPhone);
                const sOther = normalizePhone(s.otherPhone);

                // 보호자 연락처 매치 (양방향)
                if (rowGuardian && (sParent === rowGuardian || sParent2 === rowGuardian || sOther === rowGuardian)) {
                    matched = s; reason = 'parent_phone'; break;
                }
                // 원생 연락처 매치
                if (rowStudent && (sStudent === rowStudent || sParent === rowStudent || sParent2 === rowStudent)) {
                    matched = s; reason = 'student_phone'; break;
                }
                // 보호자→학생 폰 교차
                if (rowGuardian && sStudent === rowGuardian) {
                    matched = s; reason = 'cross_phone'; break;
                }
            }

            // 그룹화용 키: 이름 + 연락처(우선순위: 보호자→원생)
            const phoneKey = rowGuardian || rowStudent || '_no_phone_';
            const studentKey = `${row.studentName}|${phoneKey}`;

            return { ...row, matchedStudent: matched, matchReason: reason, studentKey };
        });
    }, [result, allStudents]);

    // 같은 학생 그룹별 카운트
    const studentGroupCount = useMemo(() => {
        const m = new Map<string, number>();
        matchedRows.forEach(r => m.set(r.studentKey, (m.get(r.studentKey) || 0) + 1));
        return m;
    }, [matchedRows]);

    const matchedCount = matchedRows.filter(r => r.matchedStudent).length;
    const unmatchedCount = matchedRows.length - matchedCount;
    const uniqueStudentCount = studentGroupCount.size;

    const handleFetch = async () => {
        if (!/^\d{6}$/.test(yearMonth)) {
            setError('YYYYMM 형식으로 입력해주세요. 예: 202604');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        setExpandedIdx(null);
        setSaveMessage(null);
        try {
            const fns = getFunctions(undefined, 'asia-northeast3');
            const callable = httpsCallable<{ yearMonth: string }, ScrapeResult>(
                fns, 'scrapeMakeEduConsultationsTest', { timeout: 300000 }
            );
            const res = await callable({ yearMonth });
            setResult(res.data);
        } catch (err: any) {
            console.error('[ConsultationListTest] Error:', err);
            setError(err?.message || '조회 실패');
        } finally {
            setLoading(false);
        }
    };

    // DB에 저장 (매칭된 것만)
    const handleSaveToDb = async () => {
        if (!result || matchedRows.length === 0) return;

        // 매칭 안 된 학생 알림
        if (unmatchedCount > 0) {
            const unmatchedNames = Array.from(new Set(
                matchedRows.filter(r => !r.matchedStudent).map(r => r.studentName)
            )).slice(0, 10);
            const more = unmatchedCount > 10 ? `\n... 외 ${unmatchedCount - 10}건` : '';
            const ok = window.confirm(
                `매칭되지 않은 상담 ${unmatchedCount}건이 있습니다.\n` +
                `(이 학생들은 저장되지 않습니다)\n\n` +
                `매칭 실패 학생 일부:\n${unmatchedNames.join(', ')}${more}\n\n` +
                `매칭된 ${matchedCount}건만 저장하시겠습니까?`
            );
            if (!ok) return;
        } else {
            const ok = window.confirm(
                `${matchedCount}건의 상담을 student_consultations에 저장하시겠습니까?\n` +
                `(같은 doc ID는 덮어쓰기 됩니다)`
            );
            if (!ok) return;
        }

        setSaving(true);
        setError(null);
        setSaveMessage(null);

        try {
            // 같은 (student, date, consultant) 그룹 내 seq 안정화 (content prefix localeCompare)
            const groupSeq = new Map<string, MatchedRow[]>();
            matchedRows.filter(r => r.matchedStudent).forEach(r => {
                const k = `${r.matchedStudent!.id}|${r.date}|${r.consultantName}`;
                const arr = groupSeq.get(k) || [];
                arr.push(r);
                groupSeq.set(k, arr);
            });
            // 그룹 내 정렬
            groupSeq.forEach(arr => {
                arr.sort((a, b) => a.content.localeCompare(b.content));
            });

            const colRef = collection(db, 'student_consultations');
            const writes: { docId: string; data: any }[] = [];
            const now = Date.now();

            for (const [groupKey, rows] of groupSeq) {
                rows.forEach((row, seq) => {
                    const student = row.matchedStudent!;
                    const docId = `makeedu_${safeKey(student.id)}_${row.date}_${safeKey(row.consultantName)}_${seq}`;
                    const data: any = {
                        studentId: student.id,
                        studentName: row.studentName,
                        school: student.school || row.school || '',
                        grade: student.grade || row.grade || '',
                        type: 'parent',
                        consultantId: row.consultantName,
                        consultantName: row.consultantName,
                        date: row.date,
                        category: 'general',
                        title: row.title || '',
                        content: row.content || '',
                        followUpNeeded: false,
                        followUpDone: false,
                        createdBy: 'makeedu_test_sync',
                        migrationSource: 'MakeEdu_HtmlXls',
                        createdAt: now,
                        updatedAt: now,
                    };
                    writes.push({ docId, data });
                });
            }

            // batch write (500건 단위)
            let written = 0;
            for (let i = 0; i < writes.length; i += 500) {
                const chunk = writes.slice(i, i + 500);
                const batch = writeBatch(db);
                chunk.forEach(w => {
                    batch.set(doc(colRef, w.docId), w.data, { merge: true });
                });
                await batch.commit();
                written += chunk.length;
            }

            setSaveMessage(`✅ ${written}건 저장 완료 (skip: ${unmatchedCount}건)`);
        } catch (err: any) {
            console.error('[ConsultationListTest] Save error:', err);
            setError(`저장 실패: ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    // 필터링
    const filteredRows = matchedRows.filter(r => {
        if (showOnlyUnmatched && r.matchedStudent) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return r.studentName.toLowerCase().includes(q)
            || r.consultantName.toLowerCase().includes(q)
            || r.school.toLowerCase().includes(q)
            || r.title.toLowerCase().includes(q)
            || r.content.toLowerCase().includes(q);
    });

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-400" size={48} />
                    <p className="mt-3 text-gray-600">관리자(master/admin) 전용 화면입니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* 헤더 */}
            <div className="flex-shrink-0 bg-white border-b px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded">관리자용</span>
                    <h1 className="text-lg font-bold text-gray-800">메이크에듀 상담목록 테스트 조회 + 매칭/저장</h1>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    메이크에듀 상담내역 → <strong>이름 + 연락처(보호자 또는 원생)</strong>로 students 매칭 → 매칭된 건만 student_consultations에 저장.
                </p>

                {/* 조회 폼 */}
                <div className="flex items-end gap-2 flex-wrap">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">조회 월 (YYYYMM)</label>
                        <input
                            type="text"
                            value={yearMonth}
                            onChange={e => setYearMonth(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                            placeholder="예: 202604"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            disabled={loading || saving}
                        />
                    </div>
                    <button
                        onClick={handleFetch}
                        disabled={loading || saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        {loading ? '조회 중... (최대 5분)' : '상담내역 조회'}
                    </button>

                    {result && (
                        <button
                            onClick={handleSaveToDb}
                            disabled={loading || saving || matchedCount === 0}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title="매칭된 학생만 student_consultations에 저장"
                        >
                            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            {saving ? '저장 중...' : `DB에 저장 (${matchedCount}건)`}
                        </button>
                    )}

                    {result && (
                        <>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="이름/학교/제목/내용 검색..."
                                className="ml-2 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            />
                            <label className="flex items-center gap-1 text-xs text-gray-700 ml-2">
                                <input
                                    type="checkbox"
                                    checked={showOnlyUnmatched}
                                    onChange={e => setShowOnlyUnmatched(e.target.checked)}
                                />
                                매칭 실패만 보기
                            </label>
                        </>
                    )}
                </div>

                {error && (
                    <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
                {saveMessage && (
                    <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-start gap-2">
                        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{saveMessage}</span>
                    </div>
                )}
            </div>

            {/* 결과 통계 */}
            {result && (
                <>
                    <div className="flex-shrink-0 bg-white border-b px-4 py-2 flex items-center gap-4 text-xs flex-wrap">
                        <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={14} />
                            <strong>{result.count}건</strong> 파싱 (기간 {result.fromYmd} ~ {result.toYmd})
                        </span>
                        <span className="text-blue-600 font-bold">매칭 성공: {matchedCount}건</span>
                        {unmatchedCount > 0 && (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                                <AlertTriangle size={12} />
                                매칭 실패: {unmatchedCount}건
                            </span>
                        )}
                        <span className="text-gray-500">고유 학생(이름+연락처): {uniqueStudentCount}명</span>
                        {result.truncated && (
                            <span className="text-orange-600">⚠️ UI 표시는 500건 제한 (전체 {result.count}건)</span>
                        )}
                        {(search || showOnlyUnmatched) && <span className="text-blue-600">필터: {filteredRows.length}건 표시</span>}
                    </div>

                    {/* 표 */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 bg-gray-100 z-10">
                                <tr>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">#</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">매칭</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">날짜</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">학생</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">연락처</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">학교/학년</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">상담자</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">제목</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">내용 (요약)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, idx) => {
                                    const isExpanded = expandedIdx === idx;
                                    const summary = row.content.length > 80
                                        ? row.content.substring(0, 80) + '...'
                                        : row.content;
                                    const groupCount = studentGroupCount.get(row.studentKey) || 1;
                                    const matchBg = row.matchedStudent ? 'hover:bg-green-50' : 'hover:bg-red-50 bg-red-50/30';
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr
                                                className={`cursor-pointer border-b ${matchBg}`}
                                                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                            >
                                                <td className="border px-2 py-1 text-gray-500">{idx + 1}</td>
                                                <td className="border px-2 py-1">
                                                    {row.matchedStudent ? (
                                                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                                                            ✓ {row.matchReason === 'parent_phone' ? '보호자' : row.matchReason === 'student_phone' ? '원생' : '교차'}
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">✗ 실패</span>
                                                    )}
                                                </td>
                                                <td className="border px-2 py-1 font-mono text-gray-700">{row.date}</td>
                                                <td className="border px-2 py-1 font-bold text-gray-800">
                                                    {row.studentName}
                                                    {groupCount > 1 && <span className="ml-1 text-[10px] text-purple-600">({groupCount})</span>}
                                                </td>
                                                <td className="border px-2 py-1 text-gray-600 font-mono text-[10px]">
                                                    {row.guardianPhone && <div>보:{row.guardianPhone}</div>}
                                                    {row.studentPhone && <div>원:{row.studentPhone}</div>}
                                                </td>
                                                <td className="border px-2 py-1 text-gray-600">{row.school} {row.grade}</td>
                                                <td className="border px-2 py-1 text-gray-700">{row.consultantName}</td>
                                                <td className="border px-2 py-1 text-gray-700 max-w-[150px] truncate">{row.title}</td>
                                                <td className="border px-2 py-1 text-gray-600 max-w-[300px]">
                                                    <span className="whitespace-pre-wrap line-clamp-2">{summary}</span>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-yellow-50">
                                                    <td colSpan={9} className="border px-4 py-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <div className="font-bold text-xs text-gray-700 mb-1">전체 내용</div>
                                                                <div className="bg-white p-2 rounded border text-xs whitespace-pre-wrap font-sans max-h-60 overflow-auto">
                                                                    {row.content || '(빈 내용)'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-xs text-gray-700 mb-1">매칭 정보</div>
                                                                <div className="bg-white p-2 rounded border text-xs space-y-1">
                                                                    {row.matchedStudent ? (
                                                                        <>
                                                                            <div className="text-green-700 font-bold">✓ 매칭 성공 ({row.matchReason})</div>
                                                                            <div><span className="text-gray-500">studentId:</span> <code className="text-blue-600">{row.matchedStudent.id}</code></div>
                                                                            <div><span className="text-gray-500">DB 학생:</span> {row.matchedStudent.name} / {row.matchedStudent.school || '-'} / {row.matchedStudent.grade || '-'}</div>
                                                                            <div><span className="text-gray-500">DB 보호자:</span> {row.matchedStudent.parentPhone || '-'}</div>
                                                                            <div><span className="text-gray-500">DB 원생폰:</span> {row.matchedStudent.studentPhone || '-'}</div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="text-red-700 font-bold">✗ 매칭 실패</div>
                                                                            <div className="text-gray-500">동일 이름의 학생을 찾았으나 연락처가 일치하지 않거나, 이름 자체가 DB에 없음</div>
                                                                        </>
                                                                    )}
                                                                    <hr className="my-1" />
                                                                    <div><span className="text-gray-500">studentKey(그룹):</span> <code>{row.studentKey}</code></div>
                                                                    <div><span className="text-gray-500">제목:</span> {row.title || '(없음)'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-gray-400">
                                            {(search || showOnlyUnmatched) ? '필터 결과 없음' : '데이터 없음'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!result && !loading && (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                    <div>
                        <Download className="mx-auto text-gray-300" size={48} />
                        <p className="mt-3 text-gray-500 text-sm">조회할 월(YYYYMM)을 입력하고 "상담내역 조회" 버튼을 누르세요.</p>
                        <p className="mt-1 text-gray-400 text-xs">파싱된 상담을 students 컬렉션과 자동 매칭한 후 저장 가능합니다.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultationListTestTab;
