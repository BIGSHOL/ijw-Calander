/**
 * Firestore 데이터 백업 스크립트
 *
 * 사용법:
 * 1. npx tsx scripts/backupFirestore.ts
 * 2. backups/ 폴더에 JSON 파일로 저장됨
 *
 * 백업 대상:
 * - students (학생)
 * - classes (수업)
 * - teachers (교사)
 * - departments (부서)
 * - ganttProjects (간트 프로젝트)
 * - ganttCategories (간트 카테고리)
 * - events (이벤트)
 * - attendance (출석)
 * - consultations (상담)
 * - grades (성적)
 * - exams (시험)
 * - examSeries (시험 시리즈)
 * - settings (설정)
 * - rolePermissions (권한)
 * - tabAccess (탭 접근)
 * - holidays (휴일)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase 설정 - 환경변수에서 로드
// 사용 전 .env.local 파일 참조 또는 환경변수 설정 필요
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore260202');

// 백업할 컬렉션 목록
const COLLECTIONS = [
  'students',
  'classes',
  'teachers',
  'departments',
  'ganttProjects',
  'ganttCategories',
  'ganttTemplates',
  'events',
  'archivedEvents',
  'attendance',
  'consultations',
  'grades',
  'exams',
  'examSeries',
  'settings',
  'rolePermissions',
  'tabAccess',
  'holidays',
  'hashtags'
];

interface BackupData {
  timestamp: string;
  collections: {
    [collectionName: string]: any[];
  };
  metadata: {
    totalDocuments: number;
    collections: {
      [collectionName: string]: number;
    };
  };
}

async function backupCollection(collectionName: string): Promise<any[]> {
  console.log(`📥 Backing up ${collectionName}...`);

  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`   ✅ ${data.length} documents backed up`);
    return data;
  } catch (error) {
    console.error(`   ❌ Error backing up ${collectionName}:`, error);
    return [];
  }
}

async function backupAllCollections(): Promise<void> {
  console.log('🔄 Starting Firestore backup...\n');

  const backupData: BackupData = {
    timestamp: new Date().toISOString(),
    collections: {},
    metadata: {
      totalDocuments: 0,
      collections: {}
    }
  };

  // 모든 컬렉션 백업
  for (const collectionName of COLLECTIONS) {
    const data = await backupCollection(collectionName);
    backupData.collections[collectionName] = data;
    backupData.metadata.collections[collectionName] = data.length;
    backupData.metadata.totalDocuments += data.length;
  }

  // 백업 폴더 생성
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 파일명 생성 (날짜_시간.json)
  const timestamp = new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  const filename = `firestore_backup_${timestamp}.json`;
  const filepath = path.join(backupDir, filename);

  // JSON 파일로 저장
  fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log('\n✅ Backup completed!');
  console.log(`📁 File: ${filepath}`);
  console.log(`📊 Total documents: ${backupData.metadata.totalDocuments}`);
  console.log(`📦 Size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);

  // 컬렉션별 통계 출력
  console.log('\n📈 Collection Statistics:');
  Object.entries(backupData.metadata.collections).forEach(([name, count]) => {
    if (count > 0) {
      console.log(`   - ${name}: ${count} documents`);
    }
  });

  process.exit(0);
}

// 실행
backupAllCollections().catch(error => {
  console.error('❌ Backup failed:', error);
  process.exit(1);
});
