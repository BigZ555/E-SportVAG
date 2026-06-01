# 🌍 GeoChampion — School Championship App

Dark-themed GeoGuessr championship management system.  
Built with HTML/CSS/JS + Firebase Realtime Database.

---

## 🚀 Setup in 5 Steps

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **Add project** → name it (e.g. `geochampion`)
3. Disable Google Analytics (optional) → **Create project**

### 2. Enable Realtime Database

1. In your project sidebar → **Build → Realtime Database**
2. Click **Create Database**
3. Choose your region → Start in **test mode** (you can lock it down later)
4. Click **Enable**

### 3. Get Your Config

1. In sidebar → **Project settings** (gear icon)
2. Scroll to **Your apps** → click **</>** (Web)
3. Register the app → copy the `firebaseConfig` object

### 4. Paste Config Into the App

Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc..."
};
```

### 5. Create the Admin Account

In Firebase Console → **Realtime Database** → click the **+** button to add data manually:

```
users/
  admin/
    password: "your_admin_password"
    role: "admin"
    displayName: "Admin"
```

> ⚠️ Passwords are stored as plain text in the database. This is fine for a school championship — for production use, switch to Firebase Authentication.

---

## 📁 File Structure

```
geochampion/
├── index.html          ← Public leaderboard (no login)
├── login.html          ← Judge login page
├── judge.html          ← Judge match panel
├── admin.html          ← Admin panel
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── firebase-config.js   ← YOUR CONFIG GOES HERE
│   ├── auth.js              ← Login/logout logic
│   ├── public.js            ← Leaderboard logic
│   ├── judge.js             ← Judge panel logic
│   └── admin.js             ← Admin panel logic
├── database.rules.json ← Firebase security rules
└── vercel.json         ← Vercel deployment config
```

---

## 👥 User Roles

| Role  | Access |
|-------|--------|
| Public | View leaderboard only |
| Judge | Login → start matches, enter scores, view own history |
| Admin | All of the above + manage teams, view all matches by judge, statistics, create judge accounts |

---

## 🏆 How It Works

1. **Admin** creates teams (name + 3 players) in the Admin Panel
2. **Admin** creates judge accounts (up to 4)
3. **Judges** log in and start matches:
   - Select Team A and Team B (players auto-fill)
   - Enter individual player scores
   - System auto-totals and determines winner
   - Save to Firebase
4. **Public leaderboard** updates automatically with wins/losses/draws/points

---

## 🌐 Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo
4. Framework Preset: **Other**
5. Deploy — done! ✅

Or use Vercel CLI:
```bash
npm i -g vercel
vercel
```

---

## 🔒 Database Rules (Optional Tightening)

The included `database.rules.json` is open for simplicity.  
For a school event this is fine. After the championship, set rules to `.write: false`.

---

## 📝 Notes

- Passwords in this app are plain text (by design for simplicity). Don't reuse real passwords.
- The app works on mobile — fully responsive.
- Up to 4 judges supported (but you can add more).
- Each match stores individual player scores + team totals.
