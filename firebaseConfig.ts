import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Helper to access environment variables in both Vite and Node environments
const getEnv = (key: string) => {
    // Vite environment
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
        return import.meta.env[key];
    }
    // Node environment
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    return undefined;
};

// Firebase configuration loaded from environment variables
// All sensitive keys are now stored in .env.local (not committed to Git)
const firebaseConfig = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnv('VITE_FIREBASE_APP_ID')
};

// Validate required environment variables
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
        'Firebase configuration error: Missing required environment variables.\n' +
        'Please ensure .env.local file exists with all VITE_FIREBASE_* variables.'
    );
}

const app = initializeApp(firebaseConfig);
// Initialize Firestore with multi-tab persistent local cache
// Handle case where Firestore is already initialized (e.g. in browser console re-runs)
import { getFirestore } from "firebase/firestore";

let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
} catch (e) {
    console.warn('Firestore already initialized, using existing instance');
    dbInstance = getFirestore(app);
}

export const db = dbInstance;

export const auth = getAuth(app);
