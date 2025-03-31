// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeAuth, getReactNativePersistence} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgFR6teEQZsKF4_VMjDwHb6wvTJJ51LKs",
  authDomain: "expense-tracker-ebf04.firebaseapp.com",
  projectId: "expense-tracker-ebf04",
  storageBucket: "expense-tracker-ebf04.firebasestorage.app",
  messagingSenderId: "307496997658",
  appId: "1:307496997658:web:bd9f974f3eb17a1c6c92a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// auth
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

// db
export const firestore = getFirestore(app);