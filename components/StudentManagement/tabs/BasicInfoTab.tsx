import React from 'react';
import { UnifiedStudent } from '../../../types';
import {
  User,
  School,
  GraduationCap,
  Calendar,
  CalendarX,
  AlertCircle,
  Edit,
  UserX,
} from 'lucide-react';

interface BasicInfoTabProps {
  student: UnifiedStudent;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ student }) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '재원', color: 'text-green-700 bg-green-100' };
      case 'on_hold':
        return { label: '대기', color: 'text-yellow-700 bg-yellow-100' };
      case 'withdrawn':
        return { label: '퇴원', color: 'text-gray-700 bg-gray-100' };
      default:
        return { label: status, color: 'text-gray-700 bg-gray-100' };
    }
  };

  const statusInfo = getStatusDisplay(student.status);

  const InfoRow = ({
    icon,
    label,
    value,
    placeholder,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string | null;
    placeholder?: string;
  }) => (
    <div className="flex items-start py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-2 w-1/3 text-gray-600">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="w-2/3">
        {value ? (
          <span className="text-sm text-gray-800">{value}</span>
        ) : (
          <span className="text-sm text-gray-400 italic">
            {placeholder || '- (구현 예정)'}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 액션 버튼 그룹 */}
      <div className="flex flex-wrap gap-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
          title="구현 예정"
        >
          <Edit className="w-4 h-4" />
          수정
        </button>
        <button
          className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled
          title="구현 예정"
        >
          <UserX className="w-4 h-4" />
          퇴원처리
        </button>
      </div>

      {/* 기본 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">기본 정보</h3>
        </div>
        <div className="p-4">
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="이름"
            value={student.name}
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="영어 이름"
            value={student.englishName}
          />
          <InfoRow
            icon={<School className="w-4 h-4" />}
            label="학교"
            value={student.school}
          />
          <InfoRow
            icon={<GraduationCap className="w-4 h-4" />}
            label="학년"
            value={student.grade}
          />
          <div className="flex items-start py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 w-1/3 text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">상태</span>
            </div>
            <div className="w-2/3">
              <span className={`text-sm px-3 py-1 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 날짜 정보 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">날짜 정보</h3>
        </div>
        <div className="p-4">
          <InfoRow
            icon={<Calendar className="w-4 h-4" />}
            label="등록일"
            value={student.startDate}
          />
          {student.endDate && (
            <InfoRow
              icon={<CalendarX className="w-4 h-4" />}
              label="퇴원일"
              value={student.endDate}
            />
          )}
        </div>
      </div>

      {/* 추가 정보 섹션 (미구현 필드들) */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">추가 정보</h3>
          <p className="text-xs text-gray-500 mt-1">추후 입력 가능한 정보입니다</p>
        </div>
        <div className="p-4">
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="생년월일"
            value={null}
            placeholder="- (구현 예정)"
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="학부모 연락처"
            value={null}
            placeholder="- (구현 예정)"
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="학생 연락처"
            value={null}
            placeholder="- (구현 예정)"
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="주소"
            value={null}
            placeholder="- (구현 예정)"
          />
        </div>
      </div>

      {/* 메모 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">특이사항</h3>
        </div>
        <div className="p-4">
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="특이사항을 입력하세요 (구현 예정)"
            disabled
          />
        </div>
      </div>
    </div>
  );
};

export default BasicInfoTab;
