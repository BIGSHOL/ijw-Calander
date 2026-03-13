/**
 * 수강료 청구서 마이그레이션 스크립트
 * 소스: ijw-calculator (default DB) → invoices 컬렉션
 * 타겟: ijw-calander (restore260202 DB) → tuition_invoices 컬렉션
 *
 * 실행: node scripts/migrate-tuition-invoices.cjs
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ============ 설정 ============

// 소스 프로젝트 (ijw-calculator)
const SOURCE_CONFIG = {
  projectId: 'ijw-calculator',
  databaseId: '(default)',
  collection: 'invoices',
};

// 타겟 프로젝트 (ijw-calander)
const TARGET_CONFIG = {
  projectId: 'ijw-calander',
  databaseId: 'restore260202',
  collection: 'tuition_invoices',
};

// ============ 초기화 ============

// 소스 앱 (ijw-calculator)
const sourceApp = initializeApp({
  projectId: SOURCE_CONFIG.projectId,
}, 'source');

// 타겟 앱 (ijw-calander)
const targetApp = initializeApp({
  projectId: TARGET_CONFIG.projectId,
}, 'target');

// Firestore 인스턴스
const sourceDb = getFirestore(sourceApp, SOURCE_CONFIG.databaseId);
const targetDb = getFirestore(targetApp, TARGET_CONFIG.databaseId);

// ============ 마이그레이션 ============

async function migrate() {
  console.log('🚀 수강료 청구서 마이그레이션 시작');
  console.log(`📂 소스: ${SOURCE_CONFIG.projectId} / ${SOURCE_CONFIG.databaseId} / ${SOURCE_CONFIG.collection}`);
  console.log(`📂 타겟: ${TARGET_CONFIG.projectId} / ${TARGET_CONFIG.databaseId} / ${TARGET_CONFIG.collection}`);
  console.log('---');

  // 1. 소스에서 모든 청구서 읽기
  const sourceRef = sourceDb.collection(SOURCE_CONFIG.collection);
  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    console.log('⚠️ 소스 컬렉션이 비어있습니다.');
    return;
  }

  console.log(`📊 소스 문서 수: ${snapshot.size}개`);

  // 2. 타겟에 기존 문서 확인
  const targetRef = targetDb.collection(TARGET_CONFIG.collection);
  const existingSnap = await targetRef.get();
  const existingIds = new Set(existingSnap.docs.map(d => d.id));
  console.log(`📊 타겟 기존 문서 수: ${existingIds.size}개`);

  // 3. 마이그레이션
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = targetDb.batch();
  const BATCH_LIMIT = 500;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const docId = doc.id;
    const data = doc.data();

    // 이미 존재하면 스킵
    if (existingIds.has(docId)) {
      console.log(`  ⏭️ 스킵 (이미 존재): ${docId}`);
      skipped++;
      continue;
    }

    try {
      const targetDocRef = targetRef.doc(docId);
      batch.set(targetDocRef, {
        ...data,
        _migratedFrom: 'ijw-calculator',
        _migratedAt: new Date().toISOString(),
      });
      batchCount++;
      migrated++;

      const name = data.studentInfo?.name || '(이름없음)';
      console.log(`  ✅ 준비: ${docId} (${name})`);

      // 배치 한도 도달 시 커밋
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        console.log(`  💾 배치 커밋 (${batchCount}건)`);
        batchCount = 0;
      }
    } catch (err) {
      console.error(`  ❌ 에러: ${docId}`, err.message);
      errors++;
    }
  }

  // 남은 배치 커밋
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  💾 최종 배치 커밋 (${batchCount}건)`);
  }

  // 4. 결과 요약
  console.log('---');
  console.log('📋 마이그레이션 결과:');
  console.log(`  ✅ 이전 완료: ${migrated}건`);
  console.log(`  ⏭️ 스킵: ${skipped}건`);
  console.log(`  ❌ 에러: ${errors}건`);
  console.log(`  📊 총 소스: ${snapshot.size}건`);
}

// holidays, sessionPeriods도 함께 마이그레이션
async function migrateCollection(collectionName) {
  console.log(`\n🔄 ${collectionName} 마이그레이션...`);

  const sourceRef = sourceDb.collection(collectionName);
  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    console.log(`  ⚠️ ${collectionName} 비어있음`);
    return;
  }

  const targetRef = targetDb.collection(collectionName);
  const existingSnap = await targetRef.get();
  const existingIds = new Set(existingSnap.docs.map(d => d.id));

  let migrated = 0;
  let skipped = 0;
  const batch = targetDb.batch();

  for (const doc of snapshot.docs) {
    if (existingIds.has(doc.id)) {
      skipped++;
      continue;
    }
    batch.set(targetRef.doc(doc.id), doc.data());
    migrated++;
  }

  if (migrated > 0) {
    await batch.commit();
  }

  console.log(`  ✅ ${migrated}건 이전, ⏭️ ${skipped}건 스킵 (총 ${snapshot.size}건)`);
}

async function main() {
  try {
    await migrate();
    await migrateCollection('holidays');
    await migrateCollection('sessionPeriods');
    console.log('\n🎉 전체 마이그레이션 완료!');
  } catch (err) {
    console.error('💥 마이그레이션 실패:', err);
  }
  process.exit(0);
}

main();
