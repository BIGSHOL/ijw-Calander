import { describe, it, expect } from 'vitest';
import {
    parseScheduleSlots,
    timeRangesOverlap,
    detectScheduleConflicts,
} from '../../components/Timetable/TimetableManager';

describe('parseScheduleSlots', () => {
    it('레거시 형식("월 1-1")을 {월, 14:30, 15:25}로 파싱', () => {
        const slots = parseScheduleSlots(['월 1-1'], '수학');
        expect(slots).toEqual([{ day: '월', start: '14:30', end: '15:25' }]);
    });

    it('통일 형식("수 3")을 수학 기준 {수, 16:20, 17:15}로 파싱', () => {
        const slots = parseScheduleSlots(['수 3'], '수학');
        expect(slots).toEqual([{ day: '수', start: '16:20', end: '17:15' }]);
    });

    it('영어 과목은 ENGLISH_PERIOD_INFO 사용 — "화 7" → 18:20~19:15', () => {
        const slots = parseScheduleSlots(['화 7'], '영어');
        expect(slots).toEqual([{ day: '화', start: '18:20', end: '19:15' }]);
    });

    it('주말(토/일)은 WEEKEND_PERIOD_INFO 사용 — "토 2" → 10:00~11:00', () => {
        const slots = parseScheduleSlots(['토 2'], '수학');
        expect(slots).toEqual([{ day: '토', start: '10:00', end: '11:00' }]);
    });

    it('주말 레거시 키도 허용 — "일 2-1" → 11:00~12:00', () => {
        const slots = parseScheduleSlots(['일 2-1'], '수학');
        expect(slots).toEqual([{ day: '일', start: '11:00', end: '12:00' }]);
    });

    it('고등수학은 수학 시간표 사용', () => {
        const slots = parseScheduleSlots(['금 5'], '고등수학');
        expect(slots).toEqual([{ day: '금', start: '18:20', end: '19:15' }]);
    });

    it('빈/무효 스케줄은 빈 배열', () => {
        expect(parseScheduleSlots(undefined, '수학')).toEqual([]);
        expect(parseScheduleSlots([], '수학')).toEqual([]);
        expect(parseScheduleSlots(['이상한값'], '수학')).toEqual([]);
    });

    it('복수 슬롯을 모두 파싱', () => {
        const slots = parseScheduleSlots(['월 1', '목 1'], '수학');
        expect(slots).toHaveLength(2);
        expect(slots[0]).toEqual({ day: '월', start: '14:30', end: '15:25' });
        expect(slots[1]).toEqual({ day: '목', start: '14:30', end: '15:25' });
    });
});

describe('timeRangesOverlap', () => {
    it('동일 시간대는 겹침', () => {
        expect(timeRangesOverlap(
            { start: '16:20', end: '17:15' },
            { start: '16:20', end: '17:15' }
        )).toBe(true);
    });

    it('일부 겹침은 겹침', () => {
        expect(timeRangesOverlap(
            { start: '16:20', end: '17:15' },
            { start: '17:00', end: '18:00' }
        )).toBe(true);
    });

    it('끝점이 붙은(연속) 시간은 겹치지 않음', () => {
        expect(timeRangesOverlap(
            { start: '15:25', end: '16:20' },
            { start: '16:20', end: '17:15' }
        )).toBe(false);
    });

    it('완전히 분리된 시간은 겹치지 않음', () => {
        expect(timeRangesOverlap(
            { start: '14:30', end: '15:25' },
            { start: '18:20', end: '19:15' }
        )).toBe(false);
    });

    it('한쪽이 다른쪽을 완전히 포함하면 겹침', () => {
        expect(timeRangesOverlap(
            { start: '14:00', end: '20:00' },
            { start: '16:20', end: '17:15' }
        )).toBe(true);
    });
});

