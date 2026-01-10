import { vi } from 'vitest';

// Mock Firestore data storage
const mockFirestoreData = new Map<string, Map<string, any>>();

// Mock document snapshot
export const createMockDocSnapshot = (id: string, data: any) => ({
  id,
  exists: () => !!data,
  data: () => data,
  ref: {
    id,
    path: `collection/${id}`,
    parent: {
      id: 'collection',
      parent: null,
    },
  },
});

// Mock query snapshot
export const createMockQuerySnapshot = (docs: any[]) => ({
  docs: docs.map((doc) => createMockDocSnapshot(doc.id, doc)),
  empty: docs.length === 0,
  size: docs.length,
  forEach: (callback: (doc: any) => void) => {
    docs.forEach((doc) => callback(createMockDocSnapshot(doc.id, doc)));
  },
});

// Mock Firestore functions
export const mockGetDocs = vi.fn();
export const mockGetDoc = vi.fn();
export const mockAddDoc = vi.fn();
export const mockUpdateDoc = vi.fn();
export const mockDeleteDoc = vi.fn();
export const mockQuery = vi.fn();
export const mockWhere = vi.fn();
export const mockCollection = vi.fn();
export const mockCollectionGroup = vi.fn();
export const mockDoc = vi.fn();

// Helper: Setup mock Firestore data
export const setupMockFirestoreData = (collectionName: string, documents: any[]) => {
  const collectionData = new Map();
  documents.forEach((doc) => {
    collectionData.set(doc.id, doc);
  });
  mockFirestoreData.set(collectionName, collectionData);
};

// Helper: Clear mock Firestore data
export const clearMockFirestoreData = () => {
  mockFirestoreData.clear();
  vi.clearAllMocks();
};

// Helper: Get mock data from collection
export const getMockDataFromCollection = (collectionName: string): any[] => {
  const collectionData = mockFirestoreData.get(collectionName);
  if (!collectionData) return [];
  return Array.from(collectionData.values());
};

// Mock Firebase module
export const mockFirebase = () => {
  return {
    collection: mockCollection.mockImplementation((db, path) => ({
      path,
      type: 'collection',
    })),
    collectionGroup: mockCollectionGroup.mockImplementation((db, path) => ({
      path,
      type: 'collectionGroup',
    })),
    doc: mockDoc.mockImplementation((db, path, id) => ({
      id,
      path: `${path}/${id}`,
      type: 'document',
    })),
    getDocs: mockGetDocs,
    getDoc: mockGetDoc,
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    query: mockQuery.mockImplementation((ref, ...filters) => ({
      ref,
      filters,
      type: 'query',
    })),
    where: mockWhere.mockImplementation((field, operator, value) => ({
      field,
      operator,
      value,
      type: 'where',
    })),
  };
};

// Reset all mocks
export const resetFirebaseMocks = () => {
  clearMockFirestoreData();
  mockGetDocs.mockReset();
  mockGetDoc.mockReset();
  mockAddDoc.mockReset();
  mockUpdateDoc.mockReset();
  mockDeleteDoc.mockReset();
  mockQuery.mockReset();
  mockWhere.mockReset();
  mockCollection.mockReset();
  mockCollectionGroup.mockReset();
  mockDoc.mockReset();
};
