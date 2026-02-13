import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ClassCard가 export default React.memo(ClassCard, ...) 이고 StudentItem은 내부 컴포넌트
// ClassCard를 통해 간접 테스트: 학생 데이터에 isTransferred/withdrawalDate를 설정하고 렌더 확인

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Clock: () => React.createElement('span', { 'data-testid': 'clock-icon' }, 'Clock'),
}));

// Mock PortalTooltip
vi.mock('../../../../components/Common/PortalTooltip', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../../Common/PortalTooltip', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../components/Common/PortalTooltip', () => ({
  default: ({ children }: any) => children,
}));

// 포탈 관련 createPortal mock
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (node: any) => node,
  };
});

import ClassCard from '../../components/Timetable/Math/components/ClassCard';
import { TimetableClass } from '../../types';
import { formatDateKey } from '../../utils/dateUtils';
import { addDays, subDays } from 'date-fns';

// formatSchoolGrade mock
vi.mock('../../utils/studentUtils', () => ({
  formatSchoolGrade: (school: string | null, grade: string | null) => {
    if (school && grade) return `${school}${grade}`;
    return school || grade || '-';
  },
}));

// gridUtils mock
vi.mock('../../components/Timetable/Math/utils/gridUtils', () => ({
  getSubjectTheme: () => ({
    bg: 'bg-white',
    text: 'text-gray-800',
    border: 'border-gray-200',
    header: 'bg-gray-100',
  }),
}));

// constants mock
vi.mock('../../components/Timetable/constants', () => ({
  MATH_PERIOD_INFO: {},
  MATH_PERIOD_TIMES: {},
  WEEKEND_PERIOD_INFO: {},
  WEEKEND_PERIOD_TIMES: {},
}));

const today = formatDateKey(new Date());
const futureDate = formatDateKey(addDays(new Date(), 30));
const pastDate = formatDateKey(subDays(new Date(), 30));

const makeClass = (students: any[]): TimetableClass => ({
  id: 'cls1',
  className: '수학A',
  subject: 'math',
  studentIds: students.map(s => s.id),
  studentList: students,
  schedule: [],
  days: ['월'],
});

const defaultCardProps = {
  span: 1,
  searchQuery: '',
  showStudents: true,
  showClassName: false,
  showSchool: false,
  showGrade: false,
  canEdit: false,
  isDragOver: false,
  onClick: vi.fn(),
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDragLeave: vi.fn(),
  onDrop: vi.fn(),
  studentMap: {},
  currentDay: '월',
};

