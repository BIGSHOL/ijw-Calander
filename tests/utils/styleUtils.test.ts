import { describe, it, expect } from 'vitest';
import {
  SUBJECT_COLORS,
  SUBJECT_LABELS,
  getSubjectBadgeClass,
  getSubjectLightBg,
  getJobTitleStyle,
} from '../../utils/styleUtils';

describe('styleUtils', () => {
  describe('SUBJECT_COLORS', () => {
    it('모든 과목 타입에 대한 색상이 정의되어 있어야 함', () => {
      const subjects = ['math', 'english', 'science', 'korean', 'other'];

      subjects.forEach(subject => {
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toBeDefined();
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('bg');
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('text');
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('border');
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('light');
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('badge');
        expect(SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS]).toHaveProperty('badgeAlt');
      });
    });

    it('수학은 골드/노란색 계열이어야 함', () => {
      expect(SUBJECT_COLORS.math.bg).toBe('#fdb813');
      expect(SUBJECT_COLORS.math.text).toBe('#081429');
    });

    it('영어는 네이비/파란색 계열이어야 함', () => {
      expect(SUBJECT_COLORS.english.bg).toBe('#081429');
      expect(SUBJECT_COLORS.english.text).toBe('#ffffff');
    });
  });

  describe('SUBJECT_LABELS', () => {
    it('모든 과목 타입에 대한 라벨이 정의되어 있어야 함', () => {
      expect(SUBJECT_LABELS.math).toBe('수학');
      expect(SUBJECT_LABELS.english).toBe('영어');
      expect(SUBJECT_LABELS.science).toBe('과학');
      expect(SUBJECT_LABELS.korean).toBe('국어');
      expect(SUBJECT_LABELS.other).toBe('기타');
    });
  });

  describe('getSubjectBadgeClass', () => {
    it('기본 variant에 대한 배지 클래스를 반환해야 함', () => {
      expect(getSubjectBadgeClass('math')).toBe('bg-[#fdb813] text-[#081429]');
      expect(getSubjectBadgeClass('english')).toBe('bg-[#081429] text-white');
    });

    it('alt variant에 대한 배지 클래스를 반환해야 함', () => {
      expect(getSubjectBadgeClass('math', 'alt')).toBe('bg-[#081429] text-[#fdb813]');
      expect(getSubjectBadgeClass('english', 'alt')).toBe(
        'bg-white text-[#081429] border border-[#081429]'
      );
    });

    it('존재하지 않는 과목은 수학 기본값을 사용해야 함', () => {
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(getSubjectBadgeClass('unknown')).toBe('bg-[#fdb813] text-[#081429]');
    });
  });

  describe('getSubjectLightBg', () => {
    it('각 과목의 연한 배경색을 반환해야 함', () => {
      expect(getSubjectLightBg('math')).toBe('#fef9e7');
      expect(getSubjectLightBg('english')).toBe('#f0f4f8');
      expect(getSubjectLightBg('science')).toBe('#ecfdf5');
      expect(getSubjectLightBg('korean')).toBe('#fef2f2');
      expect(getSubjectLightBg('other')).toBe('#f9fafb');
    });

    it('존재하지 않는 과목은 수학 기본값을 사용해야 함', () => {
      // @ts-expect-error - 테스트를 위한 잘못된 타입
      expect(getSubjectLightBg('unknown')).toBe('#fef9e7');
    });
  });

  describe('getJobTitleStyle', () => {
    it('원장/대표는 앰버 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('원장')).toContain('bg-amber-100');
      expect(getJobTitleStyle('대표')).toContain('bg-amber-100');
      expect(getJobTitleStyle('원장님')).toContain('text-amber-700');
    });

    it('이사는 보라색 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('이사')).toContain('bg-purple-100');
      expect(getJobTitleStyle('이사님')).toContain('text-purple-700');
    });

    it('부장은 인디고 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('부장')).toContain('bg-indigo-100');
      expect(getJobTitleStyle('영어부장')).toContain('text-indigo-700');
    });

    it('실장/팀장은 파란색 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('실장')).toContain('bg-blue-100');
      expect(getJobTitleStyle('팀장')).toContain('bg-blue-100');
      expect(getJobTitleStyle('관리팀장')).toContain('text-blue-700');
    });

    it('대리는 녹색 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('대리')).toContain('bg-green-100');
      expect(getJobTitleStyle('영업대리')).toContain('text-green-700');
    });

    it('강사는 핑크 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('강사')).toContain('bg-pink-100');
      expect(getJobTitleStyle('수학강사')).toContain('text-pink-700');
    });

    it('기타 직책은 회색 스타일을 반환해야 함', () => {
      expect(getJobTitleStyle('사원')).toContain('bg-gray-100');
      expect(getJobTitleStyle('인턴')).toContain('text-gray-600');
      expect(getJobTitleStyle('')).toContain('bg-gray-100');
      expect(getJobTitleStyle()).toContain('bg-gray-100');
    });

    it('여러 키워드가 포함된 경우 우선순위가 적용되어야 함', () => {
      // 원장 > 부장
      expect(getJobTitleStyle('원장부장')).toContain('bg-amber-100');
      // 이사 > 대리
      expect(getJobTitleStyle('이사대리')).toContain('bg-purple-100');
    });
  });
});
