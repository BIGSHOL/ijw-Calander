import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBnxKjLrOyW23t5fZAEeHa9uRgV9GWJGiU",
    authDomain: "ijw-calander.firebaseapp.com",
    projectId: "ijw-calander",
    storageBucket: "ijw-calander.firebasestorage.app",
    messagingSenderId: "231563652148",
    appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
};

const app = initializeApp(firebaseConfig);
// Initialize Firestore with multi-tab persistent local cache
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

export const auth = getAuth(app);
