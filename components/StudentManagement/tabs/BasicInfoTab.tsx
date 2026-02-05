import React, { useState, useEffect } from 'react';
import { UnifiedStudent } from '../../../types';
import {
  User,
  School,
  Calendar,
  Phone,
  MapPin,
  Cake,
  FileText,
  Save,
  X,
  Mail,
  Users,
  CreditCard,
  Bell,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { useStudents } from '../../../hooks/useStudents';

interface BasicInfoTabProps {
  student: UnifiedStudent;
  readOnly?: boolean; // 조회 전용 모드 (수정 버튼 숨김)
}

// 상태별 스타일 정의
const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: '재원', bg: '#10b981', text: '#ffffff' },
  on_hold: { label: '휴원/대기', bg: '#f59e0b', text: '#ffffff' },
  withdrawn: { label: '퇴원', bg: '#6b7280', text: '#ffffff' },
  prospect: { label: '예비', bg: '#3b82f6', text: '#ffffff' },
  prospective: { label: '예비', bg: '#3b82f6', text: '#ffffff' },  // 예비 상태 별칭
};

// 학년 옵션
const GRADE_OPTIONS = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
  '기타',
];

// 보호자 관계 옵션
const RELATION_OPTIONS = ['모', '부', '조부', '조모', '기타'];

