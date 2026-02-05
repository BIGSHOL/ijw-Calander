/**
 * Firestore 데이터 복원 스크립트
 *
 * 사용법:
 * 1. 백업 파일을 backups/ 폴더에 넣기
 * 2. npx tsx scripts/restoreFirestore.ts [백업파일명.json]
 * 3. 예: npx tsx scripts/restoreFirestore.ts firestore_backup_2026-01-09T12-00-00.json
 *
 * 주의:
 * - 기존 데이터를 덮어쓰지 않고 병합합니다 (같은 ID가 있으면 건너뜀)
 * - 완전 복원을 원하면 Firebase Console에서 컬렉션을 먼저 삭제하세요
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase 설정
const firebaseConfig = {
  apiKey: "***REMOVED_API_KEY_3***",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: "528427751440",
  appId: "1:528427751440:web:f59ce4b5cd9e1f2d6fb8ca",
  measurementId: "G-VCPZJ9J9Y7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore260202');

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

async function restoreCollection(
  collectionName: string,
  documents: any[],
  overwrite: boolean = false
): Promise<{ restored: number; skipped: number }> {
  console.log(`\n📤 Restoring ${collectionName}...`);

  let restored = 0;
  let skipped = 0;

  for (const docData of documents) {
    const { id, ...data } = docData;

    try {
      const docRef = doc(db, collectionName, id);

      if (!overwrite) {
        // 기존 문서 확인
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          console.log(`   ⏭️  Skipped ${id} (already exists)`);
          skipped++;
          continue;
        }
      }

      await setDoc(docRef, data);
      console.log(`   ✅ Restored ${id}`);
      restored++;

      // Firebase rate limit 방지 (100ms 대기)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Error restoring ${id}:`, error);
    }
  }

  console.log(`   📊 ${restored} restored, ${skipped} skipped`);
  return { restored, skipped };
}

async function restoreFromBackup(backupFile: string, overwrite: boolean = false): Promise<void> {
  console.log('🔄 Starting Firestore restore...\n');

  // 백업 파일 경로
  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(process.cwd(), 'backups', backupFile);

  // 파일 존재 확인
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Backup file not found: ${backupPath}`);
    console.log('\n💡 Available backups:');
    const backupDir = path.join(process.cwd(), 'backups');
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
      files.forEach(f => console.log(`   - ${f}`));
    }
    process.exit(1);
  }

  // 백업 파일 읽기
  console.log(`📁 Reading backup: ${backupPath}`);
  const backupData: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

  console.log(`📅 Backup date: ${new Date(backupData.timestamp).toLocaleString('ko-KR')}`);
  console.log(`📊 Total documents: ${backupData.metadata.totalDocuments}`);
  console.log(`⚙️  Overwrite mode: ${overwrite ? 'ON' : 'OFF'}`);

  // 사용자 확인
  console.log('\n⚠️  This will restore data to Firestore.');
  if (!overwrite) {
    console.log('   Existing documents will be preserved (merge mode).');
  } else {
    console.log('   Existing documents will be OVERWRITTEN!');
  }

  // 5초 대기 (취소 기회)
  console.log('\n⏳ Starting in 5 seconds... (Press Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 복원 시작
  const stats = {
    totalRestored: 0,
    totalSkipped: 0
  };

  for (const [collectionName, documents] of Object.entries(backupData.collections)) {
    if (documents.length === 0) continue;

    const { restored, skipped } = await restoreCollection(collectionName, documents, overwrite);
    stats.totalRestored += restored;
    stats.totalSkipped += skipped;
  }

  console.log('\n✅ Restore completed!');
  console.log(`📊 Total restored: ${stats.totalRestored}`);
  console.log(`⏭️  Total skipped: ${stats.totalSkipped}`);

  process.exit(0);
}

// 명령줄 인수 처리
const args = process.argv.slice(2);
const backupFile = args[0];
const overwrite = args.includes('--overwrite') || args.includes('-f');

if (!backupFile) {
  console.error('❌ Please provide backup file name');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/restoreFirestore.ts <backup-file.json>');
  console.log('  npx tsx scripts/restoreFirestore.ts <backup-file.json> --overwrite');
  console.log('\nExample:');
  console.log('  npx tsx scripts/restoreFirestore.ts firestore_backup_2026-01-09T12-00-00.json');

  // 사용 가능한 백업 파일 목록 표시
  const backupDir = path.join(process.cwd(), 'backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      console.log('\n💡 Available backups:');
      files.forEach(f => console.log(`   - ${f}`));
    }
  }

  process.exit(1);
}

// 실행
restoreFromBackup(backupFile, overwrite).catch(error => {
  console.error('❌ Restore failed:', error);
  process.exit(1);
});
