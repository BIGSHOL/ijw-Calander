import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Loader2, AlertCircle, Check, RotateCcw, Eye, Settings } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[8vh] z-[100]">
      <div className="bg-white rounded-sm w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            수납 데이터 가져오기
          </h2>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-2">
          {/* Section 1: 파일 업로드 */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
              <Upload className="w-3 h-3 text-primary" />
              <h3 className="text-primary font-bold text-xs">파일 업로드</h3>
            </div>
            <div className="p-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-sm hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel 파일 선택
                </button>
                {fileName && (
                  <span className="text-sm text-gray-600 font-medium">{fileName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: 데이터 미리보기 */}
          {summary && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Eye className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">데이터 미리보기</h3>
              </div>
              <div className="p-3 space-y-3">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <div className="bg-blue-50 rounded-sm p-2 border border-blue-100">
                    <p className="text-xxs text-blue-600 font-medium">청구월</p>
                    <p className="font-bold text-sm text-blue-700">{detectedMonth}</p>
                  </div>
                  <div className="bg-gray-50 rounded-sm p-2 border border-gray-100">
                    <p className="text-xxs text-gray-500 font-medium">총 레코드</p>
                    <p className="font-bold text-sm">{summary.totalRecords.toLocaleString()}건</p>
                  </div>
                  <div className="bg-gray-50 rounded-sm p-2 border border-gray-100">
                    <p className="text-xxs text-gray-500 font-medium">학생 수</p>
                    <p className="font-bold text-sm">{summary.uniqueStudents}명</p>
                  </div>
                  <div className="bg-gray-50 rounded-sm p-2 border border-gray-100">
                    <p className="text-xxs text-gray-500 font-medium">납부/미납</p>
                    <p className="font-bold text-sm">
                      <span className="text-emerald-600">{summary.paidCount}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-yellow-600">{summary.pendingCount}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-blue-50 rounded-sm p-2 border border-blue-100">
                    <p className="text-xxs text-blue-600 font-medium">총 청구액</p>
                    <p className="font-bold text-sm text-blue-700">{summary.totalBilled.toLocaleString()}원</p>
                  </div>
                  <div className="bg-emerald-50 rounded-sm p-2 border border-emerald-100">
                    <p className="text-xxs text-emerald-600 font-medium">총 납부액</p>
                    <p className="font-bold text-sm text-emerald-700">{summary.totalPaid.toLocaleString()}원</p>
                  </div>
                  <div className="bg-orange-50 rounded-sm p-2 border border-orange-100">
                    <p className="text-xxs text-orange-600 font-medium">총 미납액</p>
                    <p className="font-bold text-sm text-orange-700">{summary.totalUnpaid.toLocaleString()}원</p>
                  </div>
                </div>

                {/* 미리보기 테이블 */}
                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <div className="bg-gray-50 px-2 py-1 border-b border-gray-200">
                    <h4 className="text-xs font-medium text-gray-600">처음 10건 미리보기</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">이름</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">학년</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">수납명</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">청구액</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">할인</th>
                          <th className="px-2 py-1.5 text-right font-medium text-gray-600">납부액</th>
                          <th className="px-2 py-1.5 text-center font-medium text-gray-600">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {parsedData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-2 py-1.5">{row.studentName}</td>
                            <td className="px-2 py-1.5">{row.grade}</td>
                            <td className="px-2 py-1.5 max-w-[200px] truncate">{row.billingName}</td>
                            <td className="px-2 py-1.5 text-right">{row.billedAmount.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">{row.discountAmount.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-right">{row.paidAmount.toLocaleString()}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-xxs font-medium ${
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
                  </div>
                  {parsedData.length > 10 && (
                    <div className="bg-gray-50 px-2 py-1 border-t border-gray-200">
                      <p className="text-xxs text-gray-400 text-center">
                        ... 외 {parsedData.length - 10}건 더 있음
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: 가져오기 설정 */}
          {summary && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                <Settings className="w-3 h-3 text-primary" />
                <h3 className="text-primary font-bold text-xs">가져오기 설정</h3>
              </div>
              <div className="p-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-2 rounded-sm transition-colors">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <span className="font-medium">같은 청구월 기존 데이터 삭제 후 가져오기</span>
                    <p className="text-xxs text-gray-500 mt-0.5">
                      {overwrite
                        ? `${detectedMonth} 청구월의 기존 데이터를 모두 삭제하고 새로 가져옵니다.`
                        : '기존 데이터를 유지하고 새 데이터를 추가합니다.'}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Section 4: 결과 */}
          {importResult && (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                {importResult.success ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-red-600" />
                )}
                <h3 className={`font-bold text-xs ${
                  importResult.success ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {importResult.success ? '가져오기 완료' : '가져오기 실패'}
                </h3>
              </div>
              <div className={`p-3 ${
                importResult.success
                  ? 'bg-emerald-50'
                  : 'bg-red-50'
              }`}>
                {importResult.success ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm text-emerald-700 font-medium">
                      {importResult.count.toLocaleString()}건의 수납 데이터를 성공적으로 가져왔습니다.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm text-red-700 font-medium block">
                        데이터 가져오기에 실패했습니다.
                      </span>
                      <span className="text-xs text-red-600">
                        개발자 도구 콘솔을 확인하여 오류 내용을 확인하세요.
                      </span>
                    </div>
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
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-sm hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                다른 파일 가져오기
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 transition-colors text-sm font-medium"
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-sm hover:bg-gray-100 transition-colors text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={parsedData.length === 0 || isImporting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
