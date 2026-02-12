import {
  mapAttendanceValueToStatus,
  mapAttendanceStatusToValue,
  getAttendanceStatusLabel,
  getAttendanceStatusColor,
} from '../../utils/attendanceSync';

describe('attendanceSync', () => {
  describe('mapAttendanceValueToStatus', () => {
    it('숫자 값을 문자열 상태로 변환', () => {
      expect(mapAttendanceValueToStatus(1)).toBe('present');
      expect(mapAttendanceValueToStatus(0)).toBe('absent');
      expect(mapAttendanceValueToStatus(2)).toBe('late');
      expect(mapAttendanceValueToStatus(3)).toBe('early_leave');
      expect(mapAttendanceValueToStatus(4)).toBe('excused');
    });

    it('null은 absent 반환', () => {
      expect(mapAttendanceValueToStatus(null)).toBe('absent');
    });

    it('알 수 없는 값은 absent 반환', () => {
      expect(mapAttendanceValueToStatus(99)).toBe('absent');
      expect(mapAttendanceValueToStatus(-1)).toBe('absent');
    });
  });

  describe('mapAttendanceStatusToValue', () => {
    it('문자열 상태를 숫자 값으로 변환', () => {
      expect(mapAttendanceStatusToValue('present')).toBe(1);
      expect(mapAttendanceStatusToValue('absent')).toBe(0);
      expect(mapAttendanceStatusToValue('late')).toBe(2);
      expect(mapAttendanceStatusToValue('early_leave')).toBe(3);
      expect(mapAttendanceStatusToValue('excused')).toBe(4);
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

  describe('양방향 변환 일관성', () => {
    it('값 → 상태 → 값 왕복 변환 일치', () => {
      for (const val of [0, 1, 2, 3, 4]) {
        const status = mapAttendanceValueToStatus(val);
        const backToVal = mapAttendanceStatusToValue(status);
        expect(backToVal).toBe(val);
      }
    });
  });
});