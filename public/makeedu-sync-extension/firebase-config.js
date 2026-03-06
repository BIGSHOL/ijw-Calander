// Firebase configuration for the textbook system (ijw-calander project)
export const firebaseConfig = {
  apiKey: "AIzaSyCDDAnbtu7HDM3JUbFf4jKSH4mS6GYYPkI",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: "231563652148",
  appId: "1:231563652148:web:4a217812ef96fa3aae2e61"
};

// Firestore REST API base URL (custom database: restore260202)
const DATABASE_ID = 'restore260202';
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents`;