// 입력 필드 컴포넌트 (외부 정의 - 리렌더링 시 포커스 유지)
const InputField = ({
  label,
  value,
  onChange,
  isEditing,
  type = 'text',
  placeholder = '',
  disabled = false,
  className = '',
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  isEditing: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <div className={`flex items-center gap-2 px-2 py-1 ${className}`}>
    <label className="w-20 shrink-0 text-xs font-medium text-primary-700">{label}</label>
    {isEditing && !disabled ? (
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
      />
    ) : (
      <span className="flex-1 text-xs text-primary">{value || '-'}</span>
    )}
  </div>
);

// 선택 필드 컴포넌트 (외부 정의)
const SelectField = ({
  label,
  value,
  onChange,
  isEditing,
  options,
  className = '',
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  isEditing: boolean;
  options: string[];
  className?: string;
}) => (
  <div className={`flex items-center gap-2 px-2 py-1 ${className}`}>
    <label className="w-20 shrink-0 text-xs font-medium text-primary-700">{label}</label>
    {isEditing ? (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
      >
        <option value="">선택</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    ) : (
      <span className="flex-1 text-xs text-primary">{value || '-'}</span>
    )}
  </div>
);

// 체크박스 컴포넌트 (외부 정의)
const CheckboxField = ({
  label,
  checked,
  onChange,
  isEditing,
}: {
  label: string;
  checked: boolean | undefined;
  onChange: (value: boolean) => void;
  isEditing: boolean;
}) => (
  <label className="flex items-center gap-1 cursor-pointer">
    <input
      type="checkbox"
      checked={checked ?? false}
      onChange={(e) => onChange(e.target.checked)}
      disabled={!isEditing}
      className="w-3 h-3 text-accent rounded-sm focus:ring-accent disabled:opacity-50"
    />
    <span className="text-xs text-primary-700">{label}</span>
  </label>
);

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ student, readOnly = false }) => {
  const { updateStudent, isUpdating } = useStudents();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UnifiedStudent>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 섹션 접기/펼치기 상태
  const [showBasicInfo, setShowBasicInfo] = useState(true);
  const [showSchoolInfo, setShowSchoolInfo] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(true);
  const [showEnrollmentInfo, setShowEnrollmentInfo] = useState(true);
  const [showBillingInfo, setShowBillingInfo] = useState(true);
  const [showOtherInfo, setShowOtherInfo] = useState(true);
  const [showMemo, setShowMemo] = useState(true);

  // 학생 데이터가 변경되면 폼 데이터 초기화
  useEffect(() => {
    setFormData({
      name: student.name || '',
      englishName: student.englishName || '',
      gender: student.gender,
      attendanceNumber: student.attendanceNumber || '',
      school: student.school || '',
      grade: student.grade || '',
      status: student.status,
      startDate: student.startDate || '',
      endDate: student.endDate || '',
      // 연락처
      studentPhone: student.studentPhone || '',
      parentPhone: student.parentPhone || '',
      parentName: student.parentName || '',
      parentRelation: student.parentRelation || '모',
      otherPhone: student.otherPhone || '',
      otherPhoneRelation: student.otherPhoneRelation || '',
      homePhone: student.homePhone || '',
      // 주소
      zipCode: student.zipCode || '',
      address: student.address || '',
      addressDetail: student.addressDetail || '',
      // 추가 정보
      birthDate: student.birthDate || '',
      nickname: student.nickname || '',
      studentEmail: student.studentEmail || '',
      enrollmentReason: student.enrollmentReason || '',
      // 수납
      cashReceiptNumber: student.cashReceiptNumber || '',
      cashReceiptType: student.cashReceiptType || 'income',
      billingDay: student.billingDay,
      billingDiscount: student.billingDiscount || 0,
      // 알림
      smsNotification: student.smsNotification ?? true,
      pushNotification: student.pushNotification ?? false,
      kakaoNotification: student.kakaoNotification ?? true,
      billingSmsPrimary: student.billingSmsPrimary ?? true,
      billingSmsOther: student.billingSmsOther ?? false,
      overdueSmsPrimary: student.overdueSmsPrimary ?? true,
      overdueSmsOther: student.overdueSmsOther ?? false,
      // 기타
      graduationYear: student.graduationYear || '',
      customField1: student.customField1 || '',
      customField2: student.customField2 || '',
      memo: student.memo || '',
    });
  }, [student]);

  const handleChange = (field: keyof UnifiedStudent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateStudent(student.id, formData);
      setSaveMessage('저장되었습니다.');
      setIsEditing(false);
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('학생 정보 저장 실패:', error);
      setSaveMessage('저장에 실패했습니다.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleCancel = () => {
    // 원래 데이터로 복원
    setFormData({
      name: student.name || '',
      englishName: student.englishName || '',
      gender: student.gender,
      attendanceNumber: student.attendanceNumber || '',
      school: student.school || '',
      grade: student.grade || '',
      status: student.status,
      startDate: student.startDate || '',
      endDate: student.endDate || '',
      studentPhone: student.studentPhone || '',
      parentPhone: student.parentPhone || '',
      parentName: student.parentName || '',
      parentRelation: student.parentRelation || '모',
      otherPhone: student.otherPhone || '',
      otherPhoneRelation: student.otherPhoneRelation || '',
      homePhone: student.homePhone || '',
      zipCode: student.zipCode || '',
      address: student.address || '',
      addressDetail: student.addressDetail || '',
      birthDate: student.birthDate || '',
      nickname: student.nickname || '',
      studentEmail: student.studentEmail || '',
      enrollmentReason: student.enrollmentReason || '',
      cashReceiptNumber: student.cashReceiptNumber || '',
      cashReceiptType: student.cashReceiptType || 'income',
      billingDay: student.billingDay,
      billingDiscount: student.billingDiscount || 0,
      smsNotification: student.smsNotification ?? true,
      pushNotification: student.pushNotification ?? false,
      kakaoNotification: student.kakaoNotification ?? true,
      billingSmsPrimary: student.billingSmsPrimary ?? true,
      billingSmsOther: student.billingSmsOther ?? false,
      overdueSmsPrimary: student.overdueSmsPrimary ?? true,
      overdueSmsOther: student.overdueSmsOther ?? false,
      graduationYear: student.graduationYear || '',
      customField1: student.customField1 || '',
      customField2: student.customField2 || '',
      memo: student.memo || '',
    });
    setIsEditing(false);
  };

  const statusStyle = STATUS_STYLES[student.status] || STATUS_STYLES.active;

  return (
    <div className="space-y-2">
      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`px-2 py-1 rounded-sm text-xs font-medium ${
          saveMessage.includes('실패') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 rounded-sm text-micro font-semibold"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {statusStyle.label}
          </span>
          <span className="text-xs font-bold text-primary">{student.name}</span>
        </div>
        {/* 수정 버튼 - readOnly 모드에서는 숨김 */}
        {!readOnly && (
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 text-xs font-medium text-primary-700 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="px-2 py-1 text-xs font-medium text-primary bg-accent rounded-sm hover:bg-[#e5a711] transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {isUpdating ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-xs font-medium text-white bg-primary rounded-sm hover:bg-[#1a2845] transition-colors flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                수정
              </button>
            )}
          </div>
        )}
      </div>

      {/* 기본 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowBasicInfo(!showBasicInfo)}
        >
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">기본 정보</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBasicInfo ? '' : 'rotate-180'}`} />
        </div>
        {showBasicInfo && (
        <div className="divide-y divide-gray-100">
          <InputField label="이름" value={formData.name} onChange={(v) => handleChange('name', v)} isEditing={isEditing} />
          <InputField label="영어 이름" value={formData.englishName ?? ''} onChange={(v) => handleChange('englishName', v)} isEditing={isEditing} />
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-50">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">출결번호</label>
            {isEditing ? (
              <input
                type="text"
                value={formData.attendanceNumber ?? ''}
                onChange={(e) => handleChange('attendanceNumber', e.target.value)}
                placeholder="자동 생성됨"
                className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />
            ) : (
              <span className="flex-1 text-xs font-mono font-bold text-accent">
                {formData.attendanceNumber || '-'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">성별</label>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={formData.gender === 'male'}
                    onChange={() => handleChange('gender', 'male')}
                    className="w-3 h-3 text-accent focus:ring-accent"
                  />
                  <span className="text-xs">남</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={formData.gender === 'female'}
                    onChange={() => handleChange('gender', 'female')}
                    className="w-3 h-3 text-accent focus:ring-accent"
                  />
                  <span className="text-xs">여</span>
                </label>
              </div>
            ) : (
              <span className="flex-1 text-xs text-primary">
                {formData.gender === 'male' ? '남' : formData.gender === 'female' ? '여' : '-'}
              </span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 학교 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowSchoolInfo(!showSchoolInfo)}
        >
          <div className="flex items-center gap-1">
            <School className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">학교 정보</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSchoolInfo ? '' : 'rotate-180'}`} />
        </div>
        {showSchoolInfo && (
        <div className="divide-y divide-gray-100">
          <InputField label="학교" value={formData.school} onChange={(v) => handleChange('school', v)} isEditing={isEditing} placeholder="예: 침산초" />
          <SelectField label="학년" value={formData.grade} onChange={(v) => handleChange('grade', v)} isEditing={isEditing} options={GRADE_OPTIONS} />
          <InputField label="졸업연도" value={formData.graduationYear} onChange={(v) => handleChange('graduationYear', v)} isEditing={isEditing} placeholder="예: 2026" />
        </div>
        )}
      </div>

      {/* 연락처 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowContacts(!showContacts)}
        >
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">연락처</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showContacts ? '' : 'rotate-180'}`} />
        </div>
        {showContacts && (
        <div className="divide-y divide-gray-100">
          <InputField label="원생 휴대폰" value={formData.studentPhone} onChange={(v) => handleChange('studentPhone', v)} isEditing={isEditing} placeholder="010-0000-0000" />
          <InputField label="원생 집전화" value={formData.homePhone} onChange={(v) => handleChange('homePhone', v)} isEditing={isEditing} placeholder="053-000-0000" />
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">보호자 (SMS)</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1 flex-wrap">
                <input
                  type="text"
                  value={formData.parentPhone ?? ''}
                  onChange={(e) => handleChange('parentPhone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 min-w-[100px] px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <select
                  value={formData.parentRelation ?? '모'}
                  onChange={(e) => handleChange('parentRelation', e.target.value)}
                  className="w-14 px-1 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {RELATION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="flex-1 text-xs text-primary">
                {formData.parentPhone ? `${formData.parentPhone} (${formData.parentRelation || '모'})` : '-'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">기타 알림</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={formData.otherPhone ?? ''}
                  onChange={(e) => handleChange('otherPhone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            ) : (
              <span className="flex-1 text-xs text-primary">
                {formData.otherPhone || '-'}
              </span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 알림 설정 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <div className="flex items-center gap-1">
            <Bell className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">알림 설정</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showNotifications ? '' : 'rotate-180'}`} />
        </div>
        {showNotifications && (
        <div className="p-2 space-y-2">
          <div>
            <p className="text-xs font-medium text-primary-700 mb-1">등하원알림</p>
            <div className="flex flex-wrap gap-3">
              <CheckboxField label="SMS" checked={formData.smsNotification} onChange={(v) => handleChange('smsNotification', v)} isEditing={isEditing} />
              <CheckboxField label="푸시" checked={formData.pushNotification} onChange={(v) => handleChange('pushNotification', v)} isEditing={isEditing} />
              <CheckboxField label="알림톡" checked={formData.kakaoNotification} onChange={(v) => handleChange('kakaoNotification', v)} isEditing={isEditing} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-primary-700 mb-1">수납/미납 문자</p>
            <div className="flex flex-wrap gap-3">
              <CheckboxField label="보호자" checked={formData.billingSmsPrimary} onChange={(v) => handleChange('billingSmsPrimary', v)} isEditing={isEditing} />
              <CheckboxField label="기타보호자" checked={formData.billingSmsOther} onChange={(v) => handleChange('billingSmsOther', v)} isEditing={isEditing} />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* 주소 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowAddress(!showAddress)}
        >
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">주소</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAddress ? '' : 'rotate-180'}`} />
        </div>
        {showAddress && (
        <div className="divide-y divide-gray-100">
          <InputField label="우편번호" value={formData.zipCode} onChange={(v) => handleChange('zipCode', v)} isEditing={isEditing} placeholder="12345" />
          <InputField label="주소" value={formData.address} onChange={(v) => handleChange('address', v)} isEditing={isEditing} placeholder="대구 북구..." />
          <InputField label="상세주소" value={formData.addressDetail} onChange={(v) => handleChange('addressDetail', v)} isEditing={isEditing} />
        </div>
        )}
      </div>

      {/* 추가 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
        >
          <div className="flex items-center gap-1">
            <Cake className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">추가 정보</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAdditionalInfo ? '' : 'rotate-180'}`} />
        </div>
        {showAdditionalInfo && (
        <div className="divide-y divide-gray-100">
          <InputField label="생년월일" value={formData.birthDate} onChange={(v) => handleChange('birthDate', v)} isEditing={isEditing} type="date" />
          <InputField label="닉네임" value={formData.nickname} onChange={(v) => handleChange('nickname', v)} isEditing={isEditing} />
          <InputField label="원생 이메일" value={formData.studentEmail} onChange={(v) => handleChange('studentEmail', v)} isEditing={isEditing} type="email" placeholder="example@email.com" />
        </div>
        )}
      </div>

      {/* 등록/재원 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowEnrollmentInfo(!showEnrollmentInfo)}
        >
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">등록 정보</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showEnrollmentInfo ? '' : 'rotate-180'}`} />
        </div>
        {showEnrollmentInfo && (
        <div className="divide-y divide-gray-100">
          <InputField label="등록일" value={formData.startDate} onChange={(v) => handleChange('startDate', v)} isEditing={isEditing} type="date" />
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">재원상태</label>
            {isEditing ? (
              <select
                value={formData.status ?? 'active'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="active">재원</option>
                <option value="on_hold">휴원/대기</option>
                <option value="withdrawn">퇴원</option>
                <option value="prospective">예비</option>
              </select>
            ) : (
              <span
                className="px-1.5 py-0.5 rounded-sm text-micro font-semibold"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                {statusStyle.label}
              </span>
            )}
          </div>
          {(formData.status === 'withdrawn' || student.endDate) && (
            <InputField label="퇴원일" value={formData.endDate} onChange={(v) => handleChange('endDate', v)} isEditing={isEditing} type="date" />
          )}
        </div>
        )}
      </div>

      {/* 수납 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowBillingInfo(!showBillingInfo)}
        >
          <div className="flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">수납 정보</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBillingInfo ? '' : 'rotate-180'}`} />
        </div>
        {showBillingInfo && (
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">현금영수증</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={formData.cashReceiptNumber ?? ''}
                  onChange={(e) => handleChange('cashReceiptNumber', e.target.value)}
                  placeholder="휴대폰/사업자번호"
                  className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <label className="flex items-center gap-0.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cashReceiptType"
                    checked={formData.cashReceiptType === 'income'}
                    onChange={() => handleChange('cashReceiptType', 'income')}
                    className="w-3 h-3 text-accent focus:ring-accent"
                  />
                  <span className="text-xs">소득</span>
                </label>
                <label className="flex items-center gap-0.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cashReceiptType"
                    checked={formData.cashReceiptType === 'expense'}
                    onChange={() => handleChange('cashReceiptType', 'expense')}
                    className="w-3 h-3 text-accent focus:ring-accent"
                  />
                  <span className="text-xs">지출</span>
                </label>
              </div>
            ) : (
              <span className="flex-1 text-xs text-primary">
                {formData.cashReceiptNumber || '-'}
              </span>
            )}
          </div>
          <InputField label="수납 청구일" value={formData.billingDay} onChange={(v) => handleChange('billingDay', v)} isEditing={isEditing} type="number" placeholder="매월 (일)" />
          <div className="flex items-center gap-2 px-2 py-1">
            <label className="w-20 shrink-0 text-xs font-medium text-primary-700">기본할인</label>
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={formData.billingDiscount ?? 0}
                  onChange={(e) => handleChange('billingDiscount', Number(e.target.value))}
                  placeholder="0"
                  className="w-20 px-2 py-0.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-primary-700">원</span>
              </div>
            ) : (
              <span className="flex-1 text-xs text-primary">
                {(formData.billingDiscount ?? 0).toLocaleString()}원
              </span>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 기타 정보 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowOtherInfo(!showOtherInfo)}
        >
          <div className="flex items-center gap-1">
            <CheckSquare className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">기타</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showOtherInfo ? '' : 'rotate-180'}`} />
        </div>
        {showOtherInfo && (
        <div className="divide-y divide-gray-100">
          <InputField label="기타항목1" value={formData.customField1} onChange={(v) => handleChange('customField1', v)} isEditing={isEditing} />
          <InputField label="기타항목2" value={formData.customField2} onChange={(v) => handleChange('customField2', v)} isEditing={isEditing} />
        </div>
        )}
      </div>

      {/* 메모 섹션 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowMemo(!showMemo)}
        >
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">메모</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showMemo ? '' : 'rotate-180'}`} />
        </div>
        {showMemo && (
        <div className="p-2">
          {isEditing ? (
            <textarea
              value={formData.memo ?? ''}
              onChange={(e) => handleChange('memo', e.target.value)}
              placeholder="학생 특이사항/메모"
              rows={2}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          ) : (
            <div className="bg-gray-50 rounded-sm p-2 min-h-[40px]">
              <p className="text-xs text-primary whitespace-pre-wrap">
                {formData.memo || '등록된 메모가 없습니다.'}
              </p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default BasicInfoTab;
