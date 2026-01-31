import React from 'react';
import { CalendarEvent, Department, UserProfile, EventTag } from '../../types';
import { Type, Clock, AlignLeft, Link as LinkIcon, ChevronDown, ChevronUp, Hash } from 'lucide-react';
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
  isMaster: boolean;
  isAdmin: boolean;
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
  isMaster,
  isAdmin,
  currentUser,
}) => {
  return (
    <>
      {/* Title */}
      <div>
        <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Type size={14} className="text-[#fdb813]" /> 제목
        </label>
        <input
          type="text"
          required
          value={title}
          disabled={isViewMode || !canEditCurrent}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
          placeholder="일정 제목을 입력하세요"
        />
      </div>

      {/* Department (Dropdown with Checkboxes) */}
      <div>
        <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5">
          부서 (다중 선택 가능)
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
            className="w-full text-left px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] bg-white flex justify-between items-center outline-none transition-all"
          >
            <span className={`text-sm font-medium ${departmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
              {departmentIds.length === 0
                ? '부서를 선택하세요'
                : `${departments.find(d => d.id === departmentIds[0])?.name || departmentIds[0]} 외 ${departmentIds.length - 1}개`}
            </span>
            {isDeptDropdownOpen ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>

          {isDeptDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
              {departments.map((dept) => {
                const isSelected = departmentIds.includes(dept.id);
                const hasEditAccess = isMaster || isAdmin || currentUser?.departmentPermissions?.[dept.id] === 'edit';
                const hasViewAccess = currentUser?.departmentPermissions?.[dept.id] === 'view';

                return (
                  <label
                    key={dept.id}
                    className={`flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : ''} ${isViewMode ? 'cursor-default opacity-80' : ''}`}
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
                      className="w-4 h-4 rounded border-gray-300 accent-[#081429]"
                    />
                    <span className={`text-sm ${isSelected ? 'font-bold text-[#081429]' : 'text-gray-700'}`}>
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
        {departmentIds.length === 0 && (
          <p className="text-xs text-red-500 mt-1">최소 한 개의 부서를 선택해주세요.</p>
        )}
      </div>

      {/* Read Only Notice */}
      {!canEditCurrent && (
        <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100 mb-2 flex items-center gap-2">
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
          <div className="bg-blue-50 text-blue-700 text-xs font-bold p-3 rounded-xl border border-blue-200 flex flex-col gap-1">
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

      {/* Date & Time Range */}
      <div>
        <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-[#fdb813]" /> 일시
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              id="allDay"
              checked={isAllDay}
              disabled={isViewMode || !canEditCurrent}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 rounded text-[#fdb813] focus:ring-[#fdb813] border-gray-300"
            />
            <label htmlFor="allDay" className="text-xs font-bold text-gray-500 cursor-pointer select-none">
              하루종일
            </label>
          </div>
        </label>
        <div className="flex flex-col md:flex-row gap-2 items-center">
          {/* Start */}
          <div className="flex gap-2 w-full md:w-auto items-center">
            <div className="relative w-36">
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="relative w-36">
              <input
                type="time"
                required={!isAllDay}
                value={startTime}
                disabled={isViewMode || !canEditCurrent || isAllDay}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none font-medium text-sm ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          <span className="text-gray-400 font-bold hidden md:block">~</span>
          <span className="text-gray-400 font-bold block md:hidden rotate-90">~</span>

          {/* End */}
          <div className="flex gap-2 w-full md:w-auto items-center">
            <div className="relative w-36">
              <input
                type="date"
                required
                value={endDate}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="relative w-36">
              <input
                type="time"
                required={!isAllDay}
                value={endTime}
                disabled={isViewMode || !canEditCurrent || isAllDay}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none font-medium text-sm ${(!canEditCurrent || isAllDay) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <AlignLeft size={14} className="text-[#fdb813]" /> 상세 내용
        </label>
        <textarea
          value={description}
          disabled={isViewMode || !canEditCurrent}
          onChange={(e) => setDescription(e.target.value)}
          className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none min-h-[200px] resize-y font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
          placeholder="일정의 자세한 내용을 입력하세요"
        />
      </div>

      {/* Reference URL */}
      <div>
        <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <LinkIcon size={14} className="text-[#fdb813]" /> 참조 (Link)
        </label>
        {isViewMode && referenceUrl ? (
          <a
            href={referenceUrl.startsWith('http') ? referenceUrl : `https://${referenceUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600 hover:text-blue-800 hover:underline transition-colors font-medium text-sm flex items-center gap-2 truncate"
          >
            <LinkIcon size={14} />
            {referenceUrl}
          </a>
        ) : (
          <input
            type="text"
            value={referenceUrl}
            disabled={isViewMode || !canEditCurrent}
            onChange={(e) => setReferenceUrl(e.target.value)}
            className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] focus:border-[#fdb813] outline-none transition-all font-medium text-sm ${!canEditCurrent ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            placeholder="외부 링크를 입력하세요 (예: Notion, 구글 시트 URL)"
          />
        )}
      </div>

      {/* Color Style + Recurrence (Same Row) */}
      <div className="flex gap-6 items-start flex-wrap">
        {/* Color Pickers */}
        <div>
          <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
            색상 스타일
          </label>
          <div className="flex gap-4 items-center">
            {/* Background Color */}
            <div className="flex flex-col gap-1 items-center">
              <input
                type="color"
                value={selectedColor}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setSelectedColor(e.target.value)}
                className={`w-9 h-9 rounded-lg cursor-pointer border-2 border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="배경색 선택"
              />
              <span className="text-xxs font-bold text-gray-500">배경</span>
            </div>

            {/* Text Color */}
            <div className="flex flex-col gap-1 items-center">
              <input
                type="color"
                value={selectedTextColor}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setSelectedTextColor(e.target.value)}
                className={`w-9 h-9 rounded-lg cursor-pointer border-2 border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="글자색 선택"
              />
              <span className="text-xxs font-bold text-gray-500">글자</span>
            </div>

            {/* Border Color */}
            <div className="flex flex-col gap-1 items-center">
              <input
                type="color"
                value={selectedBorderColor}
                disabled={isViewMode || !canEditCurrent}
                onChange={(e) => setSelectedBorderColor(e.target.value)}
                className={`w-9 h-9 rounded-lg cursor-pointer border-2 border-gray-200 ${(!canEditCurrent) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="테두리색 선택"
              />
              <span className="text-xxs font-bold text-gray-500">테두리</span>
            </div>
          </div>
        </div>

        {/* Recurrence Options (New Events Only) */}
        {!existingEvent && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
              🔄 반복 설정
            </label>
            <div className="flex gap-2 items-center">
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as any)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold bg-white"
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
                <select
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#fdb813] outline-none text-sm font-bold bg-white"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}회</option>
                  ))}
                </select>
              )}
            </div>
            {recurrenceType !== 'none' && (
              <p className="text-xs text-gray-500 mt-1">
                총 {recurrenceCount}개의 일정이 생성됩니다.
              </p>
            )}
          </div>
        )}

        {/* Hashtags Combobox */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2 flex items-center gap-1">
            <Hash size={14} className="text-[#fdb813]" /> 해시태그
          </label>
          <HashtagCombobox
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            disabled={isViewMode || !canEditCurrent}
          />
          {selectedTags.some(tagId => seminarTags.includes(tagId)) && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <span className="text-xs">👥</span>
              참가자 패널 표시
            </p>
          )}
        </div>
      </div>

      {/* Author Info for Existing Events */}
      {existingEvent && (
        <div>
          <label className="block text-xs font-extrabold text-[#373d41] uppercase tracking-wider mb-2">
            작성자 정보
          </label>
          {currentUser?.canManageEventAuthors ? (
            <div className="relative">
              <select
                value={authorId}
                onChange={(e) => {
                  const selectedUser = users.find(u => u.uid === e.target.value);
                  if (selectedUser) {
                    setAuthorId(selectedUser.uid);
                    setAuthorName(`${selectedUser.email.split('@')[0]} ${selectedUser.jobTitle ? `(${selectedUser.jobTitle})` : ''}`);
                  }
                }}
                className="w-full appearance-none bg-white border border-gray-300 text-gray-700 text-sm font-bold py-2.5 px-4 rounded-xl outline-none focus:border-[#fdb813] cursor-pointer focus:ring-2 focus:ring-[#fdb813]"
              >
                {users.filter(u => u.status === 'approved').map(u => (
                  <option key={u.uid} value={u.uid}>{u.email.split('@')[0]} {u.jobTitle ? `(${u.jobTitle})` : ''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl font-bold text-sm">
              {authorName || '작성자 정보 없음'}
            </div>
          )}

          {/* Timestamps Display */}
          <div className="mt-2 flex flex-col gap-0.5 text-xxs text-gray-400 font-medium px-1">
            {existingEvent.createdAt && (
              <span>생성: {format(new Date(existingEvent.createdAt), 'yyyy-MM-dd HH:mm')}</span>
            )}
            {existingEvent.updatedAt && (
              <span>수정: {format(new Date(existingEvent.updatedAt), 'yyyy-MM-dd HH:mm')}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EventFormFields;