describe('ClassCard - 학생 분류 및 스타일', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('반이동예정 학생 (isTransferred + 미래 withdrawalDate)', () => {
    it('재원생 섹션에 표시된다', () => {
      const students = [
        { id: 's1', name: '반이동예정학생', isTransferred: true, withdrawalDate: futureDate },
        { id: 's2', name: '일반학생' },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} />);

      // "재원생" 섹션 라벨에 2명 표시
      expect(screen.getByText(/2\s*명 - 재원생/)).toBeInTheDocument();
      // 학생 이름 표시
      expect(screen.getByText('반이동예정학생')).toBeInTheDocument();
      expect(screen.getByText('일반학생')).toBeInTheDocument();
    });

    it('보라색(purple) 스타일이 적용된다', () => {
      const students = [
        { id: 's1', name: '반이동예정학생', isTransferred: true, withdrawalDate: futureDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} />);

      const studentEl = screen.getByText('반이동예정학생');
      expect(studentEl.className).toContain('bg-purple-200');
      expect(studentEl.className).toContain('text-purple-800');
    });

    it('마우스 오버 시 "반이동예정: YYYY-MM-DD" 툴팁이 표시된다', () => {
      const students = [
        { id: 's1', name: '반이동학생', isTransferred: true, withdrawalDate: futureDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} />);

      const studentEl = screen.getByText('반이동학생');
      expect(studentEl.getAttribute('title')).toContain(`반이동예정: ${futureDate}`);
    });
  });

  describe('퇴원예정 학생 (!isTransferred + 미래 withdrawalDate)', () => {
    it('퇴원예정 섹션에 표시된다', () => {
      const students = [
        { id: 's1', name: '퇴원예정학생', isTransferred: false, withdrawalDate: futureDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} showWithdrawnStudents />);

      // 퇴원예정 섹션 라벨 (JSX 표현식+텍스트 사이 공백 → 정규식 매칭)
      expect(screen.getByText(/1\s*명 - 퇴원예정/)).toBeInTheDocument();
      // 미래 퇴원예정 학생은 재원생 + 퇴원예정 양쪽에 표시되므로 2개
      expect(screen.getAllByText('퇴원예정학생')).toHaveLength(2);
    });

    it('퇴원예정 학생도 재원생 섹션에 포함된다 (미래 withdrawalDate는 아직 재원)', () => {
      const students = [
        { id: 's1', name: '일반학생' },
        { id: 's2', name: '퇴원예정학생', withdrawalDate: futureDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} showWithdrawnStudents />);

      // 미래 퇴원예정 학생은 active에도 포함 → 재원생 2명
      expect(screen.getByText(/2\s*명 - 재원생/)).toBeInTheDocument();
      // 동시에 퇴원예정 섹션에도 표시
      expect(screen.getByText(/1\s*명 - 퇴원예정/)).toBeInTheDocument();
    });
  });

  describe('과거 퇴원 학생', () => {
    it('퇴원 섹션에 표시된다', () => {
      const students = [
        { id: 's1', name: '퇴원학생', withdrawalDate: pastDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} showWithdrawnStudents />);

      expect(screen.getByText(/1\s*명 - 퇴원$/)).toBeInTheDocument();
      expect(screen.getByText('퇴원학생')).toBeInTheDocument();
    });

    it('재원생 카운트에 포함되지 않는다', () => {
      const students = [
        { id: 's1', name: '일반학생' },
        { id: 's2', name: '퇴원학생', withdrawalDate: pastDate },
      ];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} showWithdrawnStudents />);

      expect(screen.getByText(/1\s*명 - 재원생/)).toBeInTheDocument();
    });
  });

  describe('pendingMoved 학생 (드래그 이동 대기)', () => {
    it('진한 보라색(purple-400) 스타일이 적용된다', () => {
      const students = [{ id: 's1', name: '이동대기학생' }];

      render(
        <ClassCard
          {...defaultCardProps}
          cls={makeClass(students)}
          pendingMovedStudentIds={new Set(['s1'])}
        />
      );

      const studentEl = screen.getByText('이동대기학생');
      expect(studentEl.className).toContain('bg-purple-400');
      expect(studentEl.className).toContain('text-white');
    });

    it('scheduledDate가 있으면 "이동 예정일" 툴팁이 표시된다', () => {
      const students = [{ id: 's1', name: '이동대기학생' }];

      render(
        <ClassCard
          {...defaultCardProps}
          cls={makeClass(students)}
          pendingMovedStudentIds={new Set(['s1'])}
          pendingMoveSchedules={new Map([['s1', '2026-04-01']])}
        />
      );

      const studentEl = screen.getByText('이동대기학생');
      expect(studentEl.getAttribute('title')).toContain('이동 예정일: 2026-04-01');
    });

    it('scheduledDate가 없으면 "즉시 이동 (저장 대기)" 툴팁이 표시된다', () => {
      const students = [{ id: 's1', name: '이동대기학생' }];

      render(
        <ClassCard
          {...defaultCardProps}
          cls={makeClass(students)}
          pendingMovedStudentIds={new Set(['s1'])}
        />
      );

      const studentEl = screen.getByText('이동대기학생');
      expect(studentEl.getAttribute('title')).toContain('즉시 이동 (저장 대기)');
    });
  });

  describe('반이동 들어온 학생 (isTransferredIn)', () => {
    it('초록 배경 스타일이 적용된다', () => {
      const students = [{ id: 's1', name: '반이동In학생', isTransferredIn: true }];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} />);

      const studentEl = screen.getByText('반이동In학생');
      expect(studentEl.className).toContain('bg-green-200');
    });

    it('"반이동 학생" 툴팁이 표시된다', () => {
      const students = [{ id: 's1', name: '반이동In학생', isTransferredIn: true }];

      render(<ClassCard {...defaultCardProps} cls={makeClass(students)} />);

      const studentEl = screen.getByText('반이동In학생');
      expect(studentEl.getAttribute('title')).toContain('반이동 학생');
    });
  });

  describe('스타일 우선순위', () => {
    it('pendingMoved > isTransferScheduled > isHighlighted > enrollmentStyle', () => {
      // pendingMoved + isTransferred + withdrawalDate → pendingMoved가 우선
      const students = [
        { id: 's1', name: '복합학생', isTransferred: true, withdrawalDate: futureDate },
      ];

      render(
        <ClassCard
          {...defaultCardProps}
          cls={makeClass(students)}
          pendingMovedStudentIds={new Set(['s1'])}
        />
      );

      const studentEl = screen.getByText('복합학생');
      // pendingMoved(purple-400)가 우선
      expect(studentEl.className).toContain('bg-purple-400');
      expect(studentEl.className).not.toContain('bg-purple-200');
    });
  });

  describe('학생 클릭', () => {
    it('onStudentClick이 제공되면 클릭 시 호출된다', () => {
      const onStudentClick = vi.fn();
      const students = [{ id: 's1', name: '클릭학생' }];

      render(
        <ClassCard
          {...defaultCardProps}
          cls={makeClass(students)}
          onStudentClick={onStudentClick}
        />
      );

      fireEvent.click(screen.getByText('클릭학생'));
      expect(onStudentClick).toHaveBeenCalledWith('s1');
    });
  });
});