describe('detectScheduleConflicts', () => {
    const mkClass = (id: string, className: string, subject: string, schedule: string[], studentIds: string[]) => ({
        id,
        className,
        subject,
        schedule,
        studentList: studentIds.map(sid => ({ id: sid })),
    });

    it('충돌 없음 — 다른 요일, 다른 시간', () => {
        const student = 'S1';
        const toClass = mkClass('T', '수학-B', '수학', ['수 3'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['월 3'], [student]),           // 출발 반
            mkClass('E', '영어-X', '영어', ['화 7'], [student]),           // 화요일 18:20~19:15
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);
    });

    it('같은 요일 같은 시간 → 충돌 감지', () => {
        const student = 'S1';
        // 수요일 5교시 수학(18:20~19:15)로 이동
        const toClass = mkClass('T', '수학-B', '수학', ['수 5'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['월 5'], [student]),           // 출발
            // 영어 수요일 7교시 = 18:20~19:15 (같은 시간)
            mkClass('E', '영어-Gina', '영어', ['수 7'], [student]),
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toEqual({
            className: '영어-Gina',
            day: '수',
            time: '18:20~19:15',
        });
    });

    it('같은 요일이지만 시간이 연속이면 충돌 아님 (back-to-back)', () => {
        const student = 'S1';
        // 수학 1교시 14:30~15:25로 이동
        const toClass = mkClass('T', '수학-B', '수학', ['월 1'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['화 1'], [student]),
            // 수학 2교시 15:25~16:20 (1교시 끝 == 2교시 시작)
            mkClass('N', '수학-Next', '수학', ['월 2'], [student]),
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);
    });

    it('출발 반은 충돌 검사에서 제외', () => {
        const student = 'S1';
        const toClass = mkClass('T', '수학-B', '수학', ['월 3'], []);
        const allClasses = [
            // 출발 반 — 월 3교시로 동일하지만 제외되어야 함
            mkClass('F', '수학-A', '수학', ['월 3'], [student]),
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);
    });

    it('도착 반 자기 자신도 제외', () => {
        const student = 'S1';
        const toClass = mkClass('T', '수학-B', '수학', ['월 3'], [student]);
        const allClasses = [toClass];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);
    });

    it('그 학생이 없는 반은 검사하지 않음', () => {
        const student = 'S1';
        const toClass = mkClass('T', '수학-B', '수학', ['월 5'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['화 1'], [student]),
            mkClass('O', '영어-Other', '영어', ['월 7'], ['S2']),  // 다른 학생만 등록
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);
    });

    it('퇴원 학생(withdrawalDate 설정)은 활성 처리 안 함', () => {
        const student = 'S1';
        const toClass = {
            id: 'T', className: '수학-B', subject: '수학', schedule: ['월 5'],
            studentList: [] as Array<{ id: string; withdrawalDate?: string }>,
        };
        const withdrawnOther = {
            id: 'O', className: '영어-W', subject: '영어', schedule: ['월 7'],  // 같은 시간이지만
            studentList: [{ id: student, withdrawalDate: '2026-01-01' }],       // 퇴원
        };
        const conflicts = detectScheduleConflicts(student, 'F', toClass as any, [withdrawnOther, toClass] as any);
        expect(conflicts).toEqual([]);
    });

    it('도착 반이 주말이면 WEEKEND_PERIOD_INFO와 비교', () => {
        const student = 'S1';
        // 토요일 2교시 10:00~11:00
        const toClass = mkClass('T', '수학-B', '수학', ['토 2'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['월 3'], [student]),
            // 토요일 3교시 11:00~12:00 — 연속 (충돌 X)
            mkClass('S', '수학-Sat', '수학', ['토 3'], [student]),
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        expect(conflicts).toEqual([]);

        // 토요일 2교시 10:00~11:00 과 토요일 3교시 10:30~11:30 과 겹치는 케이스는 없음 (주말은 1시간 단위)
        // 토요일 2교시와 2교시 (자기 자신) 겹치는 케이스 아님
    });

    it('중복된 충돌은 한 번만 기록 (같은 반 여러 슬롯 겹침)', () => {
        const student = 'S1';
        // 월/목 5교시로 이동
        const toClass = mkClass('T', '수학-B', '수학', ['월 5', '목 5'], []);
        const allClasses = [
            mkClass('F', '수학-A', '수학', ['화 5'], [student]),
            // 월/목 5교시 모두 겹치는 영어 반
            mkClass('E', '영어-Big', '영어', ['월 7', '목 7'], [student]),
            toClass,
        ];
        const conflicts = detectScheduleConflicts(student, 'F', toClass, allClasses);
        // 월 5교시 vs 월 7교시, 목 5교시 vs 목 7교시 → 2건 (각각 다른 슬롯)
        expect(conflicts).toHaveLength(2);
        expect(conflicts.map(c => c.day).sort()).toEqual(['목', '월']);
    });
});
