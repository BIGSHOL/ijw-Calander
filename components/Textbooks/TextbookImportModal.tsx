import React, { useState, useRef, useMemo } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, AlertCircle, Check, RotateCcw, Eye, UserCheck, UserX } from 'lucide-react';
import { read, utils } from 'xlsx';

export interface TextbookImportRow {
  studentName: string;
  grade: string;
  school: string;
  textbookName: string;
  amount: number;
  month: string;
  studentId: string; // 이름_학교_학년
  matched: boolean;
}

interface TextbookImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: TextbookImportRow[]) => Promise<{ added: number; skipped: number }>;
  studentIds: Set<string>; // 기존 학생 ID 세트
}

export const TextbookImportModal: React.FC<TextbookImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  studentIds,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<TextbookImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; added: number; skipped: number } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, any>>(sheet);

    // 구분 === '교재' 만 필터
    const parsed: TextbookImportRow[] = rows
      .filter(row => String(row['구분'] ?? '') === '교재')
      .map(row => {
        const name = String(row['이름'] ?? '').trim();
        const school = String(row['학교'] ?? '').trim();
        const grade = String(row['학년'] ?? '').trim();
        const studentId = `${name}_${school}_${grade}`;
        return {
          studentName: name,
          grade,
          school,
          textbookName: String(row['수납명'] ?? ''),
          amount: Number(row['청구액'] ?? 0),
          month: String(row['청구월'] ?? ''),
          studentId,
          matched: studentIds.has(studentId),
        };
      });

    setParsedData(parsed);
  };

  const summary = useMemo(() => {
    if (parsedData.length === 0) return null;
    const matchedCount = parsedData.filter(r => r.matched).length;
    const unmatchedCount = parsedData.length - matchedCount;
    const uniqueStudents = new Set(parsedData.map(r => r.studentId)).size;
    const uniqueTextbooks = new Set(parsedData.map(r => r.textbookName)).size;
    const totalAmount = parsedData.reduce((s, r) => s + r.amount, 0);
    const months = [...new Set(parsedData.map(r => r.month))].sort();
    return { matchedCount, unmatchedCount, uniqueStudents, uniqueTextbooks, totalAmount, months };
  }, [parsedData]);

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    try {
      const result = await onImport(parsedData);
      setImportResult({ success: true, added: result.added, skipped: result.skipped });
    } catch (err) {
      console.error('Import failed:', err);
      setImportResult({ success: false, added: 0, skipped: 0 });
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setParsedData([]);
    setFileName('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]" onClick={onClose}>
      <div className="bg-white rounded-sm w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            교재 수납 데이터 가져오기
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-2">
          {/* 파일 업로드 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Upload className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">파일 업로드</h3>
            </div>
            <div className="p-3">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-sm hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel 파일 선택
                </button>
                {fileName && <span className="text-sm text-gray-600 font-medium">{fileName}</span>}
              </div>
              <p className="text-xxs text-gray-400 mt-2">* 구분이 "교재"인 행만 가져옵니다 (이름, 학년, 학교, 수납명, 청구액, 청구월)</p>
            </div>
          </div>

          {/* 데이터 미리보기 */}
          {summary && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Eye className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">데이터 미리보기</h3>
              </div>
              <div className="p-3 space-y-3">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <div className="bg-gray-50 rounded-sm p-2 border border-gray-100">
                    <p className="text-xxs text-gray-500 font-medium">총 교재 수납</p>
                    <p className="font-bold text-sm">{parsedData.length.toLocaleString()}건</p>
                  </div>
                  <div className="bg-gray-50 rounded-sm p-2 border border-gray-100">
                    <p className="text-xxs text-gray-500 font-medium">학생 수 / 교재 종류</p>
                    <p className="font-bold text-sm">{summary.uniqueStudents}명 / {summary.uniqueTextbooks}종</p>
                  </div>
                  <div className="bg-blue-50 rounded-sm p-2 border border-blue-100">
                    <p className="text-xxs text-blue-600 font-medium">총 청구액</p>
                    <p className="font-bold text-sm text-blue-700">{summary.totalAmount.toLocaleString()}원</p>
                  </div>
                </div>

                {/* 학생 매칭 현황 */}
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-1.5 bg-emerald-50 rounded-sm p-2 border border-emerald-100">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium">매칭됨 {summary.matchedCount}건</span>
                  </div>
                  {summary.unmatchedCount > 0 && (
                    <div className="flex-1 flex items-center gap-1.5 bg-amber-50 rounded-sm p-2 border border-amber-100">
                      <UserX className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs text-amber-700 font-medium">미매칭 {summary.unmatchedCount}건</span>
                    </div>
                  )}
                </div>

                {/* 청구월 */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xxs text-gray-500">청구월:</span>
                  {summary.months.map(m => (
                    <span key={m} className="text-xxs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{m}</span>
                  ))}
                </div>

                {/* 미리보기 테이블 */}
                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <div className="bg-gray-50 px-2 py-1 border-b border-gray-200">
                    <h4 className="text-xs font-medium text-gray-600">처음 15건 미리보기</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-1.5 text-center font-medium text-gray-600 w-8">매칭</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">이름</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">학년</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">학교</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">수납명</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">청구액</th>
                          <th className="px-2 py-1.5 text-center font-medium text-gray-600">청구월</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {parsedData.slice(0, 15).map((row, i) => (
                          <tr key={i} className={`hover:bg-gray-50 ${!row.matched ? 'bg-amber-50/50' : ''}`}>
                            <td className="px-2 py-1.5 text-center">
                              {row.matched
                                ? <UserCheck className="w-3.5 h-3.5 text-emerald-500 inline" />
                                : <UserX className="w-3.5 h-3.5 text-amber-400 inline" />}
                            </td>
                            <td className="px-2 py-1.5 font-medium">{row.studentName}</td>
                            <td className="px-2 py-1.5">{row.grade}</td>
                            <td className="px-2 py-1.5">{row.school}</td>
                            <td className="px-2 py-1.5 max-w-[180px] truncate">{row.textbookName}</td>
                            <td className="px-2 py-1.5 text-right">{row.amount.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-center">{row.month}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 15 && (
                    <div className="bg-gray-50 px-2 py-1 border-t border-gray-200">
                      <p className="text-xxs text-gray-400 text-center">... 외 {parsedData.length - 15}건 더 있음</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 결과 */}
          {importResult && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                {importResult.success
                  ? <Check className="w-3 h-3 text-emerald-600" />
                  : <AlertCircle className="w-3 h-3 text-red-600" />}
                <h3 className={`font-bold text-xs ${importResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
                  {importResult.success ? '가져오기 완료' : '가져오기 실패'}
                </h3>
              </div>
              <div className={`p-3 ${importResult.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {importResult.success ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="text-sm text-emerald-700 font-medium">
                      {importResult.added.toLocaleString()}건 추가 완료
                      {importResult.skipped > 0 && (
                        <span className="text-gray-500 font-normal ml-1">(중복 {importResult.skipped.toLocaleString()}건 건너뜀)</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700 font-medium">데이터 가져오기에 실패했습니다.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          {importResult?.success ? (
            <>
              <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-sm hover:bg-gray-100 text-sm font-medium">
                <RotateCcw className="w-4 h-4" /> 다른 파일 가져오기
              </button>
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 text-sm font-medium">닫기</button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-sm hover:bg-gray-100 text-sm font-medium">취소</button>
              <button
                onClick={handleImport}
                disabled={parsedData.length === 0 || isImporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 가져오는 중...</>
                ) : (
                  <><Upload className="w-4 h-4" /> {parsedData.length > 0 ? `${parsedData.length.toLocaleString()}건 가져오기` : '가져오기'}</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
