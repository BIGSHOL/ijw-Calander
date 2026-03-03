import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Send, Search, Loader2, AlertCircle,
  CheckCircle, Calendar, Eye, X,
  Bus, Square, CheckSquare,
} from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { useClasses } from '../../hooks/useClasses';
import { useShuttle } from '../../hooks/useShuttle';
import { UnifiedStudent } from '../../types';
import {
  MATH_PERIOD_INFO,
  ENGLISH_PERIOD_INFO,
  WEEKEND_PERIOD_INFO,
  PeriodInfo,
} from '../Timetable/constants';
import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../utils/styleUtils';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ─── Types ───────────────────────────────────────────────
interface ClassBlock {
  className: string;
  subject: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  periodCount: number;
}

type StudentStatus = 'idle' | 'capturing' | 'sending' | 'success' | 'error';

interface StudentDistResult {
  status: StudentStatus;
  message?: string;
}

// ─── Constants ───────────────────────────────────────────
const DAY_ORDER = ['일', '월', '화', '수', '목', '금', '토'];
const PIXELS_PER_MINUTE_IMG = 0.6;
const BATCH_SIZE = 15;

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// ─── Build timetable data (from StudentTimetableModal) ───
function buildStudentTimetable(student: UnifiedStudent, allClasses: any[]) {
  const today = new Date().toISOString().split('T')[0];
  const dayBlocks: Record<string, ClassBlock[]> = {};
  const activeDays = new Set<string>();

  const activeEnrollments = (student.enrollments || []).filter(e => {
    const hasEnded = !!(e as any).endDate;
    const startDate = (e as any).startDate;
    const hasStarted = !startDate || startDate <= today;
    return !hasEnded && hasStarted;
  });

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

    actualClass.schedule.forEach((slot: string) => {
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

  for (const [day, classes] of Object.entries(dayClassPeriods)) {
    const blocks: ClassBlock[] = [];
    for (const [classKey, info] of Object.entries(classes)) {
      info.periods.sort((a, b) => a.startTime.localeCompare(b.startTime));
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
            subject: info.subject, teacher: info.teacher, room: info.room,
            startTime: blockStart, endTime: blockEnd, periodCount: count,
          });
          blockStart = curr.startTime;
          blockEnd = curr.endTime;
          count = 1;
        }
      }
      blocks.push({
        className: classKey.split('_').slice(1).join('_'),
        subject: info.subject, teacher: info.teacher, room: info.room,
        startTime: blockStart, endTime: blockEnd, periodCount: count,
      });
    }
    blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    dayBlocks[day] = blocks;
  }

  return { dayBlocks, activeDays };
}

