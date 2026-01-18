/**
 * 학생 데이터 마이그레이션 모달
 * - public/student-migration-data.json 데이터를 로드하여 Firebase에 저장
 * - 기존 학생과 이름 매칭하여 업데이트 또는 신규 추가
 * - 영어 수업 정보 자동 매핑 (수학은 수동)
 */

import React, { useState, useRef } from 'react';
import { Database, X, Upload, AlertCircle, Check, Loader2, FileSpreadsheet } from 'lucide-react';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { read, utils } from 'xlsx';

interface StudentMigrationModalProps {
  onClose: () => void;
}

// Excel 데이터 타입
interface ExcelStudentData {
  이름: string;
  성별: '남' | '여';
  출결번호?: string;
  학교?: string;
  학년?: string;
  원생연락처?: string;
  보호자연락처?: string;
  보호자구분?: string;
  보호자이름?: string;
  기타보호자연락처?: string;
  입학일?: string;
  주소1?: string;
  주소2?: string;
  메모?: string;
  수업?: string;
  담임강사?: string;
  기타항목1?: string;
  원생고유번호?: string;
}

const StudentMigrationModal: React.FC<StudentMigrationModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<'load' | 'preview' | 'migrating' | 'done'>('load');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [rawData, setRawData] = useState<ExcelStudentData[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1단계: 파일 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');

      let data: ExcelStudentData[] = [];

      if (isExcel) {
        // Excel 파일 파싱
        const arrayBuffer = await file.arrayBuffer();
        const workbook = read(arrayBuffer, { cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = utils.sheet_to_json(sheet, { raw: false, defval: '' });
      } else if (file.name.endsWith('.json')) {
        // JSON 파일 파싱
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onload = (e) => {
            try {
              data = JSON.parse(e.target?.result as string);
              resolve(data);
            } catch (err) {
              reject(new Error('JSON 파일 파싱 실패'));
            }
          };
          reader.onerror = () => reject(new Error('파일 읽기 실패'));
          reader.readAsText(file);
        });
      } else {
        throw new Error('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .json만 지원)');
      }

      if (!data || data.length === 0) {
        throw new Error('파일에 데이터가 없습니다.');
      }

      setRawData(data);
      setTotalCount(data.length);

      // 기존 학생과 매칭 분석 (문서 ID 기준)
      const studentsRef = collection(db, 'students');
      const existingSnapshot = await getDocs(studentsRef);
      const existingDocIds = new Set<string>();

      existingSnapshot.forEach(docSnap => {
        // 문서 ID를 기준으로 체크
        existingDocIds.add(docSnap.id);
      });

      // 신규/업데이트 카운트 (문서 ID 기준으로 판단)
      let newCnt = 0;
      let updateCnt = 0;

      data.forEach(item => {
        // 문서 ID 생성: 이름_학교_학년 형식
        const docId = `${item.이름}_${item.학교 || '미정'}_${item.학년 || '0'}`;
        if (existingDocIds.has(docId)) {
          updateCnt++;
        } else {
          newCnt++;
        }
      });

      // 상태 업데이트를 한 번에 처리
      setNewCount(newCnt);
      setUpdateCount(updateCnt);
      setLoading(false);

      // 다음 렌더링 사이클에서 step 변경
      setTimeout(() => {
        setStep('preview');
      }, 0);

    } catch (err: any) {
      console.error('에러 발생:', err);
      setError(err.message || '파일 업로드 중 오류가 발생했습니다.');
      setLoading(false);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 2단계: 마이그레이션 실행
  const handleMigrate = async () => {
    if (rawData.length === 0) return;

    setStep('migrating');
    setProgress(0);

    try {
      // 기존 학생 데이터 로드 (문서 ID 기준)
      const studentsRef = collection(db, 'students');
      const existingSnapshot = await getDocs(studentsRef);
      const existingStudentsMap = new Map<string, any>();

      existingSnapshot.forEach(docSnap => {
        const student = docSnap.data() as UnifiedStudent;
        // 문서 ID를 키로 사용하여 매핑
        existingStudentsMap.set(docSnap.id, {
          ...student,
          _firestoreDocId: docSnap.id
        });
      });

      // 데이터 변환 및 배치 저장
      const batchSize = 500;
      const batches = Math.ceil(rawData.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = writeBatch(db);
        const start = i * batchSize;
        const end = Math.min(start + batchSize, rawData.length);
        const batchData = rawData.slice(start, end);

        batchData.forEach(excelData => {
          const now = new Date().toISOString();

          // 문서 ID 생성: 이름_학교_학년 형식 (항상 이 패턴 사용)
          const docId = `${excelData.이름}_${excelData.학교 || '미정'}_${excelData.학년 || '0'}`;

          // 기존 문서가 있으면 가져옴 (문서 ID 기준)
          const existingStudent = existingStudentsMap.get(docId) as (UnifiedStudent & { _firestoreDocId?: string }) | undefined;

          // ID는 항상 문서 ID와 동일
          const id = docId;

          // 주소 통합
          const address = [excelData.주소1, excelData.주소2]
            .filter(Boolean)
            .join(' ')
            .trim();

          // 과목 추출
          const subjects: ('math' | 'english')[] = [];
          if (excelData.기타항목1) {
            const upper = excelData.기타항목1.toUpperCase();
            if (upper.includes('M')) subjects.push('math');
            if (upper.includes('E')) subjects.push('english');
          }

          // 학년 정규화 (초/중/고 + 숫자 형식으로 변환)
          let grade = excelData.학년;
          if (grade) {
            const gradeNum = grade.match(/\d+/)?.[0];
            if (gradeNum) {
              const num = parseInt(gradeNum);
              // 학교명에서 레벨 추론
              const schoolName = excelData.학교?.toLowerCase() || '';
              if (schoolName.includes('초') || schoolName.includes('elementary')) {
                grade = `초${num}`;
              } else if (schoolName.includes('중') || schoolName.includes('middle')) {
                grade = `중${num}`;
              } else if (schoolName.includes('고') || schoolName.includes('high')) {
                grade = `고${num}`;
              } else if (grade.includes('초') || grade.toLowerCase().includes('elementary')) {
                grade = `초${num}`;
              } else if (grade.includes('중') || grade.toLowerCase().includes('middle')) {
                grade = `중${num}`;
              } else if (grade.includes('고') || grade.toLowerCase().includes('high')) {
                grade = `고${num}`;
              } else {
                // 학교명이나 학년에서 레벨을 추론할 수 없으면 숫자로 추론
                // 1~6: 초등, 7~9(또는 1~3 중학): 중등, 10~12(또는 1~3 고등): 고등
                if (num >= 1 && num <= 6) {
                  grade = `초${num}`;
                } else if (num >= 7 && num <= 9) {
                  grade = `중${num - 6}`;
                } else {
                  // 기본적으로 원본 유지
                  grade = gradeNum;
                }
              }
            }
          }

          // 날짜 변환
          let enrollmentDate = undefined;
          if (excelData.입학일 && excelData.입학일.length === 8) {
            const year = excelData.입학일.substring(0, 4);
            const month = excelData.입학일.substring(4, 6);
            const day = excelData.입학일.substring(6, 8);
            enrollmentDate = `${year}-${month}-${day}`;
          }

          // UnifiedStudent 객체 생성 (완전한 매핑)
          const student: any = {
            // 기존 데이터 유지
            ...existingStudent,

            // 기본 정보
            id,
            name: excelData.이름,
            englishName: existingStudent?.englishName || null,
            school: excelData.학교 || existingStudent?.school,
            grade: grade || existingStudent?.grade,
            gender: excelData.성별 === '남' ? 'male' : excelData.성별 === '여' ? 'female' : existingStudent?.gender,

            // 연락처 정보
            studentPhone: excelData.원생연락처 || existingStudent?.studentPhone,
            parentPhone: excelData.보호자연락처 || existingStudent?.parentPhone,
            parentName: excelData.보호자이름 || existingStudent?.parentName,
            parentRelation: excelData.보호자구분 || existingStudent?.parentRelation,
            otherPhone: excelData.기타보호자연락처 || existingStudent?.otherPhone,
            otherPhoneRelation: excelData.기타보호자이름 || existingStudent?.otherPhoneRelation,
            homePhone: excelData.집전화 || existingStudent?.homePhone,

            // 주소 정보
            zipCode: excelData.우편번호 || existingStudent?.zipCode,
            address: excelData.주소1 || existingStudent?.address,
            addressDetail: excelData.주소2 || existingStudent?.addressDetail,

            // 추가 정보
            birthDate: excelData.생일 || existingStudent?.birthDate,
            nickname: excelData.닉네임 || existingStudent?.nickname,
            studentEmail: excelData.원생이메일 || existingStudent?.studentEmail,
            enrollmentReason: excelData.입학동기 || existingStudent?.enrollmentReason,

            // 수납 정보
            cashReceiptNumber: excelData.현금영수증발급번호 || existingStudent?.cashReceiptNumber,
            cashReceiptType: excelData.현금영수증발급구분 === '소득공제용' ? 'income' :
              excelData.현금영수증발급구분 === '지출증빙용' ? 'expense' :
                existingStudent?.cashReceiptType,
            billingDay: excelData.수납기준청구일 ? parseInt(excelData.수납기준청구일) : existingStudent?.billingDay,
            billingDiscount: excelData.할인액 ? parseInt(excelData.할인액) : existingStudent?.billingDiscount,

            // 알림 설정
            smsNotification: excelData.보호자출결알림 === 'Y' || existingStudent?.smsNotification,
            otherSmsNotification: excelData.기타보호자출결알림 === 'Y' || existingStudent?.otherSmsNotification,

            // 기타 정보
            graduationYear: excelData.졸업연도 || existingStudent?.graduationYear,
            customField1: excelData.기타항목1 || existingStudent?.customField1,
            customField2: excelData.기타항목2 || existingStudent?.customField2,
            memo: excelData.메모
              ? existingStudent?.memo
                ? `${existingStudent.memo}\n\n[엑셀 마이그레이션 ${now}]\n${excelData.메모}`
                : excelData.메모
              : existingStudent?.memo,

            // 수강 정보
            enrollments: existingStudent?.enrollments || [],

            // 상태 관리
            status: excelData.재원여부 === 'N' ? 'withdrawn' :
              excelData.휴원여부 === 'Y' ? 'on_hold' :
                existingStudent?.status || 'active',
            startDate: enrollmentDate || excelData.등록일 || existingStudent?.startDate || now.split('T')[0],
            endDate: excelData.퇴원일 || existingStudent?.endDate,
            withdrawalDate: excelData.퇴원일 || existingStudent?.withdrawalDate,

            // 출석부 연동
            group: excelData.반 || existingStudent?.group,

            // 메타데이터
            createdAt: existingStudent?.createdAt || now,
            updatedAt: now,
          };

          // undefined 값 제거 (Firebase는 undefined를 허용하지 않음)
          const cleanStudent = Object.fromEntries(
            Object.entries(student).filter(([_, v]) => v !== undefined)
          );

          const docRef = doc(studentsRef, id);
          batch.set(docRef, cleanStudent, { merge: true });
        });

        await batch.commit();
        setProgress(Math.round(((i + 1) / batches) * 100));
      }

      setStep('done');

    } catch (err: any) {
      console.error(err);
      setError(`마이그레이션 중 오류 발생: ${err.message}`);
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-[#081429] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Database size={20} className="text-[#fdb813]" />
            원생목록 데이터 마이그레이션
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">오류</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* 1단계: 파일 업로드 */}
          {step === 'load' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">학생 데이터 파일 업로드</h3>
                <p className="text-gray-600 text-sm mb-4">
                  원생목록 Excel 또는 JSON 파일을 업로드하세요.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2 mb-6">
                  <p className="text-sm text-blue-900 font-medium">📋 마이그레이션 특징:</p>
                  <ul className="text-sm text-blue-800 space-y-1 ml-4">
                    <li>• 기존 학생과 이름 매칭 → 데이터 보완</li>
                    <li>• 새로운 학생 → 추가</li>
                    <li>• 영어 수업 자동 매핑 (약어 변환)</li>
                    <li>• 수학 수업은 수동 배정 필요</li>
                  </ul>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2">
                  <p className="text-sm text-gray-700 font-medium">📁 지원 파일 형식:</p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4">
                    <li>• Excel 파일: .xlsx, .xls</li>
                    <li>• JSON 파일: .json</li>
                  </ul>
                </div>
              </div>

              {/* 파일 업로드 영역 */}
              <div className="mt-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="student-file-upload"
                />
                <label
                  htmlFor="student-file-upload"
                  className={`
                    flex flex-col items-center justify-center
                    border-2 border-dashed rounded-lg p-8 cursor-pointer
                    transition-colors
                    ${loading
                      ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                      : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
                    }
                  `}
                >
                  <Upload className={`w-12 h-12 mb-3 ${loading ? 'text-gray-400' : 'text-blue-500'}`} />
                  <p className={`text-sm font-medium ${loading ? 'text-gray-500' : 'text-gray-700'}`}>
                    {loading ? '파일 처리 중...' : '클릭하여 파일 선택'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    또는 파일을 드래그하여 놓으세요
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* 2단계: 미리보기 */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">총 데이터</div>
                  <div className="text-2xl font-bold text-gray-900">{totalCount}명</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200 shadow-sm">
                  <div className="text-sm text-green-700 mb-1">신규 추가</div>
                  <div className="text-2xl font-bold text-green-700">{newCount}명</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                  <div className="text-sm text-blue-700 mb-1">기존 업데이트</div>
                  <div className="text-2xl font-bold text-blue-700">{updateCount}명</div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ 주의사항:</p>
                <ul className="text-sm text-yellow-700 space-y-1 ml-4">
                  <li>• 기존 학생 데이터는 보존되며 새로운 정보만 추가됩니다</li>
                  <li>• 영어 이름은 기존 데이터를 유지합니다 (엑셀에 없음)</li>
                  <li>• 수학 수업은 자동 매핑되지 않으므로 수동 배정 필요</li>
                  <li>• 실행 전 백업을 권장합니다</li>
                </ul>
              </div>

              {/* 샘플 데이터 미리보기 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 font-medium mb-3">
                  총 <span className="font-bold text-[#081429]">{totalCount}명</span>의 학생 데이터가 준비되었습니다.
                </p>
                <div className="text-xs text-gray-600">
                  <p className="font-medium mb-2">샘플 데이터 (처음 5명):</p>
                  <div className="space-y-1 ml-2">
                    {rawData.slice(0, 5).map((student, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-gray-400">{idx + 1}.</span>
                        <span className="font-medium">{student.이름}</span>
                        <span className="text-gray-500">({student.학년})</span>
                        <span className="text-gray-400 text-[10px]">{student.학교}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3단계: 마이그레이션 중 */}
          {step === 'migrating' && (
            <div className="text-center space-y-6">
              <Loader2 className="w-16 h-16 animate-spin text-[#fdb813] mx-auto" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">마이그레이션 진행 중...</h3>
                <p className="text-gray-600 text-sm">잠시만 기다려주세요.</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#fdb813] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{progress}% 완료</p>
            </div>
          )}

          {/* 4단계: 완료 */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[#081429]">마이그레이션 완료!</h3>
                <p className="text-gray-600 mt-2">
                  총 <span className="text-green-600 font-bold">{totalCount}</span>명의 학생 데이터가 저장되었습니다.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 max-w-md mx-auto">
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <p className="text-xs text-green-700">신규 추가</p>
                    <p className="text-xl font-bold text-green-700">{newCount}명</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700">업데이트</p>
                    <p className="text-xl font-bold text-blue-700">{updateCount}명</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
                <p className="text-sm text-gray-700 font-medium mb-2">📝 다음 단계:</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>1. 학생 목록을 새로고침하여 확인</li>
                  <li>2. 영어 수업 자동 배정 (선택)</li>
                  <li>3. 수학 수업 수동 배정 필요</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {step === 'load' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              취소
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleMigrate}
                className="px-4 py-2 bg-[#fdb813] text-[#081429] hover:bg-[#fdb813]/90 rounded-lg transition-colors flex items-center gap-2 font-bold"
              >
                <Upload size={16} />
                {totalCount}명 마이그레이션 실행
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#081429] text-white hover:bg-[#081429]/90 rounded-lg transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentMigrationModal;
