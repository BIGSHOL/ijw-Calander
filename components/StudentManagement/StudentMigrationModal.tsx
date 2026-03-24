/**
 * 학생 데이터 마이그레이션 모달
 * - public/student-migration-data.json 데이터를 로드하여 Firebase에 저장
 * - 기존 학생과 이름 매칭하여 업데이트 또는 신규 추가
 * - 영어 수업 정보 자동 매핑 (수학은 수동)
 */

import React, { useState, useRef } from 'react';
import { Database, X, Upload, AlertCircle, Check, Loader2, FileSpreadsheet, Settings, BarChart3 } from 'lucide-react';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { getKoreanErrorMessage } from '../../utils/errorMessages';
import { db } from '../../firebaseConfig';
import { UnifiedStudent } from '../../types';
import { read, utils } from 'xlsx';
import { generateAttendanceNumber } from '../../utils/attendanceNumberGenerator';
import { useDraggable } from '../../hooks/useDraggable';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface StudentMigrationModalProps {
  onClose: () => void;
}

// 변경 내역 타입
interface StudentChangeInfo {
  excelData: ExcelStudentData;
  isNew: boolean;
  existingData?: UnifiedStudent;
  changedFields: string[];
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
  기타보호자이름?: string;
  기타보호자연락처?: string;
  집전화?: string;
  입학일?: string;
  주소1?: string;
  주소2?: string;
  우편번호?: string;
  메모?: string;
  수업?: string;
  반?: string;
  담임강사?: string;
  기타항목1?: string;
  기타항목2?: string;
  원생고유번호?: string;
  생일?: string;
  닉네임?: string;
  원생이메일?: string;
  입학동기?: string;
  현금영수증발급번호?: string;
  현금영수증발급구분?: string;
  수납기준청구일?: string;
  할인액?: string;
  보호자출결알림?: string;
  기타보호자출결알림?: string;
  졸업연도?: string;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * 학교명 정규화 (전체 이름 → 축약형)
 * - "달산초등학교" → "달산초"
 * - "OO중학교" → "OO중"
 * - "OO고등학교" → "OO고"
 */
const normalizeSchoolName = (school?: string): string | undefined => {
  if (!school) return undefined;

  // 공백 제거 및 트림
  let normalized = school.trim();

  // 초등학교 → 초
  normalized = normalized.replace(/초등학교$/g, '초');

  // 중학교 → 중
  normalized = normalized.replace(/중학교$/g, '중');

  // 고등학교 → 고
  normalized = normalized.replace(/고등학교$/g, '고');

  return normalized;
};

/**
 * 기존 학생 데이터에서 학교 약칭 → 정식명 자동 보정 맵 생성
 * 예: "일중"이 1명, "대구일중"이 10명이면 → "일중" → "대구일중"
 */
const buildSchoolCorrections = (existingStudents: { id: string; school?: string }[]): Map<string, string> => {
  const schoolCounts = new Map<string, number>();

  existingStudents.forEach(student => {
    // ID에서 학교명 추출 (gd_ 프리픽스 제거)
    const workingId = student.id.startsWith('gd_') ? student.id.substring(3) : student.id;
    const idParts = workingId.split('_');
    const isSemanticId = idParts.length >= 2 && !/^\d+$/.test(workingId) && !/^[a-zA-Z0-9]{15,}$/.test(workingId);
    if (isSemanticId) {
      const school = normalizeSchoolName(idParts[1]);
      if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
    }
    // school 필드에서도 수집
    const school = normalizeSchoolName(student.school);
    if (school) schoolCounts.set(school, (schoolCounts.get(school) || 0) + 1);
  });

  const allSchools = Array.from(schoolCounts.keys());
  const corrections = new Map<string, string>();

  for (const shortName of allSchools) {
    if (shortName.length > 2) continue; // 3자 이상은 정상 (침산초, 종로초 등)
    const matches = allSchools.filter(
      longName => longName.length > shortName.length && longName.endsWith(shortName)
    );
    if (matches.length === 1) {
      corrections.set(shortName, matches[0]);
    } else if (matches.length > 1) {
      matches.sort((a, b) => (schoolCounts.get(b) || 0) - (schoolCounts.get(a) || 0));
      corrections.set(shortName, matches[0]);
    }
  }

  return corrections;
};

/**
 * 학교명 정규화 + 약칭 보정 통합
 */
const fullNormalizeSchoolName = (school?: string, corrections?: Map<string, string>): string | undefined => {
  const normalized = normalizeSchoolName(school);
  if (!normalized) return normalized;
  if (corrections && corrections.has(normalized)) {
    return corrections.get(normalized)!;
  }
  return normalized;
};

/**
 * 전화번호 포맷팅 (010-1234-5678 형식)
 * - "1093659838" → "010-9365-9838" (10자리, 앞에 0 누락)
 * - "01093659838" → "010-9365-9838" (11자리 휴대폰)
 * - "0531234567" → "053-123-4567" (지역번호)
 * - "021234567" → "02-123-4567" (서울)
 */
const formatPhoneNumber = (phone?: string): string | undefined => {
  if (!phone) return undefined;

  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;

  // 10자리이고 '10'으로 시작하면 앞에 0 추가 (010 누락 케이스)
  let normalized = digits;
  if (digits.length === 10 && digits.startsWith('10')) {
    normalized = '0' + digits;
  }

  // 11자리 휴대폰 (010, 011, 016, 017, 018, 019)
  if (normalized.length === 11 && normalized.startsWith('01')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }

  // 10자리 지역번호 (02 제외)
  if (normalized.length === 10 && normalized.startsWith('0') && !normalized.startsWith('02')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  // 9~10자리 서울 (02)
  if (normalized.startsWith('02')) {
    if (normalized.length === 9) {
      return `02-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
    }
    if (normalized.length === 10) {
      return `02-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
    }
  }

  // 그 외는 원본 반환 (이미 포맷팅 되어 있거나 특수한 경우)
  return phone.trim();
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const StudentMigrationModal: React.FC<StudentMigrationModalProps> = ({ onClose }) => {
  const [step, setStep] = useState<'load' | 'preview' | 'migrating' | 'done'>('load');
  const [loading, setLoading] = useState(false);
  const { handleMouseDown: handleDragMouseDown, dragStyle } = useDraggable();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const [rawData, setRawData] = useState<ExcelStudentData[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // 상세 변경 내역 저장
  const [changeDetails, setChangeDetails] = useState<StudentChangeInfo[]>([]);
  const [detailFilter, setDetailFilter] = useState<'all' | 'new' | 'update'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================================================
  // DRAG & DROP HANDLER
  // ============================================================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isValid = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.json');
    if (!isValid) {
      setError('지원하지 않는 파일 형식입니다. (.xlsx, .xls, .json만 지원)');
      return;
    }

    // fileInputRef에 직접 파일 세팅이 불가하므로 processFile로 처리
    processFile(file);
  };

  // ============================================================
  // FILE UPLOAD HANDLER
  // ============================================================

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File) => {
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

      // 필수 필드 "이름" 검증: 이름이 없는 행 필터링
      const validData = data.filter(item => item.이름 && item.이름.trim());
      const skippedCount = data.length - validData.length;
      if (validData.length === 0) {
        throw new Error('유효한 학생 데이터가 없습니다. "이름" 컬럼을 확인하세요.');
      }
      if (skippedCount > 0) {
        setError(`이름이 없는 ${skippedCount}건은 제외되었습니다.`);
      }

      // 비정상 이름 필터링 (괄호, 테스트, 특수문자 등)
      const invalidNamePattern = /[()（）\[\]{}]|테스트|test|임시|삭제|sample/i;
      const filtered = validData.filter(item => !invalidNamePattern.test(item.이름));
      const invalidCount = validData.length - filtered.length;
      if (invalidCount > 0) {
        const invalidNames = validData
          .filter(item => invalidNamePattern.test(item.이름))
          .map(item => item.이름)
          .join(', ');
        setError(prev => {
          const base = prev ? prev + ' / ' : '';
          return `${base}비정상 이름 ${invalidCount}건 제외: ${invalidNames}`;
        });
      }
      setRawData(filtered);
      data = filtered;
      setTotalCount(data.length);

      // 기존 학생과 매칭 분석 (출결번호 + 이름_학교_학년 기준)
      const studentsRef = collection(db, 'students');
      const existingSnapshot = await getDocs(studentsRef);
      const existingAttendanceNumbers = new Set<string>();
      const existingStudentsByAttendance = new Map<string, UnifiedStudent>();
      const existingStudentsByNameKey = new Map<string, UnifiedStudent>();  // 이름_학교_학년 기준

      existingSnapshot.forEach(docSnap => {
        const student = docSnap.data() as UnifiedStudent;

        // 출결번호 기준 맵
        if (student.attendanceNumber) {
          existingAttendanceNumbers.add(student.attendanceNumber);
          existingStudentsByAttendance.set(student.attendanceNumber, student);
        }

        // 이름_학교_학년 기준 맵 (기존 ID 형식 호환)
        if (student.name) {
          const nameKey = `${student.name}_${student.school || ''}_${student.grade || ''}`;
          existingStudentsByNameKey.set(nameKey, student);
        }
      });

      // 학교 약칭 보정 맵 생성 (프리뷰에서도 동일 적용)
      const existingStudentList = existingSnapshot.docs.map(d => ({
        id: d.id,
        school: (d.data() as UnifiedStudent).school,
      }));
      const schoolCorrections = buildSchoolCorrections(existingStudentList);

      // 신규/업데이트 카운트 및 상세 변경 내역 (출결번호 기준으로 판단)
      let newCnt = 0;
      let updateCnt = 0;
      const changes: StudentChangeInfo[] = [];

      // 필드명 매핑 (Excel → 기존 데이터)
      const fieldMapping: Record<string, { excelKey: keyof ExcelStudentData; existingKey: keyof UnifiedStudent; label: string }> = {
        school: { excelKey: '학교', existingKey: 'school', label: '학교' },
        grade: { excelKey: '학년', existingKey: 'grade', label: '학년' },
        studentPhone: { excelKey: '원생연락처', existingKey: 'studentPhone', label: '원생연락처' },
        parentPhone: { excelKey: '보호자연락처', existingKey: 'parentPhone', label: '보호자연락처' },
        parentName: { excelKey: '보호자이름', existingKey: 'parentName', label: '보호자이름' },
        parentRelation: { excelKey: '보호자구분', existingKey: 'parentRelation', label: '보호자구분' },
        otherPhone: { excelKey: '기타보호자연락처', existingKey: 'otherPhone', label: '기타보호자연락처' },
        address: { excelKey: '주소1', existingKey: 'address', label: '주소' },
        memo: { excelKey: '메모', existingKey: 'memo', label: '메모' },
      };

      data.forEach(item => {
        // Excel에 출결번호가 있으면 그것 사용, 없으면 전화번호로 생성
        let attendanceNumber = item.출결번호;
        if (!attendanceNumber) {
          attendanceNumber = generateAttendanceNumber(item.보호자연락처, existingAttendanceNumbers);
        }

        // 1차: 출결번호로 기존 학생 찾기
        let existingData = existingStudentsByAttendance.get(attendanceNumber);
        const foundByAttendance = !!existingData;

        // 2차: 출결번호로 못 찾으면 이름_학교_학년으로 찾기 (기존 ID 형식 호환)
        if (!existingData) {
          const normalizedSchool = fullNormalizeSchoolName(item.학교, schoolCorrections) || '';
          // 학년 정규화 (간단히)
          let grade = item.학년 || '';
          const gradeNum = grade.match(/\d+/)?.[0];
          if (gradeNum) {
            const num = parseInt(gradeNum);
            const schoolName = item.학교?.toLowerCase() || '';
            if (schoolName.includes('초') || schoolName.includes('elementary')) {
              grade = `초${num}`;
            } else if (schoolName.includes('중') || schoolName.includes('middle')) {
              grade = `중${num}`;
            } else if (schoolName.includes('고') || schoolName.includes('high')) {
              grade = `고${num}`;
            }
          }
          const nameKey = `${item.이름}_${normalizedSchool}_${grade}`;
          const candidate = existingStudentsByNameKey.get(nameKey);
          // 이름_학교_학년이 같아도 전화번호가 다르면 다른 학생으로 판단
          if (candidate) {
            const excelPhone = formatPhoneNumber(item.보호자연락처 || item.원생연락처);
            const existingPhone = candidate.parentPhone || candidate.studentPhone;
            if (!excelPhone || !existingPhone || excelPhone === existingPhone) {
              existingData = candidate;
            }
          }
        }

        const isNew = !existingData;
        const changedFields: string[] = [];

        if (!isNew && existingData) {
          // 기존 데이터와 비교하여 변경될 필드 찾기
          Object.values(fieldMapping).forEach(({ excelKey, existingKey, label }) => {
            const excelValue = item[excelKey];
            const existingValue = existingData?.[existingKey];
            if (excelValue && excelValue !== existingValue) {
              changedFields.push(label);
            }
          });
          // 출결번호로 못 찾았으면 출결번호도 업데이트 대상
          if (!foundByAttendance) {
            changedFields.push('출결번호');
          }
          updateCnt++;
        } else {
          newCnt++;
          existingAttendanceNumbers.add(attendanceNumber);
        }

        changes.push({
          excelData: item,
          isNew,
          existingData,
          changedFields
        });
      });

      // 상태 업데이트를 한 번에 처리
      setNewCount(newCnt);
      setUpdateCount(updateCnt);
      setChangeDetails(changes);
      setLoading(false);

      // 다음 렌더링 사이클에서 step 변경
      setTimeout(() => {
        setStep('preview');
      }, 0);

    } catch (err: any) {
      console.error('에러 발생:', err);
      setError(getKoreanErrorMessage(err, '파일 업로드 중 오류가 발생했습니다.'));
      setLoading(false);
    }
  };

  // ============================================================
  // MIGRATION EXECUTION HANDLER
  // ============================================================

  const handleMigrate = async () => {
    if (rawData.length === 0) return;

    setStep('migrating');
    setProgress(0);

    try {
      // 기존 학생 데이터 로드 (출결번호 + 이름_학교_학년 기준)
      const studentsRef = collection(db, 'students');
      const existingSnapshot = await getDocs(studentsRef);
      const existingStudentsByAttendance = new Map<string, any>();
      const existingStudentsByNameKey = new Map<string, any>();  // 이름_학교_학년 기준
      const existingAttendanceNumbers = new Set<string>();

      existingSnapshot.forEach(docSnap => {
        const student = docSnap.data() as UnifiedStudent;
        const studentWithDocId = {
          ...student,
          _firestoreDocId: docSnap.id
        };

        // 출결번호 기준 맵
        if (student.attendanceNumber) {
          existingStudentsByAttendance.set(student.attendanceNumber, studentWithDocId);
          existingAttendanceNumbers.add(student.attendanceNumber);
        }

        // 이름_학교_학년 기준 맵 (기존 ID 형식 호환)
        if (student.name) {
          const nameKey = `${student.name}_${student.school || ''}_${student.grade || ''}`;
          existingStudentsByNameKey.set(nameKey, studentWithDocId);
        }
      });

      // 학교 약칭 보정 맵 생성 (기존 학생 데이터 기반)
      const existingStudentList = existingSnapshot.docs.map(d => ({
        id: d.id,
        school: (d.data() as UnifiedStudent).school,
      }));
      const schoolCorrections = buildSchoolCorrections(existingStudentList);

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

          // 학년 정규화 (초/중/고 + 숫자 형식으로 변환) - nameKey 생성 전에 먼저 처리
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
                }
              }
            }
          }

          // 출결번호 생성 또는 Excel에서 가져오기
          let attendanceNumber = excelData.출결번호;
          if (!attendanceNumber) {
            attendanceNumber = generateAttendanceNumber(excelData.보호자연락처, existingAttendanceNumbers);
            existingAttendanceNumbers.add(attendanceNumber);
          }

          // 기존 학생 찾기 (1. 출결번호 기준, 2. 이름_학교_학년 기준)
          let existingStudent = existingStudentsByAttendance.get(attendanceNumber) as (UnifiedStudent & { _firestoreDocId?: string }) | undefined;

          // 학교명 정규화 + 약칭 보정
          const normalizedSchool = fullNormalizeSchoolName(excelData.학교, schoolCorrections) || '';

          // 출결번호로 못 찾으면 이름_학교_학년으로 찾기 (기존 ID 형식 호환)
          if (!existingStudent) {
            const nameKey = `${excelData.이름}_${normalizedSchool}_${grade || ''}`;
            const candidate = existingStudentsByNameKey.get(nameKey) as (UnifiedStudent & { _firestoreDocId?: string }) | undefined;
            // 이름_학교_학년이 같아도 전화번호가 다르면 다른 학생으로 판단
            if (candidate) {
              const excelPhone = formatPhoneNumber(excelData.보호자연락처 || excelData.원생연락처);
              const existingPhone = candidate.parentPhone || candidate.studentPhone;
              if (!excelPhone || !existingPhone || excelPhone === existingPhone) {
                existingStudent = candidate;
              }
            }
          }

          // 문서 ID: 기존 학생이면 기존 ID 사용, 신규면 이름_학교_학년 형식
          let id: string;
          if (existingStudent?._firestoreDocId) {
            id = existingStudent._firestoreDocId;
          } else {
            // 신규 학생: 이름_학교(정규화)_학년 형식
            const baseId = `${excelData.이름}_${normalizedSchool}_${grade || ''}`;
            id = baseId;

            // 중복 ID 체크 - 이미 사용된 ID면 순번 추가
            let counter = 1;
            while (existingStudentsByNameKey.has(id) || existingStudentsByAttendance.has(id)) {
              counter++;
              id = `${baseId}_${counter}`;
              if (counter > 100) break;
            }
            // 새 ID를 맵에 추가하여 같은 배치 내 중복 방지
            existingStudentsByNameKey.set(id, { _firestoreDocId: id } as any);
          }

          // 과목 추출
          const subjects: ('math' | 'english')[] = [];
          if (excelData.기타항목1) {
            const upper = excelData.기타항목1.toUpperCase();
            if (upper.includes('M')) subjects.push('math');
            if (upper.includes('E')) subjects.push('english');
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
            school: fullNormalizeSchoolName(excelData.학교 || existingStudent?.school, schoolCorrections),
            grade: grade || existingStudent?.grade,
            gender: excelData.성별 === '남' ? 'male' : excelData.성별 === '여' ? 'female' : existingStudent?.gender,
            attendanceNumber,  // 출결번호 추가

            // 연락처 정보 (자동 포맷팅: 010-1234-5678)
            studentPhone: formatPhoneNumber(excelData.원생연락처 || existingStudent?.studentPhone),
            parentPhone: formatPhoneNumber(excelData.보호자연락처 || existingStudent?.parentPhone),
            parentName: excelData.보호자이름 || existingStudent?.parentName,
            parentRelation: excelData.보호자구분 || existingStudent?.parentRelation,
            otherPhone: formatPhoneNumber(excelData.기타보호자연락처 || existingStudent?.otherPhone),
            otherPhoneRelation: excelData.기타보호자이름 || existingStudent?.otherPhoneRelation,
            homePhone: formatPhoneNumber(excelData.집전화 || existingStudent?.homePhone),

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

            // 상태 관리 - 기본값 active (기존 학생은 기존 status 유지)
            status: existingStudent?.status || 'active',
            startDate: enrollmentDate || existingStudent?.startDate || now.split('T')[0],
            endDate: existingStudent?.endDate,
            withdrawalDate: existingStudent?.withdrawalDate,

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
      setError(getKoreanErrorMessage(err, '마이그레이션 중 오류가 발생했습니다.'));
      setStep('preview');
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const renderErrorMessage = () => {
    if (!error) return null;

    return (
      <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">오류</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  };

  const renderLoadStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-blue-100 rounded-sm flex items-center justify-center mx-auto">
        <FileSpreadsheet className="w-8 h-8 text-blue-600" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">학생 데이터 파일 업로드</h3>
        <p className="text-gray-600 text-sm mb-4">
          원생목록 Excel 또는 JSON 파일을 업로드하세요.
        </p>

        {/* Section: 마이그레이션 특징 */}
        <div className="bg-blue-50 border border-blue-200 rounded-sm overflow-hidden text-left mb-6">
          <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-200 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-700" />
            <h4 className="text-sm font-bold text-blue-900">마이그레이션 특징</h4>
          </div>
          <div className="p-4">
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 기존 학생과 이름 매칭 → 데이터 보완</li>
              <li>• 새로운 학생 → 추가</li>
              <li>• 영어 수업 자동 매핑 (약어 변환)</li>
              <li>• 학교명 자동 축약 (초등학교→초, 중학교→중, 고등학교→고) + 약칭 자동 보정</li>
              <li>• 전화번호 자동 포맷 (1093659838→010-9365-9838)</li>
              <li>• 수학 수업은 수동 배정 필요</li>
            </ul>
          </div>
        </div>

        {/* Section: 지원 파일 형식 */}
        <div className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden text-left">
          <div onMouseDown={handleDragMouseDown} className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2 cursor-move select-none">
            <FileSpreadsheet className="w-4 h-4 text-gray-700" />
            <h4 className="text-sm font-bold text-gray-900">지원 파일 형식</h4>
          </div>
          <div className="p-4">
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Excel 파일: .xlsx, .xls</li>
              <li>• JSON 파일: .json</li>
            </ul>
          </div>
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
          disabled={loading}
        />
        <label
          htmlFor="student-file-upload"
          className={`
            flex flex-col items-center justify-center
            border-2 border-dashed rounded-sm p-8 cursor-pointer
            transition-colors
            ${loading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
            }
          `}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
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
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      {/* Section: 통계 요약 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-700" />
          <h4 className="text-sm font-bold text-gray-900">통계 요약</h4>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div style={dragStyle} className="bg-white p-4 rounded-sm border border-gray-200 shadow-sm">
            <div className="text-sm text-gray-500 mb-1">총 데이터</div>
            <div className="text-2xl font-bold text-gray-900">{totalCount}명</div>
          </div>
          <div className="bg-green-50 p-4 rounded-sm border border-green-200 shadow-sm">
            <div className="text-sm text-green-700 mb-1">신규 추가</div>
            <div className="text-2xl font-bold text-green-700">{newCount}명</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-sm border border-blue-200 shadow-sm">
            <div className="text-sm text-blue-700 mb-1">기존 업데이트</div>
            <div className="text-2xl font-bold text-blue-700">{updateCount}명</div>
          </div>
        </div>
      </div>

      {/* 주의사항 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-4">
        <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ 주의사항:</p>
        <ul className="text-sm text-yellow-700 space-y-1 ml-4">
          <li>• 기존 학생 데이터는 보존되며 새로운 정보만 추가됩니다</li>
          <li>• 영어 이름은 기존 데이터를 유지합니다 (엑셀에 없음)</li>
          <li>• 수학 수업은 자동 매핑되지 않으므로 수동 배정 필요</li>
          <li>• 실행 전 백업을 권장합니다</li>
        </ul>
      </div>

      {/* Section: 상세 변경 내역 */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden">
        {/* 필터 탭 */}
        <div className="flex items-center border-b border-gray-200 bg-white px-3 py-2">
          <span className="text-sm text-gray-600 mr-3">필터:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setDetailFilter('all')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                detailFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({totalCount})
            </button>
            <button
              onClick={() => setDetailFilter('new')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                detailFilter === 'new'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              신규 ({newCount})
            </button>
            <button
              onClick={() => setDetailFilter('update')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                detailFilter === 'update'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              업데이트 ({updateCount})
            </button>
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="max-h-[300px] overflow-y-auto">
          {changeDetails
            .filter(item => {
              if (detailFilter === 'new') return item.isNew;
              if (detailFilter === 'update') return !item.isNew;
              return true;
            })
            .map((item, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 px-4 py-2 border-b border-gray-100 text-xs ${
                  item.isNew ? 'bg-green-50/50' : 'bg-white'
                }`}
              >
                {/* 번호 */}
                <span className="text-gray-400 w-8 shrink-0 text-right">{idx + 1}.</span>

                {/* 상태 배지 */}
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded-sm text-xxs font-bold ${
                    item.isNew
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.isNew ? '신규' : '업데이트'}
                </span>

                {/* 학생 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{item.excelData.이름}</span>
                    <span className="text-gray-500">({item.excelData.학년})</span>
                    <span className="text-gray-400 truncate">{normalizeSchoolName(item.excelData.학교)}</span>
                  </div>

                  {/* 변경 내역 (업데이트의 경우) */}
                  {!item.isNew && item.changedFields.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.changedFields.map((field, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-sm text-xxs"
                        >
                          {field} 변경
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 신규 학생의 경우 주요 정보 표시 */}
                  {item.isNew && (
                    <div className="mt-1 text-xxs text-gray-500">
                      {item.excelData.보호자연락처 && (
                        <span className="mr-2">📞 {item.excelData.보호자연락처}</span>
                      )}
                      {item.excelData.기타항목1 && (
                        <span className="mr-2">📚 {item.excelData.기타항목1}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* 출결번호 */}
                <span className="text-xxs text-gray-400 shrink-0">
                  {item.excelData.출결번호 || '자동생성'}
                </span>
              </div>
            ))}
        </div>

        {/* 목록이 비어있을 때 */}
        {changeDetails.filter(item => {
          if (detailFilter === 'new') return item.isNew;
          if (detailFilter === 'update') return !item.isNew;
          return true;
        }).length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm">
            해당 조건의 학생이 없습니다.
          </div>
        )}
      </div>
    </div>
  );

  const renderMigratingStep = () => (
    <div className="text-center space-y-6">
      <Loader2 className="w-16 h-16 animate-spin text-accent mx-auto" />
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">마이그레이션 진행 중...</h3>
        <p className="text-gray-600 text-sm">잠시만 기다려주세요.</p>
      </div>
      <div className="w-full bg-gray-200 rounded-sm h-3 overflow-hidden">
        <div
          className="bg-accent h-full transition-all duration-300 rounded-sm"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600">{progress}% 완료</p>
    </div>
  );

  const renderDoneStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-sm flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-600" strokeWidth={3} />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-primary">마이그레이션 완료!</h3>
        <p className="text-gray-600 mt-2">
          총 <span className="text-green-600 font-bold">{totalCount}</span>명의 학생 데이터가 저장되었습니다.
        </p>

        {/* Section: 통계 요약 */}
        <div className="mt-4 grid grid-cols-2 gap-3 max-w-md mx-auto">
          <div className="bg-green-50 p-3 rounded-sm border border-green-200">
            <p className="text-xs text-green-700">신규 추가</p>
            <p className="text-xl font-bold text-green-700">{newCount}명</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-sm border border-blue-200">
            <p className="text-xs text-blue-700">업데이트</p>
            <p className="text-xl font-bold text-blue-700">{updateCount}명</p>
          </div>
        </div>
      </div>

      {/* Section: 다음 단계 */}
      <div className="bg-gray-50 border border-gray-200 rounded-sm overflow-hidden text-left">
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
          <Check className="w-4 h-4 text-gray-700" />
          <h4 className="text-sm font-bold text-gray-900">다음 단계</h4>
        </div>
        <div className="p-4">
          <ul className="text-sm text-gray-600 space-y-1">
            <li>1. 학생 목록을 새로고침하여 확인</li>
            <li>2. 영어 수업 자동 배정 (선택)</li>
            <li>3. 수학 수업 수동 배정 필요</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] bg-black/50">
      <div className="bg-white rounded-sm shadow-2xl w-[90%] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Database size={20} className="text-accent" />
            원생목록 데이터 마이그레이션
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderErrorMessage()}

          {step === 'load' && renderLoadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'migrating' && renderMigratingStep()}
          {step === 'done' && renderDoneStep()}
        </div>

        {/* 푸터 버튼 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {step === 'load' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-sm transition-colors"
            >
              취소
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleMigrate}
                className="px-4 py-2 bg-accent text-primary hover:bg-accent/90 rounded-sm transition-colors flex items-center gap-2 font-bold"
              >
                <Upload size={16} />
                {totalCount}명 마이그레이션 실행
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-sm transition-colors"
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
