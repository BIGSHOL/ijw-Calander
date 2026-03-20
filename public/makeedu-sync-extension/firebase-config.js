// Firebase configuration for the textbook system (ijw-calander project)
// 실제 키는 .env.local에서 관리 - 이 파일은 확장 프로그램 빌드 시 환경변수로 교체됨
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: "ijw-calander.firebaseapp.com",
  projectId: "ijw-calander",
  storageBucket: "ijw-calander.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Firestore REST API base URL (custom database: restore260202)
const DATABASE_ID = 'restore260202';
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents`;
