/**
 * 일정 → events 컬렉션 마이그레이션 스크립트
 *
 * '일정' 컬렉션의 모든 문서를 'events' 컬렉션으로 복사합니다.
 * - 문서 ID 유지
 * - 필드명 그대로 유지 (한글)
 * - 기존 '일정' 컬렉션은 삭제하지 않음 (수동 삭제)
 *
 * 사용법:
 *   npx tsx scripts/migrateEventsCollection.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// .env.local에서 환경 변수 로드
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    vars[key.trim()] = rest.join('=').trim();
  }
  return vars;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'restore260202');
const auth = getAuth(app);

const BATCH_SIZE = 450;

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function migrate() {
  // 로그인
  const email = await prompt('이메일: ');
  const password = await prompt('비밀번호: ');

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log(`\n✅ 로그인 성공: ${userCredential.user.email}\n`);
  } catch (e: any) {
    console.error('❌ 로그인 실패:', e.message);
    process.exit(1);
  }

  console.log('=== 일정 → events 컬렉션 마이그레이션 시작 ===\n');

  // 1. 기존 일정 컬렉션 읽기
  const sourceSnapshot = await getDocs(collection(db, '일정'));
  const totalDocs = sourceSnapshot.size;

  if (totalDocs === 0) {
    console.log('일정 컬렉션이 비어있습니다. 마이그레이션할 문서가 없습니다.');
    return;
  }

  console.log(`일정 컬렉션: ${totalDocs}개 문서 발견`);

  // 2. 기존 events 컬렉션 확인
  const targetSnapshot = await getDocs(collection(db, 'events'));
  if (targetSnapshot.size > 0) {
    console.log(`\n⚠️  events 컬렉션에 이미 ${targetSnapshot.size}개 문서가 존재합니다.`);
    console.log('중복 방지를 위해 기존 문서와 동일 ID는 덮어씁니다.\n');
  }

  // 3. 배치 복사
  const docs = sourceSnapshot.docs;
  let copied = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const docSnap of chunk) {
      const targetRef = doc(db, 'events', docSnap.id);
      batch.set(targetRef, docSnap.data());
    }

    await batch.commit();
    copied += chunk.length;
    console.log(`  복사 완료: ${copied}/${totalDocs}`);
  }

  // 4. 검증
  const verifySnapshot = await getDocs(collection(db, 'events'));
  console.log(`\n=== 마이그레이션 완료 ===`);
  console.log(`  원본 (일정): ${totalDocs}개`);
  console.log(`  대상 (events): ${verifySnapshot.size}개`);

  if (verifySnapshot.size >= totalDocs) {
    console.log(`\n✅ 성공. 코드를 events 컬렉션으로 전환해도 됩니다.`);
    console.log(`   기존 '일정' 컬렉션은 Firebase Console에서 수동 삭제하세요.`);
  } else {
    console.log(`\n❌ 문서 수 불일치. 확인이 필요합니다.`);
  }
}

migrate().catch(console.error);
