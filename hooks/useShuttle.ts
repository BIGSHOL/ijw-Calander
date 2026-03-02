import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// MakeEdu 버스 데이터 타입
export interface BusStudent {
  name: string;
  days: string; // "월수목", "화금" 등
}

export interface BusStop {
  order: number;
  destination: string;
  time: string;
  boardingStudents: BusStudent[];
  alightingStudents: BusStudent[];
}

export interface BusRoute {
  id: string;
  busName: string; // "1호차", "2호차" 등
  stops: BusStop[];
  totalBoardingCount: number;
  totalAlightingCount: number;
  syncedAt: string;
  source: 'makeedu';
}

// 기존 셔틀 관리 타입
export interface ShuttleRoute {
  id: string;
  name: string;
  driverName?: string;
  driverPhone?: string;
  stops: { name: string; address: string; order: number; estimatedTime: string }[];
  departureTime: string;
  returnTime?: string;
  studentCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShuttleAssignment {
  id: string;
  routeId: string;
  routeName: string;
  studentId: string;
  studentName: string;
  stopName: string;
  direction: 'pickup' | 'dropoff' | 'both';
  parentPhone?: string;
  createdAt: string;
}

export function useShuttle() {
  const queryClient = useQueryClient();

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ['shuttleRoutes'],
    queryFn: async () => {
      const q = query(collection(db, 'shuttle_routes'), orderBy('name'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShuttleRoute));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignments } = useQuery({
    queryKey: ['shuttleAssignments'],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'shuttle_assignments'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ShuttleAssignment));
    },
    staleTime: 5 * 60 * 1000,
  });

  // MakeEdu 버스 노선 데이터
  const { data: busRoutes, isLoading: busRoutesLoading } = useQuery({
    queryKey: ['busRoutes'],
    queryFn: async () => {
      const q = query(collection(db, 'bus_routes'), orderBy('busName'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BusRoute));
    },
    staleTime: 5 * 60 * 1000,
  });

  const createRoute = useMutation({
    mutationFn: async (data: Omit<ShuttleRoute, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'shuttle_routes'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shuttleRoutes'] }),
    onError: (error: Error) => { console.error('createRoute failed:', error); },
  });

  // MakeEdu 버스 데이터 일괄 저장
  const saveBusRoutes = useMutation({
    mutationFn: async (busData: Omit<BusRoute, 'id'>[]) => {
      const batch = writeBatch(db);

      // 기존 버스 노선 삭제
      const existingSnap = await getDocs(collection(db, 'bus_routes'));
      existingSnap.docs.forEach(d => batch.delete(d.ref));

      // 새 데이터 저장
      busData.forEach(route => {
        const ref = doc(collection(db, 'bus_routes'));
        batch.set(ref, route);
      });

      await batch.commit();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['busRoutes'] }),
    onError: (error: Error) => { console.error('saveBusRoutes failed:', error); },
  });

  return {
    routes: routes ?? [],
    assignments: assignments ?? [],
    busRoutes: busRoutes ?? [],
    isLoading: routesLoading,
    isBusLoading: busRoutesLoading,
    createRoute,
    saveBusRoutes,
  };
}
