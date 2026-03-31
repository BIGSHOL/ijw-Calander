import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, requestFcmToken, onForegroundMessage } from '../firebaseConfig';

// Firebase Console > 프로젝트 설정 > Cloud Messaging > 웹 푸시 인증서
// 여기에 실제 VAPID 키를 넣어야 합니다
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

type PushStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface PushNotificationResult {
  /** 현재 푸시 알림 상태 */
  status: PushStatus;
  /** 알림 권한 요청 (수동 트리거) */
  requestPermission: () => Promise<void>;
  /** iOS Safari에서 PWA 미설치 시 true */
  needsPwaInstall: boolean;
  /** 사용자에게 보여줄 안내 메시지 */
  guideMessage: string | null;
  /** 포그라운드 알림 데이터 */
  foregroundNotification: any | null;
  /** 포그라운드 알림 닫기 */
  clearForegroundNotification: () => void;
}

/**
 * 푸시 알림 토큰 관리 훅
 * - 로그인 시 자동으로 알림 권한 확인 및 토큰 등록
 * - iOS Safari PWA 미설치 시 안내 메시지 제공
 * - 포그라운드 알림 수신 처리
 */
export function usePushNotification(staffId?: string): PushNotificationResult {
  const [status, setStatus] = useState<PushStatus>('idle');
  const [foregroundNotification, setForegroundNotification] = useState<any | null>(null);
  const [guideMessage, setGuideMessage] = useState<string | null>(null);
  const tokenSavedRef = useRef(false);

  // iOS Safari 감지
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true || // iOS Safari
    window.matchMedia('(display-mode: standalone)').matches // 기타 브라우저
  );
  const needsPwaInstall = isIOS && !isStandalone;

  // FCM 토큰을 Firestore staff 문서에 저장
  const saveToken = useCallback(async (token: string) => {
    if (!staffId || tokenSavedRef.current) return;
    try {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        fcmTokens: arrayUnion(token),
      });
      tokenSavedRef.current = true;
    } catch (err) {
      console.error('FCM 토큰 저장 실패:', err);
    }
  }, [staffId]);

  // 만료/무효 토큰 제거
  const removeToken = useCallback(async (token: string) => {
    if (!staffId) return;
    try {
      const staffRef = doc(db, 'staff', staffId);
      await updateDoc(staffRef, {
        fcmTokens: arrayRemove(token),
      });
    } catch (err) {
      console.error('FCM 토큰 제거 실패:', err);
    }
  }, [staffId]);

  // 알림 권한 요청 + 토큰 발급
  const requestPermission = useCallback(async () => {
    // 지원 여부 확인
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('unsupported');
      setGuideMessage('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    // iOS Safari에서 PWA 미설치 시 안내
    if (needsPwaInstall) {
      setStatus('unsupported');
      setGuideMessage(
        '📱 iPhone/iPad에서 푸시 알림을 받으려면:\n' +
        '1. Safari 하단의 공유 버튼(□↑)을 탭하세요\n' +
        '2. "홈 화면에 추가"를 선택하세요\n' +
        '3. 추가된 앱에서 다시 로그인하면 알림이 활성화됩니다'
      );
      return;
    }

    // VAPID 키 미설정
    if (!VAPID_KEY) {
      console.warn('VITE_FIREBASE_VAPID_KEY가 설정되지 않았습니다.');
      setStatus('unsupported');
      return;
    }

    setStatus('requesting');

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        const token = await requestFcmToken(VAPID_KEY);
        if (token) {
          await saveToken(token);
          setStatus('granted');
          setGuideMessage(null);
        } else {
          setStatus('denied');
          setGuideMessage('알림 토큰 발급에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        }
      } else if (permission === 'denied') {
        setStatus('denied');
        setGuideMessage(
          '🔔 알림이 차단되어 있습니다.\n' +
          '브라우저 주소창 왼쪽의 🔒 아이콘 → "알림" → "허용"으로 변경해주세요.'
        );
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.error('알림 권한 요청 실패:', err);
      setStatus('denied');
      setGuideMessage('알림 설정 중 오류가 발생했습니다.');
    }
  }, [needsPwaInstall, saveToken]);

  // 로그인 시 자동으로 권한 확인 및 토큰 갱신
  useEffect(() => {
    if (!staffId || !VAPID_KEY) return;

    // 이미 허용된 상태면 토큰만 갱신
    if ('Notification' in window && Notification.permission === 'granted' && !needsPwaInstall) {
      (async () => {
        const token = await requestFcmToken(VAPID_KEY);
        if (token) {
          await saveToken(token);
          setStatus('granted');
        }
      })();
    } else if ('Notification' in window && Notification.permission === 'denied') {
      setStatus('denied');
    }
  }, [staffId, needsPwaInstall, saveToken]);

  // 포그라운드 메시지 수신
  useEffect(() => {
    if (status !== 'granted') return;

    let unsubscribe: (() => void) | undefined;

    onForegroundMessage((payload) => {
      setForegroundNotification(payload);
      // 5초 후 자동 닫기
      setTimeout(() => setForegroundNotification(null), 5000);
    }).then(unsub => {
      if (typeof unsub === 'function') unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [status]);

  const clearForegroundNotification = useCallback(() => {
    setForegroundNotification(null);
  }, []);

  return {
    status,
    requestPermission,
    needsPwaInstall,
    guideMessage,
    foregroundNotification,
    clearForegroundNotification,
  };
}
