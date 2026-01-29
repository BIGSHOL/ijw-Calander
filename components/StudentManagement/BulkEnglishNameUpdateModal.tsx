import React, { useState, useMemo } from 'react';
import { X, Upload, Check, AlertCircle, Loader2, FileText } from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { UnifiedStudent } from '../../types';

interface ParsedEntry {
  koreanName: string;
  englishName: string;
  foundStudent: UnifiedStudent | null;
  status: 'ready' | 'success' | 'error' | 'skipped' | 'no-change';
  errorMessage?: string;
}

interface BulkEnglishNameUpdateModalProps {
  onClose: () => void;
  students: UnifiedStudent[];
}

/**
 * 텍스트 파싱 함수
 * 예시 입력:
 *   김나윤A(Chloe)
 *   현가현(Sophia)
 *   이우민
 *
 * 출력:
 *   [{ koreanName: '김나윤A', englishName: 'Chloe' }, ...]
 */
function parseTextInput(text: string, students: UnifiedStudent[]): ParsedEntry[] {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const results: ParsedEntry[] = [];

  for (const line of lines) {
    // 정규식: 한글이름(영어이름) 형태를 매칭
    // 예: 김나윤A(Chloe), 현가현(Sophia)
    const match = line.match(/^([가-힣A-Za-z0-9\s]+)\(([A-Za-z\s]+)\)$/);

    if (match) {
      const koreanName = match[1].trim();
      const englishName = match[2].trim();

      // 학생 찾기 (정확히 일치하는 이름)
      const foundStudent = students.find(s => s.name === koreanName);

      results.push({
        koreanName,
        englishName,
        foundStudent: foundStudent || null,
        status: foundStudent ? 'ready' : 'error',
        errorMessage: foundStudent ? undefined : '학생을 찾을 수 없습니다',
      });
    } else {
      // 영어 이름이 없는 경우 (예: 이우민)
      const koreanName = line.trim();
      if (koreanName) {
        results.push({
          koreanName,
          englishName: '',
          foundStudent: null,
          status: 'skipped',
          errorMessage: '영어 이름이 없어서 건너뜀',
        });
      }
    }
  }

  return results;
}

