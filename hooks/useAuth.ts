/**
 * useAuth - Authentication listener and profile sync extracted from App.tsx
 *
 * Note: currentUser state is owned by App.tsx because useSystemConfig(!!currentUser) must be
 * called before this hook. systemConfig is accessed via useRef for latest value.
 */

import { useState, useEffect, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { UserProfile, StaffMember } from '../types';
import { staffToUserProfile, createNewStaffMember } from '../utils/staffHelpers';
import { storage, STORAGE_KEYS } from '../utils/localStorage';
import { queryClient } from '../queryClient';

interface SystemConfig {
  masterEmails?: string[];
  [key: string]: any;
}

interface UseAuthParams {
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  systemConfig: SystemConfig | undefined;
  onShowLogin: () => void;
}

export const useAuth = ({ setCurrentUser, systemConfig, onShowLogin }: UseAuthParams) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // useRef로 최신 systemConfig 참조 (auth effect는 [] deps이므로 closure stale 방지)
  const systemConfigRef = useRef(systemConfig);
  useEffect(() => {
    systemConfigRef.current = systemConfig;
  }, [systemConfig]);

  // Auth Listener with Real-time Profile Sync
  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;
    let isCancelled = false;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        const staffQuery = query(
          collection(db, 'staff'),
          where('uid', '==', user.uid)
        );

        try {
          profileUnsubscribe = onSnapshot(staffQuery, async (snapshot) => {
            if (isCancelled) return;
            try {
              const masterEmails = systemConfigRef.current?.masterEmails || [];
              const isMasterEmail = user.email && masterEmails.includes(user.email);

              if (!snapshot.empty) {
                const staffDoc = snapshot.docs[0];
                const staffData = { id: staffDoc.id, ...staffDoc.data() } as StaffMember;
                const now = new Date().toISOString();

                const currentRole = isMasterEmail ? 'master' : (staffData.systemRole || 'user');
                const indexRef = doc(db, 'staffIndex', user.uid);
                await setDoc(indexRef, {
                  staffId: staffDoc.id,
                  systemRole: currentRole,
                  updatedAt: now,
                }, { merge: true });

                if (isMasterEmail && staffData.systemRole !== 'master') {
                  await updateDoc(staffDoc.ref, {
                    systemRole: 'master',
                    approvalStatus: 'approved',
                    updatedAt: now,
                  });
                } else {
                  const profile = staffToUserProfile(staffData);
                  setUserProfile(prev => {
                    if (JSON.stringify(prev) === JSON.stringify(profile)) return prev;
                    return profile;
                  });
                }
              } else {
                // uid로 연동된 staff 문서가 없음.
                // 이메일로 기존 staff를 찾아 uid를 덮어쓰던 로직은 계정 탈취 위험으로 제거됨.
                // (다른 사람이 같은 이메일의 staff 문서를 점거 → 한쪽 Auth 삭제 시 동반 손상)
                // 기존 직원과의 연결은 관리자가 직원관리 탭에서 수동 병합한다.
                const newStaff = await createNewStaffMember(user, !!isMasterEmail);
                const profile = staffToUserProfile(newStaff);
                setUserProfile(profile);
              }
              setAuthLoading(false);
            } catch (innerError) {
              console.error("Error processing staff data:", innerError);
              setAuthLoading(false);
            }
          }, (error) => {
            console.error("Error listening to staff profile:", error);
            setAuthLoading(false);
          });
        } catch (error) {
          console.error("Error setting up staff listener:", error);
          setAuthLoading(false);
        }

      } else {
        setUserProfile(null);
        onShowLogin();
        setAuthLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    // Cancel all pending React Query queries to prevent permission-denied errors
    queryClient.cancelQueries();
    queryClient.clear();
    storage.remove(STORAGE_KEYS.DEPT_HIDDEN_IDS);
    setUserProfile(null);
    await signOut(auth);
    window.location.reload();
  };

  return {
    userProfile,
    setUserProfile,
    authLoading,
    handleLogout,
  };
};
