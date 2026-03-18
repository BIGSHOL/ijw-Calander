import React from 'react';
import { CalendarEvent, Department, UserProfile, EventTag } from '../../types';
import { Type, Clock, AlignLeft, Link as LinkIcon, ChevronDown, ChevronUp, Hash, Palette, RefreshCw, User } from 'lucide-react';
import { format } from 'date-fns';
import HashtagCombobox from './HashtagCombobox';

interface EventFormFieldsProps {
  // State values
  title: string;
  description: string;
  departmentIds: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  selectedColor: string;
  selectedTextColor: string;
  selectedBorderColor: string;
  authorId: string;
  authorName: string;
  referenceUrl: string;
  isViewMode: boolean;
  recurrenceType: 'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly';
  recurrenceCount: number;
  isDeptDropdownOpen: boolean;
  selectedTags: string[];
  availableTags: EventTag[];
  seminarTags: string[];

  // Setters
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setDepartmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  setStartTime: React.Dispatch<React.SetStateAction<string>>;
  setEndTime: React.Dispatch<React.SetStateAction<string>>;
  setIsAllDay: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedColor: React.Dispatch<React.SetStateAction<string>>;
  setSelectedTextColor: React.Dispatch<React.SetStateAction<string>>;
  setSelectedBorderColor: React.Dispatch<React.SetStateAction<string>>;
  setAuthorId: React.Dispatch<React.SetStateAction<string>>;
  setAuthorName: React.Dispatch<React.SetStateAction<string>>;
  setReferenceUrl: React.Dispatch<React.SetStateAction<string>>;
  setRecurrenceType: React.Dispatch<React.SetStateAction<'none' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly'>>;
  setRecurrenceCount: React.Dispatch<React.SetStateAction<number>>;
  setIsDeptDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;

  // External data
  existingEvent?: CalendarEvent | null;
  departments: Department[];
  users: UserProfile[];
  allEvents: CalendarEvent[];

  // Computed
  canEditCurrent: boolean;
  canManageAllDepts: boolean;
  currentUser: UserProfile | null;
}

