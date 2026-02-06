// Embed Token Management Hook
// 임베드 토큰 생성, 조회, 삭제, 검증

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  EmbedToken,
  EmbedType,
  CreateEmbedTokenInput,
  EmbedTokenValidation,
  DEFAULT_EMBED_SETTINGS,
} from '../types/embed';

const COLLECTION_NAME = 'embed_tokens';

// UUID 생성 함수
const generateToken = (): string => {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
};

// Firestore 문서를 EmbedToken으로 변환
const docToToken = (doc: any): EmbedToken => {
  const data = doc.data();
  return {
    id: doc.id,
    type: data.type,
    name: data.name,
    token: data.token,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
    createdBy: data.createdBy,
    expiresAt: data.expiresAt?.toDate?.()?.toISOString() || data.expiresAt,
    isActive: data.isActive ?? true,
    lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString() || data.lastUsedAt,
    usageCount: data.usageCount || 0,
    settings: data.settings || DEFAULT_EMBED_SETTINGS,
  };
};

/**
 * 토큰 목록 조회 및 관리 훅 (관리자용)
 */
export function useEmbedTokens(type?: EmbedType) {
  const [tokens, setTokens] = useState<EmbedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 토큰 목록 조회
  const fetchTokens = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ref = collection(db, COLLECTION_NAME);
      const q = type ? query(ref, where('type', '==', type)) : ref;
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(docToToken);
      setTokens(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // 토큰 생성
  const createToken = useCallback(
    async (input: CreateEmbedTokenInput, createdBy: string): Promise<EmbedToken> => {
      const newToken = {
        type: input.type,
        name: input.name,
        token: generateToken(),
        createdAt: serverTimestamp(),
        createdBy,
        expiresAt: input.expiresAt ? Timestamp.fromDate(new Date(input.expiresAt)) : null,
        isActive: true,
        usageCount: 0,
        settings: { ...DEFAULT_EMBED_SETTINGS, ...input.settings },
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), newToken);
      const created: EmbedToken = {
        id: docRef.id,
        ...newToken,
        createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt || undefined,
      };

      setTokens((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  // 토큰 비활성화/활성화
  const toggleToken = useCallback(async (tokenId: string, isActive: boolean) => {
    await updateDoc(doc(db, COLLECTION_NAME, tokenId), { isActive });
    setTokens((prev) =>
      prev.map((t) => (t.id === tokenId ? { ...t, isActive } : t))
    );
  }, []);

  // 토큰 삭제
  const deleteToken = useCallback(async (tokenId: string) => {
    await deleteDoc(doc(db, COLLECTION_NAME, tokenId));
    setTokens((prev) => prev.filter((t) => t.id !== tokenId));
  }, []);

  // 토큰 설정 업데이트
  const updateTokenSettings = useCallback(
    async (tokenId: string, settings: Partial<EmbedToken['settings']>) => {
      const tokenDoc = tokens.find((t) => t.id === tokenId);
      if (!tokenDoc) return;

      const newSettings = { ...tokenDoc.settings, ...settings };
      await updateDoc(doc(db, COLLECTION_NAME, tokenId), { settings: newSettings });
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenId ? { ...t, settings: newSettings } : t))
      );
    },
    [tokens]
  );

  return {
    tokens,
    loading,
    error,
    refetch: fetchTokens,
    createToken,
    toggleToken,
    deleteToken,
    updateTokenSettings,
  };
}

/**
 * 단일 토큰 검증 훅 (임베드 페이지용)
 */
export function useValidateEmbedToken(tokenValue: string | null) {
  const [validation, setValidation] = useState<EmbedTokenValidation>({
    isValid: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenValue) {
      setValidation({ isValid: false, error: 'NOT_FOUND' });
      setLoading(false);
      return;
    }

    const validate = async () => {
      setLoading(true);
      try {
        const ref = collection(db, COLLECTION_NAME);
        const q = query(ref, where('token', '==', tokenValue));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setValidation({ isValid: false, error: 'NOT_FOUND' });
          return;
        }

        const tokenDoc = snapshot.docs[0];
        const token = docToToken(tokenDoc);

        // 비활성화 확인
        if (!token.isActive) {
          setValidation({ isValid: false, error: 'INACTIVE', token });
          return;
        }

        // 만료 확인
        if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
          setValidation({ isValid: false, error: 'EXPIRED', token });
          return;
        }

        // 검증 성공 먼저 설정 (사용 기록 업데이트 실패해도 검증은 유효)
        setValidation({ isValid: true, token });

        // 사용 기록 업데이트 (실패해도 무시)
        try {
          await updateDoc(doc(db, COLLECTION_NAME, token.id), {
            lastUsedAt: serverTimestamp(),
            usageCount: (token.usageCount || 0) + 1,
          });
        } catch {
          // 비인증 환경에서 업데이트 실패 가능 → 무시
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setValidation({ isValid: false, error: 'NOT_FOUND' });
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [tokenValue]);

  return { ...validation, loading };
}

/**
 * URL에서 임베드 파라미터 추출
 */
export function getEmbedParams(): { embed: string | null; token: string | null } {
  if (typeof window === 'undefined') {
    return { embed: null, token: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    embed: params.get('embed'),
    token: params.get('token'),
  };
}

/**
 * 임베드 URL 생성
 */
export function generateEmbedUrl(type: EmbedType, token: string): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/?embed=${type}&token=${token}`;
}
