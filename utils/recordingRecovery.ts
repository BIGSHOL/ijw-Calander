// 녹음 중 갑작스런 종료 시 복구를 위한 IndexedDB 유틸

const DB_NAME = 'recording-recovery';
const DB_VERSION = 1;
const CHUNKS_STORE = 'chunks';
const META_STORE = 'meta';

interface RecordingMeta {
  id: string;           // 'consultation' | 'meeting'
  startedAt: number;
  mimeType: string;
  chunkCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE); // key: "consultation_0", "consultation_1", ...
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);   // key: "consultation" | "meeting"
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 녹음 시작 시 메타 초기화
export async function startRecoverySession(type: 'consultation' | 'meeting', mimeType: string) {
  const db = await openDB();
  const tx = db.transaction([META_STORE, CHUNKS_STORE], 'readwrite');

  // 기존 청크 삭제
  const chunksStore = tx.objectStore(CHUNKS_STORE);
  const metaStore = tx.objectStore(META_STORE);

  // 이전 청크 정리
  const cursorReq = chunksStore.openCursor();
  cursorReq.onsuccess = () => {
    const cursor = cursorReq.result;
    if (cursor) {
      if ((cursor.key as string).startsWith(type + '_')) {
        cursor.delete();
      }
      cursor.continue();
    }
  };

  const meta: RecordingMeta = {
    id: type,
    startedAt: Date.now(),
    mimeType,
    chunkCount: 0,
  };
  metaStore.put(meta, type);

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// 청크 저장 (ondataavailable 콜백에서 호출)
export async function saveChunk(type: 'consultation' | 'meeting', index: number, chunk: Blob) {
  try {
    const db = await openDB();
    const tx = db.transaction([CHUNKS_STORE, META_STORE], 'readwrite');
    tx.objectStore(CHUNKS_STORE).put(chunk, `${type}_${index}`);

    // 메타의 chunkCount 업데이트
    const metaStore = tx.objectStore(META_STORE);
    const getReq = metaStore.get(type);
    getReq.onsuccess = () => {
      const meta = getReq.result as RecordingMeta | undefined;
      if (meta) {
        meta.chunkCount = index + 1;
        metaStore.put(meta, type);
      }
    };

    return new Promise<void>((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); }; // 에러나도 녹음은 계속
    });
  } catch {
    // IndexedDB 에러는 무시 (녹음이 중단되면 안 됨)
  }
}

// 복구 가능한 녹음이 있는지 확인
export async function checkRecovery(type: 'consultation' | 'meeting'): Promise<RecordingMeta | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(type);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        const meta = req.result as RecordingMeta | undefined;
        if (meta && meta.chunkCount > 0) {
          resolve(meta);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

// 저장된 청크들을 File로 복원
export async function recoverRecording(type: 'consultation' | 'meeting'): Promise<File | null> {
  try {
    const db = await openDB();
    const tx = db.transaction([META_STORE, CHUNKS_STORE], 'readonly');
    const metaReq = tx.objectStore(META_STORE).get(type);

    return new Promise((resolve) => {
      metaReq.onsuccess = () => {
        const meta = metaReq.result as RecordingMeta | undefined;
        if (!meta || meta.chunkCount === 0) {
          db.close();
          resolve(null);
          return;
        }

        const chunks: Blob[] = [];
        let loaded = 0;

        for (let i = 0; i < meta.chunkCount; i++) {
          const chunkReq = tx.objectStore(CHUNKS_STORE).get(`${type}_${i}`);
          chunkReq.onsuccess = () => {
            if (chunkReq.result) chunks[i] = chunkReq.result;
            loaded++;
            if (loaded === meta.chunkCount) {
              db.close();
              const validChunks = chunks.filter(Boolean);
              if (validChunks.length === 0) {
                resolve(null);
                return;
              }
              const blob = new Blob(validChunks, { type: meta.mimeType });
              const startDate = new Date(meta.startedAt);
              const fileName = `복구_녹음_${startDate.toISOString().slice(0, 10)}_${startDate.toTimeString().slice(0, 5).replace(':', '')}.webm`;
              resolve(new File([blob], fileName, { type: meta.mimeType }));
            }
          };
        }
      };
      metaReq.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

// 복구 데이터 삭제 (정상 종료 또는 사용자가 삭제 선택 시)
export async function clearRecovery(type: 'consultation' | 'meeting') {
  try {
    const db = await openDB();
    const tx = db.transaction([META_STORE, CHUNKS_STORE], 'readwrite');
    tx.objectStore(META_STORE).delete(type);

    const chunksStore = tx.objectStore(CHUNKS_STORE);
    const cursorReq = chunksStore.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if ((cursor.key as string).startsWith(type + '_')) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    return new Promise<void>((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {
    // 무시
  }
}
