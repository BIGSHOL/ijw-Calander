import React, { useState, useEffect } from 'react';
import { X, Save, User, Shield } from 'lucide-react';
import { StaffMember, STAFF_ROLE_LABELS, STAFF_STATUS_LABELS, ROLE_LABELS, UserRole } from '../../types';

interface StaffFormProps {
  staff: StaffMember | null;
  onClose: () => void;
  onSubmit: (data: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  showSystemFields?: boolean; // 시스템 권한 필드 표시 여부 (MASTER/ADMIN만)
  currentUserRole?: UserRole; // 현재 사용자의 시스템 역할
}

// 시스템 역할 옵션 (MASTER/ADMIN만 변경 가능)
const SYSTEM_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'master', label: 'MASTER (최고 관리자)' },
  { value: 'admin', label: 'ADMIN (관리자)' },
  { value: 'manager', label: 'MANAGER (매니저)' },
  { value: 'math_lead', label: '수학 리드' },
  { value: 'english_lead', label: '영어 리드' },
  { value: 'math_teacher', label: '수학 강사' },
  { value: 'english_teacher', label: '영어 강사' },
  { value: 'user', label: 'USER (일반 사용자)' },
];

// 승인 상태 옵션
const APPROVAL_STATUS_OPTIONS = [
  { value: 'approved', label: '승인됨' },
  { value: 'pending', label: '대기중' },
  { value: 'rejected', label: '거부됨' },
];

// 역할 계층 정의 (낮은 숫자가 높은 권한)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  master: 1,
  admin: 2,
  manager: 3,
  math_lead: 4,
  english_lead: 4,
  math_teacher: 5,
  english_teacher: 5,
  user: 6,
  teacher: 5,
  staff: 6,
  editor: 4,
  senior_staff: 3,
  viewer: 7,
};

