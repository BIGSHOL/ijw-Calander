import React, { useState, useMemo } from 'react';
import { X, Upload, Check, Loader2, Database, AlertCircle } from 'lucide-react';
import { read, utils } from 'xlsx';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { ConsultationRecord, ConsultationSubject, ConsultationStatus, SchoolGrade } from '../../types';

interface RegistrationMigrationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRecord extends Omit<ConsultationRecord, 'id'> {
  _isDuplicate?: boolean;
  _rowNumber?: number;
}

// Performance: js-hoist-regexp - RegExp를 모듈 레벨로 호이스팅
const MONTH_SHEET_PATTERN = /^\d+월$/;
const GRADE_ELEMENTARY_PATTERN = /초(\d)/;
const GRADE_MIDDLE_PATTERN = /중(\d)/;
const GRADE_HIGH_PATTERN = /고(\d)/;
const SCHOOL_PATTERN = /^([가-힣]+)[초중고]/;
const DATE_FORMAT_PATTERN = /^\d{4}\.\d{1,2}\.\d{1,2}$/;

// 학년 매핑
function mapGrade(raw: any): SchoolGrade {
  if (!raw) return '기타' as SchoolGrade;
  const str = String(raw).trim();

  // 패턴: "종로초3" → "초3", "일중3" → "중3"
  if (str.includes('초')) {
    const match = str.match(GRADE_ELEMENTARY_PATTERN);
    return match ? (`초${match[1]}` as SchoolGrade) : '기타' as SchoolGrade;
  }
  if (str.includes('중')) {
    const match = str.match(GRADE_MIDDLE_PATTERN);
    return match ? (`중${match[1]}` as SchoolGrade) : '기타' as SchoolGrade;
  }
  if (str.includes('고')) {
    const match = str.match(GRADE_HIGH_PATTERN);
    return match ? (`고${match[1]}` as SchoolGrade) : '기타' as SchoolGrade;
  }

  return '기타' as SchoolGrade;
}

// 학교 추출
function extractSchool(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();

  // "종로초3" → "종로초등학교"
  const match = str.match(SCHOOL_PATTERN);
  if (match) {
    if (str.includes('초')) return match[1] + '초등학교';
    if (str.includes('중')) return match[1] + '중학교';
    if (str.includes('고')) return match[1] + '고등학교';
  }

  return str;
}

// 과목 매핑
function mapSubject(raw: any): ConsultationSubject {
  if (!raw) return '기타' as ConsultationSubject;
  const str = String(raw).toUpperCase();

  if (str.includes('EIE') || str.includes('영어') || str.includes('ENGLISH')) return 'English';
  if (str.includes('수학') || str.includes('MATH')) return 'Math';

  return '기타' as ConsultationSubject;
}

// 등록여부 매핑
function mapStatus(raw: any): ConsultationStatus {
  if (!raw) return '미등록';
  const str = String(raw).trim();

  if (str.includes('영어등록')) return '영어등록';
  if (str.includes('수학등록')) return '수학등록';
  if (str.includes('영수등록')) return '영수등록';
  if (str.includes('미등록')) return '미등록';
  if (str.includes('이번달') || str.includes('등록예정')) return '이번달 등록예정';
  if (str.includes('추후')) return '추후 등록예정';

  return (str || '미등록') as ConsultationStatus;
}

