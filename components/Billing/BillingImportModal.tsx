import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, AlertCircle, Check, RotateCcw } from 'lucide-react';
import { read, utils } from 'xlsx';
import { BillingRecord } from '../../types';
import { normalizeMonth } from '../../hooks/useBilling';

interface BillingImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: Omit<BillingRecord, 'id'>[], month: string, overwrite: boolean) => Promise<void>;
}

interface ParsedRow {
  externalStudentId: string;
  studentName: string;
  grade: string;
  school: string;
  parentPhone: string;
  studentPhone: string;
  category: string;
  month: string;
  billingDay: number;
  billingName: string;
  status: 'pending' | 'paid';
  billedAmount: number;
  discountAmount: number;
  pointsUsed: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentMethod: string;
  cardCompany: string;
  paidDate: string;
  cashReceipt: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * xlsx 수납여부 → BillingStatus 변환
 */
function parseStatus(raw: string): 'pending' | 'paid' {
  if (raw === '납부완료') return 'paid';
  return 'pending';
}

/**
 * xlsx 수납일(20260103) → YYYY-MM-DD 변환
 */
function parsePaidDate(raw: string | number): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

export const BillingImportModal: React.FC<BillingImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const [overwrite, setOverwrite] = useState(true);

  const detectedMonth = parsedData.length > 0 ? parsedData[0].month : '';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, any>>(sheet);

    const parsed: ParsedRow[] = rows.map((row) => ({
      externalStudentId: String(row['원생고유번호'] ?? ''),
      studentName: String(row['이름'] ?? ''),
      grade: String(row['학년'] ?? ''),
      school: String(row['학교'] ?? ''),
      parentPhone: String(row['학부모연락처'] ?? ''),
      studentPhone: String(row['원생연락처'] ?? ''),
      category: String(row['구분'] ?? ''),
      month: normalizeMonth(row['청구월'] ?? ''),
      billingDay: Number(row['청구일'] ?? 0),
      billingName: String(row['수납명'] ?? ''),
      status: parseStatus(String(row['수납여부'] ?? '')),
      billedAmount: Number(row['청구액'] ?? 0),
      discountAmount: Number(row['할인액'] ?? 0),
      pointsUsed: Number(row['적립금사용'] ?? 0),
      paidAmount: Number(row['실제낸금액'] ?? 0),
      unpaidAmount: Number(row['미납금액'] ?? 0),
      paymentMethod: String(row['결제수단'] ?? ''),
      cardCompany: String(row['카드사'] ?? ''),
      paidDate: parsePaidDate(row['수납일']),
      cashReceipt: String(row['현금영수증'] ?? ''),
      memo: String(row['메모'] ?? ''),
      createdAt: String(row['등록일시'] ?? ''),
      updatedAt: String(row['수정일시'] ?? ''),
    }));

    setParsedData(parsed);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    try {
      await onImport(parsedData, detectedMonth, overwrite);
      setImportResult({ success: true, count: parsedData.length });
    } catch (err) {
      console.error('Import failed:', err);
      setImportResult({ success: false, count: 0 });
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

  // 통계 요약
  const summary = parsedData.length > 0
    ? {
        totalRecords: parsedData.length,
        uniqueStudents: new Set(parsedData.map((r) => r.externalStudentId)).size,
        totalBilled: parsedData.reduce((s, r) => s + r.billedAmount, 0),
        totalPaid: parsedData.reduce((s, r) => s + r.paidAmount, 0),
        totalUnpaid: parsedData.reduce((s, r) => s + r.unpaidAmount, 0),
        paidCount: parsedData.filter((r) => r.status === 'paid').length,
        pendingCount: parsedData.filter((r) => r.status === 'pending').length,
      }
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold">수납 데이터 가져오기</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* 파일 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">xlsx 파일 선택</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                파일 선택
              </button>
              {fileName && (
                <span className="text-sm text-gray-600">{fileName}</span>
              )}
            </div>
          </div>

          {/* 파싱 결과 요약 */}
          {summary && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">파싱 결과</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">청구월</p>
                  <p className="font-bold text-lg">{detectedMonth}</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">총 레코드</p>
                  <p className="font-bold text-lg">{summary.totalRecords.toLocaleString()}건</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">학생 수</p>
                  <p className="font-bold text-lg">{summary.uniqueStudents}명</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">납부/미납</p>
                  <p className="font-bold text-lg">
                    <span className="text-emerald-600">{summary.paidCount}</span>
                    {' / '}
                    <span className="text-yellow-600">{summary.pendingCount}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">총 청구액</p>
                  <p className="font-bold text-blue-600">{summary.totalBilled.toLocaleString()}원</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">총 납부액</p>
                  <p className="font-bold text-emerald-600">{summary.totalPaid.toLocaleString()}원</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-gray-500">총 미납액</p>
                  <p className="font-bold text-orange-600">{summary.totalUnpaid.toLocaleString()}원</p>
                </div>
              </div>

              {/* 덮어쓰기 옵션 */}
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                같은 청구월 기존 데이터 삭제 후 가져오기
              </label>

              {/* 미리보기 테이블 */}
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-600 mb-2">미리보기 (처음 10건)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left">이름</th>
                        <th className="px-2 py-1.5 text-left">학년</th>
                        <th className="px-2 py-1.5 text-left">수납명</th>
                        <th className="px-2 py-1.5 text-right">청구액</th>
                        <th className="px-2 py-1.5 text-right">할인</th>
                        <th className="px-2 py-1.5 text-right">납부액</th>
                        <th className="px-2 py-1.5 text-center">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-white">
                          <td className="px-2 py-1.5">{row.studentName}</td>
                          <td className="px-2 py-1.5">{row.grade}</td>
                          <td className="px-2 py-1.5 max-w-[200px] truncate">{row.billingName}</td>
                          <td className="px-2 py-1.5 text-right">{row.billedAmount.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right">{row.discountAmount.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-right">{row.paidAmount.toLocaleString()}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              row.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row.status === 'paid' ? '납부완료' : '미납'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 10 && (
                    <p className="text-xs text-gray-400 mt-1 text-center">
                      ... 외 {parsedData.length - 10}건 더 있음
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Import 결과 */}
          {importResult && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${
              importResult.success
                ? 'bg-emerald-50 border border-emerald-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {importResult.success ? (
                <>
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-700">
                    {importResult.count.toLocaleString()}건 가져오기 완료
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700">가져오기에 실패했습니다. 콘솔을 확인하세요.</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          {importResult?.success ? (
            <>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                <RotateCcw className="w-4 h-4" />
                다른 파일 가져오기
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={parsedData.length === 0 || isImporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    가져오는 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {parsedData.length > 0
                      ? `${parsedData.length.toLocaleString()}건 가져오기`
                      : '가져오기'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
