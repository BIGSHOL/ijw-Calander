/**
 * staffHelpers - Staff/User profile conversion utilities extracted from App.tsx
 */

import { UserProfile, StaffMember } from '../types';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { doc, setDoc, collection } from 'firebase/firestore';

// Helper to format user display: Name (JobTitle) or Email (JobTitle)
// 지원 타입: UserProfile 또는 StaffMember
export const formatUserDisplay = (u: UserProfile | StaffMember) => {
  // StaffMember인 경우
  if ('name' in u && !('displayName' in u)) {
    const staff = u as StaffMember;
    return staff.jobTitle ? `${staff.name} (${staff.jobTitle})` : staff.name;
  }
  // UserProfile인 경우
  const user = u as UserProfile;
  const name = user.displayName || user.email.split('@')[0];
  return user.jobTitle ? `${name} (${user.jobTitle})` : name;
};

// StaffMember를 UserProfile처럼 사용하기 위한 변환 헬퍼
export const staffToUserLike = (staff: StaffMember): UserProfile => ({
  uid: staff.uid || staff.id,
  email: staff.email || '',
  displayName: staff.name,
  role: staff.systemRole || 'user',
  status: staff.approvalStatus || 'pending',
  departmentPermissions: staff.departmentPermissions || {},
  favoriteDepartments: staff.favoriteDepartments || [],
  jobTitle: staff.jobTitle,
  staffId: staff.id, // 시뮬레이션 시 출석부 등에서 선생님 필터링용
});

// Helper: staff 데이터를 UserProfile 형태로 변환
export const staffToUserProfile = (staff: StaffMember): UserProfile => {
  const systemRole = staff.systemRole;
  const approvalStatus = staff.approvalStatus;
  const email = staff.email || '';

  const isApproved = approvalStatus === 'approved';
  const hasValidRole = systemRole && systemRole !== 'user';

  if (process.env.NODE_ENV !== 'production') {
    if (isApproved && !hasValidRole) {
      console.warn('[Access Warning] Approved user without valid systemRole:', email, 'role:', systemRole);
    }
    if (hasValidRole && !isApproved) {
      console.warn('[Access Warning] User has systemRole but not approved:', email, 'status:', approvalStatus);
    }
  }

  return {
    uid: staff.uid || staff.id,
    email,
    displayName: staff.name,
    role: systemRole || 'user',
    status: approvalStatus || 'pending',
    jobTitle: staff.jobTitle,
    departmentPermissions: staff.departmentPermissions || {},
    favoriteDepartments: staff.favoriteDepartments || [],
    departmentId: staff.primaryDepartmentId,
    staffId: staff.id,
    allowedDepartments: [],
    canEdit: isApproved && hasValidRole,
  };
};

// Helper: 신규 사용자를 staff 컬렉션에 생성
export const createNewStaffMember = async (user: User, isMaster: boolean): Promise<StaffMember> => {
  const newStaffRef = doc(collection(db, 'staff'));
  const systemRole = isMaster ? 'master' : 'user';
  const now = new Date().toISOString();
  const newStaff: StaffMember = {
    id: newStaffRef.id,
    uid: user.uid,
    name: user.displayName || user.email!.split('@')[0],
    email: user.email!,
    role: 'staff',
    systemRole,
    approvalStatus: isMaster ? 'approved' : 'pending',
    departmentPermissions: {},
    favoriteDepartments: [],
    hireDate: now.split('T')[0],
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  // staffIndex 먼저 생성 (Firestore Rules에서 역할 확인용)
  const indexRef = doc(db, 'staffIndex', user.uid);
  await setDoc(indexRef, {
    staffId: newStaffRef.id,
    systemRole,
    updatedAt: now,
  });

  await setDoc(newStaffRef, newStaff);

  return newStaff;
};
