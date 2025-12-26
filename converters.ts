// Firestore Converters for Korean Localization
import { CalendarEvent, Department } from './types';

export const departmentConverter = {
    toFirestore: (dept: Department) => {
        return {
            부서명: dept.name,
            순서: dept.order,
            색상: dept.color,
            기본색상: dept.defaultColor || '#fee2e2',
            기본글자색: dept.defaultTextColor || '#000000',
            기본테두리색: dept.defaultBorderColor || '#fee2e2',
            카테고리: dept.category || '' // Add Category
        };
    },
    fromFirestore: (snapshot: any, options: any) => {
        const data = snapshot.data(options);
        return {
            id: snapshot.id,
            name: data.부서명,
            order: data.순서,
            color: data.색상,
            defaultColor: data.기본색상 || '#fee2e2',
            defaultTextColor: data.기본글자색 || '#000000',
            defaultBorderColor: data.기본테두리색 || '#fee2e2',
            category: data.카테고리 || undefined // Load Category
        } as Department;
    }
};

export const eventConverter = {
    toFirestore: (event: CalendarEvent) => {
        const data: Record<string, any> = {
            제목: event.title,
            상세내용: event.description || '',
            참가자: event.participants || '',
            부서ID: event.departmentId,
            시작일: event.startDate,
            종료일: event.endDate,
            시작시간: event.startTime || '',
            종료시간: event.endTime || '',
            하루종일: event.isAllDay || false,
            색상: event.color,
            글자색: event.textColor,
            테두리색: event.borderColor,
            작성자ID: event.authorId || '',
            작성자명: event.authorName || '',
            생성일시: event.createdAt || new Date().toISOString(),
            수정일시: new Date().toISOString(),
            참가현황: event.attendance || {},
            // Recurrence fields
            반복그룹ID: event.recurrenceGroupId || '',
            반복순서: event.recurrenceIndex || 0,
            반복유형: event.recurrenceType || ''
        };
        // Filter out any remaining undefined values
        Object.keys(data).forEach(key => {
            if (data[key] === undefined) {
                delete data[key];
            }
        });
        return data;
    },
    fromFirestore: (snapshot: any, options: any) => {
        const data = snapshot.data(options);
        // Robustness: If time is empty, treat as All Day (even if field is missing)
        const inferredAllDay = data.하루종일 || (data.시작시간 === '' && data.종료시간 === '');

        return {
            id: snapshot.id,
            title: data.제목,
            description: data.상세내용,
            participants: data.참가자,
            departmentId: data.부서ID,
            startDate: data.시작일,
            endDate: data.종료일,
            startTime: data.시작시간,
            endTime: data.종료시간,
            isAllDay: inferredAllDay,
            color: data.색상,
            textColor: data.글자색 || '#ffffff', // Default to white for existing events
            borderColor: data.테두리색 || data.색상 || 'transparent', // Default to bg color if missing
            authorId: data.작성자ID,
            authorName: data.작성자명,
            createdAt: data.생성일시,
            updatedAt: data.수정일시,
            attendance: data.참가현황,
            // Recurrence fields
            recurrenceGroupId: data.반복그룹ID || undefined,
            recurrenceIndex: data.반복순서 || undefined,
            recurrenceType: data.반복유형 || undefined
        } as CalendarEvent;
    }
};
