/**
 * getCurrentActor — 현재 로그인한 사용자의 actor 정보 조회 (audit 용)
 *
 * enrollment 변경 시 누가 했는지 기록하기 위한 표준 헬퍼.
 * - uid: 변경 불가능한 영구 키
 * - name: 당시 표시 이름 (staff > displayName > email 순)
 * - role: 역할 코드 (staffIndex 기반)
 * - roleLabel: 사용자 표시용 라벨 ('선생님' / '관리자' / ...)
 *
 * 결과는 세션 내 캐시됨 (같은 uid 재요청 시 캐시 사용).
 */

import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export interface ActorInfo {
    uid: string;
    name: string;
    role: string;
    roleLabel: string;
}

const ROLE_LABEL_MAP: Record<string, string> = {
    master: '마스터',
    admin: '관리자',
    manager: '매니저',
    math_lead: '수학팀장',
    english_lead: '영어팀장',
    math_teacher: '수학선생님',
    english_teacher: '영어선생님',
    teacher: '선생님',
    staff: '직원',
    senior_staff: '시니어직원',
    editor: '에디터',
    viewer: '뷰어',
    user: '사용자',
};

let cached: ActorInfo | null = null;

export async function getCurrentActor(): Promise<ActorInfo | null> {
    const user = auth.currentUser;
    if (!user) return null;

    if (cached && cached.uid === user.uid) return cached;

    let role = 'user';
    let staffId: string | null = null;
    try {
        const indexSnap = await getDoc(doc(db, 'staffIndex', user.uid));
        if (indexSnap.exists()) {
            const data = indexSnap.data();
            role = data.systemRole || 'user';
            staffId = data.staffId || null;
        }
    } catch { /* fallback below */ }

    let name = user.displayName || user.email?.split('@')[0] || '알 수 없음';
    if (staffId) {
        try {
            const staffSnap = await getDoc(doc(db, 'staff', staffId));
            if (staffSnap.exists()) {
                const data = staffSnap.data() as Record<string, any>;
                name = data.name || data.koreanName || data.displayName || name;
            }
        } catch { /* keep fallback name */ }
    }

    const roleLabel = ROLE_LABEL_MAP[role] || role;
    cached = { uid: user.uid, name, role, roleLabel };
    return cached;
}

/** 로그아웃 시 캐시 클리어 (다음 로그인 사용자가 잘못 캐시되지 않도록) */
export function clearActorCache(): void {
    cached = null;
}

/**
 * Firestore enrollment record 에 박을 audit 필드 5종 생성
 * - lastModifiedBy, lastModifiedByName, lastModifiedByRole, lastModifiedAt, lastAction
 */
export async function buildAuditFields(
    action: 'enrolled' | 'withdrawn' | 'restored' | 'transferred',
): Promise<Record<string, any>> {
    const actor = await getCurrentActor();
    const now = new Date().toISOString();
    return {
        lastModifiedBy: actor?.uid || null,
        lastModifiedByName: actor?.name || '알 수 없음',
        lastModifiedByRole: actor?.role || 'user',
        lastModifiedAt: now,
        lastAction: action,
    };
}

/**
 * Firestore enrollment 신규 생성용 — 최초 처리자 audit 필드 4종.
 * 절대 덮어쓰면 안 됨 (생성 시 한 번만 기록).
 * "이 학생을 이 수업에 처음 추가한 사람"을 평생 보존.
 */
export async function buildEnrollCreatedFields(): Promise<Record<string, any>> {
    const actor = await getCurrentActor();
    const now = new Date().toISOString();
    return {
        enrollCreatedBy: actor?.uid || null,
        enrollCreatedByName: actor?.name || '알 수 없음',
        enrollCreatedByRole: actor?.role || 'user',
        enrollCreatedAt: now,
    };
}

/** 표시용 role 라벨 ('이성우 선생님'의 '선생님' 부분) */
export function roleToLabel(role: string | undefined): string {
    if (!role) return '';
    return ROLE_LABEL_MAP[role] || role;
}

/**
 * 학생 카드 옆 audit 정보 포맷팅
 * "이성우 선생님 · 03-03" 또는 "" (기록 없음)
 */
export function formatAuditLabel(audit: {
    lastModifiedByName?: string;
    lastModifiedByRole?: string;
    lastModifiedAt?: string;
}): string {
    const name = audit.lastModifiedByName?.trim();
    if (!name) return '';
    const roleLabel = roleToLabel(audit.lastModifiedByRole);
    const namePart = roleLabel ? `${name} ${roleLabel}` : name;
    const at = audit.lastModifiedAt;
    if (!at) return namePart;
    try {
        const d = new Date(at);
        if (isNaN(d.getTime())) return namePart;
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${namePart} · ${m}-${day}`;
    } catch {
        return namePart;
    }
}

/** 액션 한국어 라벨 ('등록' / '퇴원' / '복원' / '반이동') */
export function actionToLabel(action: string | undefined): string {
    switch (action) {
        case 'enrolled': return '등록';
        case 'withdrawn': return '퇴원';
        case 'restored': return '복원';
        case 'transferred': return '반이동';
        default: return '';
    }
}