import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SubjectType } from '../types';

// ─── 강의실 카테고리 ───
export type RoomCategory = '본원' | '바른' | '고등';
export const ROOM_CATEGORIES: RoomCategory[] = ['본원', '바른', '고등'];

// ─── 강의실 타입 ───
export interface RoomData {
  id: string;           // Firestore document ID
  name: string;         // 표시 이름 (예: "본원203", "프리미엄1")
  floor: string;        // 층 (예: "2층", "3층", "프리미엄관")
  capacity: number;     // 수용 인원
  preferredSubjects: SubjectType[];
  building: string;     // 건물 (본원, 프리미엄관, 바른학습관 등)
  category: RoomCategory; // 카테고리 (본원, 바른, 고등)
  order: number;        // 정렬 순서
  isActive: boolean;    // 활성 여부
}

const COL_ROOMS = 'rooms';

/**
 * 강의실 목록 조회 Hook
 * Firestore `rooms` 컬렉션에서 모든 활성 강의실 조회
 */
export const useRooms = () => {
  const queryClient = useQueryClient();

  const queryResult = useQuery<RoomData[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, COL_ROOMS));
      const rooms: RoomData[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          category: data.category || detectCategory(data.name || doc.id),
        } as RoomData;
      });
      return rooms
        .filter(r => r.isActive !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    staleTime: 5 * 60 * 1000, // 5분
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  return { ...queryResult, invalidate };
};

// ─── 카테고리 판별 함수 (이름 기반 자동 분류) ───
export function detectCategory(roomName: string): RoomCategory {
  const lower = roomName.toLowerCase();
  if (lower.includes('바른') || lower.includes('프리미엄')) return '바른';
  return '본원';
}

// ─── 건물 판별 함수 ───
export function detectBuilding(roomName: string): string {
  const lower = roomName.toLowerCase();
  if (lower.includes('프리미엄') || lower.includes('lab')) return '프리미엄관';
  if (lower.includes('바른')) return '바른학습관';
  if (lower.includes('bs')) return 'BS관';
  return '본원';
}

// ─── 층 판별 함수 ───
export function detectFloor(roomName: string): string {
  // 프리미엄/바른/bs 계열
  if (/프리미엄|lab/i.test(roomName)) return '프리미엄관';
  if (/바른/.test(roomName)) return '바른학습관';
  if (/bs/i.test(roomName)) return 'BS관';
  // 숫자 기반 (본원)
  if (/^본원?2\d{2}|^2\d{2}|sky/i.test(roomName)) return '2층';
  if (/^본원?3\d{2}|^3\d{2}/.test(roomName)) return '3층';
  if (/^본원?6\d{2}|^6\d{2}/.test(roomName)) return '6층';
  return '기타';
}

// ─── "본원" 접두사 필요 여부 ───
export function needsPrefix(roomName: string): boolean {
  if (!roomName) return false;
  const lower = roomName.toLowerCase();
  // bs, 프리미엄, 바른, lab이 포함되면 접두사 불필요
  if (lower.includes('bs') || lower.includes('프리미엄') || lower.includes('바른') || lower.includes('lab')) return false;
  // 이미 "본원"이 붙어있으면 불필요
  if (roomName.startsWith('본원')) return false;
  return true;
}

// ─── 강의실명에 "본원" 접두사 추가 ───
export function addBuildingPrefix(roomName: string): string {
  if (!roomName || !roomName.trim()) return roomName;
  return needsPrefix(roomName) ? `본원${roomName}` : roomName;
}

// ─── 초기 rooms 컬렉션 생성 (기존 ROOM_CONFIGS 기반) ───
export async function initializeRoomsCollection(): Promise<number> {
  const DEFAULT_ROOMS: Omit<RoomData, 'id'>[] = [
    // 본원 2층
    { name: '본원SKY', floor: '2층', capacity: 25, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 1, isActive: true },
    { name: '본원201', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 2, isActive: true },
    { name: '본원202', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 3, isActive: true },
    { name: '본원203', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 4, isActive: true },
    { name: '본원204', floor: '2층', capacity: 20, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 5, isActive: true },
    { name: '본원205', floor: '2층', capacity: 15, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 6, isActive: true },
    { name: '본원206', floor: '2층', capacity: 15, preferredSubjects: ['math', 'science'] as SubjectType[], building: '본원', category: '본원', order: 7, isActive: true },
    // 본원 3층
    { name: '본원301', floor: '3층', capacity: 20, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 10, isActive: true },
    { name: '본원302', floor: '3층', capacity: 20, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 11, isActive: true },
    { name: '본원303', floor: '3층', capacity: 15, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 12, isActive: true },
    { name: '본원304', floor: '3층', capacity: 15, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 13, isActive: true },
    { name: '본원305', floor: '3층', capacity: 15, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 14, isActive: true },
    { name: '본원306', floor: '3층', capacity: 15, preferredSubjects: ['english'] as SubjectType[], building: '본원', category: '본원', order: 15, isActive: true },
    // 본원 6층
    { name: '본원601', floor: '6층', capacity: 25, preferredSubjects: ['math', 'korean'] as SubjectType[], building: '본원', category: '본원', order: 20, isActive: true },
    { name: '본원602', floor: '6층', capacity: 25, preferredSubjects: ['math', 'korean'] as SubjectType[], building: '본원', category: '본원', order: 21, isActive: true },
    { name: '본원603', floor: '6층', capacity: 20, preferredSubjects: ['math', 'korean'] as SubjectType[], building: '본원', category: '본원', order: 22, isActive: true },
    // 바른 (프리미엄관)
    { name: '프리미엄1', floor: '프리미엄관', capacity: 12, preferredSubjects: ['english'] as SubjectType[], building: '프리미엄관', category: '바른', order: 30, isActive: true },
    { name: '프리미엄2', floor: '프리미엄관', capacity: 12, preferredSubjects: ['english'] as SubjectType[], building: '프리미엄관', category: '바른', order: 31, isActive: true },
    { name: 'LAB', floor: '프리미엄관', capacity: 15, preferredSubjects: ['english'] as SubjectType[], building: '프리미엄관', category: '본원', order: 32, isActive: true },
  ];

  const batch = writeBatch(db);
  let count = 0;

  for (const room of DEFAULT_ROOMS) {
    const docRef = doc(db, COL_ROOMS, room.name);
    batch.set(docRef, room);
    count++;
  }

  await batch.commit();
  return count;
}

