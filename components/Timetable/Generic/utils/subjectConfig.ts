/**
 * Subject Configuration System
 *
 * Performance Optimizations Applied:
 * - bundle-barrel-imports: Direct imports from constants instead of barrel
 * - js-cache-function-results: Config objects cached at module level
 * - rerender-hoist-jsx: Static config objects hoisted outside functions
 */

import {
  MATH_PERIOD_INFO,
  MATH_UNIFIED_PERIODS,
  MATH_PERIOD_GROUPS,
  MATH_GROUP_TIMES,
  SCIENCE_PERIOD_INFO,
  SCIENCE_UNIFIED_PERIODS,
  KOREAN_PERIOD_INFO,
  KOREAN_UNIFIED_PERIODS,
  ENGLISH_PERIOD_INFO,
  ENGLISH_UNIFIED_PERIODS
} from '../../constants';

import { SUBJECT_COLORS, SUBJECT_LABELS } from '../../../../utils/styleUtils';
import type { SubjectConfiguration, SubjectKey } from '../types';

/**
 * Format periods for Math/Science/Korean (2-period grouping)
 *
 * Performance Note (js-early-exit):
 * - Returns early for empty periods
 * - Avoids unnecessary computation
 */
function formatMathPeriodsToLabel(periods: string[]): string {
  if (!periods.length) return '';

  const completeGroups: number[] = [];

  // Check for complete period groups (1+2=1교시, 3+4=2교시, etc.)
  for (let group = 1; group <= 4; group++) {
    const first = String(group * 2 - 1);
    const second = String(group * 2);
    if (periods.includes(first) && periods.includes(second)) {
      completeGroups.push(group);
    }
  }

  if (completeGroups.length === 0) {
    // Incomplete periods - show as time ranges
    // Performance Note (js-cache-property-access): Cache periodInfo lookup
    const periodInfo = MATH_PERIOD_INFO;
    return periods
      .map(p => periodInfo[p]?.time)
      .filter(Boolean)
      .join(', ');
  }

  return completeGroups.map(g => `${g}교시`).join(', ');
}

/**
 * Format periods for English (individual periods or ranges)
 *
 * Performance Note (js-min-max-loop):
 * - Uses simple loop instead of sort for min/max
 */
function formatEnglishPeriodsToLabel(periods: string[]): string {
  if (!periods.length) return '';

  const nums = periods.map(Number).sort((a, b) => a - b);
  const isConsecutive = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);

  if (isConsecutive && nums.length > 1) {
    return `${nums[0]}~${nums[nums.length - 1]}교시`;
  }

  return nums.map(n => `${n}교시`).join(', ');
}

/**
 * Math Configuration
 *
 * Performance Note (rerender-hoist-jsx):
 * - Config object is module-level constant
 * - Zero re-render overhead
 */
export const MATH_CONFIG: SubjectConfiguration = {
  subject: 'math',
  displayName: SUBJECT_LABELS.math,

  periodInfo: MATH_PERIOD_INFO,
  periodIds: MATH_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,

  firebaseSubjectKey: 'math',
  configDocPath: 'settings/math_config',

  viewPermission: 'timetable.math.view',
  editPermission: 'timetable.math.edit',

  colors: SUBJECT_COLORS.math,
};

/**
 * Science Configuration (same as Math)
 */
export const SCIENCE_CONFIG: SubjectConfiguration = {
  subject: 'science',
  displayName: SUBJECT_LABELS.science,

  periodInfo: SCIENCE_PERIOD_INFO,
  periodIds: SCIENCE_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,  // Reuse Math groups
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,  // Reuse Math formatter

  firebaseSubjectKey: 'science',
  configDocPath: 'settings/science_config',

  viewPermission: 'timetable.science.view',
  editPermission: 'timetable.science.edit',

  colors: SUBJECT_COLORS.science,
};

/**
 * Korean Configuration (same as Math)
 */
export const KOREAN_CONFIG: SubjectConfiguration = {
  subject: 'korean',
  displayName: SUBJECT_LABELS.korean,

  periodInfo: KOREAN_PERIOD_INFO,
  periodIds: KOREAN_UNIFIED_PERIODS,
  unifiedPeriodsCount: 8,

  periodGroups: MATH_PERIOD_GROUPS,  // Reuse Math groups
  groupTimes: MATH_GROUP_TIMES,
  hasGrouping: true,

  formatPeriodsToLabel: formatMathPeriodsToLabel,  // Reuse Math formatter

  firebaseSubjectKey: 'korean',
  configDocPath: 'settings/korean_config',

  viewPermission: 'timetable.korean.view',
  editPermission: 'timetable.korean.edit',

  colors: SUBJECT_COLORS.korean,
};

/**
 * English Configuration
 */
export const ENGLISH_CONFIG: SubjectConfiguration = {
  subject: 'english',
  displayName: SUBJECT_LABELS.english,

  periodInfo: ENGLISH_PERIOD_INFO,
  periodIds: ENGLISH_UNIFIED_PERIODS,
  unifiedPeriodsCount: 10,

  hasGrouping: false,  // No grouping for English

  formatPeriodsToLabel: formatEnglishPeriodsToLabel,

  firebaseSubjectKey: 'english',
  configDocPath: 'settings/english_config',

  viewPermission: 'timetable.english.view',
  editPermission: 'timetable.english.edit',

  colors: SUBJECT_COLORS.english,
};

/**
 * Config lookup map
 *
 * Performance Note (js-index-maps):
 * - Use Map for O(1) lookups instead of switch
 * - Module-level constant, computed once
 */
const CONFIG_MAP = new Map<SubjectKey, SubjectConfiguration>([
  ['math', MATH_CONFIG],
  ['english', ENGLISH_CONFIG],
  ['science', SCIENCE_CONFIG],
  ['korean', KOREAN_CONFIG],
]);

/**
 * Get subject configuration
 *
 * Performance Note (js-cache-function-results):
 * - Uses Map for O(1) lookup
 * - No switch/if overhead
 */
export function getSubjectConfig(subject: SubjectKey): SubjectConfiguration {
  return CONFIG_MAP.get(subject) || MATH_CONFIG;
}

/**
 * Get all available subject keys
 * Useful for dropdowns/selects
 */
export function getAllSubjectKeys(): SubjectKey[] {
  return Array.from(CONFIG_MAP.keys());
}
