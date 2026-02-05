import React, { useState } from 'react';
import { X, Upload, Check, Loader2, Database, AlertCircle, FileSpreadsheet, Eye, PlayCircle, CheckCircle2 } from 'lucide-react';
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
  _sheetName?: string;
  _matchedStudentId?: string; // 매칭된 학생 ID
  _matchedStudentName?: string; // 매칭된 학생 이름 (표시용)
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

  // 패턴1: "신목초등학교5" → "초5"
  // 패턴2: "종로초3" → "초3"
  // 패턴3: "경일여중학교2" → "중2"

  // 초등학교 패턴
  if (str.includes('초')) {
    // "초등학교5" 또는 "초5" 형식에서 숫자 추출
    const match1 = str.match(/초등학교(\d)/);
    if (match1) return `초${match1[1]}` as SchoolGrade;

    const match2 = str.match(GRADE_ELEMENTARY_PATTERN);
    if (match2) return `초${match2[1]}` as SchoolGrade;
  }

  // 중학교 패턴
  if (str.includes('중')) {
    const match1 = str.match(/중학교(\d)/);
    if (match1) return `중${match1[1]}` as SchoolGrade;

    const match2 = str.match(GRADE_MIDDLE_PATTERN);
    if (match2) return `중${match2[1]}` as SchoolGrade;
  }

  // 고등학교 패턴
  if (str.includes('고')) {
    const match1 = str.match(/고등학교(\d)/);
    if (match1) return `고${match1[1]}` as SchoolGrade;

    const match2 = str.match(GRADE_HIGH_PATTERN);
    if (match2) return `고${match2[1]}` as SchoolGrade;
  }

  return '기타' as SchoolGrade;
}

// 학교 추출
function extractSchool(raw: any): string {
  if (!raw) return '';
  const str = String(raw).trim();

  // 패턴1: "신목초등학교5" → "신목초등학교"
  // 패턴2: "경일여중학교2" → "경일여중학교"
  // 패턴3: "종로초3" → "종로초등학교"

  // 이미 "초등학교", "중학교", "고등학교"가 포함된 경우 → 뒤의 숫자만 제거
  if (str.includes('초등학교')) {
    return str.replace(/(\d+)$/, ''); // 마지막 숫자 제거
  }
  if (str.includes('중학교')) {
    return str.replace(/(\d+)$/, '');
  }
  if (str.includes('고등학교')) {
    return str.replace(/(\d+)$/, '');
  }

  // "종로초3" 형식 → "종로초등학교"
  const match = str.match(SCHOOL_PATTERN);
  if (match) {
    if (str.includes('초')) return match[1] + '초등학교';
    if (str.includes('중')) return match[1] + '중학교';
    if (str.includes('고')) return match[1] + '고등학교';
  }

  return str;
}

// 화면 표시용 학교 이름 (짧게)
function getDisplaySchoolName(schoolName: string): string {
  if (!schoolName) return '';
  return schoolName
    .replace('초등학교', '초')
    .replace('중학교', '중')
    .replace('고등학교', '고');
}

// 과목 매핑
function mapSubject(raw: any): ConsultationSubject {
  if (!raw) return ConsultationSubject.Other;
  const str = String(raw).toUpperCase();

  if (str.includes('EIE') || str.includes('영어') || str.includes('ENGLISH')) return ConsultationSubject.English;
  if (str.includes('수학') || str.includes('MATH')) return ConsultationSubject.Math;

  return ConsultationSubject.Other;
}

