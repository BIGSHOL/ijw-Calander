import {
  mapAttendanceValueToStatus,
  mapAttendanceStatusToValue,
  getAttendanceStatusLabel,
  getAttendanceStatusColor,
} from '../../utils/attendanceSync';

describe('attendanceSync', () => {
  describe('mapAttendanceValueToStatus', () => {
    it('양수 값은 모두 present 반환 (시간 단위)', () => {
      expect(mapAttendanceValueToStatus(1)).toBe('present');
      expect(mapAttendanceValueToStatus(0.5)).toBe('present');
      expect(mapAttendanceValueToStatus(1.5)).toBe('present');
      expect(mapAttendanceValueToStatus(2)).toBe('present');
      expect(mapAttendanceValueToStatus(2.5)).toBe('present');
      expect(mapAttendanceValueToStatus(3)).toBe('present');
    });

    it('0은 absent 반환', () => {
      expect(mapAttendanceValueToStatus(0)).toBe('absent');
    });

    it('null은 absent 반환', () => {
      expect(mapAttendanceValueToStatus(null)).toBe('absent');
    });

    it('음수 값은 absent 반환', () => {
      expect(mapAttendanceValueToStatus(-1)).toBe('absent');
    });
  });

  describe('mapAttendanceStatusToValue', () => {
    it('출석 관련 상태는 1 반환 (등원함)', () => {
      expect(mapAttendanceStatusToValue('present')).toBe(1);
      expect(mapAttendanceStatusToValue('late')).toBe(1);
      expect(mapAttendanceStatusToValue('early_leave')).toBe(1);
    });

    it('결석 관련 상태는 0 반환 (미등원)', () => {
      expect(mapAttendanceStatusToValue('absent')).toBe(0);
      expect(mapAttendanceStatusToValue('excused')).toBe(0);
    });

    it('알 수 없는 상태는 0 반환', () => {
      expect(mapAttendanceStatusToValue('unknown' as any)).toBe(0);
    });
  });

  describe('getAttendanceStatusLabel', () => {
    it('상태별 한글 라벨 반환', () => {
      expect(getAttendanceStatusLabel('present')).toBe('출석');
      expect(getAttendanceStatusLabel('absent')).toBe('결석');
      expect(getAttendanceStatusLabel('late')).toBe('지각');
      expect(getAttendanceStatusLabel('early_leave')).toBe('조퇴');
      expect(getAttendanceStatusLabel('excused')).toBe('사유결석');
    });

    it('알 수 없는 상태는 - 반환', () => {
      expect(getAttendanceStatusLabel('unknown' as any)).toBe('-');
    });
  });

  describe('getAttendanceStatusColor', () => {
    it('상태별 색상 반환', () => {
      expect(getAttendanceStatusColor('present')).toBe('emerald');
      expect(getAttendanceStatusColor('absent')).toBe('red');
      expect(getAttendanceStatusColor('late')).toBe('amber');
      expect(getAttendanceStatusColor('early_leave')).toBe('orange');
      expect(getAttendanceStatusColor('excused')).toBe('blue');
    });

    it('알 수 없는 상태는 gray 반환', () => {
      expect(getAttendanceStatusColor('unknown' as any)).toBe('gray');
    });
  });

  describe('변환 일관성', () => {
    it('출석(1) → present → 1 왕복 일치', () => {
      const status = mapAttendanceValueToStatus(1);
      expect(status).toBe('present');
      expect(mapAttendanceStatusToValue(status)).toBe(1);
    });

    it('결석(0) → absent → 0 왕복 일치', () => {
      const status = mapAttendanceValueToStatus(0);
      expect(status).toBe('absent');
      expect(mapAttendanceStatusToValue(status)).toBe(0);
    });
  });
});
