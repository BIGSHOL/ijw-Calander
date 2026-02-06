import React, { useState, useMemo, useEffect } from 'react';
import { UnifiedStudent } from '../../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface StudentListProps {
  students: UnifiedStudent[];
  selectedStudent: UnifiedStudent | null;
  onSelectStudent: (student: UnifiedStudent) => void;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  selectedStudent,
  onSelectStudent,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 학생 목록이 변경되면 첫 페이지로 리셋 (검색, 필터 변경 시)
  useEffect(() => {
    setCurrentPage(1);
  }, [students.length]);

  // 오늘 날짜 (YYYY-MM-DD 형식 문자열) - CoursesTab과 동일한 방식
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 이번 주 마지막 날 계산 (일요일)
  const weekEnd = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0(일) ~ 6(토)
    const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    return sunday.toISOString().split('T')[0];
  }, []);

  // 학생 섹션 분류 (ClassCard 로직과 동일)
  const { activeStudents, onHoldStudents, withdrawingThisWeekStudents, withdrawnStudents } = useMemo(() => {
    const active: UnifiedStudent[] = [];
    const onHold: UnifiedStudent[] = [];
    const withdrawing: UnifiedStudent[] = [];
    const withdrawn: UnifiedStudent[] = [];

    students.forEach(student => {
      // 퇴원생: withdrawalDate가 있는 경우
      if (student.withdrawalDate) {
        if (student.status === 'withdrawn') {
          // 이미 퇴원 완료된 학생 → 퇴원 섹션
          withdrawn.push(student);
        } else if (student.withdrawalDate >= today && student.withdrawalDate <= weekEnd) {
          // 이번 주 퇴원 예정
          withdrawing.push(student);
        }
        return;
      }

      // 대기생 체크 (withdrawalDate 없음)
      let isOnHold = false;

      // 1. status가 on_hold인 경우
      if (student.status === 'on_hold') {
        isOnHold = true;
      }

      // 2. enrollments에서 체크 (현재 수강 중인 수업이 모두 대기 상태)
      const activeEnrollments = (student.enrollments || []).filter(e => {
        const hasEnded = !!e.endDate;
        const startDate = e.startDate;
        const isFuture = startDate && startDate > today;
        return !hasEnded && !isFuture;
      });

      if (activeEnrollments.length > 0) {
        const allOnHold = activeEnrollments.every(e => e.onHold === true);
        if (allOnHold) {
          isOnHold = true;
        }
      }

      if (isOnHold) {
        onHold.push(student);
      } else {
        active.push(student);
      }
    });

    return {
      activeStudents: active,
      onHoldStudents: onHold,
      withdrawingThisWeekStudents: withdrawing,
      withdrawnStudents: withdrawn,
    };
  }, [students, today, weekEnd]);

  // 페이지네이션은 전체 학생 수 기준으로 (섹션 구분과 무관)
  const totalPages = Math.ceil(students.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // 각 섹션의 페이지네이션된 학생 목록
  const paginatedSections = useMemo(() => {
    let currentIndex = 0;
    const result = {
      active: [] as UnifiedStudent[],
      onHold: [] as UnifiedStudent[],
      withdrawing: [] as UnifiedStudent[],
      withdrawn: [] as UnifiedStudent[],
    };

    // 재원생 섹션
    for (let i = 0; i < activeStudents.length; i++) {
      if (currentIndex >= startIndex && currentIndex < endIndex) {
        result.active.push(activeStudents[i]);
      }
      currentIndex++;
      if (currentIndex >= endIndex) return result;
    }

    // 대기생 섹션
    for (let i = 0; i < onHoldStudents.length; i++) {
      if (currentIndex >= startIndex && currentIndex < endIndex) {
        result.onHold.push(onHoldStudents[i]);
      }
      currentIndex++;
      if (currentIndex >= endIndex) return result;
    }

    // 퇴원 예정 섹션
    for (let i = 0; i < withdrawingThisWeekStudents.length; i++) {
      if (currentIndex >= startIndex && currentIndex < endIndex) {
        result.withdrawing.push(withdrawingThisWeekStudents[i]);
      }
      currentIndex++;
      if (currentIndex >= endIndex) return result;
    }

    // 퇴원 완료 섹션
    for (let i = 0; i < withdrawnStudents.length; i++) {
      if (currentIndex >= startIndex && currentIndex < endIndex) {
        result.withdrawn.push(withdrawnStudents[i]);
      }
      currentIndex++;
      if (currentIndex >= endIndex) return result;
    }

    return result;
  }, [activeStudents, onHoldStudents, withdrawingThisWeekStudents, withdrawnStudents, startIndex, endIndex]);

  // 페이지 크기 변경 시 첫 페이지로 이동
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // 페이지 변경 시 스크롤 최상단으로
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'prospect':
      case 'prospective':  // 예비 상태 (두 가지 표기 지원)
        return <span className="text-micro bg-blue-100 text-blue-800 px-1 py-0.5 rounded-sm font-medium">예비</span>;
      case 'active':
        return <span className="text-micro bg-green-100 text-green-800 px-1 py-0.5 rounded-sm font-medium">재원</span>;
      case 'on_hold':
        return <span className="text-micro bg-amber-100 text-amber-800 px-1 py-0.5 rounded-sm font-medium">휴원/대기</span>;
      case 'withdrawn':
        return <span className="text-micro bg-gray-200 text-gray-600 px-1 py-0.5 rounded-sm font-medium">퇴원</span>;
      default:
        // status가 없거나 인식되지 않는 경우 기본값으로 "재원" 표시
        // (status 필드가 없는 기존 학생 데이터 호환)
        return <span className="text-micro bg-green-100 text-green-800 px-1 py-0.5 rounded-sm font-medium">재원</span>;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 상단: 총 학생 수 + 페이지 크기 선택 + 페이지네이션 */}
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(8, 20, 41, 0.15)', backgroundColor: '#fafafa' }}>
        <div className="flex items-center gap-1">
          <span className="text-xxs font-bold" style={{ color: 'rgb(8, 20, 41)' /* primary */ }}>
            <span style={{ color: 'rgb(253, 184, 19)' /* accent */ }}>{students.length}</span>명
          </span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="text-xxs border rounded-sm px-1 py-0.5 transition-all"
            style={{ borderColor: 'rgba(8, 20, 41, 0.2)', color: 'rgb(8, 20, 41)' /* primary */, backgroundColor: 'white' }}
            aria-label="페이지당 학생 수"
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
        </div>
        {totalPages > 1 && (
          <nav className="flex items-center gap-0.5" aria-label="학생 목록 페이지 탐색">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-1.5 py-0.5 text-xxs hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded"
              style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              aria-label="이전 페이지"
            >
              이전
            </button>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-5 h-5 rounded-full text-xxs font-bold transition-colors ${
                      currentPage === pageNum
                        ? 'text-primary'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={currentPage === pageNum ? { backgroundColor: 'rgb(253, 184, 19)' /* accent */ } : undefined}
                    aria-label={`${pageNum}페이지${currentPage === pageNum ? ' (현재 페이지)' : ''}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-1.5 py-0.5 text-xxs hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed rounded"
              style={{ color: 'rgb(8, 20, 41)' /* primary */ }}
              aria-label="다음 페이지"
            >
              다음
            </button>
          </nav>
        )}
      </div>

      {/* 학생 목록 - 섹션별로 구분 */}
      <div className="flex-1 overflow-y-auto pb-4">
        {students.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>조건에 맞는 학생이 없습니다</p>
            <p className="text-xs mt-1 text-gray-400">상단 필터를 조정해보세요</p>
          </div>
        ) : (
          <div>
            {/* 재원생 섹션 */}
            {paginatedSections.active.length > 0 && (
              <section aria-labelledby="active-students-heading">
                <div className="sticky top-0 px-2 py-1 bg-green-50 border-b border-green-200 z-10">
                  <h3 id="active-students-heading" className="text-xxs font-bold text-green-800">
                    재원 ({activeStudents.length}명)
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {paginatedSections.active.map((student) => (
                    <li
                      key={student.id}
                      onClick={() => onSelectStudent(student)}
                      className={`px-2 py-1 cursor-pointer transition-colors ${selectedStudent?.id === student.id
                        ? 'bg-accent/10 border-l-2 border-accent'
                        : student.isOldWithdrawn
                          ? 'hover:bg-accent/5 bg-accent/5'
                          : 'hover:bg-primary/5'
                        }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${student.name} 학생 선택`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStudent(student);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        {/* 1번째 줄: 상태 + 이름 + 영어이름 + 학교/학년 */}
                        <div className="flex items-center gap-1">
                          {getStatusBadge(student.status)}
                          <span className={`text-xs font-bold ${student.isOldWithdrawn ? 'text-accent' : 'text-primary'}`}>
                            {student.name}
                          </span>
                          {student.englishName && (
                            <span
                              className="text-xxs text-gray-500 max-w-[60px] truncate"
                              title={student.englishName}
                            >
                              ({student.englishName})
                            </span>
                          )}
                          {student.isOldWithdrawn && (
                            <span className="text-micro bg-accent/20 text-accent px-1 rounded-sm font-medium">과거</span>
                          )}
                          {(student.school || student.grade) && (
                            <span className="text-xxs text-gray-400">
                              {student.school && <span className="truncate max-w-[50px]" title={student.school}>{student.school}</span>}
                              {student.school && student.grade && ' '}
                              {student.grade}
                            </span>
                          )}
                        </div>
                        {/* 2번째 줄: 과목 */}
                        {student.enrollments && student.enrollments.filter(e => {
                          const hasEnded = !!e.endDate;
                          const startDate = e.startDate;
                          const isFuture = startDate && startDate > today;
                          return !hasEnded && !isFuture;
                        }).length > 0 && (
                          <div className="flex items-center gap-1 pl-0.5">
                            {Array.from(new Set(student.enrollments.filter(e => {
                              const hasEnded = !!e.endDate;
                              const startDate = e.startDate;
                              const isFuture = startDate && startDate > today;
                              return !hasEnded && !isFuture;
                            }).map(e => e.subject)))
                              .sort((a, b) => {
                                const order: Record<string, number> = { math: 1, english: 2, korean: 3, science: 4 };
                                return (order[a] || 99) - (order[b] || 99);
                              })
                              .map((subject) => {
                                const subjectNames: Record<string, string> = { math: '수학', english: '영어', korean: '국어', science: '과학' };
                                const subjectColors: Record<string, string> = { math: 'bg-blue-100 text-blue-700', english: 'bg-purple-100 text-purple-700', korean: 'bg-green-100 text-green-700', science: 'bg-orange-100 text-orange-700' };
                                return (
                                  <span key={subject} className={`text-micro px-1 rounded-sm font-medium ${subjectColors[subject] || 'bg-gray-100 text-gray-700'}`}>
                                    {subjectNames[subject] || subject}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 대기생 섹션 */}
            {paginatedSections.onHold.length > 0 && (
              <section aria-labelledby="onhold-students-heading">
                <div className="sticky top-0 px-2 py-1 bg-amber-50 border-b border-amber-200 z-10">
                  <h3 id="onhold-students-heading" className="text-xxs font-bold text-amber-800">
                    대기 ({onHoldStudents.length}명)
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {paginatedSections.onHold.map((student) => (
                    <li
                      key={student.id}
                      onClick={() => onSelectStudent(student)}
                      className={`px-2 py-1 cursor-pointer transition-colors ${selectedStudent?.id === student.id
                        ? 'bg-accent/10 border-l-2 border-accent'
                        : 'hover:bg-primary/5'
                        }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${student.name} 학생 선택`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStudent(student);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(student.status)}
                          <span className="text-xs font-bold text-primary">{student.name}</span>
                          {student.englishName && (
                            <span className="text-xxs text-gray-500 max-w-[60px] truncate" title={student.englishName}>({student.englishName})</span>
                          )}
                          {(student.school || student.grade) && (
                            <span className="text-xxs text-gray-400">
                              {student.school && <span className="truncate max-w-[50px]" title={student.school}>{student.school}</span>}
                              {student.school && student.grade && ' '}
                              {student.grade}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 퇴원 예정 섹션 (이번 주) */}
            {paginatedSections.withdrawing.length > 0 && (
              <section aria-labelledby="withdrawing-students-heading">
                <div className="sticky top-0 px-2 py-1 bg-red-50 border-b border-red-200 z-10">
                  <h3 id="withdrawing-students-heading" className="text-xxs font-bold text-red-800">
                    퇴원 예정 ({withdrawingThisWeekStudents.length}명) - 이번 주
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {paginatedSections.withdrawing.map((student) => (
                    <li
                      key={student.id}
                      onClick={() => onSelectStudent(student)}
                      className={`px-2 py-1 cursor-pointer transition-colors ${selectedStudent?.id === student.id
                        ? 'bg-accent/10 border-l-2 border-accent'
                        : 'hover:bg-primary/5'
                        }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${student.name} 학생 선택`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStudent(student);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(student.status)}
                          <span className="text-xs font-bold text-primary">{student.name}</span>
                          {student.englishName && (
                            <span className="text-xxs text-gray-500 max-w-[60px] truncate" title={student.englishName}>({student.englishName})</span>
                          )}
                          <span className="text-micro bg-red-100 text-red-700 px-1 rounded-sm font-medium">
                            {student.withdrawalDate}
                          </span>
                          {(student.school || student.grade) && (
                            <span className="text-xxs text-gray-400">
                              {student.school && <span className="truncate max-w-[50px]" title={student.school}>{student.school}</span>}
                              {student.school && student.grade && ' '}
                              {student.grade}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 퇴원 완료 섹션 */}
            {paginatedSections.withdrawn.length > 0 && (
              <section aria-labelledby="withdrawn-students-heading">
                <div className="sticky top-0 px-2 py-1 bg-gray-100 border-b border-gray-300 z-10">
                  <h3 id="withdrawn-students-heading" className="text-xxs font-bold text-gray-600">
                    퇴원 ({withdrawnStudents.length}명)
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100">
                  {paginatedSections.withdrawn.map((student) => (
                    <li
                      key={student.id}
                      onClick={() => onSelectStudent(student)}
                      className={`px-2 py-1 cursor-pointer transition-colors ${selectedStudent?.id === student.id
                        ? 'bg-accent/10 border-l-2 border-accent'
                        : 'hover:bg-primary/5'
                        }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${student.name} 학생 선택`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectStudent(student);
                        }
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(student.status)}
                          <span className="text-xs font-bold text-primary">{student.name}</span>
                          {student.englishName && (
                            <span className="text-xxs text-gray-500 max-w-[60px] truncate" title={student.englishName}>({student.englishName})</span>
                          )}
                          {student.withdrawalDate && (
                            <span className="text-micro text-gray-400 ml-auto">
                              {student.withdrawalDate}
                            </span>
                          )}
                        </div>
                        {(student.school || student.grade) && (
                          <div className="flex items-center gap-1 pl-0.5">
                            <span className="text-xxs text-gray-400">
                              {student.school && <span className="truncate max-w-[80px]" title={student.school}>{student.school}</span>}
                              {student.school && student.grade && ' '}
                              {student.grade}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentList;
