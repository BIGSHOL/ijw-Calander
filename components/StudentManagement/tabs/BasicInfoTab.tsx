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
} from 'lucide-react';
import { useStudents } from '../../../hooks/useStudents';

interface BasicInfoTabProps {
  student: UnifiedStudent;
}

// 상태별 스타일 정의
const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: '재원', bg: '#10b981', text: '#ffffff' },
  on_hold: { label: '휴원', bg: '#f59e0b', text: '#ffffff' },
  withdrawn: { label: '퇴원', bg: '#6b7280', text: '#ffffff' },
  prospect: { label: '예비', bg: '#3b82f6', text: '#ffffff' },
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

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ student }) => {
  const { updateStudent, isUpdating } = useStudents();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UnifiedStudent>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 학생 데이터가 변경되면 폼 데이터 초기화
  useEffect(() => {
    setFormData({
      name: student.name || '',
      englishName: student.englishName || '',
      gender: student.gender,
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

  // 입력 필드 컴포넌트
  const InputField = ({
    label,
    value,
    field,
    type = 'text',
    placeholder = '',
    disabled = false,
    className = '',
  }: {
    label: string;
    value: string | number | undefined;
    field: keyof UnifiedStudent;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${className}`}>
      <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">{label}</label>
      {isEditing && !disabled ? (
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => handleChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813]"
        />
      ) : (
        <span className="flex-1 text-sm text-[#081429]">{value || '-'}</span>
      )}
    </div>
  );

  // 선택 필드 컴포넌트
  const SelectField = ({
    label,
    value,
    field,
    options,
    className = '',
  }: {
    label: string;
    value: string | undefined;
    field: keyof UnifiedStudent;
    options: string[];
    className?: string;
  }) => (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${className}`}>
      <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">{label}</label>
      {isEditing ? (
        <select
          value={value || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813] focus:border-[#fdb813]"
        >
          <option value="">선택</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <span className="flex-1 text-sm text-[#081429]">{value || '-'}</span>
      )}
    </div>
  );

  // 체크박스 컴포넌트
  const CheckboxField = ({
    label,
    checked,
    field,
  }: {
    label: string;
    checked: boolean | undefined;
    field: keyof UnifiedStudent;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked ?? false}
        onChange={(e) => handleChange(field, e.target.checked)}
        disabled={!isEditing}
        className="w-4 h-4 text-[#fdb813] rounded focus:ring-[#fdb813] disabled:opacity-50"
      />
      <span className="text-sm text-[#373d41]">{label}</span>
    </label>
  );

  return (
    <div className="space-y-4">
      {/* 저장 메시지 */}
      {saveMessage && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          saveMessage.includes('실패') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded text-xs font-semibold"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {statusStyle.label}
          </span>
          <span className="text-lg font-bold text-[#081429]">{student.name}</span>
          {student.englishName && (
            <span className="text-sm text-[#373d41]">({student.englishName})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-[#373d41] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-[#081429] bg-[#fdb813] rounded-lg hover:bg-[#e5a711] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isUpdating ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#081429] rounded-lg hover:bg-[#1a2845] transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              수정
            </button>
          )}
        </div>
      </div>

      {/* 기본 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <User className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">기본 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="이름" value={formData.name} field="name" />
          <InputField label="영어 이름" value={formData.englishName ?? ''} field="englishName" />
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">성별</label>
            {isEditing ? (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={formData.gender === 'male'}
                    onChange={() => handleChange('gender', 'male')}
                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                  />
                  <span className="text-sm">남</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gender"
                    checked={formData.gender === 'female'}
                    onChange={() => handleChange('gender', 'female')}
                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                  />
                  <span className="text-sm">여</span>
                </label>
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#081429]">
                {formData.gender === 'male' ? '남' : formData.gender === 'female' ? '여' : '-'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 학교 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <School className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">학교 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="학교" value={formData.school} field="school" placeholder="예: 침산초" />
          <SelectField label="학년" value={formData.grade} field="grade" options={GRADE_OPTIONS} />
          <InputField label="졸업연도" value={formData.graduationYear} field="graduationYear" placeholder="예: 2026" />
        </div>
      </div>

      {/* 연락처 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Phone className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">연락처</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="원생 휴대폰" value={formData.studentPhone} field="studentPhone" placeholder="010-0000-0000" />
          <InputField label="원생 집전화" value={formData.homePhone} field="homePhone" placeholder="053-000-0000" />
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">보호자 (SMS)</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={formData.parentPhone ?? ''}
                  onChange={(e) => handleChange('parentPhone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
                <select
                  value={formData.parentRelation ?? '모'}
                  onChange={(e) => handleChange('parentRelation', e.target.value)}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                >
                  {RELATION_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span className="text-sm text-[#373d41]">보호자명:</span>
                <input
                  type="text"
                  value={formData.parentName ?? ''}
                  onChange={(e) => handleChange('parentName', e.target.value)}
                  placeholder="이름"
                  className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#081429]">
                {formData.parentPhone ? `${formData.parentPhone} (${formData.parentRelation || '모'}) ${formData.parentName || ''}` : '-'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">기타 알림 번호</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={formData.otherPhone ?? ''}
                  onChange={(e) => handleChange('otherPhone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
                <span className="text-sm text-[#373d41]">관계:</span>
                <input
                  type="text"
                  value={formData.otherPhoneRelation ?? ''}
                  onChange={(e) => handleChange('otherPhoneRelation', e.target.value)}
                  placeholder="관계"
                  className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#081429]">
                {formData.otherPhone ? `${formData.otherPhone} (${formData.otherPhoneRelation || '-'})` : '-'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 알림 설정 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Bell className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">알림 설정</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-[#373d41] mb-2">등하원알림</p>
            <div className="flex flex-wrap gap-4">
              <CheckboxField label="SMS" checked={formData.smsNotification} field="smsNotification" />
              <CheckboxField label="푸시" checked={formData.pushNotification} field="pushNotification" />
              <CheckboxField label="알림톡" checked={formData.kakaoNotification} field="kakaoNotification" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[#373d41] mb-2">수납문자발송</p>
            <div className="flex flex-wrap gap-4">
              <CheckboxField label="보호자" checked={formData.billingSmsPrimary} field="billingSmsPrimary" />
              <CheckboxField label="기타보호자" checked={formData.billingSmsOther} field="billingSmsOther" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-[#373d41] mb-2">미납문자발송</p>
            <div className="flex flex-wrap gap-4">
              <CheckboxField label="보호자" checked={formData.overdueSmsPrimary} field="overdueSmsPrimary" />
              <CheckboxField label="기타보호자" checked={formData.overdueSmsOther} field="overdueSmsOther" />
            </div>
          </div>
        </div>
      </div>

      {/* 주소 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <MapPin className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">주소</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="우편번호" value={formData.zipCode} field="zipCode" placeholder="12345" />
          <InputField label="주소" value={formData.address} field="address" placeholder="대구 북구..." />
          <InputField label="상세주소" value={formData.addressDetail} field="addressDetail" />
        </div>
      </div>

      {/* 추가 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Cake className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">추가 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="생년월일" value={formData.birthDate} field="birthDate" type="date" />
          <InputField label="닉네임" value={formData.nickname} field="nickname" />
          <InputField label="원생 이메일" value={formData.studentEmail} field="studentEmail" type="email" placeholder="example@email.com" />
          <InputField label="입학동기" value={formData.enrollmentReason} field="enrollmentReason" />
        </div>
      </div>

      {/* 등록/재원 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <Calendar className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">등록 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="등록일(입학일)" value={formData.startDate} field="startDate" type="date" />
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">재원상태</label>
            {isEditing ? (
              <select
                value={formData.status ?? 'active'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
              >
                <option value="active">재원</option>
                <option value="on_hold">휴원</option>
                <option value="withdrawn">퇴원</option>
                <option value="prospect">예비</option>
              </select>
            ) : (
              <span
                className="px-3 py-1 rounded text-xs font-semibold"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                {statusStyle.label}
              </span>
            )}
          </div>
          {(formData.status === 'withdrawn' || student.endDate) && (
            <InputField label="퇴원일" value={formData.endDate} field="endDate" type="date" />
          )}
        </div>
      </div>

      {/* 수납 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <CreditCard className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">수납 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">현금영수증</label>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={formData.cashReceiptNumber ?? ''}
                  onChange={(e) => handleChange('cashReceiptNumber', e.target.value)}
                  placeholder="휴대폰 또는 사업자번호"
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="cashReceiptType"
                    checked={formData.cashReceiptType === 'income'}
                    onChange={() => handleChange('cashReceiptType', 'income')}
                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                  />
                  <span className="text-sm">소득공제용</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="cashReceiptType"
                    checked={formData.cashReceiptType === 'expense'}
                    onChange={() => handleChange('cashReceiptType', 'expense')}
                    className="w-4 h-4 text-[#fdb813] focus:ring-[#fdb813]"
                  />
                  <span className="text-sm">지출증빙용</span>
                </label>
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#081429]">
                {formData.cashReceiptNumber
                  ? `${formData.cashReceiptNumber} (${formData.cashReceiptType === 'income' ? '소득공제용' : '지출증빙용'})`
                  : '-'}
              </span>
            )}
          </div>
          <InputField label="수납 청구일" value={formData.billingDay} field="billingDay" type="number" placeholder="매월 (일)" />
          <div className="flex items-center gap-3 px-4 py-2.5">
            <label className="w-28 shrink-0 text-sm font-medium text-[#373d41]">수납 기본할인</label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.billingDiscount ?? 0}
                  onChange={(e) => handleChange('billingDiscount', Number(e.target.value))}
                  placeholder="0"
                  className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813]"
                />
                <span className="text-sm text-[#373d41]">원</span>
              </div>
            ) : (
              <span className="flex-1 text-sm text-[#081429]">
                {(formData.billingDiscount ?? 0).toLocaleString()}원
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 기타 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <CheckSquare className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">기타</h3>
        </div>
        <div className="divide-y divide-gray-100">
          <InputField label="기타항목1" value={formData.customField1} field="customField1" />
          <InputField label="기타항목2" value={formData.customField2} field="customField2" />
        </div>
      </div>

      {/* 메모 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <FileText className="w-5 h-5 text-[#081429]" />
          <h3 className="text-[#081429] font-bold text-lg">메모</h3>
        </div>
        <div className="p-4">
          {isEditing ? (
            <textarea
              value={formData.memo ?? ''}
              onChange={(e) => handleChange('memo', e.target.value)}
              placeholder="학생에 대한 특이사항이나 메모를 입력하세요"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#fdb813] resize-none"
            />
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 min-h-[80px]">
              <p className="text-sm text-[#081429] whitespace-pre-wrap">
                {formData.memo || '등록된 메모가 없습니다.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BasicInfoTab;
