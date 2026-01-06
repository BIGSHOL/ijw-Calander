import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

// Config from user (copied to avoid TS compilation for this quick test script)
// Config from environment variables (Run with: node --env-file=.env.local verify_firestore.js)
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verify() {
    console.log("Starting Firestore Verification...");
    try {
        // 1. Write
        const testCol = collection(db, "verification_test");
        const docRef = await addDoc(testCol, {
            timestamp: new Date().toISOString(),
            test: "Hello Firebase"
        });
        console.log("✅ Write successful. Doc ID:", docRef.id);

        // 2. Read
        const snapshot = await getDocs(testCol);
        console.log(`✅ Read successful. Found ${snapshot.size} documents.`);

        // 3. Delete
        await deleteDoc(doc(db, "verification_test", docRef.id));
        console.log("✅ Delete successful.");

        console.log("\n🎉 Firebase integration is WORKING!");
    } catch (e) {
        console.error("\n❌ Firebase verification FAILED:", e);
        process.exit(1);
    }
}

verify();
