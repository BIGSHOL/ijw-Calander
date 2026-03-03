/**
 * StaffMergeModal - 중복 직원 병합 모달
 *
 * 중복 기준: 이름이 같은 직원
 * 처리:
 *   1. 대표 직원 선택 (유저가 선택)
 *   2. 보조 직원의 빈 필드를 대표에 보완
 *   3. classes 컬렉션의 teacher/slotTeachers 참조 업데이트 (이름 변경 시)
 *   4. 보조 직원 삭제
 */

import React, { useState, useCallback, useMemo } from 'react';
import { X, Loader2, GitMerge, ChevronDown, ChevronRight, Check, AlertTriangle, Crown } from 'lucide-react';
import { doc, writeBatch, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { StaffMember } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface StaffMergeModalProps {
  staff: StaffMember[];
  onClose: () => void;
}

interface DuplicateGroup {
  name: string;
  members: StaffMember[];
  primaryId: string; // 대표 직원 ID
}

interface MergeResult {
  mergedGroups: number;
  deletedStaff: number;
  migratedRefs: number;
  errors: string[];
}

// 병합할 필드 목록 (빈 값이면 보조에서 채움)
const MERGE_FIELDS: (keyof StaffMember)[] = [
  'uid', 'email', 'englishName', 'phone', 'subjects', 'hireDate',
  'workSchedule', 'profileImage', 'memo', 'systemRole', 'approvalStatus',
  'departmentPermissions', 'favoriteDepartments', 'primaryDepartmentId',
  'jobTitle', 'isNative', 'bgColor', 'textColor', 'defaultRoom', 'timetableOrder',
];

const StaffMergeModal: React.FC<StaffMergeModalProps> = ({ staff, onClose }) => {
  const queryClient = useQueryClient();
  useEscapeClose(onClose);

  const [step, setStep] = useState<'preview' | 'processing' | 'done'>('preview');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<MergeResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // 이름 기준 중복 그룹 감지
  const duplicateGroups = useMemo(() => {
    const nameMap = new Map<string, StaffMember[]>();
    staff.forEach(s => {
      if (s.status === 'resigned') return; // 퇴사자 제외
      const existing = nameMap.get(s.name) || [];
      existing.push(s);
      nameMap.set(s.name, existing);
    });

    const groups: DuplicateGroup[] = [];
    nameMap.forEach((members, name) => {
      if (members.length < 2) return;
      // 대표: uid가 있는 쪽 우선, 없으면 subjects가 있는 쪽, 그것도 없으면 첫 번째
      const primary = members.find(m => m.uid)
        || members.find(m => m.subjects && m.subjects.length > 0)
        || members[0];
      groups.push({ name, members, primaryId: primary.id });
    });

    return groups;
  }, [staff]);

  // primaryId 변경
  const [groupPrimaries, setGroupPrimaries] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    duplicateGroups.forEach(g => { map[g.name] = g.primaryId; });
    return map;
  });

  const setPrimary = useCallback((groupName: string, staffId: string) => {
    setGroupPrimaries(prev => ({ ...prev, [groupName]: staffId }));
  }, []);

  const toggleExpand = useCallback((name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  // 필드 병합: 대표에 없는 필드를 보조에서 채움
  const mergeFields = useCallback((primary: StaffMember, secondaries: StaffMember[]): Partial<StaffMember> => {
    const merged: Partial<StaffMember> = {};

    for (const field of MERGE_FIELDS) {
      const pVal = primary[field];
      const isEmpty = pVal === undefined || pVal === null || pVal === ''
        || (Array.isArray(pVal) && pVal.length === 0);

      if (isEmpty) {
        for (const sec of secondaries) {
          const sVal = sec[field];
          const secHasValue = sVal !== undefined && sVal !== null && sVal !== ''
            && !(Array.isArray(sVal) && sVal.length === 0);
          if (secHasValue) {
            (merged as any)[field] = sVal;
            break;
          }
        }
      }
    }

    // memo 합치기
    const allMemos = [primary.memo, ...secondaries.map(s => s.memo)].filter(Boolean);
    if (allMemos.length > 1) {
      merged.memo = allMemos.join('\n---\n');
    }

    // approvalStatus: approved 우선
    const anyApproved = [primary, ...secondaries].some(s => s.approvalStatus === 'approved');
    if (anyApproved) merged.approvalStatus = 'approved';

    // systemRole: 가장 높은 역할 우선
    const roleOrder = ['user', 'staff', 'teacher', 'manager', 'director', 'admin', 'owner', 'master'];
    const allRoles = [primary.systemRole, ...secondaries.map(s => s.systemRole)].filter(Boolean);
    if (allRoles.length > 0) {
      allRoles.sort((a, b) => roleOrder.indexOf(b!) - roleOrder.indexOf(a!));
      merged.systemRole = allRoles[0] as any;
    }

    return merged;
  }, []);

  // 보조 UID → 대표 UID로 일괄 변경 (UID를 참조하는 모든 컬렉션)
  const migrateUidReferences = useCallback(async (oldUid: string, newUid: string) => {
    if (!oldUid || !newUid || oldUid === newUid) return 0;
    let count = 0;

    // UID 참조 필드가 있는 컬렉션 목록: [컬렉션명, 필드명]
    const uidRefCollections: [string, string][] = [
      ['events', 'authorId'],
      ['bucketItems', 'authorId'],
      ['notices', 'authorId'],
      ['contracts', 'createdBy'],
      ['embedTokens', 'createdBy'],
      ['notifications', 'createdBy'],
      ['parentMessages', 'createdBy'],
      ['payroll', 'createdBy'],
      ['examSeries', 'createdBy'],
      ['ganttTemplates', 'createdBy'],
      ['ganttProjects', 'ownerId'],
    ];

    for (const [collectionName, fieldName] of uidRefCollections) {
      try {
        const q = query(collection(db, collectionName), where(fieldName, '==', oldUid));
        const snap = await getDocs(q);
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, { [fieldName]: newUid });
          count++;
        }
      } catch {
        // 컬렉션이 없을 수 있음 (무시)
      }
    }

    // staffIndex: 보조 UID 문서 → 대표 UID로 교체
    try {
      const oldIndexRef = doc(db, 'staffIndex', oldUid);
      const newIndexRef = doc(db, 'staffIndex', newUid);
      const oldSnap = await getDocs(query(collection(db, 'staffIndex')));
      // staffIndex는 uid를 문서 ID로 사용하므로 직접 처리
      const batch = writeBatch(db);
      batch.delete(oldIndexRef);
      // newIndexRef는 대표의 staff 정보로 이미 존재하거나 새로 생성됨
      await batch.commit();
    } catch {
      // staffIndex 정리 실패는 무시
    }

    return count;
  }, []);

  // 병합 실행
  const handleMerge = useCallback(async () => {
    setStep('processing');
    const errors: string[] = [];
    let deletedStaff = 0;
    let mergedGroups = 0;
    let migratedRefs = 0;
    setProgress({ current: 0, total: duplicateGroups.length });

    for (let i = 0; i < duplicateGroups.length; i++) {
      const group = duplicateGroups[i];
      const primaryId = groupPrimaries[group.name];
      const primary = group.members.find(m => m.id === primaryId);
      if (!primary) { errors.push(`${group.name}: 대표 직원을 찾을 수 없습니다`); continue; }

      const secondaries = group.members.filter(m => m.id !== primaryId);
      setProgress({ current: i + 1, total: duplicateGroups.length });

      try {
        // 1. 대표 직원 필드 보완
        const mergedInfo = mergeFields(primary, secondaries);

        // 2. 보조 UID → 대표 UID로 참조 일괄 변경
        const finalUid = primary.uid || secondaries.find(s => s.uid)?.uid;
        for (const sec of secondaries) {
          if (sec.uid && finalUid && sec.uid !== finalUid) {
            // 보조의 UID를 사용하는 모든 문서를 대표의 UID로 변경
            const count = await migrateUidReferences(sec.uid, finalUid);
            migratedRefs += count;
          }
        }

        // 3. staff 문서 업데이트 + 삭제
        const batch = writeBatch(db);
        if (Object.keys(mergedInfo).length > 0) {
          batch.update(doc(db, 'staff', primary.id), {
            ...mergedInfo,
            updatedAt: new Date().toISOString(),
          });
        }

        for (const sec of secondaries) {
          batch.delete(doc(db, 'staff', sec.id));
          deletedStaff++;
        }

        await batch.commit();
        mergedGroups++;
      } catch (err: any) {
        errors.push(`${group.name}: ${err.message}`);
      }
    }

    // 캐시 무효화
    await queryClient.invalidateQueries({ queryKey: ['staff'] });
    await queryClient.invalidateQueries({ queryKey: ['teacherClasses'] });
    await queryClient.invalidateQueries({ queryKey: ['events'] });
    await queryClient.invalidateQueries({ queryKey: ['bucketItems'] });

    setResult({ mergedGroups, deletedStaff, migratedRefs, errors });
    setStep('done');
  }, [duplicateGroups, groupPrimaries, mergeFields, migrateUidReferences, queryClient]);

  // 필드 비교 렌더링
  const renderFieldComparison = (label: string, values: (string | undefined)[]) => {
    const hasValue = values.some(v => v);
    if (!hasValue) return null;
    return (
      <div className="flex text-[11px] gap-2">
        <span className="text-gray-400 w-16 shrink-0">{label}</span>
        {values.map((v, i) => (
          <span key={i} className={`flex-1 ${v ? 'text-gray-700' : 'text-gray-300'}`}>
            {v || '-'}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm text-primary">직원 병합</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'preview' && (
            <>
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Check className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm">중복 직원이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    이름이 같은 직원 <strong className="text-primary">{duplicateGroups.length}그룹</strong>이 발견되었습니다.
                    대표 직원을 선택하고 병합하세요.
                  </p>

                  {duplicateGroups.map(group => {
                    const isExpanded = expandedGroups.has(group.name);
                    const currentPrimary = groupPrimaries[group.name];

                    return (
                      <div key={group.name} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={() => toggleExpand(group.name)}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span className="font-bold text-sm text-primary">{group.name}</span>
                          <span className="text-xs text-gray-400">({group.members.length}명)</span>
                        </button>

                        {isExpanded && (
                          <div className="p-3 space-y-2">
                            {/* 양쪽 다 UID가 있으면 경고 */}
                            {group.members.filter(m => m.uid).length > 1 && (
                              <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold">양쪽 모두 계정이 연동되어 있습니다.</p>
                                  <p>병합 후 삭제되는 쪽의 Firebase Auth 계정은 수동 정리가 필요합니다.</p>
                                </div>
                              </div>
                            )}
                            {group.members.map(member => {
                              const isPrimary = member.id === currentPrimary;
                              return (
                                <div
                                  key={member.id}
                                  className={`p-2 rounded border cursor-pointer transition-colors ${
                                    isPrimary
                                      ? 'border-primary bg-primary/5'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  onClick={() => setPrimary(group.name, member.id)}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    {isPrimary && <Crown className="w-3 h-3 text-primary" />}
                                    <span className={`text-xs font-bold ${isPrimary ? 'text-primary' : 'text-gray-600'}`}>
                                      {isPrimary ? '대표' : '삭제됨'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">ID: {member.id.slice(0, 8)}...</span>
                                  </div>
                                  <div className="space-y-0.5 text-[11px]">
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">영문명</span>
                                      <span className="text-gray-700">{member.englishName || '-'}</span>
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">이메일</span>
                                      <span className="text-gray-700">{member.email || '-'}</span>
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">과목</span>
                                      <span className="text-gray-700">
                                        {member.subjects?.length ? member.subjects.join(', ') : '-'}
                                      </span>
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">계정</span>
                                      <span className={member.uid ? 'text-emerald-600' : 'text-gray-300'}>
                                        {member.uid ? '연동됨' : '미연동'}
                                      </span>
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">호칭</span>
                                      <span className="text-gray-700">{member.jobTitle || '-'}</span>
                                    </div>
                                    <div className="flex gap-4">
                                      <span className="text-gray-400">강의실</span>
                                      <span className="text-gray-700">{member.defaultRoom || '-'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                              <p>• 대표 직원에 빈 필드가 있으면 삭제될 직원의 값으로 자동 보완됩니다.</p>
                              <p>• 수업은 이름으로 참조하므로 자동 반영됩니다.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-gray-600">병합 중... ({progress.current}/{progress.total})</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                {result.errors.length === 0 ? (
                  <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                )}
                <p className="font-bold text-sm">병합 완료</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p>병합된 그룹: <strong>{result.mergedGroups}건</strong></p>
                <p>삭제된 직원: <strong>{result.deletedStaff}명</strong></p>
                {result.migratedRefs > 0 && (
                  <p>UID 참조 변경: <strong>{result.migratedRefs}건</strong></p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 text-xs text-red-600">
                  <p className="font-bold mb-1">오류:</p>
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t">
          {step === 'preview' && duplicateGroups.length > 0 && (
            <button
              onClick={handleMerge}
              className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 flex items-center gap-1"
            >
              <GitMerge className="w-3 h-3" />
              {duplicateGroups.length}그룹 병합
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200"
          >
            {step === 'done' ? '닫기' : '취소'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffMergeModal;
