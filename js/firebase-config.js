// =============================================
//  FIREBASE CONFIGURATION
//  Replace the values below with your own
//  Firebase project credentials from:
//  https://console.firebase.google.com/
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyAIpZ6mOpLm7QQ80ZHdZgObnO7fgi8jZXI",
  authDomain: "openguessrchampionshipvag.firebaseapp.com",
  databaseURL: "https://openguessrchampionshipvag-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "openguessrchampionshipvag",
  storageBucket: "openguessrchampionshipvag.firebasestorage.app",
  messagingSenderId: "1003109155559",
  appId: "1:1003109155559:web:13882c00b5d428c4195842",
  measurementId: "G-Q5TVN075HG"
};

// =============================================
//  DO NOT EDIT BELOW THIS LINE
// =============================================

let db = null;

(function initFirebase() {
  const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";

  if (isPlaceholder) {
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed; top: 64px; left: 0; right: 0; z-index: 9999;
        background: #ff4757; color: #fff; text-align: center;
        padding: 12px 20px; font-family: monospace; font-size: 14px;
        border-bottom: 2px solid #ff2233;
      `;
      banner.textContent = '⚠️ Firebase is not configured. Open js/firebase-config.js and replace the placeholder values with your project credentials.';
      document.body.prepend(banner);
    });
    console.error('[GeoChampion] Firebase config not set. Edit js/firebase-config.js with your project credentials.');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  } catch (e) {
    console.error('[GeoChampion] Firebase init failed:', e.message);
    document.addEventListener('DOMContentLoaded', () => {
      const banner = document.createElement('div');
      banner.style.cssText = `
        position: fixed; top: 64px; left: 0; right: 0; z-index: 9999;
        background: #ff4757; color: #fff; text-align: center;
        padding: 12px 20px; font-family: monospace; font-size: 14px;
      `;
      banner.textContent = '⚠️ Firebase error: ' + e.message + ' — Check your config in js/firebase-config.js';
      document.body.prepend(banner);
    });
  }
})();

// =============================================
//  DATABASE STRUCTURE:
//
//  /users/{username}   → { password, role, displayName }
//  /teams/{teamId}     → { name, players: [p1, p2, p3] }
//  /matches/{matchId}  → { judgeId, judgeName,
//                          teamA, teamB, teamAId, teamBId,
//                          scoreA, scoreB,
//                          playerScoresA, playerScoresB,
//                          winner, timestamp }
// =============================================
