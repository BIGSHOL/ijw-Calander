import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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

  const createRoute = useMutation({
    mutationFn: async (data: Omit<ShuttleRoute, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'shuttle_routes'), { ...data, createdAt: now, updatedAt: now });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shuttleRoutes'] }),
    onError: (error: Error) => { console.error('createRoute failed:', error); },
  });

  return { routes: routes ?? [], assignments: assignments ?? [], isLoading: routesLoading, createRoute };
}
