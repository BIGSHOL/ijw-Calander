// 메이크에듀 상담내역 테스트 조회 탭 (관리자용 - DB 저장 없이 검증)
import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Loader2, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types';

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

interface Props {
    currentUser: UserProfile | null;
}

const ConsultationListTestTab: React.FC<Props> = ({ currentUser }) => {
    const today = new Date();
    const defaultYM = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [yearMonth, setYearMonth] = useState(defaultYM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ScrapeResult | null>(null);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    const isAdmin = currentUser?.role === 'master' || currentUser?.role === 'admin';

    const handleFetch = async () => {
        if (!/^\d{6}$/.test(yearMonth)) {
            setError('YYYYMM 형식으로 입력해주세요. 예: 202604');
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        setExpandedIdx(null);
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

    const filteredRows = result?.rows.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return r.studentName.toLowerCase().includes(q)
            || r.consultantName.toLowerCase().includes(q)
            || r.school.toLowerCase().includes(q)
            || r.title.toLowerCase().includes(q)
            || r.content.toLowerCase().includes(q);
    }) || [];

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
                    <h1 className="text-lg font-bold text-gray-800">메이크에듀 상담목록 테스트 조회</h1>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    DB 저장 없이 메이크에듀에서 상담내역을 긁어와서 파싱 결과만 확인합니다.
                    URL: <code className="bg-gray-100 px-1 rounded">https://school.makeedu.co.kr/counsel/counselList.do</code>
                </p>

                {/* 조회 폼 */}
                <div className="flex items-end gap-2">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">조회 월 (YYYYMM)</label>
                        <input
                            type="text"
                            value={yearMonth}
                            onChange={e => setYearMonth(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                            placeholder="예: 202604"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            disabled={loading}
                        />
                    </div>
                    <button
                        onClick={handleFetch}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        {loading ? '조회 중... (최대 5분)' : '상담내역 조회'}
                    </button>

                    {result && (
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="이름/학교/제목/내용 검색..."
                            className="ml-4 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                        />
                    )}
                </div>

                {error && (
                    <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            {/* 결과 */}
            {result && (
                <>
                    <div className="flex-shrink-0 bg-white border-b px-4 py-2 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={14} />
                            <strong>{result.count}건</strong> 파싱 성공
                        </span>
                        <span className="text-gray-500">기간: {result.fromYmd} ~ {result.toYmd}</span>
                        <span className="text-gray-500">HTML 크기: {result.htmlLength.toLocaleString()} bytes</span>
                        {result.truncated && (
                            <span className="text-orange-600">⚠️ UI 표시는 500건으로 제한 (전체는 {result.count}건)</span>
                        )}
                        {search && <span className="text-blue-600">필터: {filteredRows.length}건 표시</span>}
                    </div>

                    {/* 표 */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead className="sticky top-0 bg-gray-100 z-10">
                                <tr>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">#</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">날짜</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">학생</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">학교/학년</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">상담자</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">제목</th>
                                    <th className="border px-2 py-1.5 text-left font-bold text-gray-700">내용 (요약)</th>
                                    <th className="border px-2 py-1.5 text-right font-bold text-gray-700">길이</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, idx) => {
                                    const isExpanded = expandedIdx === idx;
                                    const summary = row.content.length > 80
                                        ? row.content.substring(0, 80) + '...'
                                        : row.content;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr
                                                className="hover:bg-blue-50 cursor-pointer border-b"
                                                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                            >
                                                <td className="border px-2 py-1 text-gray-500">{idx + 1}</td>
                                                <td className="border px-2 py-1 font-mono text-gray-700">{row.date}</td>
                                                <td className="border px-2 py-1 font-bold text-gray-800">{row.studentName}</td>
                                                <td className="border px-2 py-1 text-gray-600">{row.school} {row.grade}</td>
                                                <td className="border px-2 py-1 text-gray-700">{row.consultantName}</td>
                                                <td className="border px-2 py-1 text-gray-700 max-w-[200px] truncate">{row.title}</td>
                                                <td className="border px-2 py-1 text-gray-600 max-w-[400px]">
                                                    <span className="whitespace-pre-wrap line-clamp-2">{summary}</span>
                                                </td>
                                                <td className="border px-2 py-1 text-right text-gray-500 font-mono">
                                                    {row.contentRawLength}→{row.contentLength}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-yellow-50">
                                                    <td colSpan={8} className="border px-4 py-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <div className="font-bold text-xs text-gray-700 mb-1">전체 내용</div>
                                                                <div className="bg-white p-2 rounded border text-xs whitespace-pre-wrap font-sans max-h-60 overflow-auto">
                                                                    {row.content || '(빈 내용)'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-xs text-gray-700 mb-1">메타데이터</div>
                                                                <div className="bg-white p-2 rounded border text-xs space-y-1">
                                                                    <div><span className="text-gray-500">학생ID 후보:</span> <code>{row.studentName}_{row.school}_{row.grade}</code></div>
                                                                    <div><span className="text-gray-500">보호자:</span> {row.guardianPhone || '-'}</div>
                                                                    <div><span className="text-gray-500">원생:</span> {row.studentPhone || '-'}</div>
                                                                    <div><span className="text-gray-500">상담자(원본):</span> {row.consultantName}</div>
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
                                        <td colSpan={8} className="text-center py-8 text-gray-400">
                                            {search ? '검색 결과 없음' : '데이터 없음'}
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
                        <p className="mt-1 text-gray-400 text-xs">메이크에듀에서 한 달치 상담내역을 긁어와 파싱 결과를 표시합니다 (DB 저장 X).</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultationListTestTab;