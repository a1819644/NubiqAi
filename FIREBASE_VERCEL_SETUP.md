# 🔥 Firebase Setup for Vercel Deployment

## 🎯 Quick Fix Steps

### 1. Get Firebase Credentials

1. Go to: https://console.firebase.google.com
2. Select (or create) your project
3. Click the **gear icon** (⚙️) → **Project settings**
4. Scroll to **"Your apps"** section
5. Click **Web icon** (</>) or **"Add app"** if no web app exists
6. Copy the `firebaseConfig` object

Example:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXX",           // ← Copy this
  authDomain: "myproject.firebaseapp.com",      // ← Copy this
  projectId: "myproject-12345",                 // ← Copy this
  storageBucket: "myproject.appspot.com",       // ← Copy this
  messagingSenderId: "123456789012",            // ← Copy this
  appId: "1:123456:web:abc123"                  // ← Copy this
};
```

### 2. Enable Google Authentication

1. In Firebase Console, go to **Authentication**
2. Click **"Get Started"** (if first time)
3. Go to **Sign-in method** tab
4. Click **Google**
5. Toggle **Enable**
6. Add your email as test user
7. **Click Save**

### 3. Add Authorized Domains

Still in **Authentication** → **Settings** tab:

1. Scroll to **Authorized domains**
2. Click **"Add domain"**
3. Add your Vercel domain: `vectorlabsai.vercel.app`
4. Click **Add**

### 4. Add Environment Variables to Vercel

#### Method 1: Vercel Dashboard (Easiest)

1. Go to: https://vercel.com/dashboard
2. Click your project: **vectorlabsai**
3. Go to: **Settings** → **Environment Variables**
4. Add each variable:

| Variable Name | Value (from Firebase) | Environment |
|---------------|----------------------|-------------|
| `VITE_FIREBASE_API_KEY` | Your API Key | Production |
| `VITE_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com | Production |
| `VITE_FIREBASE_PROJECT_ID` | your-project-id | Production |
| `VITE_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com | Production |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 123456789012 | Production |
| `VITE_FIREBASE_APP_ID` | 1:123456:web:abc123 | Production |

5. Also add backend URL (temporary for now):
| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api` | Production |

#### Method 2: Via CLI

```powershell
cd "d:\flutter project\NubiqAi"

# Add each variable (paste your actual values when prompted)
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel env add VITE_API_URL production
```

### 5. Redeploy to Vercel

After adding all variables:

```powershell
cd "d:\flutter project\NubiqAi"
vercel --prod
```

---

## 🧪 Test Your Deployment

1. Visit: `https://vectorlabsai.vercel.app`
2. Open browser console (F12)
3. Click **"Sign In"**
4. Select Google account
5. Should successfully authenticate!

---

## 🐛 Still Getting Errors?

### Error: "auth/api-key-not-valid"
- ✅ Check that API key is correct (no spaces, complete)
- ✅ Verify you added it to Vercel environment variables
- ✅ Redeploy after adding variables

### Error: "auth/unauthorized-domain"
- ✅ Add `vectorlabsai.vercel.app` to Firebase Authorized domains
- ✅ Wait 5 minutes for changes to propagate

### Error: "auth/operation-not-allowed"
- ✅ Enable Google sign-in in Firebase Console
- ✅ Authentication → Sign-in method → Google → Enable

---

## 📋 Checklist

Before testing:
- [ ] Firebase project created
- [ ] Google authentication enabled
- [ ] Vercel domain added to authorized domains
- [ ] All 6 Firebase env variables added to Vercel
- [ ] Redeployed to Vercel
- [ ] Waited 2-3 minutes for deployment

---

## 🎯 What's Next?

After Firebase works:

1. **Deploy Backend** to Railway/Render
2. **Update `VITE_API_URL`** in Vercel with backend URL
3. **Redeploy** frontend
4. **Test full functionality** (chat, images, etc.)

---

**Need help?** Share the exact error message you're seeing! 🚀
