/**
 * Firestore Timestamp 변환 유틸리티
 *
 * Firestore Timestamp → 'YYYY-MM-DD' 문자열 변환을 위한 단일 진실 소스.
 * 모든 파일에서 이 함수를 import하여 사용해야 합니다.
 *
 * 주의: toISOString()은 UTC 기준이므로 KST(UTC+9) 환경에서
 * 자정~오전 9시에 전날로 표시되는 버그가 있습니다.
 * formatDateKey()는 로컬 시간 기준이므로 이 문제가 없습니다.
 */

import { formatDateKey } from './dateUtils';

/**
 * Firestore Timestamp 또는 문자열을 'YYYY-MM-DD' 형식으로 변환
 * @param timestamp - Firestore Timestamp, 날짜 문자열, 또는 null/undefined
 * @returns 'YYYY-MM-DD' 문자열 또는 undefined
 */
export const convertTimestampToDate = (timestamp: any): string | undefined => {
    if (!timestamp) return undefined;
    if (typeof timestamp === 'string') return timestamp;
    if (timestamp?.toDate) {
        const date = timestamp.toDate();
        return formatDateKey(date);
    }
    return undefined;
};
