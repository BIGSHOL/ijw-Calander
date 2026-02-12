import {
  isInjaeClass,
  isExcludedStudent,
  getCellKey,
  parseCellKey,
  getTeacherColor,
  getContrastColor,
  parseClassName,
  buildClassName,
  numberLevelUp,
  classLevelUp,
  isMaxLevel,
  isValidLevel,
  numberLevelDown,
  classLevelDown,
  isMinLevel,
  canNumberLevelDown,
  canNumberLevelUp,
  formatClassNameWithBreaks,
  DEFAULT_ENGLISH_LEVELS,
} from '../../components/Timetable/English/englishUtils';

describe('englishUtils', () => {
  describe('isInjaeClass', () => {
    it('중등E_중 포함 → true', () => {
      expect(isInjaeClass('중등E_중1 정규A')).toBe(true);
      expect(isInjaeClass('중등E_중2')).toBe(true);
    });

    it('고등E_ 포함 → true', () => {
      expect(isInjaeClass('고등E_고2 정규')).toBe(true);
    });

    it('초등E → false', () => {
      expect(isInjaeClass('중등E_초6 SKY')).toBe(false);
    });

    it('빈 문자열 → false', () => {
      expect(isInjaeClass('')).toBe(false);
    });
  });

  describe('isExcludedStudent', () => {
    it('퇴원 포함 → true', () => {
      expect(isExcludedStudent('퇴원생 모음')).toBe(true);
    });

    it('신입 포함 → true', () => {
      expect(isExcludedStudent('신입생 대기')).toBe(true);
    });

    it('일반 → false', () => {
      expect(isExcludedStudent('DP3')).toBe(false);
    });

    it('빈 문자열 → false', () => {
      expect(isExcludedStudent('')).toBe(false);
    });
  });

  describe('getCellKey / parseCellKey', () => {
    it('셀 키 생성 및 파싱 라운드트립', () => {
      const key = getCellKey('Teacher1', '3', '월');
      expect(key).toBe('Teacher1-3-월');

      const parsed = parseCellKey(key);
      expect(parsed).toEqual({ teacher: 'Teacher1', periodId: '3', day: '월' });
    });

    it('잘못된 셀 키 → null', () => {
      expect(parseCellKey('invalid')).toBeNull();
      expect(parseCellKey('a-b')).toBeNull();
    });
  });

  describe('getTeacherColor', () => {
    it('teachersData에서 이름으로 검색', () => {
      const color = getTeacherColor('김선생', [
        { name: '김선생', bgColor: '#ff0000', textColor: '#ffffff' },
      ]);
      expect(color).toEqual({ bg: '#ff0000', text: '#ffffff' });
    });

    it('영어 이름으로 검색', () => {
      const color = getTeacherColor('John', [
        { name: '존', englishName: 'John', bgColor: '#00ff00' },
      ]);
      expect(color).toEqual({ bg: '#00ff00', text: '#ffffff' });
    });

    it('기본 색상 테이블에서 반환', () => {
      const color = getTeacherColor('Teacher1');
      expect(color.bg).toBe('#3B82F6');
    });

    it('없는 강사 → 회색 기본값', () => {
      const color = getTeacherColor('Unknown');
      expect(color).toEqual({ bg: '#6B7280', text: '#ffffff' });
    });
  });

  describe('getContrastColor', () => {
    it('밝은 배경 → 어두운 글씨', () => {
      expect(getContrastColor('#ffffff')).toBe('#374151');
      expect(getContrastColor('#fef08a')).toBe('#374151');
    });

    it('어두운 배경 → 밝은 글씨', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1e3a5f')).toBe('#ffffff');
    });

    it('유효하지 않은 색상 → 기본값', () => {
      expect(getContrastColor(undefined)).toBe('#374151');
      expect(getContrastColor('invalid')).toBe('#374151');
    });
  });

  describe('parseClassName / buildClassName', () => {
    it('일반 수업명 파싱', () => {
      expect(parseClassName('DP3')).toEqual({ levelAbbr: 'DP', number: 3, suffix: '' });
      expect(parseClassName('RTT6a')).toEqual({ levelAbbr: 'RTT', number: 6, suffix: 'a' });
      expect(parseClassName('MEC1')).toEqual({ levelAbbr: 'MEC', number: 1, suffix: '' });
    });

    it('유효하지 않은 이름 → null', () => {
      expect(parseClassName('')).toBeNull();
      expect(parseClassName('abc')).toBeNull();
      expect(parseClassName('123')).toBeNull();
    });

    it('buildClassName 역변환', () => {
      expect(buildClassName({ levelAbbr: 'DP', number: 4, suffix: '' })).toBe('DP4');
      expect(buildClassName({ levelAbbr: 'RTT', number: 6, suffix: 'a' })).toBe('RTT6a');
    });
  });

  describe('numberLevelUp / numberLevelDown', () => {
    it('DP3 → DP4', () => {
      expect(numberLevelUp('DP3')).toBe('DP4');
    });

    it('RTT6a → RTT7a (suffix 유지)', () => {
      expect(numberLevelUp('RTT6a')).toBe('RTT7a');
    });

    it('DP4 → DP3', () => {
      expect(numberLevelDown('DP4')).toBe('DP3');
    });

    it('DP1 → null (최소)', () => {
      expect(numberLevelDown('DP1')).toBeNull();
    });

    it('유효하지 않으면 null', () => {
      expect(numberLevelUp('')).toBeNull();
      expect(numberLevelDown('')).toBeNull();
    });
  });

  describe('classLevelUp / classLevelDown', () => {
    const levels = DEFAULT_ENGLISH_LEVELS;

    it('DP3 → PL1 (다음 레벨, 번호 리셋)', () => {
      expect(classLevelUp('DP3', levels)).toBe('PL1');
    });

    it('suffix 유지: DP3a → PL1a', () => {
      expect(classLevelUp('DP3a', levels)).toBe('PL1a');
    });

    it('최대 레벨(MEC) → null', () => {
      expect(classLevelUp('MEC1', levels)).toBeNull();
    });

    it('PL1 → DP1 (이전 레벨)', () => {
      expect(classLevelDown('PL1', levels)).toBe('DP1');
    });

    it('최소 레벨(DP) → null', () => {
      expect(classLevelDown('DP1', levels)).toBeNull();
    });
  });

  describe('isMaxLevel / isMinLevel / isValidLevel', () => {
    const levels = DEFAULT_ENGLISH_LEVELS;

    it('MEC는 최대 레벨', () => {
      expect(isMaxLevel('MEC1', levels)).toBe(true);
      expect(isMaxLevel('DP1', levels)).toBe(false);
    });

    it('DP는 최소 레벨', () => {
      expect(isMinLevel('DP1', levels)).toBe(true);
      expect(isMinLevel('PL1', levels)).toBe(false);
    });

    it('유효한 레벨 확인', () => {
      expect(isValidLevel('DP1', levels)).toBe(true);
      expect(isValidLevel('INVALID1', levels)).toBe(false);
    });
  });

  describe('canNumberLevelUp / canNumberLevelDown', () => {
    it('6 미만이면 올릴 수 있음', () => {
      expect(canNumberLevelUp('DP5')).toBe(true);
      expect(canNumberLevelUp('DP6')).toBe(false);
    });

    it('1 초과이면 내릴 수 있음', () => {
      expect(canNumberLevelDown('DP2')).toBe(true);
      expect(canNumberLevelDown('DP1')).toBe(false);
    });
  });

  describe('formatClassNameWithBreaks', () => {
    it('공백으로 분리', () => {
      expect(formatClassNameWithBreaks('중등E_중2 정규A')).toEqual(['중등E_중2', '정규A']);
    });

    it('3단어 이상 → 2줄로 합침', () => {
      expect(formatClassNameWithBreaks('고등E_고2 정규 A')).toEqual(['고등E_고2', '정규 A']);
    });

    it('빈 문자열', () => {
      expect(formatClassNameWithBreaks('')).toEqual(['']);
    });

    it('단일 단어', () => {
      expect(formatClassNameWithBreaks('DP3')).toEqual(['DP3']);
    });
  });
});
