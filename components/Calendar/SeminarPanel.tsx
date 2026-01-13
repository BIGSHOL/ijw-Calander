import React, { useState } from 'react';
import { X, UserPlus, Users, Search, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import { SeminarAttendee, SeminarEventData, UnifiedStudent } from '../../types';

interface SeminarPanelProps {
  isOpen: boolean;
  eventTitle?: string;
  seminarData?: SeminarEventData;
  students?: UnifiedStudent[];  // 재원생 목록
  users?: any[];  // 선생님 목록
  onClose: () => void;
  onUpdateSeminarData?: (data: SeminarEventData) => void;
}

const SeminarPanel: React.FC<SeminarPanelProps> = ({
  isOpen,
  eventTitle,
  seminarData,
  students = [],
  users = [],
  onClose,
  onUpdateSeminarData
}) => {
  // 연사 정보 state
  const [speaker, setSpeaker] = useState(seminarData?.speaker || '');
  const [speakerBio, setSpeakerBio] = useState(seminarData?.speakerBio || '');
  const [speakerContact, setSpeakerContact] = useState(seminarData?.speakerContact || '');

  // 참석자 관리 state
  const [attendees, setAttendees] = useState<SeminarAttendee[]>(seminarData?.attendees || []);
  const [isAddingAttendee, setIsAddingAttendee] = useState(false);
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(null);

  // 참석자 추가 폼 state
  const [newAttendee, setNewAttendee] = useState<Partial<SeminarAttendee>>({
    name: '',
    phone: '',
    isCurrentStudent: false,
    status: 'registered'
  });

  // 학생 검색
  const [studentSearch, setStudentSearch] = useState('');

  // 참석자 검색
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const handleSave = () => {
    if (onUpdateSeminarData) {
      onUpdateSeminarData({
        ...seminarData,
        speaker,
        speakerBio,
        speakerContact,
        attendees
      });
    }
  };

  const handleAddAttendee = () => {
    if (!newAttendee.name || !newAttendee.phone) {
      alert('이름과 전화번호는 필수입니다.');
      return;
    }

    const attendee: SeminarAttendee = {
      id: `attendee_${Date.now()}`,
      name: newAttendee.name,
      phone: newAttendee.phone,
      isCurrentStudent: newAttendee.isCurrentStudent || false,
      studentId: newAttendee.studentId,
      gender: newAttendee.gender,
      ageGroup: newAttendee.ageGroup,
      grade: newAttendee.grade,
      address: newAttendee.address,
      registrationSource: newAttendee.registrationSource,
      parentAttending: newAttendee.parentAttending,
      companions: newAttendee.companions,
      assignedTeacherId: newAttendee.assignedTeacherId,
      assignedTeacherName: newAttendee.assignedTeacherName,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      memo: newAttendee.memo
    };

    setAttendees([...attendees, attendee]);
    setNewAttendee({
      name: '',
      phone: '',
      isCurrentStudent: false,
      status: 'registered'
    });
    setIsAddingAttendee(false);
  };

  const handleRemoveAttendee = (id: string) => {
    setAttendees(attendees.filter(a => a.id !== id));
  };

  const handleStudentSelect = (student: UnifiedStudent) => {
    setNewAttendee({
      ...newAttendee,
      isCurrentStudent: true,
      studentId: student.id,
      name: student.name,
      phone: '', // Phone number not stored in UnifiedStudent, will be manually entered
      // TODO: student 데이터에서 추가 정보 매핑 (gender, grade 등)
    });
    setStudentSearch('');
  };

  const filteredStudents = students.filter(s =>
    (studentSearch === '' || s.name.includes(studentSearch) || s.id.includes(studentSearch))
  );

  const filteredAttendees = attendees.filter(a =>
    (attendeeSearch === '' || a.name.includes(attendeeSearch) || (a.phone && a.phone.includes(attendeeSearch)))
  );

  return (
    <>
      {/* Side Panel */}
      <div
        className={`bg-white rounded-2xl shadow-2xl w-96 h-[90vh] border border-gray-200 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">세미나 관리</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/80 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Event Title */}
          {eventTitle && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">일정</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{eventTitle}</p>
            </div>
          )}

          {/* Fixed Header - 연사 정보 & 참석 현황 */}
          <div className="p-4 space-y-3 border-b border-gray-200 bg-gray-50">
            {/* 연사 정보 */}
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
              <h4 className="text-sm font-bold text-purple-900 mb-2">연사 정보</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">연사 이름</label>
                  <input
                    type="text"
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    placeholder="연사 이름"
                    className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">연락처</label>
                  <input
                    type="tel"
                    value={speakerContact}
                    onChange={(e) => setSpeakerContact(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">소개</label>
                  <textarea
                    value={speakerBio}
                    onChange={(e) => setSpeakerBio(e.target.value)}
                    placeholder="연사 소개"
                    rows={2}
                    className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 참석 현황 - Compact */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-2.5 border border-purple-200">
              <h4 className="text-xs font-bold text-purple-900 mb-1.5">참석 현황</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-purple-600">
                    {attendees.length}
                  </div>
                  <div className="text-xs text-gray-500">총 참석자</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xl font-bold text-blue-600">
                    {attendees.filter(a => a.isCurrentStudent).length}
                  </div>
                  <div className="text-xs text-gray-500">재원생</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content - Scrollable (참석자 목록만) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* 참석자 목록 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700">참석자 목록</h4>
                <button
                  onClick={() => setIsAddingAttendee(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
                >
                  <UserPlus size={14} />
                  추가
                </button>
              </div>

              {/* 참석자 검색 */}
              {attendees.length > 0 && !isAddingAttendee && (
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="참석자 이름 또는 전화번호 검색"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              )}

              {/* 참석자 추가 폼 */}
              {isAddingAttendee && (
                <div className="bg-white rounded-lg border-2 border-purple-300 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-bold text-gray-900">새 참석자</h5>
                    <button
                      onClick={() => {
                        setIsAddingAttendee(false);
                        setNewAttendee({ name: '', phone: '', isCurrentStudent: false, status: 'registered' });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>

                  {/* 재원생 여부 */}
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        borderColor: newAttendee.isCurrentStudent === false ? '#9333ea' : '#e5e7eb',
                        backgroundColor: newAttendee.isCurrentStudent === false ? '#f3e8ff' : '#fff'
                      }}
                    >
                      <input
                        type="radio"
                        name="studentType"
                        checked={newAttendee.isCurrentStudent === false}
                        onChange={() => setNewAttendee({ ...newAttendee, isCurrentStudent: false, studentId: undefined })}
                        className="hidden"
                      />
                      <span className="text-sm font-bold">비재원생</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer transition-colors"
                      style={{
                        borderColor: newAttendee.isCurrentStudent === true ? '#9333ea' : '#e5e7eb',
                        backgroundColor: newAttendee.isCurrentStudent === true ? '#f3e8ff' : '#fff'
                      }}
                    >
                      <input
                        type="radio"
                        name="studentType"
                        checked={newAttendee.isCurrentStudent === true}
                        onChange={() => setNewAttendee({ ...newAttendee, isCurrentStudent: true })}
                        className="hidden"
                      />
                      <span className="text-sm font-bold">재원생</span>
                    </label>
                  </div>

                  {/* 재원생 검색 */}
                  {newAttendee.isCurrentStudent && (
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="학생 이름 검색"
                        className="w-full pl-9 pr-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      {studentSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-purple-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredStudents.length > 0 ? (
                            filteredStudents.slice(0, 10).map((student) => (
                              <button
                                key={student.id}
                                onClick={() => handleStudentSelect(student)}
                                className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b border-gray-100 last:border-0"
                              >
                                <div className="font-bold text-gray-900">{student.name}</div>
                                <div className="text-xs text-gray-500">{student.school && student.grade ? `${student.school} ${student.grade}` : student.id}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                              검색 결과가 없습니다
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={newAttendee.name || ''}
                        onChange={(e) => setNewAttendee({ ...newAttendee, name: e.target.value })}
                        placeholder="이름 *"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        disabled={newAttendee.isCurrentStudent && !!newAttendee.studentId}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="tel"
                        value={newAttendee.phone || ''}
                        onChange={(e) => setNewAttendee({ ...newAttendee, phone: e.target.value })}
                        placeholder="전화번호 *"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* 비재원생 추가 정보 */}
                  {!newAttendee.isCurrentStudent && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newAttendee.gender || ''}
                          onChange={(e) => setNewAttendee({ ...newAttendee, gender: e.target.value as any })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">성별</option>
                          <option value="male">남</option>
                          <option value="female">여</option>
                        </select>
                        <select
                          value={newAttendee.ageGroup || ''}
                          onChange={(e) => setNewAttendee({ ...newAttendee, ageGroup: e.target.value as any })}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">연령대</option>
                          <option value="elementary">초등</option>
                          <option value="middle">중등</option>
                          <option value="high">고등</option>
                          <option value="adult">성인</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={newAttendee.grade || ''}
                        onChange={(e) => setNewAttendee({ ...newAttendee, grade: e.target.value })}
                        placeholder="학년 (예: 초6, 중2)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        value={newAttendee.address || ''}
                        onChange={(e) => setNewAttendee({ ...newAttendee, address: e.target.value })}
                        placeholder="주소 (간략히)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}

                  {/* 신청 정보 */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newAttendee.registrationSource || ''}
                      onChange={(e) => setNewAttendee({ ...newAttendee, registrationSource: e.target.value })}
                      placeholder="신청 경로 (예: 지인소개, 온라인)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newAttendee.parentAttending || false}
                        onChange={(e) => setNewAttendee({ ...newAttendee, parentAttending: e.target.checked })}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <span className="text-sm font-medium">부모 동반 참석</span>
                    </label>
                  </div>

                  {/* 담당 선생님 - 재원생만 표시 */}
                  {newAttendee.isCurrentStudent && (
                    <select
                      value={newAttendee.assignedTeacherId || ''}
                      onChange={(e) => {
                        const teacher = users.find(u => u.uid === e.target.value);
                        setNewAttendee({
                          ...newAttendee,
                          assignedTeacherId: e.target.value,
                          assignedTeacherName: teacher ? teacher.email.split('@')[0] : undefined
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">담당 선생님 선택</option>
                      {users.map((user) => (
                        <option key={user.uid} value={user.uid}>
                          {user.email.split('@')[0]} {user.jobTitle ? `(${user.jobTitle})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* 메모 */}
                  <textarea
                    value={newAttendee.memo || ''}
                    onChange={(e) => setNewAttendee({ ...newAttendee, memo: e.target.value })}
                    placeholder="메모"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />

                  {/* 저장 버튼 */}
                  <button
                    onClick={handleAddAttendee}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors"
                  >
                    참석자 추가
                  </button>
                </div>
              )}

              {/* 참석자 리스트 */}
              {attendees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">등록된 참석자가 없습니다</p>
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAttendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{attendee.name}</span>
                            {attendee.isCurrentStudent && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                                재원생
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{attendee.phone}</div>
                          {attendee.assignedTeacherName && (
                            <div className="text-xs text-purple-600 mt-1">
                              담당: {attendee.assignedTeacherName}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveAttendee(attendee.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {attendee.memo && (
                        <div className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 mt-2">
                          {attendee.memo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              저장
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SeminarPanel;
