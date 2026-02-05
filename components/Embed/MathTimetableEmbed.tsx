// Math Timetable Embed Component
// 공개 임베드용 수학 시간표 (읽기 전용)

import React, { useMemo, useState } from 'react';
import { Search, Calendar, Users, ExternalLink } from 'lucide-react';
import { useEmbedMathData } from '../../hooks/useEmbedData';
import { EmbedToken, EmbedSettings, DEFAULT_EMBED_SETTINGS } from '../../types/embed';
import { useMathIntegrationClasses, MathClassInfo } from '../Timetable/Math/hooks/useMathIntegrationClasses';
import { useMathClassStudents } from '../Timetable/Math/hooks/useMathClassStudents';
import { useMathSettings } from '../Timetable/Math/hooks/useMathSettings';
import IntegrationClassCard from '../Timetable/shared/IntegrationClassCard';
import { TimetableStudent } from '../../types';

interface MathTimetableEmbedProps {
  token: EmbedToken;
}

interface GroupedClass {
  periodIndex: number;
  label: string;
  classes: MathClassInfo[];
  isWeekend?: boolean;
}

const MathTimetableEmbed: React.FC<MathTimetableEmbedProps> = ({ token }) => {
  const embedSettings = token.settings || DEFAULT_EMBED_SETTINGS;
  const [searchTerm, setSearchTerm] = useState('');

  // 데이터 로딩
  const { classes, teachers, studentMap, loading, error } = useEmbedMathData(embedSettings);
  const { settings } = useMathSettings();

  // 수학 수업 변환
  const mathClasses = useMathIntegrationClasses(classes, settings, teachers);
  const classNames = useMemo(() => mathClasses.map(c => c.name), [mathClasses]);
  const { classDataMap, isLoading: studentsLoading } = useMathClassStudents(classNames, studentMap);

  // 검색 필터
  const filteredClasses = useMemo(() => {
    return mathClasses
      .filter(c => !searchTerm || (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.startPeriod - b.startPeriod || (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [mathClasses, searchTerm]);

  // 그룹화
  const groupedClasses = useMemo(() => {
    const groups: GroupedClass[] = [];

    // 평일 수업과 주말 전용 수업 분리
    const weekdayClasses = filteredClasses.filter(c => !c.isWeekendOnly);
    const weekendClasses = filteredClasses.filter(c => c.isWeekendOnly);

    // 평일 수업: 시작 교시별 그룹화
    const periodMap = new Map<number, MathClassInfo[]>();

    weekdayClasses.forEach(cls => {
      const period = cls.startPeriod;
      if (!periodMap.has(period)) {
        periodMap.set(period, []);
      }
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

    // 주말 전용 수업
    if (weekendClasses.length > 0) {
      const weekendPeriodMap = new Map<number, MathClassInfo[]>();

      weekendClasses.forEach(cls => {
        const period = cls.startPeriod;
        if (!weekendPeriodMap.has(period)) {
          weekendPeriodMap.set(period, []);
        }
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

  // 학생 통계
  const studentStats = useMemo(() => {
    let active = 0;
    let withdrawn = 0;

    Object.values(classDataMap).forEach(data => {
      if (data?.studentList) {
        data.studentList.forEach((s: TimetableStudent) => {
          if (s.withdrawalDate) {
            withdrawn++;
          } else if (!s.onHold) {
            active++;
          }
        });
      }
    });

    return { active, withdrawn };
  }, [classDataMap]);

  // 표시 옵션
  const displayOptions = {
    showStudents: embedSettings.showStudentList ?? true,
    showRoom: embedSettings.showClassroom ?? true,
    showTeacher: embedSettings.showTeacherInfo ?? true,
    showSchedule: embedSettings.showSchedule ?? true,
  };

  // 강사 색상 가져오기
  const getTeacherColor = (teacherName: string) => {
    const teacher = teachers.find(t => t.name === teacherName || t.englishName === teacherName);
    if (teacher?.bgColor) {
      return { bg: teacher.bgColor, text: teacher.textColor || '#fff' };
    }
    return { bg: '#e5e7eb', text: '#374151' };
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

  return (
    <div className={`flex flex-col h-screen ${embedSettings.theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${embedSettings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h1 className={`text-lg font-bold ${embedSettings.theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            수학 시간표
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded ${embedSettings.theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
            읽기 전용
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 학생 통계 */}
          {displayOptions.showStudents && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className={embedSettings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
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
                embedSettings.theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
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
                  embedSettings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <span className={`text-sm font-semibold ${
                    group.isWeekend
                      ? 'text-orange-600'
                      : embedSettings.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-700'
                  }`}>
                    {group.isWeekend ? '🗓️ ' : ''}{group.label}
                  </span>
                  <span className={`text-xs ${embedSettings.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
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
                        studentList={activeStudents}
                        mode="view"
                        displayOptions={displayOptions}
                        teachersData={teachers}
                        getTeacherColor={getTeacherColor}
                        subject="math"
                        // 읽기 전용이므로 이벤트 핸들러 없음
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs border-t ${
        embedSettings.theme === 'dark'
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
