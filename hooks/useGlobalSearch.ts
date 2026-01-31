/**
 * useGlobalSearch - Global search logic extracted from App.tsx
 *
 * Handles: Search across students/events/classes/teachers, result selection, Cmd+K shortcut
 */

import { useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { SearchResult } from '../components/Common/GlobalSearch';
import { CalendarEvent, Department, Teacher, AppTab } from '../types';
import { UnifiedStudent } from '../types';
import { ClassInfo } from './useClasses';
import { StudentFilters } from './useAppState';

interface UseGlobalSearchParams {
  globalStudents: UnifiedStudent[];
  events: CalendarEvent[];
  departments: Department[];
  allClasses: ClassInfo[];
  teachers: Teacher[];
  setAppMode: (mode: AppTab) => void;
  setStudentFilters: React.Dispatch<React.SetStateAction<StudentFilters>>;
  setEditingEvent: (event: CalendarEvent | null) => void;
  setIsEventModalOpen: (open: boolean) => void;
  setIsGlobalSearchOpen: (open: boolean) => void;
}

export const useGlobalSearch = ({
  globalStudents,
  events,
  departments,
  allClasses,
  teachers,
  setAppMode,
  setStudentFilters,
  setEditingEvent,
  setIsEventModalOpen,
  setIsGlobalSearchOpen,
}: UseGlobalSearchParams) => {

  const handleGlobalSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search students (max 5 results)
    globalStudents
      .filter(s =>
        s.status === 'active' && (
          s.name.toLowerCase().includes(lowerQuery) ||
          s.englishName?.toLowerCase().includes(lowerQuery) ||
          s.school?.toLowerCase().includes(lowerQuery)
        )
      )
      .slice(0, 5)
      .forEach(s => {
        results.push({
          id: s.id,
          type: 'student',
          title: s.name,
          subtitle: s.englishName || s.school,
          metadata: s.grade,
        });
      });

    // Search events (max 5 results)
    events
      .filter(e =>
        e.title.toLowerCase().includes(lowerQuery) ||
        e.description?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach(e => {
        const dept = departments.find(d => d.id === e.departmentId);
        results.push({
          id: e.id,
          type: 'event',
          title: e.title,
          subtitle: dept?.name,
          metadata: format(parseISO(e.startDate), 'yyyy-MM-dd'),
        });
      });

    // Search classes (max 5 results)
    allClasses
      .filter(c =>
        c.className.toLowerCase().includes(lowerQuery) ||
        c.teacher.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach(c => {
        results.push({
          id: c.id,
          type: 'class',
          title: c.className,
          subtitle: `강사: ${c.teacher}`,
          metadata: c.subject === 'math' ? '수학' : '영어',
        });
      });

    // Search teachers (max 5 results)
    teachers
      .filter(t =>
        t.name.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach(t => {
        const subjects = t.subjects?.map(s => s === 'math' ? '수학' : '영어').join(', ') || '';
        results.push({
          id: t.id,
          type: 'teacher',
          title: t.name,
          subtitle: subjects,
          metadata: t.defaultRoom || '',
        });
      });

    return results;
  }, [globalStudents, events, departments, allClasses, teachers]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'student':
        setAppMode('students');
        setStudentFilters(prev => ({ ...prev, searchQuery: result.title }));
        break;
      case 'event': {
        const event = events.find(e => e.id === result.id);
        if (event) {
          setAppMode('calendar');
          setEditingEvent(event);
          setIsEventModalOpen(true);
        }
        break;
      }
      case 'class':
        setAppMode('classes');
        break;
      case 'teacher':
        setAppMode('timetable');
        break;
    }
  }, [events, setAppMode, setStudentFilters, setEditingEvent, setIsEventModalOpen]);

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsGlobalSearchOpen]);

  return {
    handleGlobalSearch,
    handleSearchSelect,
  };
};
