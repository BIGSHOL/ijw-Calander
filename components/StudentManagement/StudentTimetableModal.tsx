import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Bus } from 'lucide-react';
import Modal from '../Common/Modal';
import { UnifiedStudent } from '../../types';
import { useClasses } from '../../hooks/useClasses';
import { useShuttle } from '../../hooks/useShuttle';
import {
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
  PeriodInfo,
} from '../Timetable/constants';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../utils/styleUtils';

interface StudentTimetableModalProps {
  student: UnifiedStudent;
  onClose: () => void;
}

/** 요일별 연속 교시를 합친 수업 블록 */
interface ClassBlock {
  className: string;
  subject: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  periodCount: number;
}

// 요일별 색상 (눈에 편한 부드러운 톤)
const DAY_HEADER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '일': { bg: 'bg-rose-50', text: 'text-rose-500', border: 'border-rose-200' },
  '월': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  '화': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  '수': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  '목': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  '금': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  '토': { bg: 'bg-sky-50', text: 'text-sky-500', border: 'border-sky-200' },
};

// 시간 → 분 변환
const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// 분 → "HH:MM" 변환
const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// 5분 = 3px (13:00~23:00 = 600분 = 360px)
const PIXELS_PER_MINUTE = 0.6;

const StudentTimetableModal: React.FC<StudentTimetableModalProps> = ({ student, onClose }) => {
  const { data: allClasses = [] } = useClasses();
  const { busRoutes } = useShuttle();

  // 학생의 셔틀버스 승차 정보 추출
  const shuttleEvents = useMemo(() => {
    const events: Array<{
      day: string;
      time: string;
      busName: string;
      destination: string;
    }> = [];

    busRoutes.forEach(route => {
      route.stops.forEach(stop => {
        stop.boardingStudents.forEach(s => {
          if (s.name === student.name) {
            const days = s.days ? s.days.replace(/[,\s]/g, '').split('') : [];
            days.forEach(day => {
              events.push({ day, time: stop.time, busName: route.busName, destination: stop.destination });
            });
          }
        });
      });
    });

    return events;
  }, [busRoutes, student.name]);

  // 요일별 수업 블록 (연속 교시 합침)
  const { dayBlocks, activeDays } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const dayBlocks: Record<string, ClassBlock[]> = {};
    const activeDays = new Set<string>();

    const activeEnrollments = (student.enrollments || []).filter(e => {
      const hasEnded = !!(e as any).endDate;
      const startDate = (e as any).startDate;
      const hasStarted = !startDate || startDate <= today;
      return !hasEnded && hasStarted;
    });

    // 1단계: 요일+수업별 교시 수집
    const dayClassPeriods: Record<string, Record<string, {
      subject: string; teacher: string; room: string;
      periods: Array<{ id: string; startTime: string; endTime: string }>;
    }>> = {};

    activeEnrollments.forEach(enrollment => {
      const actualClass = allClasses.find(
        c => c.className === enrollment.className && c.subject === enrollment.subject
      );
      if (!actualClass?.schedule) return;

      const studentDays = (enrollment as any).attendanceDays?.length > 0
        ? (enrollment as any).attendanceDays as string[]
        : null;

      actualClass.schedule.forEach(slot => {
        const parts = slot.split(' ');
        const day = parts[0];
        const periodId = parts[1];
        if (!day || !periodId) return;
        if (studentDays && !studentDays.includes(day)) return;

        const isWeekend = day === '토' || day === '일';
        const periodInfo: Record<string, PeriodInfo> = isWeekend
          ? WEEKEND_PERIOD_INFO
          : enrollment.subject === 'english'
          ? ENGLISH_PERIOD_INFO
          : MATH_PERIOD_INFO;

        const period = periodInfo[periodId];
        if (!period) return;

        activeDays.add(day);

        const slotKey = `${day}${periodId}`;
        const room = actualClass.slotRooms?.[slotKey] || actualClass.room || '';

        if (!dayClassPeriods[day]) dayClassPeriods[day] = {};
        const classKey = `${enrollment.subject}_${enrollment.className}`;
        if (!dayClassPeriods[day][classKey]) {
          dayClassPeriods[day][classKey] = {
            subject: enrollment.subject,
            teacher: actualClass.teacher || '',
            room,
            periods: [],
          };
        }
        dayClassPeriods[day][classKey].periods.push({
          id: periodId,
          startTime: period.startTime,
          endTime: period.endTime,
        });
      });
    });

    // 2단계: 각 수업의 교시를 시간순 정렬 → 블록으로 합침
    for (const [day, classes] of Object.entries(dayClassPeriods)) {
      const blocks: ClassBlock[] = [];

      for (const [classKey, info] of Object.entries(classes)) {
        // 시간순 정렬
        info.periods.sort((a, b) => a.startTime.localeCompare(b.startTime));

        // 연속 교시 합치기
        let blockStart = info.periods[0].startTime;
        let blockEnd = info.periods[0].endTime;
        let count = 1;

        for (let i = 1; i < info.periods.length; i++) {
          const prev = info.periods[i - 1];
          const curr = info.periods[i];
          if (prev.endTime === curr.startTime || prev.endTime >= curr.startTime) {
            blockEnd = curr.endTime;
            count++;
          } else {
            blocks.push({
              className: classKey.split('_').slice(1).join('_'),
              subject: info.subject,
              teacher: info.teacher,
              room: info.room,
              startTime: blockStart,
              endTime: blockEnd,
              periodCount: count,
            });
            blockStart = curr.startTime;
            blockEnd = curr.endTime;
            count = 1;
          }
        }
        blocks.push({
          className: classKey.split('_').slice(1).join('_'),
          subject: info.subject,
          teacher: info.teacher,
          room: info.room,
          startTime: blockStart,
          endTime: blockEnd,
          periodCount: count,
        });
      }

      blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
      dayBlocks[day] = blocks;
    }

    return { dayBlocks, activeDays };
  }, [student.enrollments, allClasses]);

  // 강의실 이동 감지 (블록 기반, 1시간 갭까지 허용)
  const roomChanges = useMemo(() => {
    const changes: Array<{
      day: string;
      fromClass: string;
      fromRoom: string;
      fromEndTime: string;
      toClass: string;
      toRoom: string;
      toStartTime: string;
    }> = [];

    for (const [day, blocks] of Object.entries(dayBlocks)) {
      const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];

        // 다른 반 + 다른 강의실 + 갭이 60분 이내
        const gap = timeToMinutes(next.startTime) - timeToMinutes(curr.endTime);
        if (curr.className !== next.className && curr.room && next.room && curr.room !== next.room && gap <= 60) {
          changes.push({
            day,
            fromClass: curr.className,
            fromRoom: curr.room,
            fromEndTime: curr.endTime,
            toClass: next.className,
            toRoom: next.room,
            toStartTime: next.startTime,
          });
        }
      }
    }

    return changes;
  }, [dayBlocks]);

  const dayOrder = ['일', '월', '화', '수', '목', '금', '토'];
  const sortedDays = dayOrder; // 모든 요일 항상 표시
  const hasClasses = activeDays.size > 0; // 실제 수업이 있는 요일이 있을 때만

  // 시간 범위 계산 (30분 단위로 반올림/반내림)
  const { rangeStartMin, timeLabels, totalHeight } = useMemo(() => {
    if (!hasClasses) return { rangeStartMin: 0, timeLabels: [], totalHeight: 0 };

    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const blocks of Object.values(dayBlocks)) {
      for (const block of blocks) {
        const start = timeToMinutes(block.startTime);
        const end = timeToMinutes(block.endTime);
        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;
      }
    }

    // 고정 범위: 13:00 ~ 23:00
    const rangeStartMin = 13 * 60; // 780
    const rangeEndMin = 23 * 60;   // 1380

    // 시간 라벨 생성 (1시간 간격)
    const timeLabels: Array<{ time: string; minutes: number; isHour: boolean }> = [];
    for (let m = rangeStartMin; m <= rangeEndMin; m += 60) {
      timeLabels.push({
        time: minutesToTime(m),
        minutes: m,
        isHour: true,
      });
    }

    const totalHeight = (rangeEndMin - rangeStartMin) * PIXELS_PER_MINUTE;

    return { rangeStartMin, rangeEndMin, timeLabels, totalHeight };
  }, [dayBlocks, hasClasses]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${student.name} 시간표`}
      size="lg"
      compact
    >
      {!hasClasses ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          수강 중인 수업이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {/* 시간표 그리드 - 시간 기반 */}
          <div className="border rounded-sm overflow-hidden">
            {/* 요일 헤더 */}
            <div className="flex border-b border-gray-200">
              <div className="w-14 flex-shrink-0 bg-gray-50 border-r border-gray-200 px-1 py-1.5 text-center">
                <span className="text-xxs font-bold text-gray-500">시간</span>
              </div>
              {sortedDays.map(day => {
                let colors = DAY_HEADER_COLORS[day] || { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
                // 토요일: 수업이 있으면 평일과 동일한 색상
                if (day === '토' && activeDays.has('토')) {
                  colors = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
                }
                return (
                  <div
                    key={day}
                    className={`flex-1 ${colors.bg} ${colors.text} px-2 py-1.5 text-center font-bold text-xs border-r last:border-r-0 border-gray-200`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>

            {/* 시간축 + 수업 블록 */}
            <div className="flex relative" style={{ height: `${totalHeight}px` }}>
              {/* 시간 열 */}
              <div className="w-14 flex-shrink-0 relative bg-gray-50 border-r border-gray-200">
                {timeLabels.map(label => {
                  const top = (label.minutes - rangeStartMin) * PIXELS_PER_MINUTE;
                  return (
                    <div
                      key={label.time}
                      className="absolute left-0 right-0 flex items-start"
                      style={{ top: `${top}px` }}
                    >
                      <span
                        className={`text-xxs px-1 -translate-y-1/2 ${
                          label.isHour ? 'font-bold text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        {label.time}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 요일 컬럼 */}
              {sortedDays.map(day => {
                const blocks = dayBlocks[day] || [];
                const hasBlocks = activeDays.has(day);
                // 일요일: 항상 진한 회색, 토요일: 수업 없을 때만 진한 회색
                const columnBg = day === '일' ? 'bg-gray-200/70'
                  : day === '토' && !hasBlocks ? 'bg-gray-200/70'
                  : '';

                return (
                  <div
                    key={day}
                    className={`flex-1 relative border-r last:border-r-0 border-gray-200 ${columnBg}`}
                  >
                    {/* 시간선 (가로) */}
                    {timeLabels.map(label => {
                      const top = (label.minutes - rangeStartMin) * PIXELS_PER_MINUTE;
                      return (
                        <div
                          key={label.time}
                          className={`absolute left-0 right-0 ${
                            label.isHour ? 'border-t border-gray-200' : 'border-t border-gray-100 border-dashed'
                          }`}
                          style={{ top: `${top}px` }}
                        />
                      );
                    })}

                    {/* 수업 블록 */}
                    {blocks.map((block, idx) => {
                      const startMin = timeToMinutes(block.startTime);
                      const endMin = timeToMinutes(block.endTime);
                      const top = (startMin - rangeStartMin) * PIXELS_PER_MINUTE;
                      const height = (endMin - startMin) * PIXELS_PER_MINUTE;
                      const subjectColor = SUBJECT_COLORS[block.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
                      const isShort = height < 60;

                      return (
                        <div
                          key={`${block.className}-${idx}`}
                          className="absolute left-0.5 right-0.5 rounded-sm overflow-hidden z-10 shadow-sm"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            backgroundColor: subjectColor.light,
                            borderLeft: `3px solid ${subjectColor.bg}`,
                          }}
                        >
                          <div className={`px-1.5 h-full flex flex-col ${isShort ? 'py-0 justify-center' : 'py-1'}`}>
                            <div
                              className="font-bold text-xxs truncate leading-tight"
                              style={{ color: subjectColor.text === '#ffffff' ? subjectColor.border : subjectColor.text }}
                            >
                              {block.className}
                            </div>
                            {!isShort && (
                              <>
                                <div className="text-micro font-medium text-gray-500 mt-0.5">
                                  {block.startTime} ~ {block.endTime}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {block.room && (
                                    <span className="text-micro text-gray-400">{block.room}</span>
                                  )}
                                  {block.teacher && (
                                    <span className="text-micro text-gray-400">| {block.teacher}</span>
                                  )}
                                </div>
                              </>
                            )}
                            {isShort && (
                              <div className="text-micro text-gray-400 truncate">
                                {block.startTime}~{block.endTime}
                                {block.room && ` · ${block.room}`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 셔틀버스 승하차 표시 */}
                    {shuttleEvents
                      .filter(e => e.day === day)
                      .map((e, ei) => {
                        const eventMin = timeToMinutes(e.time);
                        const top = (eventMin - rangeStartMin) * PIXELS_PER_MINUTE;
                        return (
                          <div
                            key={`shuttle-${ei}`}
                            className="absolute left-0 right-0 z-20 flex items-center justify-center"
                            style={{ top: `${top - 10}px` }}
                          >
                            <div className="bg-blue-500 text-white text-micro px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                              <Bus size={8} />
                              <span>승차 {e.time}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 수업 요약 */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(
              (student.enrollments || [])
                .filter(e => {
                  const today = new Date().toISOString().split('T')[0];
                  return !(e as any).endDate && (!(e as any).startDate || (e as any).startDate <= today);
                })
                .reduce((acc, e) => {
                  const key = `${e.subject}_${e.className}`;
                  if (!acc[key]) {
                    const actualClass = allClasses.find(c => c.className === e.className && c.subject === e.subject);
                    acc[key] = {
                      className: e.className,
                      subject: e.subject,
                      teacher: actualClass?.teacher || '',
                      room: actualClass?.room || '',
                    };
                  }
                  return acc;
                }, {} as Record<string, { className: string; subject: string; teacher: string; room: string }>)
            ).map(([key, info]) => {
              const subjectColor = SUBJECT_COLORS[info.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1 px-2 py-1 rounded-sm border text-xxs"
                  style={{ borderColor: subjectColor.border, backgroundColor: subjectColor.light }}
                >
                  <span
                    className="px-1 py-0.5 rounded-sm font-bold text-micro"
                    style={{ backgroundColor: subjectColor.bg, color: subjectColor.text }}
                  >
                    {SUBJECT_LABELS[info.subject as keyof typeof SUBJECT_LABELS] || info.subject}
                  </span>
                  <span className="font-medium">{info.className}</span>
                  {info.teacher && <span className="text-gray-400">| {info.teacher}</span>}
                  {info.room && <span className="text-gray-400">| {info.room}</span>}
                </div>
              );
            })}
          </div>

          {/* 강의실 이동 알림 */}
          {roomChanges.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-bold text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                강의실 이동 안내
              </div>
              {roomChanges.map((change, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xxs text-amber-800">
                  <span className="font-bold px-1 py-0.5 bg-amber-100 rounded-sm">{change.day}</span>
                  <span>{change.fromClass}</span>
                  <span className="font-mono text-amber-600">({change.fromRoom})</span>
                  <ArrowRight className="w-3 h-3 text-amber-500" />
                  <span>{change.toClass}</span>
                  <span className="font-mono text-amber-600">({change.toRoom})</span>
                  <span className="text-amber-500 ml-auto">
                    {change.fromEndTime} → {change.toStartTime}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 셔틀버스 이용 안내 */}
          {shuttleEvents.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 space-y-1.5">
              <div className="flex items-center gap-1 text-xs font-bold text-blue-700">
                <Bus className="w-3.5 h-3.5" />
                셔틀버스 이용
              </div>
              {[...shuttleEvents].sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)).map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xxs text-blue-800">
                  <span className="font-bold px-1 py-0.5 bg-blue-100 rounded-sm">{e.day}</span>
                  <span className="px-1 py-0.5 rounded-sm text-white text-micro font-bold bg-blue-500">승차</span>
                  <span className="font-bold">{e.time}</span>
                  <span className="text-blue-500">{e.busName}</span>
                  {e.destination && <span className="text-blue-400">· {e.destination}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default StudentTimetableModal;