const StaffForm: React.FC<StaffFormProps> = ({ staff, onClose, onSubmit, showSystemFields = false, currentUserRole = 'user' }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    englishName: '',
    email: '',
    phone: '',
    role: 'teacher' as StaffMember['role'],
    jobTitle: '', // 호칭 (예: 대표, 팀장, 선생님)
    subjects: [] as ('math' | 'english')[],
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active' as StaffMember['status'],
    memo: '',
    // 강사 전용 필드
    isHiddenInTimetable: false,
    isHiddenInAttendance: false,
    isNative: false,
    bgColor: '#3b82f6',
    textColor: '#ffffff',
    defaultRoom: '',
    timetableOrder: 0,
    // 시스템 권한 필드
    systemRole: 'user' as UserRole,
    approvalStatus: 'pending' as 'approved' | 'pending' | 'rejected',
  });

  // Initialize form with staff data if editing
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        englishName: staff.englishName || '',
        email: staff.email || '',
        phone: staff.phone || '',
        role: staff.role || 'teacher',
        jobTitle: staff.jobTitle || '',
        subjects: staff.subjects || [],
        hireDate: staff.hireDate || new Date().toISOString().split('T')[0],
        status: staff.status || 'active',
        memo: staff.memo || '',
        // 강사 전용 필드
        isHiddenInTimetable: staff.isHiddenInTimetable || false,
        isHiddenInAttendance: staff.isHiddenInAttendance || false,
        isNative: staff.isNative || false,
        bgColor: staff.bgColor || '#3b82f6',
        textColor: staff.textColor || '#ffffff',
        defaultRoom: staff.defaultRoom || '',
        timetableOrder: staff.timetableOrder || 0,
        // 시스템 권한 필드
        systemRole: staff.systemRole || 'user',
        approvalStatus: staff.approvalStatus || 'pending',
      });
    }
  }, [staff]);

  // 현재 사용자가 변경 가능한 역할 목록 필터링
  const availableRoles = SYSTEM_ROLE_OPTIONS.filter((option) => {
    const currentUserLevel = ROLE_HIERARCHY[currentUserRole];
    const targetRoleLevel = ROLE_HIERARCHY[option.value];

    // MASTER는 선택할 수 없음 (아무도 MASTER로 설정 불가)
    if (option.value === 'master') return false;

    // 자신의 역할보다 낮은 역할만 설정 가능 (숫자가 크면 낮은 역할)
    return targetRoleLevel > currentUserLevel;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubjectToggle = (subject: 'math' | 'english') => {
    setFormData((prev) => {
      const subjects = prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <User className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-base font-bold text-primary">
              {staff ? '직원 수정' : '직원 등록'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-sm transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* 기본 정보 - 2열 레이아웃 */}
          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="홍길동"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                required
              />
            </div>

            {/* English Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                영어 이름
              </label>
              <input
                type="text"
                name="englishName"
                value={formData.englishName}
                onChange={handleChange}
                placeholder="Jane"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                이메일 {staff && <span className="text-gray-400 font-normal">(수정 불가)</span>}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
                disabled={!!staff}
                className={`w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent ${
                  staff ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                }`}
              />
              {staff && formData.email && (
                <p className="text-xxs text-gray-400 mt-0.5">
                  시스템 계정과 연동된 이메일은 변경할 수 없습니다.
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="010-1234-5678"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                직책 <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Hire Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                입사일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="hireDate"
                value={formData.hireDate}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                상태 <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {Object.entries(STAFF_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Job Title (호칭) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                호칭
              </label>
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                placeholder="예: 대표, 원장, 팀장, 선생님"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {/* Default Room (teacher only) */}
            {formData.role === 'teacher' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  기본 강의실
                </label>
                <input
                  type="text"
                  name="defaultRoom"
                  value={formData.defaultRoom}
                  onChange={handleChange}
                  placeholder="예: 301호"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            )}
          </div>

          {/* Subjects (only for teachers) */}
          {formData.role === 'teacher' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  담당 과목
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSubjectToggle('math')}
                    className={`flex-1 py-1.5 px-3 rounded-sm border-2 text-sm transition-colors ${
                      formData.subjects.includes('math')
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    수학
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubjectToggle('english')}
                    className={`flex-1 py-1.5 px-3 rounded-sm border-2 text-sm transition-colors ${
                      formData.subjects.includes('english')
                        ? 'border-pink-500 bg-pink-50 text-pink-700 font-medium'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    영어
                  </button>
                </div>
              </div>

              {/* 시간표 설정 섹션 */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <h3 className="text-xs font-bold text-gray-700 mb-2">시간표 설정</h3>

                {/* 색상 설정 - 2열 */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      배경색
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        name="bgColor"
                        value={formData.bgColor}
                        onChange={handleChange}
                        className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        name="bgColor"
                        value={formData.bgColor}
                        onChange={handleChange}
                        placeholder="#3b82f6"
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      글자색
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        name="textColor"
                        value={formData.textColor}
                        onChange={handleChange}
                        className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        name="textColor"
                        value={formData.textColor}
                        onChange={handleChange}
                        placeholder="#ffffff"
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 체크박스 옵션들 - 2열 */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isNative}
                      onChange={(e) => setFormData(prev => ({ ...prev, isNative: e.target.checked }))}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-accent"
                    />
                    <span className="text-xs text-gray-700">원어민 강사</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isHiddenInTimetable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isHiddenInTimetable: e.target.checked }))}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-accent"
                    />
                    <span className="text-xs text-gray-700">시간표에서 숨김</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isHiddenInAttendance}
                      onChange={(e) => setFormData(prev => ({ ...prev, isHiddenInAttendance: e.target.checked }))}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-accent"
                    />
                    <span className="text-xs text-gray-700">출석부에서 숨김</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* 시스템 권한 설정 섹션 (MASTER/ADMIN만 표시) */}
          {showSystemFields && staff?.uid && (
            <div className="border-t border-gray-200 pt-3 mt-3">
              <h3 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                시스템 권한 설정
              </h3>
              <div className="bg-purple-50/50 rounded-sm p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* 시스템 역할 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      시스템 역할
                    </label>
                    <select
                      name="systemRole"
                      value={formData.systemRole}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                    >
                      {/* 현재 역할이 변경 불가능한 경우 현재 값을 표시 */}
                      {!availableRoles.some(r => r.value === formData.systemRole) && (
                        <option value={formData.systemRole}>
                          {SYSTEM_ROLE_OPTIONS.find(r => r.value === formData.systemRole)?.label || formData.systemRole} (변경 불가)
                        </option>
                      )}
                      {availableRoles.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    {!availableRoles.some(r => r.value === formData.systemRole) && (
                      <p className="text-xxs text-amber-600 mt-0.5">
                        현재 역할은 변경할 수 없습니다. (자신보다 낮은 권한만 설정 가능)
                      </p>
                    )}
                  </div>

                  {/* 승인 상태 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      승인 상태
                    </label>
                    <select
                      name="approvalStatus"
                      value={formData.approvalStatus}
                      onChange={handleChange}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                    >
                      {APPROVAL_STATUS_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xxs text-gray-500">
                  시스템 역할은 앱 내 기능 접근 권한을 결정합니다. 승인 상태가 '승인됨'이어야 로그인이 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* Memo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows={2}
              placeholder="추가 정보를 입력하세요..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-sm hover:bg-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-sm animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{staff ? '수정' : '등록'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffForm;
