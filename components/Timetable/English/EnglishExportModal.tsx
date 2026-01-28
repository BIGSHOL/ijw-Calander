import React, { useState, useRef, useCallback } from 'react';
import { X, Download, Loader2, Image as ImageIcon, CheckSquare, Square, Users } from 'lucide-react';
import { Teacher } from '../../../types';
import { EN_PERIODS, EN_WEEKDAYS, getCellKey, getTeacherColor } from './englishUtils';

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
}

const EnglishExportModal: React.FC<EnglishExportModalProps> = ({
  isOpen,
  onClose,
  teachers,
  teachersData,
  scheduleData,
  visibleWeekdays
}) => {
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set(teachers));
  const [isExporting, setIsExporting] = useState(false);
  const [currentExporting, setCurrentExporting] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const filteredWeekdays = EN_WEEKDAYS.filter(day => visibleWeekdays.has(day));

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

  // 단일 강사 시간표를 캔버스에 그리기
  const renderTeacherSchedule = useCallback(async (
    teacher: string,
    canvas: HTMLCanvasElement
  ): Promise<void> => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = getTeacherColor(teacher, teachersData);
    const teacherData = teachersData.find(t => t.name === teacher);
    const displayName = teacherData?.englishName || teacher;

    // 설정
    const cellWidth = 80;
    const cellHeight = 50;
    const headerHeight = 60;
    const periodColWidth = 70;
    const padding = 20;

    const cols = filteredWeekdays.length;
    const rows = EN_PERIODS.length;

    canvas.width = periodColWidth + cols * cellWidth + padding * 2;
    canvas.height = headerHeight + rows * cellHeight + padding * 2;

    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 폰트 설정
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 강사명 헤더
    ctx.fillStyle = colors.bg;
    ctx.fillRect(padding, padding, canvas.width - padding * 2, headerHeight - 10);
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 16px "Malgun Gothic", sans-serif';
    ctx.fillText(displayName, canvas.width / 2, padding + (headerHeight - 10) / 2);

    // 요일 헤더
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(padding + periodColWidth, padding + headerHeight - 10, cols * cellWidth, 30);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px "Malgun Gothic", sans-serif';
    filteredWeekdays.forEach((day, idx) => {
      const x = padding + periodColWidth + idx * cellWidth + cellWidth / 2;
      const y = padding + headerHeight - 10 + 15;
      ctx.fillText(day, x, y);
    });

    // 교시 및 셀 그리기
    EN_PERIODS.forEach((period, pIdx) => {
      const y = padding + headerHeight + 20 + pIdx * cellHeight;

      // 교시 컬럼
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(padding, y, periodColWidth, cellHeight);
      ctx.strokeStyle = '#e5e7eb';
      ctx.strokeRect(padding, y, periodColWidth, cellHeight);
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 11px "Malgun Gothic", sans-serif';
      ctx.fillText(period.label, padding + periodColWidth / 2, y + cellHeight / 2 - 8);
      ctx.font = '9px "Malgun Gothic", sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(period.time, padding + periodColWidth / 2, y + cellHeight / 2 + 8);

      // 요일별 셀
      filteredWeekdays.forEach((day, dIdx) => {
        const x = padding + periodColWidth + dIdx * cellWidth;
        const cellKey = getCellKey(teacher, period.id, day);
        const cellData = scheduleData[cellKey];

        // 셀 배경
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, cellWidth, cellHeight);
        ctx.strokeStyle = '#e5e7eb';
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // 수업 정보
        if (cellData?.className) {
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 10px "Malgun Gothic", sans-serif';

          // 수업명 (줄바꿈 처리)
          const className = cellData.className;
          const maxWidth = cellWidth - 8;
          let displayText = className;
          if (ctx.measureText(className).width > maxWidth) {
            displayText = className.substring(0, 6) + '..';
          }
          ctx.fillText(displayText, x + cellWidth / 2, y + cellHeight / 2 - 8);

          // 강의실
          if (cellData.room) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '9px "Malgun Gothic", sans-serif';
            ctx.fillText(cellData.room, x + cellWidth / 2, y + cellHeight / 2 + 8);
          }

          // 합반 표시
          if (cellData.merged && cellData.merged.length > 0) {
            ctx.fillStyle = '#3b82f6';
            ctx.font = 'bold 8px "Malgun Gothic", sans-serif';
            ctx.fillText(`+${cellData.merged.length}`, x + cellWidth - 12, y + 10);
          }
        }
      });
    });
  }, [filteredWeekdays, scheduleData, teachersData]);

  // 강사별 이미지 다운로드
  const downloadTeacherImage = useCallback(async (teacher: string): Promise<void> => {
    const canvas = document.createElement('canvas');
    await renderTeacherSchedule(teacher, canvas);

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
  }, [renderTeacherSchedule]);

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExporting ? onClose : undefined}
      />

      {/* 모달 컨텐츠 */}
      <div className="relative bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
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
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* 강사 선택 */}
        <div className="flex-1 overflow-auto p-4">
          {isExporting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <p className="text-gray-700 font-medium">
                {currentExporting} 선생님 시간표 저장 중...
              </p>
              <p className="text-sm text-gray-500">
                {progress.current} / {progress.total} 완료
              </p>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* 전체 선택/해제 */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users size={16} />
                  <span>{selectedTeachers.size}명 선택됨</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    전체 선택
                  </button>
                  <button
                    onClick={selectNone}
                    className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-600 flex-shrink-0" />
                      ) : (
                        <Square size={18} className="text-gray-400 flex-shrink-0" />
                      )}
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colors.bg }}
                      />
                      <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        {!isExporting && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              취소
            </button>
            <button
              onClick={handleExport}
              disabled={selectedTeachers.size === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Download size={18} />
              {selectedTeachers.size}명 내보내기
            </button>
          </div>
        )}
      </div>

      {/* 숨겨진 캔버스 */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default EnglishExportModal;
