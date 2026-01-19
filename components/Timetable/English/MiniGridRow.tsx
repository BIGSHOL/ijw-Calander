import { EN_WEEKDAYS, getTeacherColor, EnglishPeriod } from './englishUtils';
import { Teacher } from '../../../types';
import { ScheduleCell } from './hooks/useEnglishClasses';

interface MiniGridRowProps {
    period: EnglishPeriod;
    scheduleMap: Record<string, Record<string, ScheduleCell>>;
    weekendShift: number;
    teachersData: Teacher[];
    displayDays: string[];
    hiddenTeachers?: string[];
    hideTime?: boolean;
    onlyTime?: boolean;
}


const MiniGridRow: React.FC<MiniGridRowProps> = ({
    period,
    scheduleMap,
    weekendShift,
    teachersData,
    displayDays,
    hiddenTeachers,
    hideTime = false,
    onlyTime = false
}) => {
    // Parse time for display (e.g. 14:20~15:00 -> 14:20 \n ~15:00)
    const [start, end] = period.time.split('~');

    return (
        <div className="flex border-b border-gray-100 h-[24px]">
            {/* Period Label - Time Only */}
            {!hideTime && (
                <div className="w-[48px] border-r border-gray-100 flex flex-col items-center justify-center bg-gray-50 shrink-0 leading-tight py-0.5">
                    <span className="text-micro font-bold text-gray-700 tracking-tighter">{start}</span>
                    <span className="text-micro text-gray-500 tracking-tighter">~{end}</span>
                </div>
            )}

            {/* Days */}
            {!onlyTime && displayDays.map(day => {
                const dayIndex = EN_WEEKDAYS.indexOf(day as any);
                const isWeekend = dayIndex >= 5;

                // Shift Logic for Lookup
                // If this is a weekend column, do we look up "shifted" period?
                // academy-app:
                // if (isWeekend && weekendShift > 0) effectivePeriodId = shifted...
                // This means the ROW represents Period P. 
                // Using Weekend Shift = 4...
                // At Row 5, we look up Period 1 data for the Weekend column.

                let effectivePeriodId = period.id;
                if (isWeekend && weekendShift > 0) {
                    const currentNum = parseInt(period.id, 10);
                    if (!isNaN(currentNum)) {
                        const shiftedNum = currentNum - weekendShift;
                        effectivePeriodId = String(shiftedNum) as any;
                    }
                }

                // Note: scheduleMap structure is Map[periodId][day] -> Cell
                // So we just access correct period key
                const cell = scheduleMap[effectivePeriodId]?.[day];

                // Get style based on teacher
                let teacherStyle = {};
                const isHidden = cell?.teacher && hiddenTeachers?.includes(cell.teacher);

                // Get display name (영어 이름 우선)
                const teacherData = cell?.teacher ? teachersData.find(t => t.name === cell.teacher) : null;
                const displayName = teacherData?.englishName || cell?.teacher || '';

                if (cell?.teacher && !isHidden) {
                    const colors = getTeacherColor(cell.teacher, teachersData);
                    // If underline is enabled, override color with blue
                    if (cell.underline) {
                        teacherStyle = { backgroundColor: colors.bg, color: '#2563eb' };
                    } else {
                        teacherStyle = { backgroundColor: colors.bg, color: colors.text };
                    }
                }

                return (
                    <div
                        key={day}
                        className="flex-1 border-r border-gray-100 last:border-r-0 flex flex-col justify-center items-center text-center px-0.5 overflow-hidden text-xxs"
                        style={teacherStyle}
                        title={displayName}
                    >
                        {cell && !isHidden && (
                            <span className={`leading-tight line-clamp-2 break-all ${cell.underline ? 'underline italic' : ''}`}>
                                {displayName.slice(0, 4)}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default MiniGridRow;
