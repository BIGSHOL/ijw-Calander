import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, UserCheck, RefreshCw, AlertCircle, UserPlus, CheckCircle2, PenLine, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, Timestamp, collection, getDocs, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import Modal from '../Common/Modal';
import { UnifiedStudent } from '../../types';
import { generateAttendanceNumber } from '../../utils/attendanceNumberGenerator';
import { generateStudentCode } from '../../utils/studentCodeGenerator';
import { parseClassName, DEFAULT_ENGLISH_LEVELS } from '../Timetable/English/englishUtils';

interface MakeEduStudent {
  name: string;
  school: string;
  grade: string;
  phone: string;
  parentPhone: string;
  registrationDate: string;
  className: string;
  teacher: string;
  siblings: string;
  memo: string;
  status: string;
  // 추가 필드
  attendanceNumber: string;
  customField1: string;
  customField2: string;
  gender: string;
  parentName: string;
  birthDate: string;
  address: string;
  addressDetail: string;
  _raw: Record<string, string>;
}

interface ComparisonResult {
  makeEduStudent: MakeEduStudent;
  ijwMatch: UnifiedStudent | null;
  matchType: 'exact' | 'none';
  updatableFields: string[]; // 업데이트 가능한 필드 목록
}

type SyncTab = 'compare' | 'logs';

interface SyncLog {
  id: string;
  timestamp: any;
  durationMs: number;
  totalScraped: number;
  registeredCount: number;
  updatedCount: number;
  errorCount: number;
  skippedCount: number;
  registered: { name: string; studentId?: string; enrollNote?: string }[];
  updated: { name: string; fields: string[]; enrollNote?: string }[];
  errors: { name: string; error: string }[];
}

interface MakeEduSyncModalProps {
  onClose: () => void;
  existingStudents: UnifiedStudent[];
}

/** 학교명 정규화 (엑셀 가져오기와 동일) */
const normalizeSchoolName = (school: string): string => {
  return school.trim()
    .replace(/초등학교$/g, '초')
    .replace(/중학교$/g, '중')
    .replace(/고등학교$/g, '고');
};

/** 학년 정규화 (엑셀 가져오기와 동일 로직) */
const normalizeGrade = (grade?: string, school?: string): string => {
  if (!grade) return '';
  const gradeNum = grade.match(/\d+/)?.[0];
  if (!gradeNum) return grade.trim();
  const num = parseInt(gradeNum);
  const schoolName = (school || '').toLowerCase();
  if (schoolName.includes('초') || schoolName.includes('elementary')) return `초${num}`;
  if (schoolName.includes('중') || schoolName.includes('middle')) return `중${num}`;
  if (schoolName.includes('고') || schoolName.includes('high')) return `고${num}`;
  if (grade.includes('초')) return `초${num}`;
  if (grade.includes('중')) return `중${num}`;
  if (grade.includes('고')) return `고${num}`;
  if (num >= 1 && num <= 6) return `초${num}`;
  if (num >= 7 && num <= 9) return `중${num - 6}`;
  return grade.trim();
};

