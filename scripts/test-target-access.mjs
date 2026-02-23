import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyCDDAnbtu7HDM3JUbFf4jKSH4mS6GYYPkI",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: "231563652148",
  appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
});
const db = initializeFirestore(app, {}, 'restore260202');

async function test() {
  console.log('1. textbook_requests 읽기 시도...');
  try {
    const snap = await getDocs(collection(db, 'textbook_requests'));
    console.log(`   ✅ 성공: ${snap.size}건`);
  } catch (e) { console.log(`   ❌ 실패: ${e.code}`); }

  console.log('2. textbook_requests 쓰기 시도...');
  try {
    await setDoc(doc(db, 'textbook_requests', '__test__'), { test: true });
    console.log('   ✅ 성공');
    await deleteDoc(doc(db, 'textbook_requests', '__test__'));
    console.log('   삭제 완료');
  } catch (e) { console.log(`   ❌ 실패: ${e.code}`); }

  console.log('3. settings 쓰기 시도...');
  try {
    await setDoc(doc(db, 'settings', '__test__'), { test: true });
    console.log('   ✅ 성공');
    await deleteDoc(doc(db, 'settings', '__test__'));
  } catch (e) { console.log(`   ❌ 실패: ${e.code}`); }

  process.exit(0);
}
test();
