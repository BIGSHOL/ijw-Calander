import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const COL_STUDENTS = 'students';

/**
 * 진급 가능한 학년 목록 (초1 ~ 고2)
 * 고2 → 고3으로 진급 가능. 고3은 더 이상 진급 불가.
 */
const PROMOTABLE_GRADES = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2',
];

/**
 * 다음 학년 계산
 * 초6→중1, 중3→고1 자동 전환 포함
 */
function getNextGrade(grade: string): string | null {
  const idx = PROMOTABLE_GRADES.indexOf(grade);
  if (idx === -1) return null;
  if (idx === PROMOTABLE_GRADES.length - 1) return '고3'; // 고2 → 고3
  return PROMOTABLE_GRADES[idx + 1];
}

interface PromotionResult {
  totalPromoted: number;
  elementaryToMiddle: number; // 초6→중1
  middleToHigh: number;       // 중3→고1
}

/**
 * 학년 진급 훅
 * - Firestore에서 퇴원생 제외한 전체 학생 조회
 * - 진급 가능한 학년(초1~고2)인 학생만 +1 진급
 * - writeBatch로 일괄 업데이트
 * - React Query 캐시 자동 무효화
 */
export function useGradePromotion() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<PromotionResult> => {
      // 퇴원생 제외 학생 조회
      const q = query(
        collection(db, COL_STUDENTS),
        where('status', '!=', 'withdrawn')
      );
      const snapshot = await getDocs(q);

      const now = new Date().toISOString();
      let totalPromoted = 0;
      let elementaryToMiddle = 0;
      let middleToHigh = 0;

      // Firestore writeBatch는 최대 500개 제한
      const batchSize = 450;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const currentGrade = data.grade as string | undefined;
        if (!currentGrade) continue;

        const nextGrade = getNextGrade(currentGrade);
        if (!nextGrade) continue;

        // 학제 전환 카운트
        if (currentGrade === '초6' && nextGrade === '중1') elementaryToMiddle++;
        if (currentGrade === '중3' && nextGrade === '고1') middleToHigh++;

        batch.update(doc(db, COL_STUDENTS, docSnap.id), {
          grade: nextGrade,
          updatedAt: now,
        });
        totalPromoted++;
        batchCount++;

        // 배치 크기 제한 도달 시 커밋하고 새 배치 생성
        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      // 남은 배치 커밋
      if (batchCount > 0) {
        await batch.commit();
      }

      return { totalPromoted, elementaryToMiddle, middleToHigh };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const promoteGrades = useCallback(async () => {
    // 먼저 대상 학생 수 확인을 위한 사전 조회
    const q = query(
      collection(db, COL_STUDENTS),
      where('status', '!=', 'withdrawn')
    );
    const snapshot = await getDocs(q);

    let eligibleCount = 0;
    for (const docSnap of snapshot.docs) {
      const grade = docSnap.data().grade as string | undefined;
      if (grade && PROMOTABLE_GRADES.includes(grade)) {
        eligibleCount++;
      }
    }

    if (eligibleCount === 0) {
      alert('진급 대상 학생이 없습니다.');
      return;
    }

    if (!confirm(
      `전체 재원 학생의 학년을 1씩 올리시겠습니까?\n\n` +
      `진급 대상: ${eligibleCount}명\n` +
      `(초6→중1, 중3→고1 자동 전환)\n\n` +
      `이 작업은 되돌릴 수 없습니다.`
    )) {
      return;
    }

    try {
      const result = await mutation.mutateAsync();

      let message = `${result.totalPromoted}명 학년 진급 완료!`;
      const details: string[] = [];
      if (result.elementaryToMiddle > 0) details.push(`초6→중1: ${result.elementaryToMiddle}명`);
      if (result.middleToHigh > 0) details.push(`중3→고1: ${result.middleToHigh}명`);
      if (details.length > 0) message += `\n(${details.join(', ')})`;

      alert(message);
    } catch (error) {
      console.error('학년 진급 실패:', error);
      alert('학년 진급 중 오류가 발생했습니다.');
    }
  }, [mutation]);

  return {
    promoteGrades,
    isPromoting: mutation.isPending,
  };
}
