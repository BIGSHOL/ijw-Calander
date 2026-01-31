/**
 * useAuth - Authentication listener and profile sync extracted from App.tsx
 *
 * Note: currentUser state is owned by App.tsx because useSystemConfig(!!currentUser) must be
 * called before this hook. systemConfig is accessed via useRef for latest value.
 */

import { useState, useEffect, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { UserProfile, StaffMember } from '../types';
import { staffToUserProfile, createNewStaffMember } from '../utils/staffHelpers';
import { storage, STORAGE_KEYS } from '../utils/localStorage';

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
              const masterEmails = systemConfigRef.current?.masterEmails || ['st2000423@gmail.com'];
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
                const emailQuery = query(
                  collection(db, 'staff'),
                  where('email', '==', user.email)
                );
                const emailSnapshot = await getDocs(emailQuery);

                if (!emailSnapshot.empty) {
                  const existingStaff = emailSnapshot.docs[0];
                  const existingData = existingStaff.data();
                  const linkedRole = isMasterEmail ? 'master' : (existingData.systemRole || 'user');
                  const linkNow = new Date().toISOString();

                  const indexRef = doc(db, 'staffIndex', user.uid);
                  await setDoc(indexRef, {
                    staffId: existingStaff.id,
                    systemRole: linkedRole,
                    updatedAt: linkNow,
                  });

                  await updateDoc(existingStaff.ref, {
                    uid: user.uid,
                    systemRole: linkedRole,
                    approvalStatus: isMasterEmail ? 'approved' : (existingData.approvalStatus || 'pending'),
                    updatedAt: linkNow,
                  });
                  console.log('✅ Existing staff linked with uid:', existingStaff.id, 'staffIndex created');
                } else {
                  const newStaff = await createNewStaffMember(user, !!isMasterEmail);
                  const profile = staffToUserProfile(newStaff);
                  setUserProfile(profile);
                }
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
    await signOut(auth);
    setUserProfile(null);
    storage.remove(STORAGE_KEYS.DEPT_HIDDEN_IDS);
    window.location.reload();
  };

  return {
    userProfile,
    setUserProfile,
    authLoading,
    handleLogout,
  };
};
