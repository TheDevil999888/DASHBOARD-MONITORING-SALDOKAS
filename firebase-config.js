// FIREBASE CONFIGURATION (LIVE)
const firebaseConfig = {
    apiKey: "AIzaSyBMWjQxxQamzKNr3SqGPT5QJ-ztSsJjxSc",
    authDomain: "bank-dashboard-81930.firebaseapp.com",
    databaseURL: "https://bank-dashboard-81930-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bank-dashboard-81930",
    storageBucket: "bank-dashboard-81930.firebasestorage.app",
    messagingSenderId: "690556373897",
    appId: "1:690556373897:web:91ed2b440f6f6d5850ef58"
};

// Initialize Firebase (Compat Mode)
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); // Get reference to Realtime Database

console.log("Firebase Live Connection initialized for Project: " + firebaseConfig.projectId);
