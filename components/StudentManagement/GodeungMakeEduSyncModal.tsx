/**
 * GodeungMakeEduSyncModal - 고등수학관 MakeEdu 신규원생 동기화 모달
 *
 * MakeEduSyncModal과 동일한 로직이지만:
 * - Cloud Function: scrapeMakeEduGodeungStudents (별도 크리덴셜)
 * - 비교 대상: campus === 'godeung' 학생만
 * - 신규 학생 생성 시: campus='godeung', 문서 ID에 'gd_' 프리픽스
 * - 동기화 로그: makeEduGodeungSyncLogs 컬렉션
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, UserCheck, RefreshCw, AlertCircle, UserPlus, CheckCircle2, PenLine } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebaseConfig';
import { doc, setDoc, getDoc, Timestamp, collection, getDocs, updateDoc } from 'firebase/firestore';
import Modal from '../Common/Modal';
import { UnifiedStudent } from '../../types';
import { generateAttendanceNumber } from '../../utils/attendanceNumberGenerator';
import { getCampus } from '../../utils/campusUtils';

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
  attendanceNumber: string;
  customField1: string;
  customField2: string;
  gender: string;
  parentName: string;
  birthDate: string;
  address: string;
  addressDetail: string;
  makeEduNo?: string;
  _raw: Record<string, string>;
}

interface ComparisonResult {
  makeEduStudent: MakeEduStudent;
  ijwMatch: UnifiedStudent | null;
  matchType: 'exact' | 'code' | 'none';
  updatableFields: string[];
}

interface GodeungMakeEduSyncModalProps {
  onClose: () => void;
  existingStudents: UnifiedStudent[];
}

const normalizeSchoolName = (school: string): string => {
  return school.trim()
    .replace(/초등학교$/g, '초')
    .replace(/중학교$/g, '중')
    .replace(/고등학교$/g, '고');
};

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

const formatPhoneNumber = (phone?: string): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  let normalized = digits;
  if (digits.length === 10 && digits.startsWith('10')) normalized = '0' + digits;
  if (normalized.length === 11 && normalized.startsWith('01')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  if (normalized.length === 10 && normalized.startsWith('0') && !normalized.startsWith('02')) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return phone.trim();
};

const formatDate = (date?: string): string | undefined => {
  if (!date) return undefined;
  const digits = date.replace(/\D/g, '');
  if (digits.length === 8) return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return date;
};

const normalizePhone = (phone?: string | null): string => {
  if (!phone) return '';
  if (phone.startsWith('U2FsdGVkX1')) return '';
  return phone.replace(/\D/g, '');
};

const getUpdatableFields = (existing: UnifiedStudent, meStudent: MakeEduStudent): string[] => {
  const fields: string[] = [];
  const normalizedSchool = normalizeSchoolName(meStudent.school || '');
  const normalizedGrade = normalizeGrade(meStudent.grade, meStudent.school);
  const gender = meStudent.gender === '남' ? 'male' : meStudent.gender === '여' ? 'female' : null;

  if (meStudent.name && existing.name !== meStudent.name.trim()) fields.push('이름');
  if (gender && existing.gender !== gender) fields.push('성별');
  if (normalizedSchool && existing.school !== normalizedSchool) fields.push('학교');
  if (normalizedGrade && existing.grade !== normalizedGrade) fields.push('학년');
  if (meStudent.attendanceNumber && (existing as any).attendanceNumber !== meStudent.attendanceNumber) fields.push('출결번호');

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
  const makeEduNo = meStudent.makeEduNo;
  if (makeEduNo && makeEduNo.trim() !== "" && (existing as any).studentCode !== makeEduNo) fields.push('원생고유번호');

  return fields;
};

const GodeungMakeEduSyncModal: React.FC<GodeungMakeEduSyncModalProps> = ({ onClose, existingStudents }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [makeEduCount, setMakeEduCount] = useState(0);
  const [registering, setRegistering] = useState<Record<number, boolean>>({});
  const [registered, setRegistered] = useState<Record<number, boolean>>({});
  const [registerError, setRegisterError] = useState<Record<number, string>>({});
  const [bulkRegistering, setBulkRegistering] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [updated, setUpdated] = useState<Record<number, boolean>>({});

  // 고등수학관 학생만 비교 대상
  const godeungStudents = useMemo(() =>
    existingStudents.filter(s => getCampus(s) === 'godeung'),
    [existingStudents]
  );

  const usedAttendanceNumbers = useMemo(() => {
    const set = new Set<string>();
    existingStudents.forEach(s => {
      if ((s as any).attendanceNumber) set.add((s as any).attendanceNumber);
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
      // 고등수학관 전용 Cloud Function 호출
      const scrapeFn = httpsCallable(functions, 'scrapeMakeEduGodeungStudents');
      const response = await scrapeFn({});
      const data = response.data as {
        students: MakeEduStudent[];
        count: number;
        headers: string[];
      };

      setMakeEduCount(data.count);

      // 고등수학관 학생만으로 비교 맵 구성
      const ijwNameMap = new Map<string, UnifiedStudent>();
      const ijwCodeMap = new Map<string, UnifiedStudent>();
      godeungStudents.forEach(s => {
        if (s.name) ijwNameMap.set(s.name.trim(), s);
        const studentCode = (s as any).studentCode;
        if (studentCode && studentCode.trim() !== "") {
          ijwCodeMap.set(studentCode.trim(), s);
        }
      });

      const comparisonResults: ComparisonResult[] = data.students.map(meStudent => {
        const normalizedName = meStudent.name.trim();
        const makeEduNo = meStudent.makeEduNo?.trim();

        let exactMatch: UnifiedStudent | null = null;
        let matchType: 'exact' | 'code' | 'none' = 'none';

        if (makeEduNo && makeEduNo !== "") {
          exactMatch = ijwCodeMap.get(makeEduNo) || null;
          if (exactMatch) matchType = 'code';
        }
        if (!exactMatch) {
          exactMatch = ijwNameMap.get(normalizedName) || null;
          if (exactMatch) matchType = 'exact';
        }

        const updatableFields = exactMatch ? getUpdatableFields(exactMatch, meStudent) : [];
        return { makeEduStudent: meStudent, ijwMatch: exactMatch, matchType, updatableFields };
      });

      comparisonResults.sort((a, b) => {
        if (a.matchType === 'none' && b.matchType !== 'none') return -1;
        if (a.matchType !== 'none' && b.matchType === 'none') return 1;
        if (a.updatableFields.length > 0 && b.updatableFields.length === 0) return -1;
        if (a.updatableFields.length === 0 && b.updatableFields.length > 0) return 1;
        return 0;
      });

      setResults(comparisonResults);
    } catch (err: any) {
      const msg = err?.message || err?.details || '고등수학관 신규원생 조회에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAndCompare(); }, []);

  /** 개별 학생 등록 - 고등수학관 전용 (campus='godeung', ID 프리픽스 'gd_') */
  const registerStudent = async (index: number) => {
    const result = results[index];
    if (!result || result.matchType !== 'none' || registered[index]) return;

    const student = result.makeEduStudent;
    setRegistering(prev => ({ ...prev, [index]: true }));
    setRegisterError(prev => ({ ...prev, [index]: '' }));

    try {
      const name = student.name.trim();
      const normalizedSchool = normalizeSchoolName(student.school || '');
      const grade = normalizeGrade(student.grade, student.school);

      // gd_ 프리픽스로 고등수학관 학생 ID 생성
      const baseId = `gd_${name}_${normalizedSchool || 'Unspecified'}_${grade || 'Unspecified'}`;
      let studentId = baseId;
      let counter = 1;
      while ((await getDoc(doc(db, 'students', studentId))).exists()) {
        counter++;
        studentId = `${baseId}_${counter}`;
        if (counter > 100) throw new Error('동일한 학생 정보가 너무 많습니다.');
      }

      let attendanceNumber = student.attendanceNumber;
      if (!attendanceNumber || usedAttendanceNumbers.has(attendanceNumber)) {
        attendanceNumber = generateAttendanceNumber(student.parentPhone || student.phone, usedAttendanceNumbers);
      }
      usedAttendanceNumbers.add(attendanceNumber);

      const studentCode = student.makeEduNo || null;
      const formattedStudentPhone = formatPhoneNumber(student.phone);
      const formattedParentPhone = formatPhoneNumber(student.parentPhone);
      const gender = student.gender === '남' ? 'male' : student.gender === '여' ? 'female' : null;
      const startDate = formatDate(student.registrationDate) || new Date().toISOString().split('T')[0];

      await setDoc(doc(db, 'students', studentId), {
        name, englishName: null, gender,
        campus: 'godeung', // 고등수학관 캠퍼스 태그
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

      setRegistered(prev => ({ ...prev, [index]: true }));
    } catch (err: any) {
      setRegisterError(prev => ({ ...prev, [index]: err?.message || '등록 실패' }));
    } finally {
      setRegistering(prev => ({ ...prev, [index]: false }));
    }
  };

  /** 기존 학생 업데이트 */
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

      if (student.name && existing.name !== student.name.trim()) updateData.name = student.name.trim();
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
      const makeEduNo = student.makeEduNo;
      if (makeEduNo && makeEduNo.trim() !== "" && (existing as any).studentCode !== makeEduNo) updateData.studentCode = makeEduNo;

      const formattedStudentPhone = formatPhoneNumber(student.phone);
      const formattedParentPhone = formatPhoneNumber(student.parentPhone);
      if (formattedStudentPhone && normalizePhone(existing.studentPhone) !== normalizePhone(formattedStudentPhone)) updateData.studentPhone = formattedStudentPhone;
      if (formattedParentPhone && normalizePhone(existing.parentPhone) !== normalizePhone(formattedParentPhone)) updateData.parentPhone = formattedParentPhone;

      if (Object.keys(updateData).length === 0) {
        setUpdated(prev => ({ ...prev, [index]: true }));
        return;
      }

      updateData.updatedAt = Timestamp.now();
      updateData.makeEduSync = true;

      await updateDoc(doc(db, 'students', existing.id), updateData);
      setUpdated(prev => ({ ...prev, [index]: true }));
    } catch (err: any) {
      setRegisterError(prev => ({ ...prev, [index]: err?.message || '업데이트 실패' }));
    } finally {
      setRegistering(prev => ({ ...prev, [index]: false }));
    }
  };

  const registerAllUnmatched = async () => {
    setBulkRegistering(true);
    const indices = results
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.matchType === 'none' && !registered[i])
      .map(({ i }) => i);
    for (const idx of indices) await registerStudent(idx);
    setBulkRegistering(false);
  };

  const updateAllUpdatable = async () => {
    setBulkUpdating(true);
    const indices = results
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => (r.matchType === 'exact' || r.matchType === 'code') && r.updatableFields.length > 0 && !updated[i])
      .map(({ i }) => i);
    for (const idx of indices) await updateExistingStudent(idx);
    setBulkUpdating(false);
  };

  const unmatchedCount = results.filter(r => r.matchType === 'none').length;
  const registeredCount = Object.values(registered).filter(Boolean).length;
  const updatedCount = Object.values(updated).filter(Boolean).length;
  const remainingUnmatched = unmatchedCount - registeredCount;

  const updatableCount = useMemo(() =>
    results.filter((r, i) => (r.matchType === 'exact' || r.matchType === 'code') && r.updatableFields.length > 0 && !updated[i]).length,
    [results, updated]
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="고등수학관 원생 조회"
      size="xl"
      compact
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-gray-600">고등수학관 메이크에듀 원생 조회 중...</p>
          <p className="text-xs text-gray-400">로그인 → 원생 목록 가져오는 중</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-red-600 font-medium">조회 실패</p>
          <p className="text-xs text-red-500 max-w-md text-center">{error}</p>
          <button
            onClick={fetchAndCompare}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-sm hover:bg-purple-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            다시 시도
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center flex-wrap gap-2 p-2 bg-purple-50 rounded-sm border border-purple-200 text-xs">
            <span className="font-bold text-purple-700">
              고등수학관 {makeEduCount}명
            </span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-500">
              기존 고등수학관 학생 {godeungStudents.length}명
            </span>
            <span className="text-gray-300">|</span>
            {remainingUnmatched > 0 ? (
              <span className="font-bold text-red-600">미등록 {remainingUnmatched}명</span>
            ) : (
              <span className="font-bold text-emerald-600">모두 등록됨</span>
            )}
            {updatableCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="font-bold text-blue-600">업데이트 가능 {updatableCount}명</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              {updatableCount > 0 && (
                <button
                  onClick={updateAllUpdatable}
                  disabled={bulkUpdating || bulkRegistering}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {bulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenLine className="w-3 h-3" />}
                  일괄 업데이트 ({updatableCount})
                </button>
              )}
              {remainingUnmatched > 0 && (
                <button
                  onClick={registerAllUnmatched}
                  disabled={bulkRegistering || bulkUpdating}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {bulkRegistering ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                  일괄 등록 ({remainingUnmatched})
                </button>
              )}
              <button
                onClick={fetchAndCompare}
                className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
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
                  <tr className="bg-purple-600 text-white">
                    <th className="px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">이름</th>
                    <th className="px-2 py-1.5 text-left font-medium">성별</th>
                    <th className="px-2 py-1.5 text-left font-medium">학교</th>
                    <th className="px-2 py-1.5 text-left font-medium">학년</th>
                    <th className="px-2 py-1.5 text-left font-medium">연락처</th>
                    <th className="px-2 py-1.5 text-left font-medium">보호자</th>
                    <th className="px-2 py-1.5 text-left font-medium">등록일</th>
                    <th className="px-2 py-1.5 text-center font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, i) => {
                    const s = result.makeEduStudent;
                    const hasUpdates = (result.matchType === 'exact' || result.matchType === 'code') && result.updatableFields.length > 0;
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
                        <td className="px-2 py-1.5 text-gray-600 font-mono whitespace-nowrap">{s.phone || '-'}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                          {s.parentName ? `${s.parentName} ` : ''}
                          {s.parentPhone ? <span className="font-mono">{s.parentPhone}</span> : !s.parentName ? '-' : ''}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{s.registrationDate || '-'}</td>
                        <td className="px-2 py-1.5 text-center">
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 등록완료
                            </span>
                          ) : isUpdated ? (
                            <span className="inline-flex items-center gap-0.5 text-blue-600 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 업데이트됨
                            </span>
                          ) : hasUpdates ? (
                            <div>
                              <button
                                onClick={() => updateExistingStudent(i)}
                                disabled={registering[i] || bulkUpdating || bulkRegistering}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-500 text-white font-bold rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50 text-xs"
                              >
                                {registering[i] ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenLine className="w-3 h-3" />}
                                업데이트
                              </button>
                              <div className="flex flex-wrap gap-0.5 mt-1 justify-center">
                                {result.updatableFields.map(f => (
                                  <span key={f} className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded-sm text-xxs">+{f}</span>
                                ))}
                              </div>
                            </div>
                          ) : (result.matchType === 'exact' || result.matchType === 'code') ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                              <UserCheck className="w-3.5 h-3.5" /> 동기화됨
                            </span>
                          ) : (
                            <button
                              onClick={() => registerStudent(i)}
                              disabled={registering[i] || bulkRegistering || bulkUpdating}
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-purple-600 text-white font-bold rounded-sm hover:bg-purple-700 transition-colors disabled:opacity-50 text-xs"
                            >
                              {registering[i] ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
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
              고등수학관 원생이 없습니다.
            </div>
          )}

          <div className="text-xxs text-gray-400 space-y-0.5">
            <p>• 고등수학관 전용 MakeEdu 계정에서 원생 데이터를 가져옵니다</p>
            <p>• 등록되는 학생은 campus='godeung' 태그 + 문서 ID에 'gd_' 프리픽스가 붙습니다</p>
            <p>• 본원 학생과 이름이 겹쳐도 별도로 관리됩니다</p>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default GodeungMakeEduSyncModal;
