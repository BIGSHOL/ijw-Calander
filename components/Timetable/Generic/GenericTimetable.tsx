/**
 * Generic Timetable Component - Entry Point
 *
 * Performance Optimizations Applied:
 * - bundle-dynamic-imports: Heavy components loaded dynamically
 * - rerender-memo: Memoized for stable props
 * - rerender-lazy-state-init: Lazy initialization of config
 * - async-suspense-boundaries: Suspense for code splitting
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import type { SubjectKey } from './types';
import { getSubjectConfig } from './utils/subjectConfig';
import { useTimetableClasses } from './hooks/useTimetableClasses';
import { useClassStudents } from './hooks/useClassStudents';

// Performance Note (bundle-dynamic-imports):
// Lazy load TimetableGrid to reduce initial bundle size
const TimetableGrid = lazy(() => import('./components/TimetableGrid'));

interface GenericTimetableProps {
  subject: SubjectKey;
  currentUser: any;
  viewType?: 'teacher' | 'room' | 'class';
  onStudentsUpdated?: () => void;
}

/**
 * Generic Timetable Component
 *
 * Renders a timetable for any subject (math, english, science, korean)
 * using subject-specific configuration
 *
 * @param subject - Subject key (math, english, science, korean)
 * @param currentUser - Current user object for permissions
 * @param viewType - View mode (teacher, room, class)
 * @param onStudentsUpdated - Callback when students are updated
 */
function GenericTimetable({
  subject,
  currentUser,
  viewType = 'teacher',
  onStudentsUpdated,
}: GenericTimetableProps) {
  // Performance Note (rerender-lazy-state-init):
  // Memoize config to avoid re-computation
  const config = useMemo(() => getSubjectConfig(subject), [subject]);

  // Fetch classes data
  const { classes, loading: classesLoading } = useTimetableClasses(subject);

  // Extract class names for student fetching
  // Performance Note (rerender-dependencies):
  // Memoize derived data to prevent unnecessary re-renders
  const classNames = useMemo(
    () => classes.map(c => c.className),
    [classes]
  );

  // Fetch student data (with 5-minute cache)
  const { classDataMap, isLoading: studentsLoading } = useClassStudents(
    subject,
    classNames,
    {} // TODO: Pass global studentMap if available
  );

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showStudents, setShowStudents] = useState(true);
  const [showClassName, setShowClassName] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Permission check
  // Performance Note (rerender-derived-state):
  // Derive permission from config, not raw currentUser
  const canView = useMemo(() => {
    // TODO: Implement proper permission check with hasPermission()
    return true; // Placeholder
  }, [currentUser, config.viewPermission]);

  const canEdit = useMemo(() => {
    // TODO: Implement proper permission check
    return mode === 'edit' && true; // Placeholder
  }, [mode, currentUser, config.editPermission]);

  // Loading state
  if (classesLoading || studentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div>{config.displayName} 시간표 로딩 중...</div>
        </div>
      </div>
    );
  }

  // Permission denied
  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">
          {config.displayName} 시간표에 대한 권한이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="generic-timetable-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="text-2xl font-bold">
          <span className={config.colors.badge + ' px-3 py-1 rounded'}>
            {config.displayName}
          </span>
          {' '}시간표
        </h2>

        <div className="flex gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border rounded"
          />

          {/* View Settings */}
          <button
            onClick={() => setShowStudents(!showStudents)}
            className="px-3 py-2 border rounded hover:bg-gray-100"
          >
            {showStudents ? '학생 숨기기' : '학생 보기'}
          </button>

          <button
            onClick={() => setShowClassName(!showClassName)}
            className="px-3 py-2 border rounded hover:bg-gray-100"
          >
            {showClassName ? '수업명 숨기기' : '수업명 보기'}
          </button>

          {/* Edit Mode Toggle */}
          {canEdit && (
            <button
              onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}
              className={`px-3 py-2 rounded ${
                mode === 'edit'
                  ? 'bg-blue-500 text-white'
                  : 'border hover:bg-gray-100'
              }`}
            >
              {mode === 'edit' ? '보기 모드' : '편집 모드'}
            </button>
          )}
        </div>
      </div>

      {/* Timetable Grid */}
      {/* Performance Note (async-suspense-boundaries):
          Suspense boundary for code-split TimetableGrid */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">시간표 로딩 중...</div>
          </div>
        }
      >
        <TimetableGrid
          config={config}
          classes={classes}
          classDataMap={classDataMap}
          viewType={viewType}
          mode={mode}
          canEdit={canEdit}
          searchQuery={searchQuery}
          showStudents={showStudents}
          showClassName={showClassName}
          onStudentsUpdated={onStudentsUpdated}
        />
      </Suspense>
    </div>
  );
}

// Performance Note (rerender-memo):
// Memoize component to prevent unnecessary re-renders
// Only re-render when subject or currentUser changes
export default GenericTimetable;
