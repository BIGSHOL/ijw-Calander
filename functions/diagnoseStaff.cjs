/**
 * [일회용 진단] uid 충돌 staff 문서 점검 (읽기 전용 — 아무것도 변경하지 않음)
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

const KEY_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(KEY_PATH)) {
  console.error("[중단] functions/serviceAccountKey.json 이 없습니다.");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = getFirestore("restore20260319");

const TARGET_UID = "T7HN60crkUeSoCo6bSyzdB2AK3w1";
const EMAILS = ["st2000423@gmail.com", "lhy335577@gmail.com"];

function row(id, d) {
  return (
    `  - docId="${id}"\n` +
    `      name="${d.name || "-"}"  email="${d.email || "-"}"  uid="${d.uid || "-"}"\n` +
    `      systemRole="${d.systemRole || "-"}"  approvalStatus="${d.approvalStatus || "-"}"  status="${d.status || "-"}"  createdAt="${d.createdAt || "-"}"`
  );
}

async function main() {
  console.log("\n=== staff 진단 (읽기 전용) ===\n");

  // 0. Firebase Auth 계정 상태
  console.log("[0] Firebase Auth 계정 상태:");
  for (const email of EMAILS) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      console.log(`  - ${email} : 존재 (uid=${u.uid})`);
    } catch (e) {
      console.log(`  - ${email} : 없음 (${e.code})`);
    }
  }
  console.log("");

  // 1. uid로 연결된 staff 문서
  console.log(`[1] uid="${TARGET_UID}" 에 연결된 staff 문서:`);
  const byUid = await db.collection("staff").where("uid", "==", TARGET_UID).get();
  if (byUid.empty) console.log("  (없음)");
  byUid.forEach((doc) => console.log(row(doc.id, doc.data())));

  // 2. email로 staff 문서
  for (const email of EMAILS) {
    console.log(`\n[2] email="${email}" 인 staff 문서:`);
    const byEmail = await db.collection("staff").where("email", "==", email).get();
    if (byEmail.empty) console.log("  (없음)");
    byEmail.forEach((doc) => console.log(row(doc.id, doc.data())));
  }

  // 3. staffIndex (firestore.rules 의 권한 판정 기준)
  console.log(`\n[3] staffIndex/${TARGET_UID}:`);
  const idx = await db.collection("staffIndex").doc(TARGET_UID).get();
  if (!idx.exists) console.log("  (없음)");
  else console.log("  " + JSON.stringify(idx.data()));

  console.log("\n=== 진단 완료 ===\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("[오류]", e);
  process.exit(1);
});