// 날짜 변환
function parseDate(raw: any, yearMonth: string): string {
  if (!raw) return '';

  const str = String(raw).trim();

  // "2026.01.03" 형식
  if (DATE_FORMAT_PATTERN.test(str)) {
    const [year, month, day] = str.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // 숫자 (1.03 = 1월 3일)
  if (typeof raw === 'number' && raw < 32) {
    const [month, day] = String(raw).split('.');
    const year = yearMonth.split('-')[0];
    return `${year}-${month.padStart(2, '0')}-${(day || '01').padStart(2, '0')}`;
  }

  return '';
}

// Performance: rendering-hoist-jsx - 정적 JSX를 컴포넌트 외부로 추출
const TABLE_HEADERS = (
  <thead className="bg-gray-100 sticky top-0">
    <tr>
      <th className="px-2 py-1 text-left">행</th>
      <th className="px-2 py-1 text-left">이름</th>
      <th className="px-2 py-1 text-left">학교학년</th>
      <th className="px-2 py-1 text-left">상담일</th>
      <th className="px-2 py-1 text-left">과목</th>
      <th className="px-2 py-1 text-left">등록여부</th>
      <th className="px-2 py-1 text-left">상태</th>
    </tr>
  </thead>
);

const RegistrationMigrationModal: React.FC<RegistrationMigrationModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'migrating' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, new: 0, duplicate: 0 });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      // 엑셀 파일 읽기
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { cellDates: false });

      // 월별 시트 필터링 (예: "1월", "12월")
      const monthSheets = workbook.SheetNames.filter(name => MONTH_SHEET_PATTERN.test(name));

      if (monthSheets.length === 0) {
        throw new Error('월별 시트가 없습니다. (예: 1월, 2월, ...)');
      }

      console.log(`📋 처리할 시트: ${monthSheets.join(', ')}`);

      // Performance: js-set-map-lookups - Set을 사용한 O(1) 중복 검색
      const existingSnapshot = await getDocs(collection(db, 'consultations'));
      const existingKeys = new Set<string>();

      existingSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        // 중복 키: 이름_상담일_내용앞50자
        const key = `${data.studentName}_${data.consultationDate.substring(0, 10)}_${(data.notes || '').substring(0, 50)}`;
        existingKeys.add(key);
      });

      const allRecords: ParsedRecord[] = [];

      // 모든 월별 시트 처리
      for (const sheetName of monthSheets) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any[][];

        // 월 추출 (예: "1월" → "2026-01")
        const monthNum = sheetName.replace('월', '').padStart(2, '0');
        const yearMonth = `2026-${monthNum}`;

        // Row 0: 빈 행, Row 1: 헤더, Row 2+: 데이터
        const dataRows = rawData.slice(2);

        dataRows.forEach((row, idx) => {
          // 빈 행 스킵 (이름 없으면)
          if (!row[3] || row[3] === '') return;

          const studentName = String(row[3] || '').trim();
          const consultationDate = parseDate(row[6], yearMonth) || parseDate(row[1], yearMonth);
          const notes = String(row[15] || '').trim();

          // 중복 체크
          const key = `${studentName}_${consultationDate}_${notes.substring(0, 50)}`;
          const isDuplicate = existingKeys.has(key);

          const record: ParsedRecord = {
            // 학생 정보
            studentName,
            schoolName: extractSchool(row[4]),
            grade: mapGrade(row[4]),
            address: String(row[5] || '').trim(),
            parentPhone: '', // 엑셀에 없음

            // 상담 정보
            consultationDate: consultationDate + 'T00:00:00.000Z',
            subject: mapSubject(row[7]),
            counselor: String(row[8] || '').trim(),
            receiver: String(row[2] || '').trim(),

            // 등록 정보
            status: mapStatus(row[9]),
            registrar: String(row[11] || '').trim(),
            paymentAmount: String(row[12] || ''),
            paymentDate: parseDate(row[14], yearMonth) ? parseDate(row[14], yearMonth) + 'T00:00:00.000Z' : '',

            // 상담 내용
            notes,
            nonRegistrationReason: String(row[16] || '').trim(),
            followUpDate: parseDate(row[17], yearMonth) ? parseDate(row[17], yearMonth) + 'T00:00:00.000Z' : '',
            followUpContent: String(row[18] || '').trim(),
            consultationPath: String(row[19] || '').trim(),

            // 메타데이터
            createdAt: parseDate(row[1], yearMonth) + 'T00:00:00.000Z',
            updatedAt: new Date().toISOString(),

            // 중복 여부 및 행 번호
            _isDuplicate: isDuplicate,
            _rowNumber: idx + 3, // Row 2부터 시작이므로 +3
          };

          allRecords.push(record);
        });
      }

      // Performance: js-combine-iterations - filter 2번을 단일 루프로 결합
      let newCount = 0;
      let duplicateCount = 0;
      for (let i = 0; i < allRecords.length; i++) {
        if (allRecords[i]._isDuplicate) {
          duplicateCount++;
        } else {
          newCount++;
        }
      }

      setStats({
        total: allRecords.length,
        new: newCount,
        duplicate: duplicateCount,
      });

      setParsedRecords(allRecords);
      setStep('preview');
      setLoading(false);

    } catch (err: any) {
      console.error('파일 업로드 오류:', err);
      setError(err.message || '파일 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setStep('migrating');
    setProgress(0);
    setError(null);

    try {
      const newRecords = parsedRecords.filter(r => !r._isDuplicate);

      if (newRecords.length === 0) {
        throw new Error('추가할 새로운 레코드가 없습니다.');
      }

      const batchSize = 450; // Firestore limit: 500
      const batches = Math.ceil(newRecords.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = writeBatch(db);
        const start = i * batchSize;
        const end = Math.min(start + batchSize, newRecords.length);
        const batchRecords = newRecords.slice(start, end);

        batchRecords.forEach(record => {
          const timestamp = Date.now().toString(36);
          const dateStr = record.consultationDate.substring(0, 10).replace(/-/g, '');
          const docId = `${dateStr}_${record.studentName}_${timestamp}`;

          // _isDuplicate, _rowNumber 제거
          const { _isDuplicate, _rowNumber, ...cleanRecord } = record;

          const docRef = doc(db, 'consultations', docId);
          batch.set(docRef, cleanRecord);
        });

        await batch.commit();
        setProgress(Math.round(((i + 1) / batches) * 100));
      }

      setStep('done');

    } catch (err: any) {
      console.error('마이그레이션 오류:', err);
      setError(err.message || '마이그레이션 중 오류가 발생했습니다.');
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="px-5 py-3 border-b flex justify-between items-center bg-[#081429]">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#fdb813]" />
            <h2 className="text-lg font-bold text-white">등록 상담 DB 불러오기</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: 파일 업로드 */}
          {step === 'upload' && (
            <div className="text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-[#fdb813]" />
              <h3 className="text-xl font-bold text-[#081429] mb-2">Excel 파일 업로드</h3>
              <p className="text-gray-600 mb-6">
                월별 시트 (예: 1월, 2월, ...)가 포함된 엑셀 파일을 선택하세요.
              </p>

              <label className="inline-block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
                <div className="px-6 py-3 bg-[#fdb813] text-[#081429] rounded-lg font-semibold cursor-pointer hover:bg-[#e5a711] transition-colors inline-flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      파일 선택
                    </>
                  )}
                </div>
              </label>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 미리보기 */}
          {step === 'preview' && (
            <div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-bold text-blue-900 mb-2">📊 마이그레이션 통계</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">전체 레코드:</span>
                    <span className="ml-2 font-bold text-blue-900">{stats.total}개</span>
                  </div>
                  <div>
                    <span className="text-gray-600">신규 추가:</span>
                    <span className="ml-2 font-bold text-green-600">{stats.new}개</span>
                  </div>
                  <div>
                    <span className="text-gray-600">중복 스킵:</span>
                    <span className="ml-2 font-bold text-orange-600">{stats.duplicate}개</span>
                  </div>
                </div>
              </div>

              {/* 미리보기 테이블 */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-bold text-[#081429]">데이터 미리보기 (최대 20개)</h4>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    {TABLE_HEADERS}
                    <tbody>
                      {parsedRecords.slice(0, 20).map((record, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-gray-100 ${record._isDuplicate ? 'bg-orange-50' : ''}`}
                        >
                          <td className="px-2 py-1 text-gray-500">{record._rowNumber}</td>
                          <td className="px-2 py-1 font-medium">{record.studentName}</td>
                          <td className="px-2 py-1 text-gray-600">
                            {record.schoolName} {record.grade}
                          </td>
                          <td className="px-2 py-1 text-gray-600">
                            {record.consultationDate.substring(0, 10)}
                          </td>
                          <td className="px-2 py-1">
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                              {record.subject}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              record.status.includes('등록') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            {record._isDuplicate ? (
                              <span className="text-orange-600 font-medium">중복</span>
                            ) : (
                              <span className="text-green-600 font-medium">신규</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleMigrate}
                  disabled={stats.new === 0}
                  className="px-4 py-2 bg-[#fdb813] text-[#081429] rounded-lg font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  {stats.new}개 마이그레이션 실행
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 마이그레이션 중 */}
          {step === 'migrating' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#fdb813] animate-spin" />
              <h3 className="text-xl font-bold text-[#081429] mb-2">마이그레이션 진행 중...</h3>
              <p className="text-gray-600 mb-4">잠시만 기다려주세요.</p>

              <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-[#fdb813] h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">{progress}% 완료</p>
            </div>
          )}

          {/* Step 4: 완료 */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-[#081429] mb-2">마이그레이션 완료!</h3>
              <p className="text-gray-600 mb-6">
                {stats.new}개의 상담 기록이 성공적으로 추가되었습니다.
              </p>

              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-3 bg-[#fdb813] text-[#081429] rounded-lg font-semibold hover:bg-[#e5a711] transition-colors"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationMigrationModal;
