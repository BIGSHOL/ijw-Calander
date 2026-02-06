import { convertGanttProjectsToCalendarEvents } from '../../utils/ganttToCalendar';
import { GanttProject } from '../../types';

// 테스트용 헬퍼: 날짜 문자열을 타임스탬프로 변환
const toTimestamp = (dateStr: string) => new Date(dateStr).getTime();

// 테스트용 기본 프로젝트 필드
const baseProject = {
  templateId: 'template1',
  progress: 0,
  lastUpdated: Date.now(),
};

// 테스트용 기본 태스크 필드
const baseTask = {
  description: '',
  completed: false,
};

describe('ganttToCalendar', () => {
  describe('convertGanttProjectsToCalendarEvents', () => {
    it('빈 프로젝트 배열은 빈 이벤트 배열을 반환해야 함', () => {
      const result = convertGanttProjectsToCalendarEvents([]);
      expect(result).toEqual([]);
    });

    it('간트 프로젝트를 캘린더 이벤트로 변환해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project1',
          title: '테스트 프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업 1',
              description: '작업 설명',
              startOffset: 0,
              duration: 5,
              departmentIds: ['dept1'],
              assigneeName: '홍길동',
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'gantt-project1-task1',
        title: '[테스트 프로젝트] 작업 1',
        description: '작업 설명',
        departmentId: 'dept1',
        departmentIds: ['dept1'],
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        isAllDay: true,
        color: '#8b5cf6',
        textColor: '#ffffff',
        borderColor: '#7c3aed',
        authorId: 'user1',
        participants: '홍길동',
      });
    });

    it('startOffset을 올바르게 계산해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project2',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 10,
              duration: 3,
              departmentIds: ['dept1'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result[0].startDate).toBe('2026-01-11');
      expect(result[0].endDate).toBe('2026-01-13');
    });

    it('duration을 올바르게 계산해야 함 (inclusive)', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project3',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 0,
              duration: 1,
              departmentIds: ['dept1'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      // duration 1 = 1일 (시작일 = 종료일)
      expect(result[0].startDate).toBe('2026-01-01');
      expect(result[0].endDate).toBe('2026-01-01');
    });

    it('여러 작업을 가진 프로젝트를 처리해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project4',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업 1',
              startOffset: 0,
              duration: 3,
              departmentIds: ['dept1'],
            },
            {
              ...baseTask,
              id: 'task2',
              title: '작업 2',
              startOffset: 3,
              duration: 2,
              departmentIds: ['dept2'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('gantt-project4-task1');
      expect(result[1].id).toBe('gantt-project4-task2');
      expect(result[0].departmentId).toBe('dept1');
      expect(result[1].departmentId).toBe('dept2');
    });

    it('여러 프로젝트를 처리해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project1',
          title: '프로젝트 1',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업 1',
              startOffset: 0,
              duration: 1,
              departmentIds: ['dept1'],
            },
          ],
        },
        {
          ...baseProject,
          id: 'project2',
          title: '프로젝트 2',
          startedAt: toTimestamp('2026-02-01'),
          ownerId: 'user2',
          tasks: [
            {
              ...baseTask,
              id: 'task2',
              title: '작업 2',
              startOffset: 0,
              duration: 1,
              departmentIds: ['dept2'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('[프로젝트 1] 작업 1');
      expect(result[1].title).toBe('[프로젝트 2] 작업 2');
      expect(result[0].startDate).toBe('2026-01-01');
      expect(result[1].startDate).toBe('2026-02-01');
    });

    it('departmentIds가 없으면 general을 사용해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project5',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 0,
              duration: 1,
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result[0].departmentId).toBe('general');
    });

    it('assigneeName이 없으면 participants가 undefined여야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project6',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 0,
              duration: 1,
              departmentIds: ['dept1'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result[0].participants).toBeUndefined();
    });

    it('description이 없으면 기본 설명을 사용해야 함', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project7',
          title: '프로젝트 제목',
          startedAt: toTimestamp('2026-01-01'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 0,
              duration: 1,
              departmentIds: ['dept1'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result[0].description).toBe('Gantt Task from project: 프로젝트 제목');
    });

    it('날짜 경계를 올바르게 처리해야 함 (월 넘어가는 경우)', () => {
      const projects: GanttProject[] = [
        {
          ...baseProject,
          id: 'project8',
          title: '프로젝트',
          startedAt: toTimestamp('2026-01-30'),
          ownerId: 'user1',
          tasks: [
            {
              ...baseTask,
              id: 'task1',
              title: '작업',
              startOffset: 0,
              duration: 5,
              departmentIds: ['dept1'],
            },
          ],
        },
      ];

      const result = convertGanttProjectsToCalendarEvents(projects);

      expect(result[0].startDate).toBe('2026-01-30');
      expect(result[0].endDate).toBe('2026-02-03');
    });
  });
});
