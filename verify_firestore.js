import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

// Config from user (copied to avoid TS compilation for this quick test script)
const firebaseConfig = {
    apiKey: "AIzaSyBnxKjLrOyW23t5fZAEeHa9uRgV9GWJGiU",
    authDomain: "ijw-calander.firebaseapp.com",
    projectId: "ijw-calander",
    storageBucket: "ijw-calander.firebasestorage.app",
    messagingSenderId: "231563652148",
    appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
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
