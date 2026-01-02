import { GanttProject, CalendarEvent } from '../types';

const GANTT_EVENT_COLOR = '#8b5cf6'; // Purple for Gantt distinction

/**
 * Converts Gantt Project tasks into CalendarEvent objects.
 * These events appear as "All Day" events on the main calendar.
 */
export const convertGanttProjectsToCalendarEvents = (
    projects: GanttProject[]
): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    for (const project of projects) {
        const projectStartDate = new Date(project.startedAt);

        for (const task of project.tasks) {
            // Calculate actual start and end dates based on offsets
            const taskStartDate = new Date(projectStartDate);
            taskStartDate.setDate(taskStartDate.getDate() + task.startOffset);

            const taskEndDate = new Date(taskStartDate);
            taskEndDate.setDate(taskEndDate.getDate() + task.duration - 1); // Duration is inclusive

            // Format dates as ISO strings (YYYY-MM-DD)
            const startDateStr = taskStartDate.toISOString().split('T')[0];
            const endDateStr = taskEndDate.toISOString().split('T')[0];

            const calendarEvent: CalendarEvent = {
                id: `gantt-${project.id}-${task.id}`,
                departmentId: task.departmentIds?.[0] || 'general', // Primary department or fallback
                departmentIds: task.departmentIds,
                title: `[${project.title}] ${task.title}`,
                description: task.description || `Gantt Task from project: ${project.title}`,
                startDate: startDateStr,
                endDate: endDateStr,
                isAllDay: true,
                color: GANTT_EVENT_COLOR,
                textColor: '#ffffff',
                borderColor: '#7c3aed', // Darker purple border
                authorId: project.ownerId,
                participants: task.assigneeName || undefined,
            };

            events.push(calendarEvent);
        }
    }

    return events;
};
