import React, { useState, useRef, useCallback, useMemo } from 'react';
import { X, Download, Loader2, Image as ImageIcon, CheckSquare, Square, Users, Settings, Eye, FileSpreadsheet } from 'lucide-react';
import { addDays, format } from 'date-fns';
import html2canvas from 'html2canvas';
import { Teacher, ClassKeywordColor } from '../../../types';
import { EN_PERIODS, EN_WEEKDAYS, getCellKey, getTeacherColor, getContrastColor, formatClassNameWithBreaks } from './englishUtils';

interface ScheduleCell {
  className?: string;
  classId?: string;
  room?: string;
  teacher?: string;
  note?: string;
  merged?: { className: string; room?: string; underline?: boolean }[];
  underline?: boolean;
}

type ScheduleData = Record<string, ScheduleCell>;

interface EnglishExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: string[];
  teachersData: Teacher[];
  scheduleData: ScheduleData;
  visibleWeekdays: Set<string>;
  classKeywords?: ClassKeywordColor[];  // 키워드별 색상 설정
  currentWeekStart?: Date;  // 주차 시작일 (날짜 표시용)
}

const EnglishExportModal: React.FC<EnglishExportModalProps> = ({
  isOpen,
  onClose,
  teachers,
  teachersData,
  scheduleData,
  visibleWeekdays,
  classKeywords = [],
  currentWeekStart
}) => {
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set(teachers));
  // 내보내기용 요일 선택 (초기값: 현재 보이는 요일)
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<string>>(new Set(visibleWeekdays));
  const [isExporting, setIsExporting] = useState(false);
  const [currentExporting, setCurrentExporting] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const filteredWeekdays = EN_WEEKDAYS.filter(day => selectedWeekdays.has(day));
  const previewRef = useRef<HTMLDivElement>(null);

  // 요일별 날짜 계산 (2/9 형식)
  const weekDates = useMemo(() => {
    if (!currentWeekStart) return {};
    const dayToIndex: Record<string, number> = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
    const dates: Record<string, string> = {};
    EN_WEEKDAYS.forEach(day => {
      const idx = dayToIndex[day];
      if (idx !== undefined) {
        const date = addDays(currentWeekStart, idx);
        dates[day] = format(date, 'M/d');
      }
    });
    return dates;
  }, [currentWeekStart]);

  // 키워드 색상 매칭 함수
  const getKeywordColor = useCallback((className: string | undefined) => {
    if (!className || classKeywords.length === 0) return null;
    return classKeywords.find(kw => className.includes(kw.keyword)) || null;
  }, [classKeywords]);

  const toggleWeekday = (day: string) => {
    setSelectedWeekdays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        // 최소 1개는 선택되어야 함
        if (newSet.size > 1) {
          newSet.delete(day);
        }
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  const selectAllWeekdays = () => setSelectedWeekdays(new Set(EN_WEEKDAYS));
  const selectWeekdaysOnly = () => setSelectedWeekdays(new Set(['월', '화', '수', '목', '금']));

  const toggleTeacher = (teacher: string) => {
    setSelectedTeachers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teacher)) {
        newSet.delete(teacher);
      } else {
        newSet.add(teacher);
      }
      return newSet;
    });
  };

  const selectAll = () => setSelectedTeachers(new Set(teachers));
  const selectNone = () => setSelectedTeachers(new Set());

  // 강사 시간표 미리보기 컴포넌트 (html2canvas 캡처용)
  const TeacherSchedulePreview: React.FC<{ teacher: string }> = ({ teacher }) => {
    const colors = getTeacherColor(teacher, teachersData);
    const teacherData = teachersData.find(t => t.name === teacher);
    const displayName = teacherData?.englishName || teacher;

    return (
      <div className="bg-white p-4" style={{ width: 'fit-content' }}>
        {/* 강사명 헤더 */}
        <div
          className="text-center py-3 px-6 mb-2 rounded font-bold text-lg"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {displayName}
        </div>

        {/* 시간표 테이블 */}
        <table className="border-collapse" style={{ borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="p-2 bg-gray-50 border border-gray-300 text-xs font-bold text-gray-600 text-center w-20">
                교시
              </th>
              {filteredWeekdays.map(day => (
                <th
                  key={day}
                  className="p-2 bg-gray-100 border border-gray-300 text-xs font-bold text-gray-700 text-center w-24"
                >
                  {weekDates[day] ? `${weekDates[day]} (${day})` : day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EN_PERIODS.map(period => (
              <tr key={period.id}>
                {/* 교시 컬럼 */}
                <td className="p-2 bg-gray-50 border border-gray-300 text-center w-20">
                  <div className="text-xs font-bold text-gray-700">{period.label}</div>
                  <div className="text-[10px] text-gray-400">{period.time}</div>
                  {period.weekendTime && (
                    <div className="text-[10px] text-blue-500">토일 {period.weekendTime}</div>
                  )}
                </td>

                {/* 요일별 셀 */}
                {filteredWeekdays.map(day => {
                  const cellKey = getCellKey(teacher, period.id, day);
                  const cellData = scheduleData[cellKey];
                  const matchedKw = getKeywordColor(cellData?.className);

                  const cellBgColor = matchedKw?.bgColor || (cellData?.className ? '#f0fdf4' : '#ffffff');
                  const cellTextColor = matchedKw ? getContrastColor(matchedKw.bgColor) : '#1f2937';

                  return (
                    <td
                      key={`${period.id}-${day}`}
                      className="border border-gray-300 w-24 h-16 relative"
                      style={{ backgroundColor: cellBgColor, verticalAlign: 'middle' }}
                    >
                      {cellData?.className && (
                        <div className="flex flex-col items-center justify-center h-full p-1">
                          {/* 수업명 */}
                          <div
                            className="text-xs font-bold text-center leading-tight"
                            style={{ color: cellTextColor }}
                          >
                            {formatClassNameWithBreaks(cellData.className).map((part, idx) => (
                              <React.Fragment key={idx}>
                                {part}
                                {idx < formatClassNameWithBreaks(cellData.className).length - 1 && <br />}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* 강의실 */}
                          {cellData.room && (
                            <>
                              <div className="w-4/5 border-t border-gray-300 my-1"></div>
                              <div
                                className="text-[10px] font-medium"
                                style={{ color: matchedKw ? cellTextColor : '#6B7280' }}
                              >
                                {cellData.room}
                              </div>
                            </>
                          )}

                          {/* 합반 배지 */}
                          {cellData.merged && cellData.merged.length > 0 && (
                            <div className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold px-1 rounded">
                              +{cellData.merged.length}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // 강사별 이미지 다운로드 (html2canvas 사용)
  const downloadTeacherImage = useCallback(async (teacher: string): Promise<void> => {
    const previewContainer = previewRef.current;
    if (!previewContainer) return;

    // 현재 내보내기 중인 강사의 시간표 요소 찾기
    const teacherElement = previewContainer.querySelector(`[data-teacher="${teacher}"]`) as HTMLElement;
    if (!teacherElement) return;

    try {
      // html2canvas로 DOM 캡처
      const canvas = await html2canvas(teacherElement, {
        backgroundColor: '#ffffff',
        scale: 2, // 고해상도를 위해 2배 스케일
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      // PNG로 다운로드
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `영어시간표_${teacher}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          // 다음 다운로드 전 딜레이 (브라우저 차단 방지)
          setTimeout(resolve, 500);
        }, 'image/png');
      });
    } catch (error) {
      console.error('html2canvas 캡처 실패:', error);
    }
  }, []);

  // 선택된 강사들 순차 내보내기
  const handleExport = useCallback(async () => {
    const teachersToExport = Array.from(selectedTeachers);
    if (teachersToExport.length === 0) return;

    setIsExporting(true);
    setProgress({ current: 0, total: teachersToExport.length });

    for (let i = 0; i < teachersToExport.length; i++) {
      const teacher = teachersToExport[i];
      setCurrentExporting(teacher);
      setProgress({ current: i + 1, total: teachersToExport.length });
      await downloadTeacherImage(teacher);
    }

    setIsExporting(false);
    setCurrentExporting(null);
    onClose();
  }, [selectedTeachers, downloadTeacherImage, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={!isExporting ? onClose : undefined}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-sm shadow-2xl w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-sm">
              <ImageIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">영어 시간표 내보내기</h2>
              <p className="text-sm text-gray-500">강사별 개별 이미지로 저장</p>
            </div>
          </div>
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-2 rounded-sm hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-auto p-4">
          {isExporting ? (
            /* 내보내기 진행 중 */
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <p className="text-gray-700 font-medium">
                {currentExporting} 선생님 시간표 저장 중...
              </p>
              <p className="text-sm text-gray-500">
                {progress.current} / {progress.total} 완료
              </p>
              <div className="w-full max-w-xs bg-gray-200 rounded-sm h-2">
                <div
                  className="bg-blue-600 h-2 rounded-sm transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Section 1: 내보내기 옵션 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Settings className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">내보내기 옵션</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {/* 파일 형식 */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">파일 형식</span>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <FileSpreadsheet size={14} className="text-blue-600" />
                      <span>PNG 이미지 (강사별 개별 파일)</span>
                    </div>
                  </div>

                  {/* 요일 필터 */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <span className="w-16 shrink-0 text-xs font-medium text-[#373d41]">요일 선택</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {EN_WEEKDAYS.map(day => {
                          const isSelected = selectedWeekdays.has(day);
                          return (
                            <button
                              key={day}
                              onClick={() => toggleWeekday(day)}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={selectAllWeekdays}
                          className="text-xxs text-blue-600 hover:underline"
                        >
                          전체
                        </button>
                        <span className="text-xxs text-gray-300">|</span>
                        <button
                          onClick={selectWeekdaysOnly}
                          className="text-xxs text-blue-600 hover:underline"
                        >
                          평일만
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: 포함할 데이터 (강사 선택) */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <CheckSquare className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">포함할 데이터</h3>
                </div>
                <div className="p-2">
                  {/* 전체 선택/해제 */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Users size={14} />
                      <span>{selectedTeachers.size}명 선택됨</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAll}
                        className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-sm hover:bg-blue-100 transition-colors"
                      >
                        전체 선택
                      </button>
                      <button
                        onClick={selectNone}
                        className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-sm hover:bg-gray-200 transition-colors"
                      >
                        선택 해제
                      </button>
                    </div>
                  </div>

                  {/* 강사 목록 */}
                  <div className="grid grid-cols-2 gap-2">
                    {teachers.map(teacher => {
                      const isSelected = selectedTeachers.has(teacher);
                      const colors = getTeacherColor(teacher, teachersData);
                      const teacherData = teachersData.find(t => t.name === teacher);
                      const displayName = teacherData?.englishName || teacher;

                      return (
                        <button
                          key={teacher}
                          onClick={() => toggleTeacher(teacher)}
                          className={`flex items-center gap-2 p-2 rounded-sm border transition-all ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} className="text-blue-600 flex-shrink-0" />
                          ) : (
                            <Square size={16} className="text-gray-400 flex-shrink-0" />
                          )}
                          <div
                            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: colors.bg }}
                          />
                          <span className={`text-xs font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                            {displayName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Section 3: 미리보기 */}
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                  <Eye className="w-3 h-3 text-[#081429]" />
                  <h3 className="text-[#081429] font-bold text-xs">미리보기</h3>
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-[#373d41] font-medium">선택 강사</span>
                      <span className="text-gray-700">{selectedTeachers.size}명</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-[#373d41] font-medium">파일 개수</span>
                      <span className="text-gray-700">{selectedTeachers.size}개 PNG 파일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 text-[#373d41] font-medium">포함 내용</span>
                      <span className="text-gray-700">수업명, 강의실, 합반 정보</span>
                    </div>
                    {selectedTeachers.size === 0 && (
                      <p className="text-xs text-red-500 mt-2">
                        최소 1명 이상의 강사를 선택해주세요.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: 작업 (푸터) */}
        {!isExporting && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors font-medium"
            >
              취소
            </button>
            <button
              onClick={handleExport}
              disabled={selectedTeachers.size === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Download size={18} />
              {selectedTeachers.size}명 내보내기
            </button>
          </div>
        )}
      </div>

      {/* 숨겨진 미리보기 (html2canvas 캡처용) */}
      <div
        ref={previewRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {Array.from(selectedTeachers).map(teacher => (
          <div key={teacher} data-teacher={teacher}>
            <TeacherSchedulePreview teacher={teacher} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnglishExportModal;
