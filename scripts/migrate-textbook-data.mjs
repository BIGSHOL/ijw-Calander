/**
 * Firebase 데이터 이전: ijw-textbook → ijw-calander (restore260202 DB)
 * 양쪽 모두 Client SDK 사용 (임시 open rules 적용됨)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, collection, getDocs, getDoc, setDoc, doc, query, orderBy, writeBatch } from 'firebase/firestore';

// Source: ijw-textbook - 환경변수에서 로드
const sourceApp = initializeApp({
  apiKey: process.env.SOURCE_FIREBASE_API_KEY || "YOUR_SOURCE_API_KEY",
  authDomain: "ijw-textbook.firebaseapp.com",
  projectId: "ijw-textbook",
  storageBucket: "ijw-textbook.firebasestorage.app",
  messagingSenderId: process.env.SOURCE_FIREBASE_SENDER_ID || "YOUR_SOURCE_SENDER_ID",
  appId: process.env.SOURCE_FIREBASE_APP_ID || "YOUR_SOURCE_APP_ID"
}, 'source');
const sourceDb = getFirestore(sourceApp);

// Target: ijw-calander (restore260202 DB) - 환경변수에서 로드
const targetApp = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
}, 'target');
const targetDb = initializeFirestore(targetApp, {}, 'restore260202');

async function migrateRequests() {
  console.log('\n📋 [1/3] requests → textbook_requests');

  const existingSnap = await getDocs(collection(targetDb, 'textbook_requests'));
  const existingIds = new Set(existingSnap.docs.map(d => d.id));
  console.log(`  기존: ${existingIds.size}건`);

  const sourceSnap = await getDocs(query(collection(sourceDb, 'requests'), orderBy('createdAt', 'desc')));
  console.log(`  Source: ${sourceSnap.size}건`);

  let added = 0, skipped = 0, batchCount = 0;
  let batch = writeBatch(targetDb);

  for (const d of sourceSnap.docs) {
    if (existingIds.has(d.id)) { skipped++; continue; }
    const { imageUrl, ...data } = d.data();
    batch.set(doc(targetDb, 'textbook_requests', d.id), data);
    added++; batchCount++;
    if (batchCount >= 450) {
      await batch.commit(); batch = writeBatch(targetDb); batchCount = 0;
      console.log(`  ... ${added}건`);
    }
  }
  if (batchCount > 0) await batch.commit();
  console.log(`  ✅ ${added}건 추가, ${skipped}건 건너뜀`);
}

async function migrateAccountSettings() {
  console.log('\n💳 [2/3] settings/default-account → settings/textbook-account');
  const snap = await getDoc(doc(sourceDb, 'settings', 'default-account'));
  if (!snap.exists()) { console.log('  ⚠️ 없음'); return; }
  await setDoc(doc(targetDb, 'settings', 'textbook-account'), snap.data());
  console.log('  ✅ 완료');
}

async function migrateTextbookCatalog() {
  console.log('\n📚 [3/3] settings/textbooks → settings/textbook-catalog');
  const snap = await getDoc(doc(sourceDb, 'settings', 'textbooks'));
  if (!snap.exists()) { console.log('  ⚠️ 없음'); return; }
  const data = snap.data();
  console.log(`  교재: ${(data.list || []).length}개`);
  await setDoc(doc(targetDb, 'settings', 'textbook-catalog'), {
    list: data.list || [], updatedAt: new Date().toISOString(), migratedFrom: 'ijw-textbook',
  });
  console.log('  ✅ 완료');
}

async function main() {
  console.log('🚀 ijw-textbook → ijw-calander/restore260202 이전 시작');
  try {
    await migrateRequests();
    await migrateAccountSettings();
    await migrateTextbookCatalog();
    const final = await getDocs(collection(targetDb, 'textbook_requests'));
    console.log(`\n🎉 완료! textbook_requests: ${final.size}건`);
  } catch (err) {
    console.error('\n❌ 실패:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