// 등록여부 매핑
function mapStatus(raw: any): ConsultationStatus {
  if (!raw) return ConsultationStatus.NotRegistered;
  const str = String(raw).trim();

  if (str.includes('영어등록')) return ConsultationStatus.EngRegistered;
  if (str.includes('수학등록')) return ConsultationStatus.MathRegistered;
  if (str.includes('영수등록')) return ConsultationStatus.EngMathRegistered;
  if (str.includes('미등록')) return ConsultationStatus.NotRegistered;
  if (str.includes('이번달') || str.includes('등록예정')) return ConsultationStatus.PendingThisMonth;
  if (str.includes('추후')) return ConsultationStatus.PendingFuture;

  return (str || ConsultationStatus.NotRegistered) as ConsultationStatus;
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
      <th className="px-2 py-1 text-left text-xxs">상담일</th>
      <th className="px-2 py-1 text-left text-xxs">이름</th>
      <th className="px-2 py-1 text-left text-xxs">학교</th>
      <th className="px-2 py-1 text-left text-xxs">학년</th>
      <th className="px-2 py-1 text-left text-xxs">과목</th>
      <th className="px-2 py-1 text-left text-xxs">학생연동</th>
      <th className="px-2 py-1 text-left text-xxs">등록여부</th>
      <th className="px-2 py-1 text-left text-xxs">상태</th>
      <th className="px-2 py-1 text-left text-xxs">시트</th>
      <th className="px-2 py-1 text-left text-xxs">행</th>
    </tr>
  </thead>
);

