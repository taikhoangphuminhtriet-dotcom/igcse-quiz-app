import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyAUI0iqchS7XJGb0YwlyDJJOFdDAQSDQ10",
    authDomain: "live2-8b337.firebaseapp.com",
    databaseURL: "https://live2-8b337-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "live2-8b337",
    storageBucket: "live2-8b337.firebasestorage.app",
    messagingSenderId: "83407640211",
    appId: "1:83407640211:web:8b02946cf80b42ebba1f66"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
