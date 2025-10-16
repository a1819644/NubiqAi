# 🔐 Firebase Authentication Setup Guide

## Quick Start (5 minutes)

### Step 1: Create/Select Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** (or select an existing project)
3. Enter project name (e.g., "NubiqAi")
4. Follow the setup wizard (you can disable Google Analytics if you want)

### Step 2: Add Web App to Firebase

1. In your Firebase project dashboard, click the **Web icon** (`</>`) to add a web app
2. Register your app:
   - **App nickname**: `NubiqAi Web` (or any name you prefer)
   - ✅ Check **"Also set up Firebase Hosting"** (optional)
3. Click **"Register app"**
4. You'll see a configuration object with your Firebase credentials - **KEEP THIS WINDOW OPEN!**

### Step 3: Enable Google Authentication

1. In the left sidebar, click **"Authentication"**
2. Click **"Get started"** (if first time)
3. Click the **"Sign-in method"** tab
4. Find **"Google"** in the providers list
5. Click on it to expand
6. Toggle **"Enable"**
7. Select a **"Project support email"** from the dropdown (your email)
8. Click **"Save"**

### Step 4: Copy Firebase Credentials

From the Firebase config window (Step 2), copy the values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",                    // ← Copy this
  authDomain: "project.firebaseapp.com", // ← Copy this
  projectId: "project-id",               // ← Copy this
  storageBucket: "project.appspot.com",  // ← Copy this
  messagingSenderId: "123456789",        // ← Copy this
  appId: "1:123456789:web:abc123"        // ← Copy this
};
```

### Step 5: Create `.env` File

1. In your project root (`D:\flutter project\NubiqAi\`), create a file named `.env`
2. Copy the contents from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   
3. Replace the placeholder values with your Firebase credentials:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

### Step 6: Restart Your Development Server

**Important:** After creating/updating `.env`, you **must restart** your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 7: Test Authentication

1. Open your app in the browser (usually `http://localhost:3000`)
2. Click **"Sign In"** button
3. Click **"Continue with Google"**
4. Select your Google account
5. You should be signed in! 🎉

---

## Troubleshooting

### ❌ "Firebase: Error (auth/invalid-api-key)"
- **Problem:** API key is incorrect or missing
- **Solution:** Double-check your `VITE_FIREBASE_API_KEY` in `.env`

### ❌ "Firebase: Error (auth/unauthorized-domain)"
- **Problem:** Current domain not authorized in Firebase
- **Solution:** 
  1. Go to Firebase Console > Authentication > Settings > Authorized domains
  2. Add `localhost` (should be there by default)
  3. For production, add your actual domain

### ❌ "Firebase: Error (auth/operation-not-allowed)"
- **Problem:** Google sign-in not enabled
- **Solution:** Follow Step 3 again to enable Google authentication

### ❌ Changes not reflecting after updating `.env`
- **Problem:** Vite caches environment variables
- **Solution:** Restart your development server completely

### ❌ "Cannot find module 'firebase/app'"
- **Problem:** Firebase package not installed
- **Solution:** Run `npm install` in your project root

---

## Security Best Practices

### ✅ DO:
- ✅ Keep `.env` file in `.gitignore` (already done)
- ✅ Use different Firebase projects for development and production
- ✅ Enable only the authentication methods you need
- ✅ Add only trusted domains to authorized domains list

### ❌ DON'T:
- ❌ **Never commit `.env` to Git** (credentials will be exposed!)
- ❌ Don't share your Firebase credentials publicly
- ❌ Don't use production Firebase credentials in development

---

## What Happens When User Signs In?

Here's the authentication flow:

```
1. User clicks "Sign In" button
   ↓
2. Opens AuthDialog with Google button
   ↓
3. User clicks "Continue with Google"
   ↓
4. Firebase shows Google account picker popup
   ↓
5. User selects Google account and grants permission
   ↓
6. Firebase returns user object:
   - uid (unique user ID)
   - displayName (user's name)
   - email (user's email)
   - photoURL (profile picture)
   ↓
7. useAuth hook converts Firebase user to app User type
   ↓
8. User object stored in:
   - React state (for current session)
   - localStorage (for persistence across page reloads)
   ↓
9. User ID sent to backend with all API requests
   ↓
10. Backend auto-creates user profile if not exists
   ↓
11. AI greets user by name from profile! 🎉
```

---

## Advanced Configuration (Optional)

### Add More Authentication Methods

You can enable additional sign-in methods:

1. **Email/Password:**
   - Firebase Console > Authentication > Sign-in method
   - Enable "Email/Password"
   - Update `AuthDialog.tsx` to include email/password form

2. **GitHub:**
   - Enable GitHub provider in Firebase
   - Requires GitHub OAuth App setup

3. **Microsoft/Apple:**
   - Enable respective providers
   - Requires additional app setup

### Configure Authentication Settings

1. **Email Verification:**
   - Authentication > Settings
   - Toggle "Email verification"

2. **Password Requirements:**
   - Authentication > Settings
   - Configure password policy

---

## Need Help?

- 📚 [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- 🎯 [Firebase Console](https://console.firebase.google.com)
- 💬 Check browser console for detailed error messages
- 🔍 Review `FIREBASE_AUTH_SETUP.md` for code implementation details

---

## Status Checklist

- [ ] Firebase project created
- [ ] Web app added to Firebase project
- [ ] Google authentication enabled
- [ ] `.env` file created with Firebase credentials
- [ ] Development server restarted
- [ ] Sign-in tested successfully
- [ ] User profile created in backend
- [ ] User sees personalized greeting from AI

Once all checkboxes are ✅, your authentication is fully set up! 🚀