const RegistrationMigrationModal: React.FC<RegistrationMigrationModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'upload' | 'sheet-select' | 'preview' | 'migrating' | 'done'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, new: 0, duplicate: 0, matched: 0 });

  // 시트 선택 상태
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [workbookData, setWorkbookData] = useState<any>(null);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const RECORDS_PER_PAGE = 50;

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
        throw new Error(`월별 시트가 없습니다. (예: 1월, 2월, ...)\n현재 시트: ${workbook.SheetNames.join(', ')}`);
      }

      // 워크북과 시트 목록 저장
      setWorkbookData(workbook);
      setAvailableSheets(monthSheets);
      setSelectedSheets(new Set(monthSheets)); // 기본값: 전체 선택
      setStep('sheet-select');
      setLoading(false);

    } catch (err: any) {
      console.error('파일 업로드 오류:', err);
      setError(err.message || '파일 처리 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleParseSelectedSheets = async () => {
    if (!workbookData || selectedSheets.size === 0) {
      setError('시트를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const workbook = workbookData;

      // 1. 기존 상담 기록 중복 검사
      const existingSnapshot = await getDocs(collection(db, 'consultations'));
      const existingKeys = new Set<string>();

      existingSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        // 중복 키: 이름_상담일_내용앞50자
        const key = `${data.studentName}_${data.consultationDate.substring(0, 10)}_${(data.notes || '').substring(0, 50)}`;
        existingKeys.add(key);
      });

      // 2. 기존 학생 DB 조회 (자동 매칭용)
      const studentsSnapshot = await getDocs(collection(db, 'students'));
      const studentMatchMap = new Map<string, { id: string; name: string }>();

      studentsSnapshot.docs.forEach(docSnap => {
        const student = docSnap.data();
        // 매칭 키: 이름_학교
        const matchKey = `${student.name}_${student.school || ''}`;
        studentMatchMap.set(matchKey, {
          id: docSnap.id,
          name: student.name
        });
      });

      const allRecords: ParsedRecord[] = [];

      // 선택된 시트만 처리
      const sheetsToProcess = Array.from(selectedSheets);

      for (const sheetName of sheetsToProcess) {
        const sheet = workbook.Sheets[sheetName];
        const rawData = utils.sheet_to_json(sheet, { defval: '', header: 1 }) as any[][];

        // 월 추출 및 연도 판단
        // 10월, 11월, 12월 → 2025년
        // 1월, 2월, ... 9월 → 2026년
        const monthNum = sheetName.replace('월', '').padStart(2, '0');
        const month = parseInt(monthNum, 10);
        const year = month >= 10 ? '2025' : '2026';
        const yearMonth = `${year}-${monthNum}`;

        // Row 0: 빈 행, Row 1: 헤더, Row 2+: 데이터
        const dataRows = rawData.slice(2);

        // 시트 구조 감지 (헤더 확인)
        const headers = rawData[1] || [];
        const hasPhoneColumn = headers.some((h: any) => String(h).includes('전화번호'));

        // 컬럼 인덱스 매핑 (전화번호 유무에 따라 다름)
        // hasPhoneColumn = true: 1월, 2월 구조 (전화번호 있음, 모든 컬럼 +1)
        // hasPhoneColumn = false: 10~12월 구조 (전화번호 없음)
        const col = hasPhoneColumn ? {
          name: 4,           // E열 (전화번호 있음)
          schoolGrade: 5,    // F열
          address: 6,        // G열
          consultDate: 7,    // H열
          subject: 8,        // I열
          counselor: 9,      // J열
          status: 10,        // K열
          parentPhone: 11,   // L열
          registrar: 12,     // M열
          amount: 13,        // N열
          paymentDate: 15,   // P열
          notes: 16,         // Q열
          nonRegReason: 17,  // R열
          followUpDate: 18,  // S열
          followUpContent: 19, // T열
          consultPath: 20    // U열
        } : {
          name: 3,           // D열 (전화번호 없음)
          schoolGrade: 4,    // E열
          address: 5,        // F열
          consultDate: 6,    // G열
          subject: 7,        // H열
          counselor: 8,      // I열
          status: 9,         // J열
          parentPhone: 10,   // K열
          registrar: 11,     // L열
          amount: 12,        // M열
          paymentDate: 14,   // O열
          notes: 15,         // P열
          nonRegReason: 16,  // Q열
          followUpDate: 17,  // R열
          followUpContent: 18, // S열
          consultPath: 19    // T열
        };

        let skippedCount = 0;
        let processedCount = 0;

        dataRows.forEach((row, idx) => {
          // 빈 행 스킵 (이름 없으면)
          if (!row[col.name] || row[col.name] === '') {
            skippedCount++;
            return;
          }

          processedCount++;

          const studentName = String(row[col.name] || '').trim(); // 이름
          const consultationDate = parseDate(row[col.consultDate], yearMonth) || parseDate(row[1], yearMonth) || `${yearMonth}-01`; // 상담일 (fallback: 접수일 → 해당월 1일)
          const notes = String(row[col.notes] || '').trim(); // 상담내용

          // 중복 체크
          const key = `${studentName}_${consultationDate}_${notes.substring(0, 50)}`;
          const isDuplicate = existingKeys.has(key);

          // 학생 매칭 체크 (이름 + 학교)
          const schoolName = extractSchool(row[col.schoolGrade]); // 학교학년
          const parentPhone = String(row[col.parentPhone] || '').trim(); // 보호자 연락처
          const matchKey = `${studentName}_${schoolName}`;
          const matchedStudent = studentMatchMap.get(matchKey);

          const record: ParsedRecord = {
            // 학생 정보
            studentName,
            schoolName: extractSchool(row[col.schoolGrade]), // 학교학년
            grade: mapGrade(row[col.schoolGrade]), // 학교학년
            address: String(row[col.address] || '').trim(), // 주소
            parentPhone,

            // 상담 정보
            consultationDate: consultationDate + 'T00:00:00.000Z',
            subject: mapSubject(row[col.subject]), // 과목
            counselor: String(row[col.counselor] || '').trim(), // 상담자
            receiver: String(row[2] || '').trim(), // C열: 수신자 (구조 무관하게 동일)

            // 등록 정보
            status: mapStatus(row[col.status]), // 등록여부
            registrar: String(row[col.registrar] || '').trim(), // 등록자
            paymentAmount: String(row[col.amount] || ''), // 금액
            paymentDate: parseDate(row[col.paymentDate], yearMonth) ? parseDate(row[col.paymentDate], yearMonth) + 'T00:00:00.000Z' : '', // 납부일

            // 상담 내용
            notes,
            nonRegistrationReason: String(row[col.nonRegReason] || '').trim(), // 미등록사유
            followUpDate: parseDate(row[col.followUpDate], yearMonth) ? parseDate(row[col.followUpDate], yearMonth) + 'T00:00:00.000Z' : '', // 추후상담일
            followUpContent: String(row[col.followUpContent] || '').trim(), // 추후상담내용
            consultationPath: String(row[col.consultPath] || '').trim(), // 상담경로

            // 메타데이터
            createdAt: (parseDate(row[1], yearMonth) || consultationDate) + 'T00:00:00.000Z', // B열: 접수일 (fallback: 상담일)
            updatedAt: new Date().toISOString(),

            // 중복 여부, 행 번호, 시트 이름, 학생 매칭 정보
            _isDuplicate: isDuplicate,
            _rowNumber: idx + 3, // Row 2부터 시작이므로 +3
            _sheetName: sheetName,
            _matchedStudentId: matchedStudent?.id,
            _matchedStudentName: matchedStudent?.name,
          };

          allRecords.push(record);
        });
      }

      // 통계 계산: 전체, 신규, 중복, 학생 매칭
      let newCount = 0;
      let duplicateCount = 0;
      let matchedCount = 0;

      for (let i = 0; i < allRecords.length; i++) {
        if (allRecords[i]._isDuplicate) {
          duplicateCount++;
        } else {
          newCount++;
        }
        if (allRecords[i]._matchedStudentId) {
          matchedCount++;
        }
      }

      setStats({
        total: allRecords.length,
        new: newCount,
        duplicate: duplicateCount,
        matched: matchedCount,
      });

      setParsedRecords(allRecords);
      setCurrentPage(1); // 페이지 초기화
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
          // 랜덤 ID 생성 (20자 영숫자)
          const docId = Array.from({ length: 20 }, () =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
          ).join('');

          // 메타데이터 필드 제거하고, 매칭된 학생 ID는 registeredStudentId로 설정
          const { _isDuplicate, _rowNumber, _sheetName, _matchedStudentId, _matchedStudentName, ...cleanRecord } = record;

          // 학생 매칭이 있으면 registeredStudentId 자동 설정
          const finalRecord = _matchedStudentId
            ? { ...cleanRecord, registeredStudentId: _matchedStudentId }
            : cleanRecord;

          const docRef = doc(db, 'consultations', docId);
          batch.set(docRef, finalRecord);
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/50 p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent" />
            <h2 className="text-sm font-bold text-primary">등록 상담 DB 불러오기</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: 파일 업로드 */}
          {step === 'upload' && (
            <div>
              {/* Section: 파일 업로드 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <Upload className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold text-primary">Excel 파일 업로드</h3>
                </div>

                <div className="text-center">
                  <Upload className="w-16 h-16 mx-auto mb-4 text-accent" />
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
                    <div className="px-6 py-3 bg-accent text-primary rounded-sm font-semibold cursor-pointer hover:bg-[#e5a711] transition-colors inline-flex items-center gap-2">
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
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 시트 선택 */}
          {step === 'sheet-select' && (
            <div>
              {/* Section: 시트 선택 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <FileSpreadsheet className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold text-primary">불러올 시트 선택</h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  마이그레이션할 월별 시트를 선택하세요. (기본값: 전체 선택)
                </p>

                {/* 전체 선택/해제 버튼 */}
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setSelectedSheets(new Set(availableSheets))}
                    className="px-3 py-1.5 bg-blue-500 text-white rounded-sm text-sm font-medium hover:bg-blue-600 transition-colors"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={() => setSelectedSheets(new Set())}
                    className="px-3 py-1.5 bg-gray-500 text-white rounded-sm text-sm font-medium hover:bg-gray-600 transition-colors"
                  >
                    전체 해제
                  </button>
                </div>

                {/* 시트 선택 그리드 */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {availableSheets.map(sheetName => (
                    <button
                      key={sheetName}
                      onClick={() => {
                        const newSelected = new Set(selectedSheets);
                        if (newSelected.has(sheetName)) {
                          newSelected.delete(sheetName);
                        } else {
                          newSelected.add(sheetName);
                        }
                        setSelectedSheets(newSelected);
                      }}
                      className={`px-4 py-3 rounded-sm border-2 transition-all font-medium text-sm ${
                        selectedSheets.has(sheetName)
                          ? 'bg-accent border-accent text-primary shadow-md'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{sheetName}</span>
                        {selectedSheets.has(sheetName) && (
                          <Check size={16} className="ml-2" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* 선택된 시트 개수 */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-sm">
                  <p className="text-sm text-blue-900">
                    <strong>{selectedSheets.size}개</strong> 시트가 선택되었습니다.
                    {selectedSheets.size > 0 && (
                      <span className="ml-2 text-blue-700">
                        ({Array.from(selectedSheets).join(', ')})
                      </span>
                    )}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex justify-between gap-3">
                  <button
                    onClick={() => {
                      setStep('upload');
                      setWorkbookData(null);
                      setAvailableSheets([]);
                      setSelectedSheets(new Set());
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    ← 다른 파일 선택
                  </button>
                  <button
                    onClick={handleParseSelectedSheets}
                    disabled={selectedSheets.size === 0 || loading}
                    className="px-6 py-2 bg-accent text-primary rounded-sm font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        데이터 분석 중...
                      </>
                    ) : (
                      <>
                        다음 단계 →
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 미리보기 */}
          {step === 'preview' && (
            <div>
              {/* Section: 마이그레이션 통계 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <Eye className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold text-primary">마이그레이션 통계</h3>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-sm">
                  <div className="grid grid-cols-4 gap-4 text-sm">
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
                    <div>
                      <span className="text-gray-600">학생 연동:</span>
                      <span className="ml-2 font-bold text-emerald-600">{stats.matched}개</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: 데이터 미리보기 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <Database className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold text-primary">데이터 미리보기</h3>
                </div>

                <div className="border border-gray-200 rounded-sm overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-primary">
                      전체 {stats.total}개
                    </h4>
                    <div className="text-xs text-gray-600">
                      페이지 {currentPage} / {Math.ceil(stats.total / RECORDS_PER_PAGE)}
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs">
                      {TABLE_HEADERS}
                      <tbody>
                        {parsedRecords
                          .slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE)
                          .map((record, idx) => (
                          <tr
                            key={idx}
                            className={`border-b border-gray-100 ${record._isDuplicate ? 'bg-orange-50' : ''}`}
                          >
                            <td className="px-2 py-1 text-gray-600">
                              {record.consultationDate.substring(0, 10)}
                            </td>
                            <td className="px-2 py-1 font-medium">{record.studentName}</td>
                            <td className="px-2 py-1 text-gray-600">
                              {getDisplaySchoolName(record.schoolName)}
                            </td>
                            <td className="px-2 py-1 text-gray-600">
                              {record.grade}
                            </td>
                            <td className="px-2 py-1">
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                {record.subject}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              {record._matchedStudentId ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1 w-fit">
                                  연결됨
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium flex items-center gap-1 w-fit">
                                  신규
                                </span>
                              )}
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
                            <td className="px-2 py-1">
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                                {record._sheetName}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-gray-500">{record._rowNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 페이지네이션 컨트롤 */}
                  {stats.total > RECORDS_PER_PAGE && (
                    <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="text-xs text-gray-600">
                        {(currentPage - 1) * RECORDS_PER_PAGE + 1} - {Math.min(currentPage * RECORDS_PER_PAGE, stats.total)} / {stats.total}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(stats.total / RECORDS_PER_PAGE), prev + 1))}
                        disabled={currentPage === Math.ceil(stats.total / RECORDS_PER_PAGE)}
                        className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-sm flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleMigrate}
                    disabled={stats.new === 0}
                    className="px-4 py-2 bg-accent text-primary rounded-sm font-semibold hover:bg-[#e5a711] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    {stats.new}개 마이그레이션 실행
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: 마이그레이션 중 */}
          {step === 'migrating' && (
            <div>
              {/* Section: 마이그레이션 진행 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <PlayCircle className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold text-primary">마이그레이션 진행 중</h3>
                </div>

                <div className="text-center py-8">
                  <Loader2 className="w-16 h-16 mx-auto mb-4 text-accent animate-spin" />
                  <p className="text-gray-600 mb-4">잠시만 기다려주세요.</p>

                  <div className="w-full max-w-md mx-auto bg-gray-200 rounded-sm h-4 overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{progress}% 완료</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 완료 */}
          {step === 'done' && (
            <div>
              {/* Section: 완료 */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-bold text-primary">마이그레이션 완료</h3>
                </div>

                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-sm flex items-center justify-center">
                    <Check className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-gray-600 mb-6">
                    {stats.new}개의 상담 기록이 성공적으로 추가되었습니다.
                  </p>

                  <button
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="px-6 py-3 bg-accent text-primary rounded-sm font-semibold hover:bg-[#e5a711] transition-colors"
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationMigrationModal;
