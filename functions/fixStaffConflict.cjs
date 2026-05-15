/**
 * [일회용] uid 충돌 staff 정리
 *
 * 배경: 퇴사 직원 `이희영` staff 문서의 uid가 박소선 master 문서와 동일하게
 *       남아있어 한 uid에 staff 문서가 2개 연결된 상태. 이를 정리한다.
 *
 * 작업:
 *  1. staff/`이희영` (퇴사자): uid 필드 제거 + email을 lhy335577@gmail.com 으로 원복
 *  2. staffIndex/{uid}: email을 st2000423@gmail.com 으로 갱신 (staffId/systemRole은 이미 정상)
 *  3. 검증: uid로 staff 재조회 시 master 문서 1개만 남는지 확인
 *
 * 사용법: functions 디렉토리에서  node fixStaffConflict.cjs
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const KEY_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(KEY_PATH)) {
  console.error("[중단] functions/serviceAccountKey.json 이 없습니다.");
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = getFirestore("restore20260319");

const TARGET_UID = "T7HN60crkUeSoCo6bSyzdB2AK3w1";
const RESIGNED_STAFF_DOC_ID = "이희영";
const RESIGNED_OLD_EMAIL = "lhy335577@gmail.com";
const MASTER_EMAIL = "st2000423@gmail.com";

async function main() {
  console.log("\n=== uid 충돌 staff 정리 ===\n");

  // 1. 퇴사 직원 `이희영` 문서: uid 제거 + email 원복
  const resignedRef = db.collection("staff").doc(RESIGNED_STAFF_DOC_ID);
  const resignedSnap = await resignedRef.get();
  if (!resignedSnap.exists) {
    console.log(`[경고] staff/${RESIGNED_STAFF_DOC_ID} 문서가 없습니다. 건너뜁니다.`);
  } else {
    const before = resignedSnap.data();
    console.log(`[1] staff/${RESIGNED_STAFF_DOC_ID} 정리 전:`);
    console.log(
      `    name="${before.name}" email="${before.email}" uid="${before.uid}" ` +
      `systemRole="${before.systemRole}" status="${before.status}"`
    );
    if (before.uid && before.uid !== TARGET_UID) {
      console.error(`[중단] 예상과 다른 uid("${before.uid}") 입니다. 안전을 위해 중단합니다.`);
      process.exit(1);
    }
    if (before.systemRole === "master") {
      console.error("[중단] 이 문서의 systemRole이 master 입니다. 잘못된 대상이므로 중단합니다.");
      process.exit(1);
    }
    await resignedRef.update({
      uid: FieldValue.delete(),
      email: RESIGNED_OLD_EMAIL,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[1] 완료: uid 필드 제거, email -> ${RESIGNED_OLD_EMAIL}`);
  }

  // 2. staffIndex 이메일 갱신 (staffId / systemRole 은 이미 master 문서를 정상 참조)
  const idxRef = db.collection("staffIndex").doc(TARGET_UID);
  const idxSnap = await idxRef.get();
  if (!idxSnap.exists) {
    console.log(`\n[경고] staffIndex/${TARGET_UID} 문서가 없습니다.`);
  } else {
    const idx = idxSnap.data();
    console.log(`\n[2] staffIndex/${TARGET_UID} 정리 전: ${JSON.stringify(idx)}`);
    await idxRef.update({
      email: MASTER_EMAIL,
      updatedAt: new Date().toISOString(),
    });
    console.log(
      `[2] 완료: email -> ${MASTER_EMAIL} ` +
      `(staffId="${idx.staffId}", systemRole="${idx.systemRole}" 유지)`
    );
  }

  // 3. 검증 — uid 로 staff 재조회 시 master 문서 1개만 나와야 함
  console.log(`\n[3] 검증 — uid="${TARGET_UID}" 에 연결된 staff 문서:`);
  const verify = await db.collection("staff").where("uid", "==", TARGET_UID).get();
  if (verify.empty) {
    console.log("    (없음) — 예상과 다름! master 문서의 uid 가 사라졌습니다.");
  } else {
    verify.forEach((d) => {
      const x = d.data();
      console.log(
        `    - docId="${d.id}" name="${x.name}" systemRole="${x.systemRole}" email="${x.email}"`
      );
    });
    if (verify.size === 1 && verify.docs[0].data().systemRole === "master") {
      console.log("    => 정상: master 문서 1개만 연결됨.");
    } else {
      console.log(`    => 주의: 문서 ${verify.size}개. 추가 점검이 필요합니다.`);
    }
  }

  console.log("\n=== 정리 완료 ===\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("[오류]", e);
  process.exit(1);
});