// ─── 기존 rooms에 category 필드 마이그레이션 ───
export async function migrateRoomCategories(): Promise<number> {
  const snapshot = await getDocs(collection(db, COL_ROOMS));
  const batch = writeBatch(db);
  let count = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (!data.category) {
      batch.update(docSnap.ref, { category: detectCategory(data.name || docSnap.id) });
      count++;
    }
  }

  if (count > 0) await batch.commit();
  return count;
}

// ─── 강의실 추가 ───
export async function addRoom(room: Omit<RoomData, 'id'>): Promise<void> {
  const docRef = doc(db, COL_ROOMS, room.name);
  await setDoc(docRef, room);
}

// ─── 강의실 수정 ───
export async function updateRoom(id: string, updates: Partial<RoomData>): Promise<void> {
  const docRef = doc(db, COL_ROOMS, id);
  await updateDoc(docRef, updates);
}

// ─── 강의실 삭제 (비활성화) ───
export async function deactivateRoom(id: string): Promise<void> {
  const docRef = doc(db, COL_ROOMS, id);
  await updateDoc(docRef, { isActive: false });
}

// ─── 강의실명 변경 시 classes의 room/slotRooms 일괄 업데이트 ───
export async function renameRoomInClasses(oldName: string, newName: string): Promise<number> {
  if (oldName === newName) return 0;
  const classesSnapshot = await getDocs(collection(db, 'classes'));
  const batch = writeBatch(db);
  let count = 0;
  let batchCount = 0;

  for (const docSnap of classesSnapshot.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updates: Record<string, any> = {};

    // room 필드
    if (data.room === oldName) {
      updates.room = newName;
      needsUpdate = true;
    }

    // slotRooms 필드
    if (data.slotRooms) {
      const newSlotRooms: Record<string, string> = {};
      let slotChanged = false;
      for (const [key, value] of Object.entries(data.slotRooms)) {
        if (value === oldName) {
          newSlotRooms[key] = newName;
          slotChanged = true;
        } else {
          newSlotRooms[key] = value as string;
        }
      }
      if (slotChanged) {
        updates.slotRooms = newSlotRooms;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      batch.update(docSnap.ref, updates);
      count++;
      batchCount++;
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`[강의실] "${oldName}" → "${newName}" 반 ${count}개 업데이트`);
  return count;
}

// ─── 기존 classes 데이터의 room/slotRooms에 "본원" 접두사 마이그레이션 ───
export async function migrateRoomNames(): Promise<{ classesUpdated: number; staffUpdated: number; roomsCreated: number }> {
  let classesUpdated = 0;
  let staffUpdated = 0;

  // 1. classes 컬렉션 마이그레이션
  const classesSnapshot = await getDocs(collection(db, 'classes'));
  const classBatch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of classesSnapshot.docs) {
    const data = docSnap.data();
    let needsUpdate = false;
    const updates: Record<string, any> = {};

    // room 필드
    if (data.room && needsPrefix(data.room)) {
      updates.room = addBuildingPrefix(data.room);
      needsUpdate = true;
    }

    // slotRooms 필드
    if (data.slotRooms) {
      const newSlotRooms: Record<string, string> = {};
      let slotChanged = false;
      for (const [key, value] of Object.entries(data.slotRooms)) {
        const roomStr = value as string;
        if (roomStr && needsPrefix(roomStr)) {
          newSlotRooms[key] = addBuildingPrefix(roomStr);
          slotChanged = true;
        } else {
          newSlotRooms[key] = roomStr;
        }
      }
      if (slotChanged) {
        updates.slotRooms = newSlotRooms;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      classBatch.update(docSnap.ref, updates);
      classesUpdated++;
      batchCount++;

      // Firestore batch는 최대 500개
      if (batchCount >= 490) {
        await classBatch.commit();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await classBatch.commit();
  }

  // 2. staff 컬렉션 마이그레이션 (defaultRoom)
  const staffSnapshot = await getDocs(collection(db, 'staff'));
  const staffBatch = writeBatch(db);
  let staffBatchCount = 0;

  for (const docSnap of staffSnapshot.docs) {
    const data = docSnap.data();
    if (data.defaultRoom && needsPrefix(data.defaultRoom)) {
      staffBatch.update(docSnap.ref, {
        defaultRoom: addBuildingPrefix(data.defaultRoom),
      });
      staffUpdated++;
      staffBatchCount++;
    }
  }

  if (staffBatchCount > 0) {
    await staffBatch.commit();
  }

  // 3. rooms 컬렉션 초기화
  const roomsCreated = await initializeRoomsCollection();

  return { classesUpdated, staffUpdated, roomsCreated };
}