/** 전화번호 포맷팅 (엑셀 가져오기와 동일) */
const formatPhoneNumber = (phone?: string): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  let normalized = digits;
  if (digits.length === 10 && digits.startsWith('10')) {
    normalized = '0' + digits;
  }
  if (normalized.length === 11 && normalized.startsWith('01')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  if (normalized.length === 10 && normalized.startsWith('0') && !normalized.startsWith('02')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  if (normalized.startsWith('02')) {
    if (normalized.length === 9) return `02-${normalized.slice(2, 5)}-${normalized.slice(5)}`;
    if (normalized.length === 10) return `02-${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }
  return phone.trim();
};

/** 입학일 포맷 (YYYYMMDD → YYYY-MM-DD) */
const formatDate = (date?: string): string | undefined => {
  if (!date) return undefined;
  const digits = date.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return date;
};

/** 전화번호 비교용 정규화 (숫자만 추출, 암호화된 값은 빈 문자열 취급) */
const normalizePhone = (phone?: string | null): string => {
  if (!phone) return '';
  // 암호화된 값 (U2FsdGVkX1로 시작)은 빈 문자열로 취급
  if (phone.startsWith('U2FsdGVkX1')) return '';
  return phone.replace(/\D/g, '');
};

/** 기존 학생과 MakeEdu 데이터를 비교하여 업데이트 가능한 필드 목록 반환 (빈 필드 + 차이) */
const getUpdatableFields = (existing: UnifiedStudent, meStudent: MakeEduStudent): string[] => {
  const fields: string[] = [];
  const normalizedSchool = normalizeSchoolName(meStudent.school || '');
  const normalizedGrade = normalizeGrade(meStudent.grade, meStudent.school);
  const gender = meStudent.gender === '남' ? 'male' : meStudent.gender === '여' ? 'female' : null;

  // 비어있거나 다른 경우 업데이트 가능
  if (gender && existing.gender !== gender) fields.push('성별');
  if (normalizedSchool && existing.school !== normalizedSchool) fields.push('학교');
  if (normalizedGrade && existing.grade !== normalizedGrade) fields.push('학년');
  if (meStudent.attendanceNumber && (existing as any).attendanceNumber !== meStudent.attendanceNumber) fields.push('출결번호');

  // 전화번호: 암호화된 값이면 차이로 판정, 평문이면 정규화 비교
  const formattedStudentPhone = formatPhoneNumber(meStudent.phone);
  const formattedParentPhone = formatPhoneNumber(meStudent.parentPhone);
  if (formattedStudentPhone && normalizePhone(existing.studentPhone) !== normalizePhone(formattedStudentPhone)) fields.push('원생연락처');
  if (formattedParentPhone && normalizePhone(existing.parentPhone) !== normalizePhone(formattedParentPhone)) fields.push('보호자연락처');

  if (meStudent.parentName && (existing as any).parentName !== meStudent.parentName) fields.push('보호자이름');
  if (meStudent.birthDate && (existing as any).birthDate !== meStudent.birthDate) fields.push('생일');
  if (meStudent.address && (existing as any).address !== meStudent.address) fields.push('주소');
  if (meStudent.customField1 && (existing as any).customField1 !== meStudent.customField1) fields.push('기타항목1');
  if (meStudent.customField2 && (existing as any).customField2 !== meStudent.customField2) fields.push('기타항목2');
  if (meStudent.memo && !(existing as any).memo) fields.push('메모');

  return fields;
};

/** 타임스탬프를 KST YYYY-MM-DD HH:mm 형식으로 변환 */
const formatTimestamp = (ts: any): string => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const min = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
};

const MakeEduSyncModal: React.FC<MakeEduSyncModalProps> = ({ onClose, existingStudents }) => {
  const [activeTab, setActiveTab] = useState<SyncTab>('compare');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [makeEduCount, setMakeEduCount] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  // 등록/업데이트 상태 관리
  const [registering, setRegistering] = useState<Record<number, boolean>>({});
  const [registered, setRegistered] = useState<Record<number, boolean>>({});
  const [registerError, setRegisterError] = useState<Record<number, string>>({});
  const [bulkRegistering, setBulkRegistering] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [updated, setUpdated] = useState<Record<number, boolean>>({});
  // 동기화 로그
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  // 일괄 등록 시 출결번호 중복 방지용 (등록할 때마다 추가)
  const usedAttendanceNumbers = useMemo(() => {
    const set = new Set<string>();
    existingStudents.forEach(s => {
      if ((s as any).attendanceNumber) set.add((s as any).attendanceNumber);
    });
    return set;
  }, [existingStudents]);
  // 일괄 등록 시 고유번호 중복 방지용
  const usedStudentCodes = useMemo(() => {
    const set = new Set<string>();
    existingStudents.forEach(s => {
      if ((s as any).studentCode) set.add((s as any).studentCode);
    });
    return set;
  }, [existingStudents]);

  const fetchAndCompare = async () => {
    setLoading(true);
    setError(null);
    setRegistered({});
    setRegisterError({});
    setUpdated({});
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const scrapeFn = httpsCallable(functions, 'scrapeMakeEduNewStudents');
      const response = await scrapeFn({});
      const data = response.data as {
        students: MakeEduStudent[];
        count: number;
        headers: string[];
      };

      setMakeEduCount(data.count);
      setHeaders(data.headers);

      // Build name lookup of existing IJW students
      const ijwNameMap = new Map<string, UnifiedStudent>();
      existingStudents.forEach(s => {
        if (s.name) ijwNameMap.set(s.name.trim(), s);
      });

      // Compare each MakeEdu student with IJW
      const comparisonResults: ComparisonResult[] = data.students.map(meStudent => {
        const normalizedName = meStudent.name.trim();
        const exactMatch = ijwNameMap.get(normalizedName) || null;
        const updatableFields = exactMatch ? getUpdatableFields(exactMatch, meStudent) : [];

        return {
          makeEduStudent: meStudent,
          ijwMatch: exactMatch,
          matchType: exactMatch ? 'exact' : 'none',
          updatableFields,
        };
      });

      // Sort: unmatched first, then updatable, then fully synced
      comparisonResults.sort((a, b) => {
        if (a.matchType === 'none' && b.matchType !== 'none') return -1;
        if (a.matchType !== 'none' && b.matchType === 'none') return 1;
        if (a.updatableFields.length > 0 && b.updatableFields.length === 0) return -1;
        if (a.updatableFields.length === 0 && b.updatableFields.length > 0) return 1;
        return 0;
      });

      setResults(comparisonResults);
    } catch (err: any) {
      const msg = err?.message || err?.details || '신규원생 조회에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      // 넉넉히 가져와서 중복/무변동 필터 후 20건 추출
      const q = query(
        collection(db, 'makeEduSyncLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as SyncLog[];

      // 로그 시그니처: 등록/업데이트/에러 학생 이름+필드를 정렬한 문자열
      const getSignature = (log: SyncLog): string => {
        const regNames = (log.registered || []).map(r => r.name).sort().join(',');
        const updNames = (log.updated || []).map(u => `${u.name}:${(u.fields || []).sort().join('+')}`).sort().join(',');
        const errNames = (log.errors || []).map(e => e.name).sort().join(',');
        return `R[${regNames}]U[${updNames}]E[${errNames}]`;
      };

      const filtered: SyncLog[] = [];
      let prevSig = '';
      for (const log of allLogs) {
        // 무변동 로그 (등록 0, 업데이트 0, 에러 0) 스킵
        if (log.registeredCount === 0 && log.updatedCount === 0 && log.errorCount === 0) continue;
        // 이전 로그와 동일한 내용(같은 학생들 반복 업데이트) 스킵
        const sig = getSignature(log);
        if (sig === prevSig) continue;
        prevSig = sig;
        filtered.push(log);
        if (filtered.length >= 20) break;
      }

      setLogs(filtered);
      setLogsLoaded(true);
    } catch (err) {
      console.error('Failed to fetch sync logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndCompare();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs' && !logsLoaded) fetchLogs();
  }, [activeTab, logsLoaded, fetchLogs]);

  /**
   * 개별 학생 등록 (신규)
   */
  const registerStudent = async (index: number) => {
    const result = results[index];
    if (!result || result.matchType === 'exact' || registered[index]) return;

    const student = result.makeEduStudent;
    setRegistering(prev => ({ ...prev, [index]: true }));
    setRegisterError(prev => ({ ...prev, [index]: '' }));

    try {
      const name = student.name.trim();
      const normalizedSchool = normalizeSchoolName(student.school || '');
      const grade = normalizeGrade(student.grade, student.school);

      const baseId = `${name}_${normalizedSchool || 'Unspecified'}_${grade || 'Unspecified'}`;
      let studentId = baseId;
      let counter = 1;

      while ((await getDoc(doc(db, 'students', studentId))).exists()) {
        counter++;
        studentId = `${baseId}_${counter}`;
        if (counter > 100) throw new Error('동일한 학생 정보가 너무 많습니다.');
      }

      // 출결번호: MakeEdu 값 사용 또는 자동 생성 (중복 체크 포함)
      let attendanceNumber = student.attendanceNumber;
      if (!attendanceNumber || usedAttendanceNumbers.has(attendanceNumber)) {
        attendanceNumber = generateAttendanceNumber(student.parentPhone || student.phone, usedAttendanceNumbers);
      }
      usedAttendanceNumbers.add(attendanceNumber);

      // 학생 고유번호 생성
      const studentCode = generateStudentCode(usedStudentCodes);
      usedStudentCodes.add(studentCode);

      const formattedStudentPhone = formatPhoneNumber(student.phone);
      const formattedParentPhone = formatPhoneNumber(student.parentPhone);

      const gender = student.gender === '남' ? 'male' : student.gender === '여' ? 'female' : null;
      const startDate = formatDate(student.registrationDate) || new Date().toISOString().split('T')[0];

      await setDoc(doc(db, 'students', studentId), {
        name, englishName: null, gender,
        school: normalizedSchool || null, grade: grade || null, graduationYear: null,
        attendanceNumber, studentCode,
        studentPhone: formattedStudentPhone || null,
        homePhone: null,
        parentPhone: formattedParentPhone || null,
        parentName: student.parentName || null, parentRelation: '모',
        zipCode: null, address: student.address || null, addressDetail: student.addressDetail || null,
        birthDate: student.birthDate || null, nickname: null,
        startDate, enrollmentReason: null,
        memo: student.memo || null,
        customField1: student.customField1 || null, customField2: student.customField2 || null,
        status: 'active',
        enrollmentDate: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
        smsNotification: true, pushNotification: false, kakaoNotification: true,
        billingSmsPrimary: true, billingSmsOther: false,
        overdueSmsPrimary: true, overdueSmsOther: false,
        makeEduSync: true,
      });

      // 영어 수업 자동 배정 (약어 변환 매칭)
      let enrollNote = '';
      const cf1 = (student.customField1 || '').toUpperCase();
      if (cf1.includes('E') && student.className) {
        try {
          const enrollResult = await autoEnrollEnglish(studentId, student.className, startDate, student._raw);
          if (enrollResult) enrollNote = enrollResult; // 매칭 실패 메시지
        } catch (e: any) {
          enrollNote = `영어 배정 오류: ${e?.message || '알 수 없음'}`;
        }
      }

      setRegistered(prev => ({ ...prev, [index]: true }));
      if (enrollNote) {
        setRegisterError(prev => ({ ...prev, [index]: enrollNote }));
      }
    } catch (err: any) {
      setRegisterError(prev => ({ ...prev, [index]: err?.message || '등록 실패' }));
    } finally {
      setRegistering(prev => ({ ...prev, [index]: false }));
    }
  };

  /**
   * 기존 학생 업데이트 (비어있는 필드만 MakeEdu 데이터로 채움)
   */
  const updateExistingStudent = async (index: number) => {
    const result = results[index];
    if (!result || !result.ijwMatch || result.updatableFields.length === 0 || updated[index]) return;

    const student = result.makeEduStudent;
    const existing = result.ijwMatch;
    setRegistering(prev => ({ ...prev, [index]: true }));
    setRegisterError(prev => ({ ...prev, [index]: '' }));

    try {
      const updateData: Record<string, any> = {};
      const normalizedSchool = normalizeSchoolName(student.school || '');
      const normalizedGradeVal = normalizeGrade(student.grade, student.school);
      const gender = student.gender === '남' ? 'male' : student.gender === '여' ? 'female' : null;

      // 비어있거나 다른 필드 업데이트
      if (gender && existing.gender !== gender) updateData.gender = gender;
      if (normalizedSchool && existing.school !== normalizedSchool) updateData.school = normalizedSchool;
      if (normalizedGradeVal && existing.grade !== normalizedGradeVal) updateData.grade = normalizedGradeVal;
      if (student.attendanceNumber && (existing as any).attendanceNumber !== student.attendanceNumber) updateData.attendanceNumber = student.attendanceNumber;
      if (student.parentName && (existing as any).parentName !== student.parentName) updateData.parentName = student.parentName;
      if (student.birthDate && (existing as any).birthDate !== student.birthDate) updateData.birthDate = student.birthDate;
      if (student.address && (existing as any).address !== student.address) updateData.address = student.address;
      if (student.customField1 && (existing as any).customField1 !== student.customField1) updateData.customField1 = student.customField1;
      if (student.customField2 && (existing as any).customField2 !== student.customField2) updateData.customField2 = student.customField2;
      if (student.memo && !(existing as any).memo) updateData.memo = student.memo;

      // 전화번호 (비어있거나 다른 경우 업데이트 - 평문 저장)
      const formattedStudentPhone = formatPhoneNumber(student.phone);
      const formattedParentPhone = formatPhoneNumber(student.parentPhone);

      if (formattedStudentPhone && normalizePhone(existing.studentPhone) !== normalizePhone(formattedStudentPhone)) {
        updateData.studentPhone = formattedStudentPhone;
      }
      if (formattedParentPhone && normalizePhone(existing.parentPhone) !== normalizePhone(formattedParentPhone)) {
        updateData.parentPhone = formattedParentPhone;
      }

      if (Object.keys(updateData).length === 0) {
        setUpdated(prev => ({ ...prev, [index]: true }));
        return;
      }

      updateData.updatedAt = Timestamp.now();
      updateData.makeEduSync = true;

      await updateDoc(doc(db, 'students', existing.id), updateData);

      // 영어 수업 자동 배정 (기타항목1에 E 포함 & 아직 배정 안 된 경우)
      let enrollNote = '';
      const cf1 = (student.customField1 || '').toUpperCase();
      if (cf1.includes('E') && student.className) {
        const enrollmentsSnap = await getDocs(collection(db, 'students', existing.id, 'enrollments'));
        const hasEnglish = enrollmentsSnap.docs.some(d => {
          const data = d.data();
          return data.subject === 'english' && !data.endDate;
        });
        if (!hasEnglish) {
          const startDate = formatDate(student.registrationDate) || (existing as any).startDate || new Date().toISOString().split('T')[0];
          try {
            const enrollResult = await autoEnrollEnglish(existing.id, student.className, startDate, student._raw);
            if (enrollResult) enrollNote = enrollResult;
          } catch (e: any) {
            enrollNote = `영어 배정 오류: ${e?.message || '알 수 없음'}`;
          }
        }
      }

      setUpdated(prev => ({ ...prev, [index]: true }));
      if (enrollNote) {
        setRegisterError(prev => ({ ...prev, [index]: enrollNote }));
      }
    } catch (err: any) {
      setRegisterError(prev => ({ ...prev, [index]: err?.message || '업데이트 실패' }));
    } finally {
      setRegistering(prev => ({ ...prev, [index]: false }));
    }
  };

  /**
   * 영어 수업 자동 배정 (약어 변환 매칭)
   * 1차: 정확한 className 매칭
   * 2차: parseClassName으로 레벨+넘버 패턴 매칭 (DP3, RTT2a 등)
   * 3차: _raw 데이터에서 영어 클래스 패턴 탐색 (수업 열이 수학일 경우)
   * 4차: 부분 문자열 매칭
   */
  const autoEnrollEnglish = async (
    studentId: string,
    className: string,
    startDate: string,
    rawData?: Record<string, string>
  ): Promise<string | null> => {
    const classesSnap = await getDocs(collection(db, 'classes'));
    const englishClasses: any[] = [];
    classesSnap.forEach(docSnap => {
      const cls = docSnap.data();
      if (cls.subject === 'english') {
        englishClasses.push({ id: docSnap.id, ...cls });
      }
    });

    if (englishClasses.length === 0) return '영어 수업이 등록되어 있지 않습니다';

    const validLevelAbbrs = DEFAULT_ENGLISH_LEVELS.map(l => l.abbreviation.toUpperCase());

    // 영어 레벨 패턴으로 클래스 매칭하는 헬퍼
    const matchByLevel = (name: string): any | null => {
      const parsed = parseClassName(name);
      if (!parsed || !validLevelAbbrs.includes(parsed.levelAbbr.toUpperCase())) return null;
      // 정확한 레벨+넘버+접미사 매칭
      let found = englishClasses.find(c => c.className === name);
      if (found) return found;
      // 레벨+넘버 매칭 (접미사 무시)
      found = englishClasses.find(c => {
        const p = parseClassName(c.className);
        return p && p.levelAbbr.toUpperCase() === parsed.levelAbbr.toUpperCase() && p.number === parsed.number;
      });
      return found || null;
    };

    let matchedClass: any = null;

    // 1차: 정확한 className 매칭 (subject=english)
    matchedClass = englishClasses.find(c => c.className === className);

    // 2차: className이 영어 레벨 패턴인 경우 약어 변환 매칭
    if (!matchedClass) {
      matchedClass = matchByLevel(className);
    }

    // 3차: className이 영어 패턴이 아닌 경우 (수학 클래스명일 수 있음)
    // _raw 데이터에서 영어 클래스 패턴 탐색
    if (!matchedClass && rawData) {
      for (const value of Object.values(rawData)) {
        if (!value || value === className) continue;
        const trimmed = value.trim();
        matchedClass = matchByLevel(trimmed);
        if (matchedClass) break;
      }
    }

    // 4차: 부분 문자열 매칭 (className에 영어 클래스명이 포함된 경우)
    if (!matchedClass) {
      matchedClass = englishClasses.find(c =>
        c.className && className &&
        (c.className.includes(className) || className.includes(c.className))
      );
    }

    if (!matchedClass) return `영어 수업 '${className}' 매칭 실패`;

    const enrollmentId = `enrollment_${Date.now()}`;
    await setDoc(doc(db, `students/${studentId}/enrollments`, enrollmentId), {
      classId: matchedClass.id,
      subject: 'english',
      className: matchedClass.className,
      staffId: matchedClass.teacher || '',
      teacher: matchedClass.teacher || '',
      schedule: matchedClass.schedule || [],
      days: [],
      period: null, room: null,
      startDate, endDate: null, color: null,
      isSlotTeacher: false,
      createdAt: Timestamp.now(),
    });
    return null; // 성공
  };

  /** 미등록 학생 일괄 등록 */
  const registerAllUnmatched = async () => {
    setBulkRegistering(true);
    const indices = results
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.matchType === 'none' && !registered[i])
      .map(({ i }) => i);
    for (const idx of indices) await registerStudent(idx);
    setBulkRegistering(false);
  };

  /** 업데이트 가능한 기존 학생 일괄 업데이트 */
  const updateAllUpdatable = async () => {
    setBulkUpdating(true);
    const indices = results
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.matchType === 'exact' && r.updatableFields.length > 0 && !updated[i])
      .map(({ i }) => i);
    for (const idx of indices) await updateExistingStudent(idx);
    setBulkUpdating(false);
  };

  const unmatchedCount = results.filter(r => r.matchType === 'none').length;
  const matchedCount = results.filter(r => r.matchType === 'exact').length;
  const registeredCount = Object.values(registered).filter(Boolean).length;
  const updatedCount = Object.values(updated).filter(Boolean).length;
  const remainingUnmatched = unmatchedCount - registeredCount;

  const updatableCount = useMemo(() =>
    results.filter((r, i) => r.matchType === 'exact' && r.updatableFields.length > 0 && !updated[i]).length,
    [results, updated]
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="메이크에듀 신규원생 동기화"
      size="xl"
      compact
    >
      {/* 탭 버튼 */}
      <div className="flex border-b mb-3">
        <button
          onClick={() => setActiveTab('compare')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'compare'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <UserPlus className="w-3 h-3" />
          신규원생 비교
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Clock className="w-3 h-3" />
          동기화 로그
        </button>
      </div>

      {/* 비교 탭 */}
      {activeTab === 'compare' && (loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <p className="text-sm text-gray-600">메이크에듀 신규원생 조회 중...</p>
          <p className="text-xs text-gray-400">로그인 → 신규원생 목록 가져오는 중</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-600 font-medium">조회 실패</p>
          <p className="text-xs text-red-500 max-w-md text-center">{error}</p>
          <button
            onClick={fetchAndCompare}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs rounded-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center flex-wrap gap-2 p-2 bg-gray-50 rounded-sm border text-xs">
            <span className="font-bold text-primary">
              메이크에듀 {makeEduCount}명
            </span>
            <span className="text-gray-300">|</span>
            {remainingUnmatched > 0 ? (
              <span className="font-bold text-red-600">미등록 {remainingUnmatched}명</span>
            ) : unmatchedCount > 0 ? (
              <span className="font-bold text-emerald-600">모두 등록 완료</span>
            ) : (
              <span className="font-bold text-emerald-600">모두 등록됨</span>
            )}
            {updatableCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-bold text-blue-600">업데이트 가능 {updatableCount}명</span>
              </>
            )}
            {updatedCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-bold text-blue-600">업데이트 완료 {updatedCount}명</span>
              </>
            )}
            {registeredCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-emerald-600 font-bold">방금 등록 {registeredCount}명</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              {updatableCount > 0 && (
                <button
                  onClick={updateAllUpdatable}
                  disabled={bulkUpdating || bulkRegistering}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {bulkUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <PenLine className="w-3 h-3" />
                  )}
                  일괄 업데이트 ({updatableCount})
                </button>
              )}
              {remainingUnmatched > 0 && (
                <button
                  onClick={registerAllUnmatched}
                  disabled={bulkRegistering || bulkUpdating}
                  className="flex items-center gap-1 px-2 py-1 bg-accent text-primary text-xs font-bold rounded-sm hover:bg-[#e5a60f] transition-colors disabled:opacity-50"
                >
                  {bulkRegistering ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  일괄 등록 ({remainingUnmatched})
                </button>
              )}
              <button
                onClick={fetchAndCompare}
                className="p-1 text-gray-400 hover:text-primary transition-colors"
                title="새로고침"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Results Table */}
          {results.length > 0 ? (
            <div className="border rounded-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">이름</th>
                    <th className="px-2 py-1.5 text-left font-medium">성별</th>
                    <th className="px-2 py-1.5 text-left font-medium">학교</th>
                    <th className="px-2 py-1.5 text-left font-medium">학년</th>
                    <th className="px-2 py-1.5 text-left font-medium">반</th>
                    <th className="px-2 py-1.5 text-left font-medium">과목</th>
                    <th className="px-2 py-1.5 text-left font-medium">연락처</th>
                    <th className="px-2 py-1.5 text-left font-medium">보호자</th>
                    <th className="px-2 py-1.5 text-left font-medium">등록일</th>
                    <th className="px-2 py-1.5 text-center font-medium">IJW 상태</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => {
                    const s = result.makeEduStudent;
                    const cf1 = (s.customField1 || '').toUpperCase();
                    const subjects: string[] = [];
                    if (cf1.includes('M')) subjects.push('수');
                    if (cf1.includes('E')) subjects.push('영');

                    const hasUpdates = result.matchType === 'exact' && result.updatableFields.length > 0;
                    const isUpdated = updated[i];
                    const isRegistered = registered[i];

                    return (
                      <tr
                        key={i}
                        className={`border-t ${
                          isRegistered || isUpdated
                            ? 'bg-emerald-50 hover:bg-emerald-100'
                            : result.matchType === 'none'
                            ? 'bg-red-50 hover:bg-red-100'
                            : hasUpdates
                            ? 'bg-blue-50 hover:bg-blue-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-2 py-1.5 text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-2 py-1.5 font-bold whitespace-nowrap">{s.name}</td>
                        <td className="px-2 py-1.5 text-gray-600">{s.gender || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600">{s.school || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600">{s.grade || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600">{s.className || '-'}</td>
                        <td className="px-2 py-1.5">
                          {subjects.length > 0 ? (
                            <div className="flex gap-0.5">
                              {subjects.map(sub => (
                                <span
                                  key={sub}
                                  className={`px-1 py-0.5 rounded-sm text-xxs font-bold ${
                                    sub === '수' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {sub}
                                </span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 font-mono whitespace-nowrap">
                          {s.phone || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                          {s.parentName ? `${s.parentName} ` : ''}
                          {s.parentPhone ? <span className="font-mono">{s.parentPhone}</span> : !s.parentName ? '-' : ''}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{s.registrationDate || '-'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              등록완료
                            </span>
                          ) : isUpdated ? (
                            <span className="inline-flex items-center gap-0.5 text-blue-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              업데이트됨
                            </span>
                          ) : result.matchType === 'exact' && hasUpdates ? (
                            <div>
                              <button
                                onClick={() => updateExistingStudent(i)}
                                disabled={registering[i] || bulkUpdating || bulkRegistering}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-500 text-white font-bold rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50 text-xs"
                              >
                                {registering[i] ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <PenLine className="w-3 h-3" />
                                )}
                                업데이트
                              </button>
                              <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                                {result.updatableFields.map(f => (
                                  <span key={f} className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded-sm text-xxs">
                                    +{f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : result.matchType === 'exact' ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                              <UserCheck className="w-3.5 h-3.5" />
                              동기화됨
                            </span>
                          ) : (
                            <button
                              onClick={() => registerStudent(i)}
                              disabled={registering[i] || bulkRegistering || bulkUpdating}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-accent text-primary font-bold rounded-sm hover:bg-[#e5a60f] transition-colors disabled:opacity-50 text-xs"
                            >
                              {registering[i] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              등록
                            </button>
                          )}
                          {registerError[i] && (
                            <p className="text-xxs text-red-500 mt-0.5">{registerError[i]}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              신규원생이 없습니다.
            </div>
          )}

          {/* 안내 */}
          <div className="text-xxs text-gray-400 space-y-0.5">
            <p>• 기타항목1에 E 포함 시 영어 수업 자동 배정 (수학은 수동 배정 필요)</p>
            <p>• 출결번호가 없는 학생은 자동 생성됩니다</p>
            <p>• 업데이트는 IJW 데이터와 다른 필드를 MakeEdu 데이터로 갱신합니다 (메모는 빈 경우만)</p>
          </div>
        </div>
      ))}

      {/* 로그 탭 */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">30분마다 자동 동기화된 기록 (최근 20건)</p>
            <button
              onClick={() => { setLogsLoaded(false); fetchLogs(); }}
              className="p-1 text-gray-400 hover:text-primary transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              <p className="text-xs text-gray-500">로그 불러오는 중...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              동기화 로그가 없습니다.
            </div>
          ) : (
            <div className="border rounded-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-2 py-1.5 text-left font-medium">시각</th>
                    <th className="px-2 py-1.5 text-right font-medium">소요</th>
                    <th className="px-2 py-1.5 text-right font-medium">조회</th>
                    <th className="px-2 py-1.5 text-right font-medium">등록</th>
                    <th className="px-2 py-1.5 text-right font-medium">업데이트</th>
                    <th className="px-2 py-1.5 text-right font-medium">에러</th>
                    <th className="px-2 py-1.5 text-center font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDetails = (log.registered?.length > 0) || (log.updated?.length > 0) || (log.errors?.length > 0);
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`border-t cursor-pointer transition-colors ${
                            isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
                          } ${log.errorCount > 0 ? 'text-red-600' : ''}`}
                          onClick={() => hasDetails && setExpandedLogId(isExpanded ? null : log.id)}
                        >
                          <td className="px-2 py-1.5 whitespace-nowrap font-mono">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-500">
                            {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-right">{log.totalScraped ?? '-'}</td>
                          <td className="px-2 py-1.5 text-right">
                            {log.registeredCount > 0 ? (
                              <span className="font-bold text-emerald-600">{log.registeredCount}</span>
                            ) : '0'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {log.updatedCount > 0 ? (
                              <span className="font-bold text-blue-600">{log.updatedCount}</span>
                            ) : '0'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {log.errorCount > 0 ? (
                              <span className="font-bold text-red-600">{log.errorCount}</span>
                            ) : '0'}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {hasDetails && (
                              isExpanded
                                ? <ChevronUp className="w-3 h-3 inline text-gray-400" />
                                : <ChevronDown className="w-3 h-3 inline text-gray-400" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={7} className="px-3 py-2">
                              <div className="space-y-2 text-xs">
                                {log.registered?.length > 0 && (
                                  <div>
                                    <p className="font-bold text-emerald-700 mb-1">
                                      신규 등록 ({log.registered.length}명)
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {log.registered.map((r, i) => (
                                        <span key={i} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-sm">
                                          {r.name}
                                          {r.enrollNote && <span className="text-orange-500 ml-1">({r.enrollNote})</span>}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {log.updated?.length > 0 && (
                                  <div>
                                    <p className="font-bold text-blue-700 mb-1">
                                      업데이트 ({log.updated.length}명)
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {log.updated.map((u, i) => (
                                        <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-sm">
                                          {u.name}
                                          {u.fields?.length > 0 && (
                                            <span className="text-blue-500 ml-1">
                                              [{u.fields.join(', ')}]
                                            </span>
                                          )}
                                          {u.enrollNote && <span className="text-orange-500 ml-1">({u.enrollNote})</span>}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {log.errors?.length > 0 && (
                                  <div>
                                    <p className="font-bold text-red-700 mb-1">
                                      에러 ({log.errors.length}건)
                                    </p>
                                    <div className="space-y-0.5">
                                      {log.errors.map((e, i) => (
                                        <p key={i} className="text-red-600">
                                          <span className="font-bold">{e.name}</span>: {e.error}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {log.skippedCount > 0 && (
                                  <p className="text-gray-500">변경 없이 스킵: {log.skippedCount}명</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default MakeEduSyncModal;
