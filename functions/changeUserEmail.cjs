/**
 * [일회용 스크립트] Firebase Auth 사용자 이메일 변경 + staff 문서 email 동기화
 *
 * 배경: master 계정의 이메일을 lhy335577@gmail.com -> st2000423@gmail.com 으로 복구.
 *       uid는 그대로 유지되므로 staff 연결·master 권한·staffIndex가 모두 보존된다.
 *
 * 사용법:
 *   1. Firebase Console > 프로젝트 설정(톱니바퀴) > "서비스 계정" 탭
 *      > "새 비공개 키 생성" 클릭 > JSON 파일 다운로드
 *   2. 다운로드한 파일을 이 폴더에 functions/serviceAccountKey.json 이름으로 저장
 *   3. 터미널에서:  cd functions  &&  node changeUserEmail.cjs
 *   4. 완료 후 보안을 위해 serviceAccountKey.json 파일을 삭제
 *
 * 안전장치: NEW_EMAIL이 이미 다른 계정에 사용 중이면 아무것도 바꾸지 않고 중단한다.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

// ── 변경 대상 ──────────────────────────────
const OLD_EMAIL = "lhy335577@gmail.com";
const NEW_EMAIL = "st2000423@gmail.com";
// ──────────────────────────────────────────

const KEY_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(KEY_PATH)) {
  console.error("[중단] functions/serviceAccountKey.json 파일이 없습니다.");
  console.error("  Firebase Console > 프로젝트 설정 > 서비스 계정 > '새 비공개 키 생성'으로");
  console.error("  키를 발급받아 functions/serviceAccountKey.json 으로 저장한 뒤 다시 실행하세요.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});
const db = getFirestore("restore20260319");

async function main() {
  console.log(`\n=== 이메일 변경: ${OLD_EMAIL} -> ${NEW_EMAIL} ===\n`);

  // 1. 변경 대상 계정 조회 (uid는 이메일로 자동 확인)
  let user;
  try {
    user = await admin.auth().getUserByEmail(OLD_EMAIL);
  } catch (e) {
    console.error(`[중단] ${OLD_EMAIL} 계정을 찾을 수 없습니다 (${e.code}).`);
    process.exit(1);
  }
  console.log("대상 계정 확인:");
  console.log(`  uid          : ${user.uid}`);
  console.log(`  현재 이메일  : ${user.email}`);
  console.log(`  생성일       : ${user.metadata.creationTime}`);
  console.log(`  최종 로그인  : ${user.metadata.lastSignInTime}`);

  // 2. 새 이메일 중복 확인 — 이미 사용 중이면 아무것도 바꾸지 않고 중단
  try {
    const existing = await admin.auth().getUserByEmail(NEW_EMAIL);
    console.error(
      `\n[중단] ${NEW_EMAIL} 은 이미 다른 계정(uid: ${existing.uid})에 사용 중입니다.`
    );
    process.exit(1);
  } catch (e) {
    if (e.code !== "auth/user-not-found") {
      console.error("[중단] 이메일 중복 확인 중 오류:", e);
      process.exit(1);
    }
    // auth/user-not-found → 사용 가능, 계속 진행
  }

  // 3. Firebase Auth 이메일 변경 (uid 불변)
  await admin.auth().updateUser(user.uid, { email: NEW_EMAIL });
  console.log(`\n[완료] Firebase Auth 이메일 변경: ${OLD_EMAIL} -> ${NEW_EMAIL}`);

  // 4. staff 문서 email 동기화 (uid로 검색)
  const staffSnap = await db
    .collection("staff")
    .where("uid", "==", user.uid)
    .get();
  if (staffSnap.empty) {
    console.log(
      `[경고] uid(${user.uid})에 연결된 staff 문서가 없어 staff.email 동기화는 건너뜁니다.`
    );
  } else {
    for (const docSnap of staffSnap.docs) {
      const data = docSnap.data();
      await docSnap.ref.update({
        email: NEW_EMAIL,
        updatedAt: new Date().toISOString(),
      });
      console.log(
        `[완료] staff 문서(${docSnap.id}) email 동기화: ` +
        `${data.email || "(없음)"} -> ${NEW_EMAIL} ` +
        `[systemRole: ${data.systemRole || "-"}, approvalStatus: ${data.approvalStatus || "-"}]`
      );
    }
  }

  console.log("\n=== 완료 ===");
  console.log(`이제 ${NEW_EMAIL} + 기존 비밀번호로 로그인할 수 있습니다.`);
  console.log('비밀번호를 모르면 로그인 화면의 "비밀번호찾기"를 이용하세요.');
  console.log("보안을 위해 functions/serviceAccountKey.json 파일을 삭제하세요.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("\n[오류] 실행 중 예외 발생:", e);
  process.exit(1);
});