const BulkEnglishNameUpdateModal: React.FC<BulkEnglishNameUpdateModalProps> = ({
  onClose,
  students,
}) => {
  const { updateStudent } = useStudents();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedEntries, setProcessedEntries] = useState<ParsedEntry[]>([]);
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');

  // 입력 텍스트 파싱
  const parsedEntries = useMemo(() => {
    if (!inputText.trim()) return [];
    return parseTextInput(inputText, students);
  }, [inputText, students]);

  // 통계
  const stats = useMemo(() => {
    const total = parsedEntries.length;
    const ready = parsedEntries.filter(e => e.status === 'ready').length;
    const errors = parsedEntries.filter(e => e.status === 'error').length;
    const skipped = parsedEntries.filter(e => e.status === 'skipped').length;
    return { total, ready, errors, skipped };
  }, [parsedEntries]);

  // 미리보기로 이동
  const handlePreview = () => {
    if (parsedEntries.length === 0) {
      alert('입력된 데이터가 없습니다.');
      return;
    }
    setStep('preview');
  };

  // 일괄 업데이트 실행
  const handleBulkUpdate = async () => {
    if (stats.ready === 0) {
      alert('업데이트할 학생이 없습니다.');
      return;
    }

    const confirmMessage = `${stats.ready}명의 학생 영어 이름을 업데이트하시겠습니까?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsProcessing(true);
    const results = [...parsedEntries];

    for (let i = 0; i < results.length; i++) {
      const entry = results[i];

      if (entry.status !== 'ready' || !entry.foundStudent) {
        continue;
      }

      try {
        // 기존 영어 이름과 동일한지 확인
        if (entry.foundStudent.englishName === entry.englishName) {
          results[i] = {
            ...entry,
            status: 'no-change',
            errorMessage: '이미 동일한 영어 이름입니다',
          };
          continue;
        }

        // 영어 이름 업데이트
        await updateStudent(entry.foundStudent.id, {
          englishName: entry.englishName,
        });

        results[i] = {
          ...entry,
          status: 'success',
        };
      } catch (error) {
        console.error('영어 이름 업데이트 실패:', entry.koreanName, error);
        results[i] = {
          ...entry,
          status: 'error',
          errorMessage: `업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        };
      }

      // 진행 상황 업데이트
      setProcessedEntries([...results]);
    }

    setIsProcessing(false);
    setStep('result');
  };

  // 결과 통계
  const resultStats = useMemo(() => {
    if (step !== 'result') return null;
    const success = processedEntries.filter(e => e.status === 'success').length;
    const noChange = processedEntries.filter(e => e.status === 'no-change').length;
    const errors = processedEntries.filter(e => e.status === 'error').length;
    const skipped = processedEntries.filter(e => e.status === 'skipped').length;
    return { success, noChange, errors, skipped };
  }, [processedEntries, step]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#081429]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#fdb813]" />
            <h2 className="text-lg font-bold text-white">일괄 영어 이름 업데이트</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <div className={`flex items-center gap-2 ${step === 'input' ? 'text-[#081429] font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'input' ? 'bg-[#fdb813] text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <span>입력</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-[#081429] font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' ? 'bg-[#fdb813] text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <span>미리보기</span>
          </div>
          <div className="w-12 h-0.5 bg-gray-300" />
          <div className={`flex items-center gap-2 ${step === 'result' ? 'text-[#081429] font-semibold' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'result' ? 'bg-[#fdb813] text-white' : 'bg-gray-200'}`}>
              3
            </div>
            <span>완료</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 단계 1: 입력 */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">입력 형식 안내</h3>
                <p className="text-sm text-blue-800 mb-2">
                  각 줄에 한 명씩 입력하세요. 형식: <code className="bg-blue-100 px-1 py-0.5 rounded">이름(영어이름)</code>
                </p>
                <div className="bg-white border border-blue-200 rounded p-3 text-sm font-mono space-y-1">
                  <div>김나윤A(Chloe)</div>
                  <div>현가현(Sophia)</div>
                  <div>이세인A(Vera)</div>
                  <div>전민석(Min)</div>
                  <div>이우민 ← 영어 이름 없으면 건너뜀</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  학생 목록 입력
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="김나윤A(Chloe)&#10;현가현(Sophia)&#10;이세인A(Vera)"
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fdb813] focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* 입력 통계 */}
              {parsedEntries.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">파싱 결과</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">전체:</span>
                      <span className="ml-2 font-semibold text-gray-900">{stats.total}명</span>
                    </div>
                    <div>
                      <span className="text-gray-600">업데이트 가능:</span>
                      <span className="ml-2 font-semibold text-green-600">{stats.ready}명</span>
                    </div>
                    <div>
                      <span className="text-gray-600">오류:</span>
                      <span className="ml-2 font-semibold text-red-600">{stats.errors}명</span>
                    </div>
                    <div>
                      <span className="text-gray-600">건너뜀:</span>
                      <span className="ml-2 font-semibold text-gray-500">{stats.skipped}명</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 단계 2: 미리보기 */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 mb-2">업데이트 미리보기</h3>
                <p className="text-sm text-amber-800">
                  아래 목록을 확인하고 업데이트를 진행하세요.
                </p>
              </div>

              <div className="space-y-2">
                {parsedEntries.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      entry.status === 'ready'
                        ? 'bg-green-50 border-green-200'
                        : entry.status === 'skipped'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {entry.status === 'ready' && (
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        {entry.status === 'skipped' && (
                          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                        {entry.status === 'error' && (
                          <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {entry.koreanName}
                            {entry.englishName && (
                              <span className="ml-2 text-[#fdb813]">→ {entry.englishName}</span>
                            )}
                          </div>
                          {entry.foundStudent && entry.foundStudent.englishName && (
                            <div className="text-xs text-gray-500">
                              현재: {entry.foundStudent.englishName}
                            </div>
                          )}
                          {entry.errorMessage && (
                            <div className="text-xs text-red-600 mt-1">{entry.errorMessage}</div>
                          )}
                        </div>
                      </div>
                      {entry.foundStudent && (
                        <div className="text-xs text-gray-500">
                          {entry.foundStudent.school} {entry.foundStudent.grade}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 단계 3: 결과 */}
          {step === 'result' && resultStats && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">업데이트 완료</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">성공:</span>
                    <span className="ml-2 font-semibold text-green-600">{resultStats.success}명</span>
                  </div>
                  <div>
                    <span className="text-gray-600">변경 없음:</span>
                    <span className="ml-2 font-semibold text-blue-600">{resultStats.noChange}명</span>
                  </div>
                  <div>
                    <span className="text-gray-600">실패:</span>
                    <span className="ml-2 font-semibold text-red-600">{resultStats.errors}명</span>
                  </div>
                  <div>
                    <span className="text-gray-600">건너뜀:</span>
                    <span className="ml-2 font-semibold text-gray-500">{resultStats.skipped}명</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {processedEntries.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      entry.status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : entry.status === 'no-change'
                        ? 'bg-blue-50 border-blue-200'
                        : entry.status === 'skipped'
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {entry.status === 'success' && (
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        {entry.status === 'no-change' && (
                          <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        )}
                        {entry.status === 'skipped' && (
                          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        )}
                        {entry.status === 'error' && (
                          <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {entry.koreanName}
                            {entry.englishName && (
                              <span className="ml-2 text-[#fdb813]">→ {entry.englishName}</span>
                            )}
                          </div>
                          {entry.errorMessage && (
                            <div className="text-xs text-gray-500 mt-1">{entry.errorMessage}</div>
                          )}
                        </div>
                      </div>
                      {entry.status === 'success' && (
                        <span className="text-xs text-green-600 font-medium">업데이트 완료</span>
                      )}
                      {entry.status === 'no-change' && (
                        <span className="text-xs text-blue-600 font-medium">변경 없음</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            {step === 'result' ? '닫기' : '취소'}
          </button>

          <div className="flex gap-2">
            {step === 'input' && (
              <button
                onClick={handlePreview}
                disabled={parsedEntries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-[#fdb813] text-white rounded-lg hover:bg-[#fdb813]/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-4 h-4" />
                미리보기
              </button>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('input')}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={isProcessing}
                >
                  이전
                </button>
                <button
                  onClick={handleBulkUpdate}
                  disabled={stats.ready === 0 || isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-[#081429] text-white rounded-lg hover:bg-[#081429]/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Check className="w-4 h-4" />
                  {isProcessing ? '업데이트 중...' : `${stats.ready}명 업데이트`}
                </button>
              </>
            )}

            {step === 'result' && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-[#fdb813] text-white rounded-lg hover:bg-[#fdb813]/90 transition-colors"
              >
                <Check className="w-4 h-4" />
                완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEnglishNameUpdateModal;
