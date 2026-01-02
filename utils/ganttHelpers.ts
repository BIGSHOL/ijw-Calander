import { GanttSubTask } from '../types';

/**
 * Normalizes a GanttSubTask to ensure all Phase 7 fields are present (undefined if missing).
 * This handles backward compatibility for existing tasks created before Phase 7.
 */
export const normalizeGanttSubTask = (task: any): GanttSubTask => {
    return {
        ...task,
        assigneeId: task.assigneeId || undefined,
        assigneeName: task.assigneeName || undefined,
        assigneeEmail: task.assigneeEmail || undefined,
        departmentIds: Array.isArray(task.departmentIds) ? task.departmentIds : undefined,
    };
};

/**
 * Normalizes an array of tasks.
 */
export const normalizeGanttTasks = (tasks: any[]): GanttSubTask[] => {
    if (!Array.isArray(tasks)) return [];
    return tasks.map(normalizeGanttSubTask);
};
