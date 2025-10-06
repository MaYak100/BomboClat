// Firebase конфигурация
const firebaseConfig = {
  apiKey: "AIzaSyBPOzeYDjdo1XVjytQyHX4AqVqroxuwtzc",
  authDomain: "bomboclat3000-71e33.firebaseapp.com",
  databaseURL: "https://bomboclat3000-71e33-default-rtdb.firebaseio.com",
  projectId: "bomboclat3000-71e33",
  storageBucket: "bomboclat3000-71e33.firebasestorage.app",
  messagingSenderId: "360583233725",
  appId: "1:360583233725:web:1c473e4d876996fa4d37d4"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
