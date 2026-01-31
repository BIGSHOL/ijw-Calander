/**
 * useBucketItems - Bucket list state and CRUD operations extracted from App.tsx
 *
 * Handles: Bucket subscription, Add/Edit/Delete with permission checks
 */

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, setDoc, doc, deleteDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BucketItem, UserProfile } from '../types';

interface UseBucketItemsParams {
  currentUser: User | null;
  effectiveProfile: UserProfile | undefined;
  userProfile: UserProfile | null;
  usersFromStaff: UserProfile[];
  hasPermission: (perm: string) => boolean;
}

export const useBucketItems = ({
  currentUser,
  effectiveProfile,
  userProfile,
  usersFromStaff,
  hasPermission,
}: UseBucketItemsParams) => {
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);

  // Subscribe to Bucket Items (onSnapshot for caching/delta updates)
  // 최적화: 현재 사용자의 아이템만 조회 (읽기 -90%)
  useEffect(() => {
    if (!currentUser) {
      setBucketItems([]);
      return;
    }
    const q = query(
      collection(db, "bucketItems"),
      where("authorId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as BucketItem[];
      setBucketItems(items);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Helper: Check if user's role is higher than author's role (시뮬레이션 적용)
  const isHigherRole = (authorId: string | undefined): boolean => {
    if (!effectiveProfile || !authorId) return false;
    const hierarchy = ['master', 'admin', 'manager', 'math_lead', 'english_lead', 'math_teacher', 'english_teacher', 'user'];
    const author = usersFromStaff.find(u => u.uid === authorId);
    if (!author) return false;
    const myIndex = hierarchy.indexOf(effectiveProfile.role);
    const authorIndex = hierarchy.indexOf(author.role);
    return myIndex < authorIndex;
  };

  // Helper: Check if current user can edit/delete a bucket (시뮬레이션 적용)
  const canModifyBucket = (bucket: BucketItem, action: 'edit' | 'delete'): boolean => {
    if (!effectiveProfile) return false;
    if (effectiveProfile.role === 'master') return true;
    if (bucket.authorId === effectiveProfile.uid) return true;
    if (hasPermission('events.bucket') && isHigherRole(bucket.authorId)) return true;
    return false;
  };

  const handleAddBucketItem = async (title: string, targetMonth: string, priority: 'high' | 'medium' | 'low') => {
    if (!hasPermission('events.create')) return;
    const newItem: BucketItem = {
      id: crypto.randomUUID(),
      title,
      targetMonth,
      priority,
      createdAt: new Date().toISOString(),
      authorId: userProfile?.uid || '',
      authorName: userProfile?.displayName || userProfile?.email || '알 수 없음',
    };
    await setDoc(doc(db, "bucketItems", newItem.id), newItem);
  };

  const handleDeleteBucketItem = async (id: string) => {
    const bucket = bucketItems.find(b => b.id === id);
    if (!bucket) return;

    if (!canModifyBucket(bucket, 'delete')) {
      alert('삭제 권한이 없습니다. 본인이 작성한 버킷만 삭제할 수 있습니다.');
      return;
    }

    await deleteDoc(doc(db, "bucketItems", id));
  };

  const handleEditBucketItem = async (id: string, title: string, priority: 'high' | 'medium' | 'low') => {
    const bucket = bucketItems.find(b => b.id === id);
    if (!bucket) return;

    if (!canModifyBucket(bucket, 'edit')) {
      alert('수정 권한이 없습니다. 본인이 작성한 버킷만 수정할 수 있습니다.');
      return;
    }

    await updateDoc(doc(db, "bucketItems", id), { title, priority });
  };

  return {
    bucketItems,
    handleAddBucketItem,
    handleDeleteBucketItem,
    handleEditBucketItem,
  };
};
