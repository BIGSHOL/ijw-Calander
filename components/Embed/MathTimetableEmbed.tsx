// Math Timetable Embed Component
// 공개 임베드용 수학 시간표 (읽기 전용)
// 기존 TimetableGrid 컴포넌트를 재사용하여 내부 시간표와 동일한 UI 제공

import React, { useMemo, useState } from 'react';
import { Search, Calendar, Users, ExternalLink, Grid, LayoutGrid } from 'lucide-react';
import { useEmbedMathData } from '../../hooks/useEmbedData';
import { EmbedToken, EmbedSettings, DEFAULT_EMBED_SETTINGS } from '../../types/embed';
import { useMathIntegrationClasses, MathClassInfo } from '../Timetable/Math/hooks/useMathIntegrationClasses';
import { useMathClassStudents } from '../Timetable/Math/hooks/useMathClassStudents';
import { useMathSettings } from '../Timetable/Math/hooks/useMathSettings';
import IntegrationClassCard from '../Timetable/shared/IntegrationClassCard';
import TimetableGrid from '../Timetable/Math/components/TimetableGrid';
import { TimetableStudent, TimetableClass, Teacher } from '../../types';
import { MATH_PERIODS, ALL_WEEKDAYS } from '../Timetable/constants';
import { startOfWeek, addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface MathTimetableEmbedProps {
  token: EmbedToken;
}

interface GroupedClass {
  periodIndex: number;
  label: string;
  classes: MathClassInfo[];
  isWeekend?: boolean;
}

// No-op handlers for read-only embed mode
const noopHandler = () => {};
const noopDragHandler = (e: React.DragEvent) => { e.preventDefault(); };
const noopClassClick = (_cls: TimetableClass) => {};

// 통일된 periodId → 레거시 periodId 변환 (수학 시간표용)
const UNIFIED_TO_LEGACY_PERIOD_MAP: Record<string, string> = {
  '1': '1-1', '2': '1-2',
  '3': '2-1', '4': '2-2',
  '5': '3-1', '6': '3-2',
  '7': '4-1', '8': '4-2',
};

// 스케줄 데이터 정규화 (다양한 형식 지원)
// TimetableGrid는 레거시 format ("월 3-1")을 기대하므로 변환 필요
const normalizeSchedule = (schedule: any[] | undefined): string[] => {
  if (!schedule) return [];

  const result = schedule.map(slot => {
    // 이미 문자열인 경우 - 형식 검증 및 정규화
    if (typeof slot === 'string') {
      const trimmed = slot.trim();

      // "월 3-1" 형식 (레거시) - 그대로 유지
      if (/^[월화수목금토일]\s+\d-\d$/.test(trimmed)) {
        return trimmed;
      }

      // "월 5" 형식 (통일된) - 레거시로 변환
      const unifiedMatch = trimmed.match(/^([월화수목금토일])\s+(\d+)$/);
      if (unifiedMatch) {
        const day = unifiedMatch[1];
        const unifiedPeriod = unifiedMatch[2];
        const legacyPeriod = UNIFIED_TO_LEGACY_PERIOD_MAP[unifiedPeriod];
        if (legacyPeriod) {
          return `${day} ${legacyPeriod}`;
        }
        // 변환 못하면 그대로 반환 (주말 등)
        return trimmed;
      }

      // "월-3-1" 형식을 "월 3-1"로 변환
      const dashMatch = trimmed.match(/^([월화수목금토일])-(.+)$/);
      if (dashMatch) {
        return `${dashMatch[1]} ${dashMatch[2]}`;
      }

      return trimmed;
    }

    // 객체 형식: { day: '월', period: '1' } 또는 { day: '월', periods: ['1', '2'] }
    if (typeof slot === 'object' && slot !== null) {
      const day = slot.day || slot.weekday || '';
      if (!day) return null;

      if (slot.periods && Array.isArray(slot.periods)) {
        return slot.periods.map((p: string) => {
          const legacyP = UNIFIED_TO_LEGACY_PERIOD_MAP[p] || p;
          return `${day} ${legacyP}`;
        });
      }
      const period = slot.period || slot.periodId || slot.time || '';
      if (!period) return null;
      const legacyPeriod = UNIFIED_TO_LEGACY_PERIOD_MAP[period] || period;
      return `${day} ${legacyPeriod}`;
    }

    return null;
  }).flat().filter((s): s is string => s !== null && s !== '');

  return result;
};

// ===== 메인 컴포넌트 =====
const MathTimetableEmbed: React.FC<MathTimetableEmbedProps> = ({ token }) => {
  const embedSettings = token.settings || DEFAULT_EMBED_SETTINGS;
  const viewType = embedSettings.viewType || 'class';
  const [searchTerm, setSearchTerm] = useState('');

  // 데이터 로딩
  const { classes, teachers, studentMap, loading, error } = useEmbedMathData(embedSettings);
  const { settings } = useMathSettings();

  // 수학 수업 변환 (통합뷰용)
  const mathClasses = useMathIntegrationClasses(classes, settings, teachers);
  const classNames = useMemo(() => mathClasses.map(c => c.name), [mathClasses]);
  const { classDataMap, isLoading: studentsLoading } = useMathClassStudents(classNames, studentMap);

  // ===== 강사뷰용 데이터 계산 =====

  // 강사 목록 추출 (수업 데이터에서 직접 - teachers 컬렉션 접근 제한 대비)
  const sortedTeachers = useMemo(() => {
    const teacherNames = new Set<string>();
    classes.forEach(cls => {
      // 기본 담당 강사
      if (cls.teacher && typeof cls.teacher === 'string') {
        teacherNames.add(cls.teacher.trim());
      }
      // 슬롯별 강사 (합반 수업 등)
      if (cls.slotTeachers && typeof cls.slotTeachers === 'object') {
        Object.values(cls.slotTeachers).forEach(t => {
          if (t && typeof t === 'string') {
            teacherNames.add(t.trim());
          }
        });
      }
    });

    // 빈 문자열 제거 후 정렬
    return Array.from(teacherNames).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [classes]);

  // weekDates 계산 (현재 주 기준)
  const weekDates = useMemo(() => {
    const currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const dates: Record<string, { date: Date; formatted: string }> = {};
    ALL_WEEKDAYS.forEach((day, idx) => {
      const date = addDays(currentMonday, idx);
      dates[day] = {
        date,
        formatted: format(date, 'M/d', { locale: ko })
      };
    });
    return dates;
  }, []);

  // 검색 필터링된 수업 (강사뷰용) - 스케줄 정규화 + 학생 데이터 병합
  const filteredClassesForGrid = useMemo(() => {
    // 스케줄 데이터를 문자열 배열로 정규화하고 학생 데이터 병합
    const normalizedClasses = classes.map(cls => {
      // classDataMap에서 학생 데이터 가져오기 (className으로 매칭)
      const studentData = classDataMap[cls.className];
      return {
        ...cls,
        schedule: normalizeSchedule(cls.schedule),
        // studentList 병합 (ClassCard가 이 필드를 사용)
        studentList: studentData?.studentList || [],
        studentIds: studentData?.studentIds || cls.studentIds || [],
      };
    });

    if (!searchTerm) return normalizedClasses;
    const term = searchTerm.toLowerCase();
    return normalizedClasses.filter(cls =>
      cls.className?.toLowerCase().includes(term) ||
      cls.teacher?.toLowerCase().includes(term)
    );
  }, [classes, searchTerm, classDataMap]);

  // ===== 통합뷰용 데이터 계산 =====

  // 검색 필터 (통합뷰용)
  const filteredClasses = useMemo(() => {
    return mathClasses
      .filter(c => !searchTerm || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.startPeriod - b.startPeriod || (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [mathClasses, searchTerm]);

  // 그룹화 (통합뷰용)
  const groupedClasses = useMemo(() => {
    const groups: GroupedClass[] = [];

    const weekdayClasses = filteredClasses.filter(c => !c.isWeekendOnly);
    const weekendClasses = filteredClasses.filter(c => c.isWeekendOnly);

    const periodMap = new Map<number, MathClassInfo[]>();
    weekdayClasses.forEach(cls => {
      const period = cls.startPeriod;
      if (!periodMap.has(period)) periodMap.set(period, []);
      periodMap.get(period)!.push(cls);
    });

    Array.from(periodMap.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([period, classes]) => {
        groups.push({
          periodIndex: period,
          label: `${period}교시 시작`,
          classes,
        });
      });

    if (weekendClasses.length > 0) {
      const weekendPeriodMap = new Map<number, MathClassInfo[]>();
      weekendClasses.forEach(cls => {
        const period = cls.startPeriod;
        if (!weekendPeriodMap.has(period)) weekendPeriodMap.set(period, []);
        weekendPeriodMap.get(period)!.push(cls);
      });

      Array.from(weekendPeriodMap.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([period, classes]) => {
          groups.push({
            periodIndex: 100 + period,
            label: `주말 ${period}교시 시작`,
            classes,
            isWeekend: true,
          });
        });
    }

    return groups;
  }, [filteredClasses]);

  // 학생 통계 (수학 수업 학생만, 중복 제거)
  const studentStats = useMemo(() => {
    const activeSet = new Set<string>();
    const withdrawnSet = new Set<string>();

    Object.values(classDataMap).forEach(data => {
      if (data?.studentList) {
        data.studentList.forEach((s: TimetableStudent) => {
          if (s.withdrawalDate) {
            withdrawnSet.add(s.id);
          } else if (!s.onHold) {
            activeSet.add(s.id);
          }
        });
      }
    });

    return { active: activeSet.size, withdrawn: withdrawnSet.size };
  }, [classDataMap]);

  // 표시 옵션
  const displayOptions = {
    showStudents: embedSettings.showStudentList ?? true,
    showRoom: embedSettings.showClassroom ?? true,
    showTeacher: embedSettings.showTeacherInfo ?? true,
    showSchedule: embedSettings.showSchedule ?? true,
  };

  if (loading || studentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">시간표 로딩중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">데이터 로드 실패</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const isDark = embedSettings.theme === 'dark';

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            수학 시간표
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
            읽기 전용
          </span>
          {/* 뷰 타입 표시 */}
          <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
            viewType === 'teacher'
              ? isDark ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-700'
              : isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
          }`}>
            {viewType === 'teacher' ? <Grid className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
            {viewType === 'teacher' ? '강사뷰' : '통합뷰'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 학생 통계 */}
          {displayOptions.showStudents && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                재원생 <strong className="text-green-600">{studentStats.active}</strong>명
              </span>
            </div>
          )}

          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="수업명 검색..."
              className={`pl-8 pr-3 py-1.5 text-sm border rounded-md w-48 focus:ring-2 focus:ring-indigo-400 outline-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewType === 'teacher' ? (
          // 강사뷰 - 기존 TimetableGrid 컴포넌트 재사용
          <div className="h-full overflow-auto p-4">
            {sortedTeachers.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Grid className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>표시할 강사가 없습니다</p>
                  <p className="text-xs mt-2 text-gray-400">
                    수업: {classes.length}개 / 강사 데이터를 확인해주세요
                  </p>
                </div>
              </div>
            ) : (
              <TimetableGrid
                filteredClasses={filteredClassesForGrid}
                allResources={sortedTeachers}
                orderedSelectedDays={ALL_WEEKDAYS}
                weekDates={weekDates}
                viewType="teacher"
                currentPeriods={MATH_PERIODS}
                teachers={teachers}
                searchQuery={searchTerm}
                canEdit={false}
                mode="view"
                columnWidth="normal"
                rowHeight="normal"
                fontSize="normal"
                showClassName={true}
                showSchool={false}
                showGrade={true}
                showEmptyRooms={false}
                showStudents={embedSettings.showStudentList ?? true}
                showHoldStudents={embedSettings.showHoldStudents ?? false}
                showWithdrawnStudents={embedSettings.showWithdrawnStudents ?? false}
                dragOverClassId={null}
                onClassClick={noopClassClick}
                onDragStart={noopDragHandler as any}
                onDragOver={noopDragHandler as any}
                onDragLeave={noopDragHandler as any}
                onDrop={noopDragHandler as any}
                currentSubjectFilter="math"
                studentMap={studentMap}
                timetableViewMode="teacher-based"
              />
            )}
          </div>
        ) : (
          // 통합뷰 (카드)
          <div className="h-full overflow-y-auto p-4">
            {groupedClasses.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>표시할 수업이 없습니다</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedClasses.map((group) => (
                  <div key={group.periodIndex}>
                    {/* 그룹 헤더 */}
                    <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <span className={`text-sm font-semibold ${
                        group.isWeekend
                          ? 'text-orange-600'
                          : isDark ? 'text-indigo-400' : 'text-indigo-700'
                      }`}>
                        {group.isWeekend ? '🗓️ ' : ''}{group.label}
                      </span>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        ({group.classes.length}개 수업)
                      </span>
                    </div>

                    {/* 수업 카드 그리드 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {group.classes.map((classInfo) => {
                        const classData = classDataMap[classInfo.name];
                        const activeStudents = classData?.studentList?.filter(
                          (s: TimetableStudent) => !s.withdrawalDate && !s.onHold
                        ) || [];

                        return (
                          <IntegrationClassCard
                            key={classInfo.classId}
                            classInfo={{
                              name: classInfo.name,
                              classId: classInfo.classId,
                              mainTeacher: classInfo.mainTeacher,
                              mainRoom: classInfo.mainRoom,
                              startPeriod: classInfo.startPeriod,
                              scheduleMap: classInfo.scheduleMap,
                              visiblePeriods: classInfo.visiblePeriods,
                              finalDays: classInfo.finalDays,
                            }}
                            classStudentData={{ studentList: activeStudents, studentIds: activeStudents.map(s => s.id) }}
                            mode="view"
                            displayOptions={displayOptions}
                            teachersData={teachers}
                            subject="math"
                            currentUser={null}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs border-t ${
        isDark
          ? 'bg-gray-800 border-gray-700 text-gray-400'
          : 'bg-white border-gray-200 text-gray-500'
      }`}>
        <span>
          마지막 업데이트: {new Date().toLocaleString('ko-KR')}
        </span>
        <a
          href={window.location.origin}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          인재원 학원 관리 시스템
        </a>
      </div>
    </div>
  );
};

export default MathTimetableEmbed;
