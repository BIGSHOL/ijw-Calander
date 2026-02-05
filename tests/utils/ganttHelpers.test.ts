import { describe, it, expect } from 'vitest';
import { normalizeGanttSubTask, normalizeGanttTasks } from '../../utils/ganttHelpers';

describe('ganttHelpers', () => {
  describe('normalizeGanttSubTask', () => {
    it('모든 Phase 7 필드가 있는 작업을 그대로 반환해야 함', () => {
      const task = {
        id: 'task1',
        title: '테스트 작업',
        assigneeId: 'user1',
        assigneeName: '홍길동',
        assigneeEmail: 'hong@example.com',
        departmentIds: ['dept1', 'dept2'],
        startOffset: 0,
        duration: 5,
      };

      const result = normalizeGanttSubTask(task);

      expect(result).toEqual(task);
      expect(result.assigneeId).toBe('user1');
      expect(result.assigneeName).toBe('홍길동');
      expect(result.assigneeEmail).toBe('hong@example.com');
      expect(result.departmentIds).toEqual(['dept1', 'dept2']);
    });

    it('Phase 7 필드가 없는 레거시 작업에 undefined를 추가해야 함', () => {
      const legacyTask = {
        id: 'task2',
        title: '레거시 작업',
        startOffset: 0,
        duration: 3,
      };

      const result = normalizeGanttSubTask(legacyTask);

      expect(result.id).toBe('task2');
      expect(result.title).toBe('레거시 작업');
      expect(result.assigneeId).toBeUndefined();
      expect(result.assigneeName).toBeUndefined();
      expect(result.assigneeEmail).toBeUndefined();
      expect(result.departmentIds).toBeUndefined();
    });

    it('일부 필드만 있는 작업을 올바르게 처리해야 함', () => {
      const partialTask = {
        id: 'task3',
        title: '부분 작업',
        assigneeId: 'user2',
        assigneeName: '김철수',
        startOffset: 1,
        duration: 2,
      };

      const result = normalizeGanttSubTask(partialTask);

      expect(result.assigneeId).toBe('user2');
      expect(result.assigneeName).toBe('김철수');
      expect(result.assigneeEmail).toBeUndefined();
      expect(result.departmentIds).toBeUndefined();
    });

    it('빈 배열 departmentIds를 undefined로 처리하지 않아야 함', () => {
      const task = {
        id: 'task4',
        title: '작업',
        departmentIds: [],
        startOffset: 0,
        duration: 1,
      };

      const result = normalizeGanttSubTask(task);

      expect(result.departmentIds).toEqual([]);
    });

    it('departmentIds가 배열이 아니면 undefined로 설정해야 함', () => {
      const task = {
        id: 'task5',
        title: '작업',
        departmentIds: 'dept1', // 잘못된 타입
        startOffset: 0,
        duration: 1,
      };

      const result = normalizeGanttSubTask(task);

      expect(result.departmentIds).toBeUndefined();
    });
  });

  describe('normalizeGanttTasks', () => {
    it('작업 배열을 정규화해야 함', () => {
      const tasks = [
        {
          id: 'task1',
          title: '작업1',
          assigneeId: 'user1',
          assigneeName: '홍길동',
          startOffset: 0,
          duration: 5,
        },
        {
          id: 'task2',
          title: '작업2',
          startOffset: 1,
          duration: 3,
        },
      ];

      const result = normalizeGanttTasks(tasks);

      expect(result).toHaveLength(2);
      expect(result[0].assigneeId).toBe('user1');
      expect(result[0].assigneeName).toBe('홍길동');
      expect(result[1].assigneeId).toBeUndefined();
      expect(result[1].assigneeName).toBeUndefined();
    });

    it('빈 배열을 빈 배열로 반환해야 함', () => {
      const result = normalizeGanttTasks([]);
      expect(result).toEqual([]);
    });

    it('배열이 아닌 입력은 빈 배열을 반환해야 함', () => {
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(normalizeGanttTasks(null)).toEqual([]);
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(normalizeGanttTasks(undefined)).toEqual([]);
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(normalizeGanttTasks('not an array')).toEqual([]);
    });

    it('각 작업을 개별적으로 정규화해야 함', () => {
      const tasks = [
        { id: '1', title: 'A', assigneeId: 'user1', departmentIds: ['dept1'] },
        { id: '2', title: 'B', departmentIds: 'wrong' },
        { id: '3', title: 'C', assigneeEmail: 'test@example.com' },
      ];

      const result = normalizeGanttTasks(tasks);

      expect(result[0].departmentIds).toEqual(['dept1']);
      expect(result[1].departmentIds).toBeUndefined();
      expect(result[2].assigneeEmail).toBe('test@example.com');
      expect(result[2].assigneeId).toBeUndefined();
    });
  });
});