const EventFormFields: React.FC<EventFormFieldsProps> = ({
  title,
  description,
  departmentIds,
  startDate,
  endDate,
  startTime,
  endTime,
  isAllDay,
  selectedColor,
  selectedTextColor,
  selectedBorderColor,
  authorId,
  authorName,
  referenceUrl,
  isViewMode,
  recurrenceType,
  recurrenceCount,
  isDeptDropdownOpen,
  selectedTags,
  availableTags,
  seminarTags,
  setTitle,
  setDescription,
  setDepartmentIds,
  setStartDate,
  setEndDate,
  setStartTime,
  setEndTime,
  setIsAllDay,
  setSelectedColor,
  setSelectedTextColor,
  setSelectedBorderColor,
  setAuthorId,
  setAuthorName,
  setReferenceUrl,
  setRecurrenceType,
  setRecurrenceCount,
  setIsDeptDropdownOpen,
  setSelectedTags,
  existingEvent,
  departments,
  users,
  allEvents,
  canEditCurrent,
  canManageAllDepts,
  currentUser,
}) => {
  return (
    <div className="space-y-2">
      {/* Read Only Notice */}
      {!canEditCurrent && (
        <div className="bg-red-50 text-red-600 text-xs font-bold p-3 border border-red-100 flex items-center gap-2">
          <span className="text-lg">⚠️</span> 이 부서의 일정은 조회만 가능합니다.
        </div>
      )}

      {/* Recurrence Info for Existing Events */}
      {existingEvent?.recurrenceGroupId && existingEvent?.recurrenceIndex && (() => {
        const totalInGroup = allEvents.filter(e => e.recurrenceGroupId === existingEvent.recurrenceGroupId).length;
        const lastEvent = allEvents
          .filter(e => e.recurrenceGroupId === existingEvent.recurrenceGroupId)
          .sort((a, b) => (b.recurrenceIndex || 0) - (a.recurrenceIndex || 0))[0];
        const lastDate = lastEvent?.startDate || '';

        return (
          <div className="bg-blue-50 text-blue-700 text-xs font-bold p-3 border border-blue-200 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <span>
                반복 일정 ({
                  existingEvent.recurrenceType === 'daily' ? '매일' :
                    existingEvent.recurrenceType === 'weekdays' ? '평일' :
                      existingEvent.recurrenceType === 'weekends' ? '주말' :
                        existingEvent.recurrenceType === 'weekly' ? '매주' :
                          existingEvent.recurrenceType === 'monthly' ? '매월' :
                            existingEvent.recurrenceType === 'yearly' ? '매년' : '알수없음'
                }) - {existingEvent.recurrenceIndex}/{totalInGroup}번째
              </span>
            </div>
            {lastDate && (
              <span className="text-xxs text-blue-500 ml-7">
                마지막 반복: {lastDate}
              </span>
            )}
          </div>
        );
      })()}

      {/* Section 1: 기본 정보 (제목, 부서) */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <Type className="w-3 h-3 text-primary" />
          <h3 className="text-primary font-bold text-xs">기본 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Title Row */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="w-12 shrink-0 text-xs font-medium text-primary-700">제목 <span className="text-red-500">*</span></span>
            <input
              type="text"
              required
              value={title}
              disabled={isViewMode || !canEditCurrent}
              onChange={(e) => setTitle(e.target.value)}
              className={`flex-1 px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          {/* Department Row */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs font-medium text-primary-700">부서</span>
              <div className="flex-1 relative">
                <button
                  type="button"
                  onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  className="w-full text-left px-2 py-1 text-xs border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent bg-white flex justify-between items-center outline-none"
                >
                  <span className={`text-xs ${departmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                    {departmentIds.length === 0
                      ? '부서를 선택하세요'
                      : `${departments.find(d => d.id === departmentIds[0])?.name || departmentIds[0]} 외 ${departmentIds.length - 1}개`}
                  </span>
                  {isDeptDropdownOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>

                {isDeptDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border border-gray-200 shadow-xl z-50 max-h-40 overflow-y-auto">
                    {departments.map((dept) => {
                      const isSelected = departmentIds.includes(dept.id);
                      const hasEditAccess = canManageAllDepts || currentUser?.departmentPermissions?.[dept.id] === 'edit';
                      const hasViewAccess = currentUser?.departmentPermissions?.[dept.id] === 'view';

                      return (
                        <label
                          key={dept.id}
                          className={`flex items-center gap-2 p-1.5 hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : ''} ${isViewMode ? 'cursor-default opacity-80' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isViewMode || !hasEditAccess}
                            onChange={(e) => {
                              let newIds: string[];
                              if (e.target.checked) {
                                newIds = [...departmentIds, dept.id];
                                setSelectedColor(dept.defaultColor || '#fee2e2');
                                setSelectedTextColor(dept.defaultTextColor || '#ffffff');
                                setSelectedBorderColor(dept.defaultBorderColor || dept.defaultColor || '#fee2e2');
                              } else {
                                newIds = departmentIds.filter(id => id !== dept.id);
                                if (newIds.length > 0) {
                                  const firstDept = departments.find(d => d.id === newIds[0]);
                                  if (firstDept) {
                                    setSelectedColor(firstDept.defaultColor || '#fee2e2');
                                    setSelectedTextColor(firstDept.defaultTextColor || '#ffffff');
                                    setSelectedBorderColor(firstDept.defaultBorderColor || firstDept.defaultColor || '#fee2e2');
                                  }
                                }
                              }
                              setDepartmentIds(newIds);
                            }}
                            className="w-3.5 h-3.5 rounded border-gray-300 accent-[#081429]"
                          />
                          <span className={`text-xs ${isSelected ? 'font-bold text-primary' : 'text-gray-700'}`}>
                            {dept.name}
                          </span>
                          {!hasEditAccess && hasViewAccess && (
                            <span className="text-xxs text-gray-400 ml-auto">(조회전용)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {departmentIds.length === 0 && (
              <p className="text-xxs text-red-500 mt-1 ml-14">최소 한 개의 부서를 선택해주세요.</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: 일시 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">일시</h3>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              disabled={isViewMode || !canEditCurrent}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-3 h-3 rounded text-accent focus:ring-accent border-gray-300"
            />
            <span className="text-xxs text-gray-500">하루종일</span>
          </label>
        </div>
        <div className="p-2">
          <div className="flex flex-col md:flex-row gap-2 items-center">
            {/* Start */}
            <div className="flex gap-2 w-full md:w-auto items-center">
              <span className="text-xxs text-gray-400 w-8">시작</span>
              <input
                type="date"
                required
                value={startDate}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setStartDate(newDate);
                  if (newDate > endDate) {
                    setEndDate(newDate);
                  }
                }}
                className={`w-32 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
              <input
                type="time"
                required={!isAllDay}
                value={startTime}
                disabled={isViewMode || !canEditCurrent || isAllDay}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-24 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>

            <span className="text-gray-400 text-xs">~</span>

            {/* End */}
            <div className="flex gap-2 w-full md:w-auto items-center">
              <span className="text-xxs text-gray-400 w-8">종료</span>
              <input
                type="date"
                required
                value={endDate}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className={`w-32 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
              <input
                type="time"
                required={!isAllDay}
                value={endTime}
                disabled={isViewMode || !canEditCurrent || isAllDay}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-24 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: 상세 정보 */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <AlignLeft className="w-3 h-3 text-primary" />
          <h3 className="text-primary font-bold text-xs">상세 정보</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Description Row */}
          <div className="px-2 py-1.5">
            <span className="text-xs font-medium text-primary-700 block mb-1">내용</span>
            <textarea
              value={description}
              disabled={isViewMode || !canEditCurrent}
              spellCheck={false}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none min-h-[80px] resize-y text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              placeholder="일정의 자세한 내용을 입력하세요"
            />
          </div>

          {/* Reference URL Row */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <LinkIcon className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="w-10 shrink-0 text-xs font-medium text-primary-700">링크</span>
            {isViewMode && referenceUrl ? (
              <a
                href={referenceUrl.startsWith('http') ? referenceUrl : `https://${referenceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-600 hover:text-blue-800 hover:underline transition-colors text-xs truncate"
              >
                {referenceUrl}
              </a>
            ) : (
              <input
                type="text"
                value={referenceUrl}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setReferenceUrl(e.target.value)}
                className={`flex-1 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent focus:border-accent outline-none text-xs ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="Notion, 구글 시트 URL 등"
              />
            )}
          </div>
        </div>
      </div>

      {/* Section 4: 표시 설정 (색상, 반복, 해시태그) */}
      <div className="bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          <Palette className="w-3 h-3 text-primary" />
          <h3 className="text-primary font-bold text-xs">표시 설정</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Color Pickers Row */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="w-12 shrink-0 text-xs font-medium text-primary-700">색상</span>
            <div className="flex gap-3 items-center">
              <div className="flex flex-col gap-0.5 items-center">
                <input
                  type="color"
                  value={selectedColor}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className={`w-6 h-6 cursor-pointer border border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="배경색 선택"
                />
                <span className="text-xxs text-gray-400">배경</span>
              </div>
              <div className="flex flex-col gap-0.5 items-center">
                <input
                  type="color"
                  value={selectedTextColor}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setSelectedTextColor(e.target.value)}
                  className={`w-6 h-6 cursor-pointer border border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="글자색 선택"
                />
                <span className="text-xxs text-gray-400">글자</span>
              </div>
              <div className="flex flex-col gap-0.5 items-center">
                <input
                  type="color"
                  value={selectedBorderColor}
                  disabled={isViewMode || !canEditCurrent}
                  onChange={(e) => setSelectedBorderColor(e.target.value)}
                  className={`w-6 h-6 cursor-pointer border border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="테두리색 선택"
                />
                <span className="text-xxs text-gray-400">테두리</span>
              </div>
            </div>
          </div>

          {/* Recurrence Options Row (New Events Only) */}
          {!existingEvent && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <RefreshCw className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="w-10 shrink-0 text-xs font-medium text-primary-700">반복</span>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as any)}
                className="flex-1 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs bg-white max-w-[120px]"
              >
                <option value="none">반복 없음</option>
                <option value="daily">매일</option>
                <option value="weekdays">평일 (월-금)</option>
                <option value="weekends">주말 (토-일)</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월</option>
                <option value="yearly">매년</option>
              </select>
              {recurrenceType !== 'none' && (
                <>
                  <select
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-300 focus:ring-1 focus:ring-accent outline-none text-xs bg-white"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}회</option>
                    ))}
                  </select>
                  <span className="text-xxs text-gray-400">총 {recurrenceCount}개 생성</span>
                </>
              )}
            </div>
          )}

          {/* Hashtags Row */}
          <div className="flex items-start gap-2 px-2 py-1.5">
            <Hash className="w-3 h-3 text-gray-400 shrink-0 mt-1" />
            <span className="w-10 shrink-0 text-xs font-medium text-primary-700 mt-0.5">태그</span>
            <div className="flex-1">
              <HashtagCombobox
                availableTags={availableTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                disabled={isViewMode || !canEditCurrent}
              />
              {selectedTags.some(tagId => seminarTags.includes(tagId)) && (
                <p className="text-xxs text-amber-600 mt-1 flex items-center gap-1">
                  <span className="text-xxs">👥</span>
                  참가자 패널 표시
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: 작성자 정보 (Existing Events Only) */}
      {existingEvent && (
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <User className="w-3 h-3 text-primary" />
            <h3 className="text-primary font-bold text-xs">작성자 정보</h3>
          </div>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="w-12 shrink-0 text-xs font-medium text-primary-700">작성자</span>
              {currentUser?.canManageEventAuthors ? (
                <select
                  value={authorId}
                  onChange={(e) => {
                    const selectedUser = users.find(u => u.uid === e.target.value);
                    if (selectedUser) {
                      setAuthorId(selectedUser.uid);
                      setAuthorName(`${selectedUser.email.split('@')[0]} ${selectedUser.jobTitle ? `(${selectedUser.jobTitle})` : ''}`);
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-gray-300 text-xs outline-none focus:border-accent cursor-pointer focus:ring-1 focus:ring-accent bg-white"
                >
                  {users.filter(u => u.status === 'approved').map(u => (
                    <option key={u.uid} value={u.uid}>{u.email.split('@')[0]} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-xs text-primary">{authorName || '작성자 정보 없음'}</span>
              )}
            </div>

            {/* Timestamps Display */}
            {(existingEvent.createdAt || existingEvent.updatedAt) && (
              <div className="px-2 py-1.5 flex flex-col gap-0.5 text-xxs text-gray-400">
                {existingEvent.createdAt && (
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0">생성</span>
                    <span>{format(new Date(existingEvent.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                )}
                {existingEvent.updatedAt && (
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0">수정</span>
                    <span>{format(new Date(existingEvent.updatedAt), 'yyyy-MM-dd HH:mm')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFormFields;
