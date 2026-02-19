import { renderHook, act } from '@testing-library/react';
import { useExcelImport } from '../../hooks/useExcelImport';

// xlsx mock
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: { mock: true },
    },
  })),
  utils: {
    sheet_to_json: vi.fn(() => [
      { 이름: '김철수', 학년: '초3', 학교: '테스트초', 청구액: 50000 },
      { 이름: '이영희', 학년: '초4', 학교: '샘플초', 청구액: 60000 },
      { 이름: '박민수', 학년: '중1', 학교: '테스트중', 청구액: 70000 },
    ]),
  },
}));

interface TestRow {
  name: string;
  grade: string;
  school: string;
  amount: number;
}

const testParser = (rows: Record<string, any>[]): TestRow[] =>
  rows.map((row) => ({
    name: String(row['이름'] ?? ''),
    grade: String(row['학년'] ?? ''),
    school: String(row['학교'] ?? ''),
    amount: Number(row['청구액'] ?? 0),
  }));

describe('useExcelImport', () => {
  const mockOnImport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnImport.mockResolvedValue({ added: 3, skipped: 0 });
  });

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    expect(result.current.parsedData).toEqual([]);
    expect(result.current.fileName).toBe('');
    expect(result.current.isImporting).toBe(false);
    expect(result.current.importResult).toBeNull();
    expect(result.current.isParsed).toBe(false);
    expect(result.current.isComplete).toBe(false);
    expect(result.current.uploadedFile).toBeNull();
  });

  it('파일을 파싱한다', async () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    const mockFile = new File(['test'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    (mockFile as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileChange(mockEvent);
    });

    expect(result.current.fileName).toBe('test.xlsx');
    expect(result.current.parsedData).toHaveLength(3);
    expect(result.current.parsedData[0]).toEqual({
      name: '김철수',
      grade: '초3',
      school: '테스트초',
      amount: 50000,
    });
    expect(result.current.isParsed).toBe(true);
    expect(result.current.uploadedFile).toBe(mockFile);
  });

  it('가져오기를 실행한다', async () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    // 먼저 파일 파싱
    const mockFile = new File(['test'], 'test.xlsx');
    (mockFile as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileChange(mockEvent);
    });

    // 가져오기 실행
    await act(async () => {
      await result.current.handleImport();
    });

    expect(mockOnImport).toHaveBeenCalledWith(
      result.current.parsedData,
      { fileName: 'test.xlsx' }
    );
    expect(result.current.importResult).toEqual({
      success: true,
      added: 3,
      skipped: 0,
    });
    expect(result.current.isComplete).toBe(true);
  });

  it('가져오기 실패 시 에러를 처리한다', async () => {
    mockOnImport.mockRejectedValue(new Error('Import failed'));

    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    // 파일 파싱
    const mockFile = new File(['test'], 'test.xlsx');
    (mockFile as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [mockFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    // 가져오기 실행 (실패)
    await act(async () => {
      await result.current.handleImport();
    });

    expect(result.current.importResult).toEqual({
      success: false,
      added: 0,
      skipped: 0,
    });
    expect(result.current.isComplete).toBe(false);
  });

  it('상태를 초기화한다', async () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    // 파일 파싱
    const mockFile = new File(['test'], 'test.xlsx');
    (mockFile as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [mockFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.isParsed).toBe(true);

    // 초기화
    act(() => {
      result.current.handleReset();
    });

    expect(result.current.parsedData).toEqual([]);
    expect(result.current.fileName).toBe('');
    expect(result.current.importResult).toBeNull();
    expect(result.current.isParsed).toBe(false);
    expect(result.current.uploadedFile).toBeNull();
  });

  it('파일이 없으면 파싱하지 않는다', async () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    const mockEvent = {
      target: { files: [] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileChange(mockEvent);
    });

    expect(result.current.parsedData).toEqual([]);
    expect(result.current.fileName).toBe('');
  });

  it('데이터가 없으면 가져오기를 실행하지 않는다', async () => {
    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    await act(async () => {
      await result.current.handleImport();
    });

    expect(mockOnImport).not.toHaveBeenCalled();
  });

  it('중복 건너뛰기 결과를 처리한다', async () => {
    mockOnImport.mockResolvedValue({ added: 2, skipped: 1 });

    const { result } = renderHook(() =>
      useExcelImport({ parser: testParser, onImport: mockOnImport })
    );

    const mockFile = new File(['test'], 'test.xlsx');
    (mockFile as any).arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    await act(async () => {
      await result.current.handleFileChange({
        target: { files: [mockFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.handleImport();
    });

    expect(result.current.importResult).toEqual({
      success: true,
      added: 2,
      skipped: 1,
    });
  });
});
