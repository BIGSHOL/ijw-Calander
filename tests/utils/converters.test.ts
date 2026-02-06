import { departmentConverter, eventConverter } from '../../converters';
import { Department, CalendarEvent } from '../../types';

describe('converters', () => {
  describe('departmentConverter', () => {
    describe('toFirestore', () => {
      it('모든 필드를 한글 키로 변환해야 함', () => {
        const dept: Department = {
          id: 'dept1',
          name: '수학부',
          order: 1,
          color: '#ff0000',
          defaultColor: '#fee2e2',
          defaultTextColor: '#000000',
          defaultBorderColor: '#fee2e2',
          category: 'education',
        };

        const result = departmentConverter.toFirestore(dept);

        expect(result).toEqual({
          부서명: '수학부',
          순서: 1,
          색상: '#ff0000',
          기본색상: '#fee2e2',
          기본글자색: '#000000',
          기본테두리색: '#fee2e2',
          카테고리: 'education',
        });
      });

      it('기본값을 올바르게 적용해야 함', () => {
        const dept: Department = {
          id: 'dept1',
          name: '영어부',
          order: 2,
          color: '#0000ff',
        };

        const result = departmentConverter.toFirestore(dept);

        expect(result.기본색상).toBe('#fee2e2');
        expect(result.기본글자색).toBe('#000000');
        expect(result.기본테두리색).toBe('#fee2e2');
        expect(result.카테고리).toBe('');
      });
    });

    describe('fromFirestore', () => {
      it('한글 키를 영문 키로 변환해야 함', () => {
        const snapshot = {
          id: 'dept1',
          data: () => ({
            부서명: '수학부',
            순서: 1,
            색상: '#ff0000',
            기본색상: '#fee2e2',
            기본글자색: '#000000',
            기본테두리색: '#fee2e2',
            카테고리: 'education',
          }),
        };

        const result = departmentConverter.fromFirestore(snapshot, {});

        expect(result).toEqual({
          id: 'dept1',
          name: '수학부',
          order: 1,
          color: '#ff0000',
          defaultColor: '#fee2e2',
          defaultTextColor: '#000000',
          defaultBorderColor: '#fee2e2',
          category: 'education',
        });
      });

      it('누락된 필드에 기본값을 적용해야 함', () => {
        const snapshot = {
          id: 'dept2',
          data: () => ({
            부서명: '영어부',
            순서: 2,
            색상: '#0000ff',
          }),
        };

        const result = departmentConverter.fromFirestore(snapshot, {});

        expect(result.defaultColor).toBe('#fee2e2');
        expect(result.defaultTextColor).toBe('#000000');
        expect(result.defaultBorderColor).toBe('#fee2e2');
        expect(result.category).toBeUndefined();
      });
    });
  });

  describe('eventConverter', () => {
    describe('toFirestore', () => {
      it('모든 필드를 한글 키로 변환해야 함', () => {
        const event: CalendarEvent = {
          id: 'event1',
          title: '테스트 이벤트',
          description: '설명',
          participants: '참가자1, 참가자2',
          departmentId: 'dept1',
          departmentIds: ['dept1', 'dept2'],
          startDate: '2026-01-15',
          endDate: '2026-01-16',
          startTime: '09:00',
          endTime: '18:00',
          isAllDay: false,
          color: '#ff0000',
          textColor: '#ffffff',
          borderColor: '#ff0000',
          authorId: 'user1',
          authorName: '작성자',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          version: 1,
          attendance: {},
          referenceUrl: 'https://example.com',
          recurrenceGroupId: 'group1',
          recurrenceIndex: 0,
          recurrenceType: 'weekly',
          relatedGroupId: 'related1',
        };

        const result = eventConverter.toFirestore(event);

        expect(result.제목).toBe('테스트 이벤트');
        expect(result.상세내용).toBe('설명');
        expect(result.참가자).toBe('참가자1, 참가자2');
        expect(result.부서ID).toBe('dept1');
        expect(result.부서ID목록).toEqual(['dept1', 'dept2']);
        expect(result.시작일).toBe('2026-01-15');
        expect(result.종료일).toBe('2026-01-16');
        expect(result.시작시간).toBe('09:00');
        expect(result.종료시간).toBe('18:00');
        expect(result.하루종일).toBe(false);
        expect(result.반복그룹ID).toBe('group1');
      });

      it('undefined 값을 필터링해야 함', () => {
        const event: CalendarEvent = {
          id: 'event2',
          title: '최소 이벤트',
          departmentId: 'dept1',
          startDate: '2026-01-15',
          endDate: '2026-01-15',
          color: '#ff0000',
          textColor: '#ffffff',
          borderColor: '#ff0000',
        };

        const result = eventConverter.toFirestore(event);

        expect(result).not.toHaveProperty('recurrenceGroupId');
        expect(result).not.toHaveProperty('recurrenceIndex');
        expect(result).not.toHaveProperty('recurrenceType');
        expect(result).not.toHaveProperty('relatedGroupId');
      });

      it('수정일시를 자동으로 생성해야 함', () => {
        const event: CalendarEvent = {
          id: 'event3',
          title: '이벤트',
          departmentId: 'dept1',
          startDate: '2026-01-15',
          endDate: '2026-01-15',
          color: '#ff0000',
          textColor: '#ffffff',
          borderColor: '#ff0000',
        };

        const result = eventConverter.toFirestore(event);

        expect(result.수정일시).toBeDefined();
        expect(typeof result.수정일시).toBe('string');
      });
    });

    describe('fromFirestore', () => {
      it('한글 키를 영문 키로 변환해야 함', () => {
        const snapshot = {
          id: 'event1',
          data: () => ({
            제목: '테스트 이벤트',
            상세내용: '설명',
            참가자: '참가자1',
            부서ID: 'dept1',
            부서ID목록: ['dept1', 'dept2'],
            시작일: '2026-01-15',
            종료일: '2026-01-16',
            시작시간: '09:00',
            종료시간: '18:00',
            하루종일: false,
            색상: '#ff0000',
            글자색: '#ffffff',
            테두리색: '#ff0000',
            작성자ID: 'user1',
            작성자명: '작성자',
            생성일시: '2026-01-01T00:00:00Z',
            수정일시: '2026-01-02T00:00:00Z',
            버전: 1,
          }),
        };

        const result = eventConverter.fromFirestore(snapshot, {});

        expect(result.title).toBe('테스트 이벤트');
        expect(result.description).toBe('설명');
        expect(result.departmentId).toBe('dept1');
        expect(result.departmentIds).toEqual(['dept1', 'dept2']);
        expect(result.startDate).toBe('2026-01-15');
        expect(result.isAllDay).toBe(false);
      });

      it('하루종일 이벤트를 추론해야 함 (시간이 비어있을 때)', () => {
        const snapshot = {
          id: 'event2',
          data: () => ({
            제목: '하루종일 이벤트',
            부서ID: 'dept1',
            시작일: '2026-01-15',
            종료일: '2026-01-15',
            시작시간: '',
            종료시간: '',
            색상: '#ff0000',
          }),
        };

        const result = eventConverter.fromFirestore(snapshot, {});

        expect(result.isAllDay).toBe(true);
      });

      it('기본값을 올바르게 적용해야 함', () => {
        const snapshot = {
          id: 'event3',
          data: () => ({
            제목: '최소 이벤트',
            부서ID: 'dept1',
            시작일: '2026-01-15',
            종료일: '2026-01-15',
            색상: '#ff0000',
          }),
        };

        const result = eventConverter.fromFirestore(snapshot, {});

        expect(result.textColor).toBe('#ffffff');
        expect(result.borderColor).toBe('#ff0000');
        expect(result.version).toBe(1);
      });

      it('부서ID목록이 없으면 부서ID로 생성해야 함', () => {
        const snapshot = {
          id: 'event4',
          data: () => ({
            제목: '이벤트',
            부서ID: 'dept1',
            시작일: '2026-01-15',
            종료일: '2026-01-15',
            색상: '#ff0000',
          }),
        };

        const result = eventConverter.fromFirestore(snapshot, {});

        expect(result.departmentIds).toEqual(['dept1']);
      });

      it('부서ID도 없으면 빈 배열로 설정해야 함', () => {
        const snapshot = {
          id: 'event5',
          data: () => ({
            제목: '이벤트',
            시작일: '2026-01-15',
            종료일: '2026-01-15',
            색상: '#ff0000',
          }),
        };

        const result = eventConverter.fromFirestore(snapshot, {});

        expect(result.departmentIds).toEqual([]);
      });
    });
  });
});
