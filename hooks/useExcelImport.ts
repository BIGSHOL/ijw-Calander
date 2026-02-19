import { useState, useRef, useCallback } from 'react';
import { read, utils } from 'xlsx';

// ─── Types ────────────────────────────────────────────
export interface ImportResult {
  success: boolean;
  added: number;
  skipped: number;
}

export interface UseExcelImportOptions<T> {
  /**
   * xlsx의 raw 행 배열을 도메인 객체 배열로 변환하는 파서.
   * 필드 매핑, 정규화, 필터링을 여기서 수행합니다.
   */
  parser: (rows: Record<string, any>[]) => T[];

  /**
   * 파싱된 데이터를 실제 저장하는 콜백.
   * Firebase batch write 등을 수행하고 결과를 반환합니다.
   */
  onImport: (data: T[], meta?: { fileName: string }) => Promise<{ added: number; skipped: number }>;
}

export interface UseExcelImportReturn<T> {
  /** 파일 input ref (hidden input에 연결) */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** 파싱된 데이터 배열 */
  parsedData: T[];
  /** 선택된 파일명 */
  fileName: string;
  /** 가져오기 진행 중 여부 */
  isImporting: boolean;
  /** 가져오기 결과 (완료 후) */
  importResult: ImportResult | null;
  /** 파일 선택 핸들러 (input onChange에 연결) */
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  /** 가져오기 실행 */
  handleImport: () => Promise<void>;
  /** 전체 상태 초기화 */
  handleReset: () => void;
  /** 파일 선택 다이얼로그 열기 */
  openFileDialog: () => void;
  /** 파싱 단계 완료 여부 */
  isParsed: boolean;
  /** 가져오기 성공 완료 여부 */
  isComplete: boolean;
  /** 업로드된 원본 파일 */
  uploadedFile: File | null;
}

// ─── Hook ─────────────────────────────────────────────

/**
 * Excel 파일 가져오기의 공통 로직을 캡슐화하는 훅.
 *
 * 공통 흐름: 파일 선택 → xlsx 파싱 → 미리보기 → 가져오기 → 결과
 *
 * @example
 * ```tsx
 * const { fileInputRef, parsedData, handleFileChange, handleImport, ... } = useExcelImport({
 *   parser: (rows) => rows.filter(r => r['구분'] === '교재').map(r => ({
 *     name: String(r['이름'] ?? ''),
 *     amount: Number(r['청구액'] ?? 0),
 *   })),
 *   onImport: async (data) => {
 *     // Firebase batch write
 *     return { added: data.length, skipped: 0 };
 *   },
 * });
 * ```
 */
export function useExcelImport<T>(
  options: UseExcelImportOptions<T>
): UseExcelImportReturn<T> {
  const { parser, onImport } = options;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<T[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setImportResult(null);
      setUploadedFile(file);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json<Record<string, any>>(sheet);

      const parsed = parser(rows);
      setParsedData(parsed);
    },
    [parser]
  );

  const handleImport = useCallback(async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    try {
      const result = await onImport(parsedData, { fileName });
      setImportResult({ success: true, added: result.added, skipped: result.skipped });
    } catch (err) {
      console.error('Excel import failed:', err);
      setImportResult({ success: false, added: 0, skipped: 0 });
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, onImport, fileName]);

  const handleReset = useCallback(() => {
    setParsedData([]);
    setFileName('');
    setImportResult(null);
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    parsedData,
    fileName,
    isImporting,
    importResult,
    handleFileChange,
    handleImport,
    handleReset,
    openFileDialog,
    isParsed: parsedData.length > 0,
    isComplete: importResult?.success === true,
    uploadedFile,
  };
}