// ─── Timetable Image Renderer (inline styles for html-to-image) ───
const TimetableImageRenderer: React.FC<{
  student: UnifiedStudent;
  allClasses: any[];
  busRoutes: any[];
  reportDate: string;
}> = ({ student, allClasses, busRoutes, reportDate }) => {
  const { dayBlocks, activeDays } = useMemo(
    () => buildStudentTimetable(student, allClasses),
    [student, allClasses]
  );

  const shuttleEvents = useMemo(() => {
    const events: Array<{ day: string; time: string; busName: string; destination: string }> = [];
    busRoutes.forEach((route: any) => {
      route.stops?.forEach((stop: any) => {
        stop.boardingStudents?.forEach((s: any) => {
          if (s.name === student.name) {
            const days = s.days ? s.days.replace(/[,\s]/g, '').split('') : [];
            days.forEach((day: string) => {
              events.push({ day, time: stop.time, busName: route.busName, destination: stop.destination });
            });
          }
        });
      });
    });
    return events;
  }, [busRoutes, student.name]);

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

  const hasClasses = activeDays.size > 0;

  const rangeStartMin = 13 * 60;
  const rangeEndMin = 23 * 60;
  const totalHeight = (rangeEndMin - rangeStartMin) * PIXELS_PER_MINUTE_IMG;

  const timeLabels = useMemo(() => {
    const labels: Array<{ time: string; minutes: number }> = [];
    for (let m = rangeStartMin; m <= rangeEndMin; m += 60) {
      labels.push({ time: minutesToTime(m), minutes: m });
    }
    return labels;
  }, []);

  if (!hasClasses) return null;

  // Use inline styles for reliable html-to-image capture
  return (
    <div style={{ width: '800px', backgroundColor: 'white', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
          {student.name} 시간표
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
          배포일: {reportDate} | 인재원 프리미엄
        </div>
      </div>

      {/* Timetable Grid */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', overflow: 'hidden' }}>
        {/* Day Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{
            width: '56px', flexShrink: 0, backgroundColor: '#f9fafb',
            borderRight: '1px solid #e5e7eb', padding: '6px 4px', textAlign: 'center',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280' }}>시간</span>
          </div>
          {DAY_ORDER.map((day, i) => {
            const isWeekend = day === '일' || (day === '토' && !activeDays.has('토'));
            return (
              <div
                key={day}
                style={{
                  flex: 1, padding: '6px 8px', textAlign: 'center',
                  fontWeight: 'bold', fontSize: '12px',
                  backgroundColor: day === '일' ? '#fef2f2' : day === '토' ? '#f0f9ff' : '#f9fafb',
                  color: day === '일' ? '#ef4444' : day === '토' ? '#0ea5e9' : '#4b5563',
                  borderRight: i < DAY_ORDER.length - 1 ? '1px solid #e5e7eb' : 'none',
                }}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Time axis + blocks */}
        <div style={{ display: 'flex', position: 'relative', height: `${totalHeight}px` }}>
          {/* Time column */}
          <div style={{ width: '56px', flexShrink: 0, position: 'relative', backgroundColor: '#f9fafb', borderRight: '1px solid #e5e7eb' }}>
            {timeLabels.map(label => {
              const top = (label.minutes - rangeStartMin) * PIXELS_PER_MINUTE_IMG;
              return (
                <div key={label.time} style={{ position: 'absolute', left: 0, right: 0, top: `${top}px` }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 'bold', color: '#374151',
                    padding: '0 4px', transform: 'translateY(-50%)', display: 'inline-block',
                  }}>
                    {label.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {DAY_ORDER.map((day, di) => {
            const blocks = dayBlocks[day] || [];
            const hasBlocks = activeDays.has(day);
            const columnBg = day === '일' ? 'rgba(229,231,235,0.7)'
              : day === '토' && !hasBlocks ? 'rgba(229,231,235,0.7)'
              : 'transparent';

            return (
              <div key={day} style={{
                flex: 1, position: 'relative',
                borderRight: di < DAY_ORDER.length - 1 ? '1px solid #e5e7eb' : 'none',
                backgroundColor: columnBg,
              }}>
                {/* Time lines */}
                {timeLabels.map(label => {
                  const top = (label.minutes - rangeStartMin) * PIXELS_PER_MINUTE_IMG;
                  return (
                    <div key={label.time} style={{
                      position: 'absolute', left: 0, right: 0, top: `${top}px`,
                      borderTop: '1px solid #e5e7eb',
                    }} />
                  );
                })}

                {/* Class blocks */}
                {blocks.map((block, idx) => {
                  const startMin = timeToMinutes(block.startTime);
                  const endMin = timeToMinutes(block.endTime);
                  const top = (startMin - rangeStartMin) * PIXELS_PER_MINUTE_IMG;
                  const height = (endMin - startMin) * PIXELS_PER_MINUTE_IMG;
                  const sc = SUBJECT_COLORS[block.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
                  const isShort = height < 60;

                  return (
                    <div
                      key={`${block.className}-${idx}`}
                      style={{
                        position: 'absolute', left: '2px', right: '2px', borderRadius: '2px',
                        overflow: 'hidden', zIndex: 10,
                        top: `${top}px`, height: `${height}px`,
                        backgroundColor: sc.light, borderLeft: `3px solid ${sc.bg}`,
                      }}
                    >
                      <div style={{
                        padding: isShort ? '0 6px' : '4px 6px', height: '100%',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: isShort ? 'center' : 'flex-start',
                      }}>
                        <div style={{
                          fontWeight: 'bold', fontSize: '10px',
                          color: sc.text === '#ffffff' ? sc.border : sc.text,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {block.className}
                        </div>
                        {!isShort && (
                          <>
                            <div style={{ fontSize: '9px', fontWeight: 500, color: '#6b7280', marginTop: '2px' }}>
                              {block.startTime} ~ {block.endTime}
                            </div>
                            <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>
                              {block.room && `${block.room}`}
                              {block.teacher && ` | ${block.teacher}`}
                            </div>
                          </>
                        )}
                        {isShort && (
                          <div style={{ fontSize: '9px', color: '#9ca3af' }}>
                            {block.startTime}~{block.endTime}{block.room && ` · ${block.room}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Shuttle events */}
                {shuttleEvents
                  .filter(e => e.day === day)
                  .map((e, ei) => {
                    const eventMin = timeToMinutes(e.time);
                    const top = (eventMin - rangeStartMin) * PIXELS_PER_MINUTE_IMG;
                    return (
                      <div
                        key={`shuttle-${ei}`}
                        style={{
                          position: 'absolute', left: 0, right: 0, zIndex: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          top: `${top - 10}px`,
                        }}
                      >
                        <span style={{
                          backgroundColor: '#3b82f6', color: 'white', fontSize: '9px',
                          padding: '2px 6px', borderRadius: '9999px',
                        }}>
                          Bus {e.time}
                        </span>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Class Summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
        {Object.entries(
          (student.enrollments || [])
            .filter(e => {
              const today = new Date().toISOString().split('T')[0];
              return !(e as any).endDate && (!(e as any).startDate || (e as any).startDate <= today);
            })
            .reduce((acc, e) => {
              const key = `${e.subject}_${e.className}`;
              if (!acc[key]) {
                const cls = allClasses.find(c => c.className === e.className && c.subject === e.subject);
                acc[key] = { className: e.className, subject: e.subject, teacher: cls?.teacher || '', room: cls?.room || '' };
              }
              return acc;
            }, {} as Record<string, { className: string; subject: string; teacher: string; room: string }>)
        ).map(([key, info]) => {
          const sc = SUBJECT_COLORS[info.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', borderRadius: '2px',
              border: `1px solid ${sc.border}`, backgroundColor: sc.light, fontSize: '10px',
            }}>
              <span style={{
                padding: '2px 4px', borderRadius: '2px', fontWeight: 'bold', fontSize: '9px',
                backgroundColor: sc.bg, color: sc.text,
              }}>
                {SUBJECT_LABELS[info.subject as keyof typeof SUBJECT_LABELS] || info.subject}
              </span>
              <span style={{ fontWeight: 500 }}>{info.className}</span>
              {info.teacher && <span style={{ color: '#9ca3af' }}>| {info.teacher}</span>}
              {info.room && <span style={{ color: '#9ca3af' }}>| {info.room}</span>}
            </div>
          );
        })}
      </div>

      {/* 강의실 이동 안내 */}
      {roomChanges.length > 0 && (
        <div style={{
          marginTop: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: '4px', padding: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#b45309', marginBottom: '6px' }}>
            ⚠️ 강의실 이동 안내
          </div>
          {roomChanges.map((change, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#92400e', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', padding: '2px 6px', backgroundColor: '#fef3c7', borderRadius: '2px' }}>{change.day}</span>
              <span>{change.fromClass}</span>
              <span style={{ color: '#d97706' }}>({change.fromRoom})</span>
              <span style={{ color: '#d97706' }}>→</span>
              <span>{change.toClass}</span>
              <span style={{ color: '#d97706' }}>({change.toRoom})</span>
              <span style={{ color: '#b45309', marginLeft: 'auto' }}>{change.fromEndTime} → {change.toStartTime}</span>
            </div>
          ))}
        </div>
      )}

      {/* 셔틀버스 이용 안내 */}
      {shuttleEvents.length > 0 && (
        <div style={{
          marginTop: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: '4px', padding: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '6px' }}>
            🚌 셔틀버스 이용
          </div>
          {[...shuttleEvents]
            .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
            .map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#1e40af', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', padding: '2px 6px', backgroundColor: '#dbeafe', borderRadius: '2px' }}>{e.day}</span>
              <span style={{ padding: '2px 6px', borderRadius: '2px', color: 'white', fontSize: '9px', fontWeight: 'bold', backgroundColor: '#3b82f6' }}>승차</span>
              <span style={{ fontWeight: 'bold' }}>{e.time}</span>
              <span style={{ color: '#3b82f6' }}>{e.busName}</span>
              {e.destination && <span style={{ color: '#60a5fa' }}>· {e.destination}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Preview Modal ───────────────────────────────────────
const PreviewModal: React.FC<{
  student: UnifiedStudent;
  allClasses: any[];
  busRoutes: any[];
  reportDate: string;
  onClose: () => void;
}> = ({ student, allClasses, busRoutes, reportDate, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-[860px] max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-white border-b px-4 py-2 flex items-center justify-between z-10">
        <span className="font-bold text-sm">{student.name} 시간표 미리보기</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
      </div>
      <div className="p-4">
        <TimetableImageRenderer
          student={student}
          allClasses={allClasses}
          busRoutes={busRoutes}
          reportDate={reportDate}
        />
      </div>
    </div>
  </div>
);

// ─── Main Tab Component ──────────────────────────────────
const TimetableDistributionTab: React.FC = () => {
  const { students, loading: studentsLoading } = useStudents();
  const { data: allClasses = [] } = useClasses();
  const { busRoutes } = useShuttle();

  // Settings (클래스노트 로그인 정보 하드코딩)
  const loginId = 'injaewonpremium';
  const loginPw = 'mbplaza2*';
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Student selection & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Distribution
  const [isDistributing, setIsDistributing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [results, setResults] = useState<Record<string, StudentDistResult>>({});

  // Preview
  const [previewStudent, setPreviewStudent] = useState<UnifiedStudent | null>(null);

  // Render area
  const [renderStudents, setRenderStudents] = useState<UnifiedStudent[]>([]);

  // Filter active students with classes
  const activeStudents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return students.filter(s => {
      if (s.status === 'withdrawn') return false;
      const hasActiveEnrollment = (s.enrollments || []).some(e => {
        const hasEnded = !!(e as any).endDate;
        const startDate = (e as any).startDate;
        const hasStarted = !startDate || startDate <= today;
        return !hasEnded && hasStarted;
      });
      return hasActiveEnrollment;
    });
  }, [students]);

  // Apply search and subject filter
  const filteredStudents = useMemo(() => {
    let list = activeStudents;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        (s.enrollments || []).some(e => e.className?.toLowerCase().includes(q))
      );
    }

    if (subjectFilter !== 'all') {
      list = list.filter(s =>
        (s.enrollments || []).some(e => {
          const hasEnded = !!(e as any).endDate;
          return !hasEnded && e.subject === subjectFilter;
        })
      );
    }

    return list;
  }, [activeStudents, searchQuery, subjectFilter]);

  // Get enrolled class info summary for a student
  const getClassSummary = useCallback((student: UnifiedStudent) => {
    const today = new Date().toISOString().split('T')[0];
    return (student.enrollments || [])
      .filter(e => !(e as any).endDate && (!(e as any).startDate || (e as any).startDate <= today))
      .map(e => ({ className: e.className, subject: e.subject }));
  }, []);

  // Selection handlers
  const toggleStudent = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  }, [filteredStudents, selectedIds.size]);

  // ─── Distribution Handler ───
  const handleDistribute = useCallback(async () => {
    const selected = activeStudents.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return;

    setIsDistributing(true);
    setResults({});
    setProgress({ current: 0, total: selected.length, phase: '시간표 이미지 생성 중...' });

    // Phase 1: Render timetables and capture images
    setRenderStudents(selected);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for DOM render

    const { toJpeg } = await import('html-to-image');
    const reports: Array<{ studentId: string; studentName: string; reportDate: string; imageBase64: string }> = [];

    for (let i = 0; i < selected.length; i++) {
      const student = selected[i];
      setProgress({ current: i + 1, total: selected.length, phase: `이미지 캡처: ${student.name} (${i + 1}/${selected.length})` });
      setResults(prev => ({ ...prev, [student.id]: { status: 'capturing' } }));

      const element = document.getElementById(`timetable-capture-${student.id}`);
      if (!element) {
        setResults(prev => ({ ...prev, [student.id]: { status: 'error', message: '수업이 없거나 렌더링 실패' } }));
        continue;
      }

      try {
        const dataUrl = await toJpeg(element, {
          cacheBust: true,
          quality: 0.9,
          pixelRatio: 2,
        });
        reports.push({
          studentId: student.id,
          studentName: student.name,
          reportDate: `${reportDate}T12:00:00`,
          imageBase64: dataUrl,
        });
        setResults(prev => ({ ...prev, [student.id]: { status: 'sending' } }));
      } catch (err: any) {
        setResults(prev => ({ ...prev, [student.id]: { status: 'error', message: `캡처 실패: ${err.message}` } }));
      }
    }

    // Phase 2: Send to Cloud Function in batches
    setProgress({ current: 0, total: reports.length, phase: '클래스노트 배포 중...' });

    for (let batchIdx = 0; batchIdx < reports.length; batchIdx += BATCH_SIZE) {
      const batch = reports.slice(batchIdx, batchIdx + BATCH_SIZE);
      setProgress(prev => ({ ...prev, current: batchIdx, phase: `배포 중... (${batchIdx + 1}~${Math.min(batchIdx + BATCH_SIZE, reports.length)} / ${reports.length})` }));

      try {
        const functions = getFunctions(undefined, 'asia-northeast3');
        const submitFn = httpsCallable(functions, 'submitTimetableToClassNote');
        const result = await submitFn({
          loginId,
          loginPw,
          reports: batch.map(r => ({
            studentName: r.studentName,
            reportDate: r.reportDate,
            imageBase64: r.imageBase64,
          })),
        });

        const data = result.data as any;
        if (data.results) {
          data.results.forEach((r: any) => {
            const report = batch.find(b => b.studentName === r.studentName);
            if (report) {
              setResults(prev => ({
                ...prev,
                [report.studentId]: {
                  status: r.success ? 'success' : 'error',
                  message: r.message,
                },
              }));
            }
          });
        }
      } catch (err: any) {
        batch.forEach(report => {
          setResults(prev => ({
            ...prev,
            [report.studentId]: {
              status: 'error',
              message: `전송 실패: ${err.message}`,
            },
          }));
        });
      }
    }

    setProgress({ current: reports.length, total: reports.length, phase: '완료' });
    setRenderStudents([]);
    setIsDistributing(false);
  }, [activeStudents, selectedIds, reportDate]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { success: 0, error: 0, pending: 0 };
    Object.values(results).forEach(r => {
      if (r.status === 'success') counts.success++;
      else if (r.status === 'error') counts.error++;
      else counts.pending++;
    });
    return counts;
  }, [results]);

  const getStatusIcon = (status?: StudentStatus) => {
    switch (status) {
      case 'capturing': return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'sending': return <Loader2 size={14} className="animate-spin text-indigo-500" />;
      case 'success': return <CheckCircle size={14} className="text-green-500" />;
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      default: return null;
    }
  };

  if (studentsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <Send size={18} />
            시간표 배포
          </h2>
          <p className="text-xxs text-gray-400 mt-0.5">
            학생 시간표를 클래스노트로 배포합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="px-2 py-1.5 border rounded text-xs"
          />
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 border rounded text-xs"
            placeholder="학생 이름 또는 반 검색..."
          />
        </div>

        {/* Subject filter */}
        <div className="flex items-center gap-1">
          {['all', 'math', 'english'].map(s => (
            <button
              key={s}
              onClick={() => setSubjectFilter(s)}
              className={`px-2 py-1 rounded text-xxs font-medium transition-colors ${
                subjectFilter === s
                  ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? '전체' : s === 'math' ? '수학' : '영어'}
            </button>
          ))}
        </div>

        {/* Select all */}
        <button
          onClick={toggleAll}
          className="flex items-center gap-1 px-2 py-1 rounded text-xxs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600"
        >
          {selectedIds.size === filteredStudents.length && filteredStudents.length > 0
            ? <CheckSquare size={12} className="text-blue-500" />
            : <Square size={12} />}
          전체선택 ({selectedIds.size}/{filteredStudents.length})
        </button>

        {/* Distribute button */}
        <button
          onClick={handleDistribute}
          disabled={isDistributing || selectedIds.size === 0}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-colors ${
            isDistributing || selectedIds.size === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
          }`}
        >
          {isDistributing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isDistributing ? '배포 중...' : `배포 (${selectedIds.size}명)`}
        </button>
      </div>

      {/* Progress Bar */}
      {isDistributing && (
        <div className="bg-blue-50 border-b px-4 py-2">
          <div className="flex items-center justify-between text-xxs text-blue-700 mb-1">
            <span>{progress.phase}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Status Summary */}
      {Object.keys(results).length > 0 && !isDistributing && (
        <div className="bg-white border-b px-4 py-2 flex items-center gap-4">
          <span className="text-xxs text-gray-500">배포 결과:</span>
          <span className="flex items-center gap-1 text-xxs text-green-600">
            <CheckCircle size={12} /> {statusCounts.success}명 성공
          </span>
          {statusCounts.error > 0 && (
            <span className="flex items-center gap-1 text-xxs text-red-600">
              <AlertCircle size={12} /> {statusCounts.error}명 실패
            </span>
          )}
        </div>
      )}

      {/* Student List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredStudents.map(student => {
            const classes = getClassSummary(student);
            const isSelected = selectedIds.has(student.id);
            const result = results[student.id];

            return (
              <div
                key={student.id}
                onClick={() => !isDistributing && toggleStudent(student.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                } ${isDistributing ? 'opacity-80 cursor-default' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isSelected
                      ? <CheckSquare size={16} className="text-blue-500 flex-shrink-0" />
                      : <Square size={16} className="text-gray-300 flex-shrink-0" />}
                    <span className="font-bold text-sm text-gray-800">{student.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(result?.status)}
                    <button
                      onClick={e => { e.stopPropagation(); setPreviewStudent(student); }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                      title="미리보기"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>

                {/* Class badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {classes.map((cls, i) => {
                    const sc = SUBJECT_COLORS[cls.subject as keyof typeof SUBJECT_COLORS] || SUBJECT_COLORS.other;
                    return (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-micro font-medium"
                        style={{ backgroundColor: sc.light, color: sc.text === '#ffffff' ? sc.border : sc.text, border: `1px solid ${sc.border}` }}
                      >
                        {cls.className}
                      </span>
                    );
                  })}
                </div>

                {/* Status message */}
                {result?.message && (
                  <p className={`text-micro mt-1.5 ${result.status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                    {result.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {searchQuery ? '검색 결과가 없습니다.' : '수강 중인 학생이 없습니다.'}
          </div>
        )}
      </div>

      {/* Hidden Render Area (for html-to-image capture) */}
      <div
        style={{ position: 'fixed', left: '-9999px', top: 0, opacity: 1, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {renderStudents.map(student => (
          <div key={student.id} id={`timetable-capture-${student.id}`}>
            <TimetableImageRenderer
              student={student}
              allClasses={allClasses}
              busRoutes={busRoutes}
              reportDate={reportDate}
            />
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewStudent && (
        <PreviewModal
          student={previewStudent}
          allClasses={allClasses}
          busRoutes={busRoutes}
          reportDate={reportDate}
          onClose={() => setPreviewStudent(null)}
        />
      )}
    </div>
  );
};

export default TimetableDistributionTab;
