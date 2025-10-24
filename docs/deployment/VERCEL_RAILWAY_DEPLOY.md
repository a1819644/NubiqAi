# 🚀 Vercel + Railway Deployment Guide

## Step 1: Deploy Frontend to Vercel ✅

### A. Login to Vercel
```powershell
vercel login
```
This will open your browser to authenticate.

### B. Deploy to Vercel
```powershell
cd "d:\flutter project\NubiqAi"
vercel --prod
```

**Answer the prompts:**
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N**
- Project name? **nubiqai** (or your choice)
- Directory? **./dist**
- Override settings? **N**

**Save your Vercel URL!** (e.g., `https://nubiqai.vercel.app`)

---

## Step 2: Deploy Backend to Railway 🚂

### A. Sign Up for Railway
1. Go to: https://railway.app
2. Sign up with GitHub
3. **You get $5 free credit monthly!**

### B. Create New Project
1. Click **"New Project"**
2. Choose **"Deploy from GitHub repo"** or **"Empty Project"**

### C. Deploy Backend Files

**If using GitHub:**
1. Push your code to GitHub
2. Connect repository
3. Set root directory to `/Server`

**If deploying directly:**
1. Install Railway CLI:
```powershell
npm install -g @railway/cli
```

2. Login:
```powershell
railway login
```

3. Deploy:
```powershell
cd "d:\flutter project\NubiqAi\Server"
railway init
railway up
```

### D. Add Environment Variables in Railway Dashboard
Go to your Railway project → Variables → Add:
```
GEMINI_API_KEY=your_gemini_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=your_env
PINECONE_INDEX=your_index
PORT=8000
NODE_ENV=production
```

### E. Get Your Railway Backend URL
After deployment, Railway will give you a URL like:
`https://nubiqai-backend-production.up.railway.app`

---

## Step 3: Connect Frontend to Backend 🔗

### A. Update Environment Variable
Edit `.env.production`:
```env
VITE_API_URL=https://your-railway-url.up.railway.app/api
```

### B. Rebuild Frontend
```powershell
cd "d:\flutter project\NubiqAi"
npm run build
```

### C. Redeploy to Vercel
```powershell
vercel --prod
```

---

## Step 4: Configure Firebase for Production 🔥

### A. Add Authorized Domains
1. Go to: https://console.firebase.google.com
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Add your Vercel domain:
   - `nubiqai.vercel.app`
   - Your custom domain (if any)

### B. Update Firebase Config
Edit `.env.production` with your real Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_real_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### C. Rebuild & Redeploy
```powershell
npm run build
vercel --prod
```

---

## Alternative: Deploy Backend to Render.com 🎨

### Render.com Setup (Another free option)
1. Go to: https://render.com
2. Sign up with GitHub
3. **New** → **Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Root Directory**: `Server`
   - **Build Command**: `npm install`
   - **Start Command**: `npx ts-node index.ts`
   - **Environment**: Add all your env variables

---

## Quick Command Summary 📋

```powershell
# 1. Deploy Frontend
cd "d:\flutter project\NubiqAi"
vercel login
vercel --prod

# 2. Deploy Backend (Railway)
cd Server
railway login
railway init
railway up

# 3. Update API URL & Redeploy Frontend
# (Edit .env.production with Railway URL)
cd ..
npm run build
vercel --prod
```

---

## 🎯 What You'll Have:

- **Frontend**: `https://nubiqai.vercel.app` (free forever!)
- **Backend**: `https://your-app.up.railway.app` ($5/month free tier)
- **Custom Domain**: Optional, configure in Vercel settings

---

## 🧪 Test Your Deployment

1. Visit your Vercel URL
2. Open browser console (F12)
3. Try to sign in
4. Send a test message
5. Check if backend responds

---

## 🆘 Troubleshooting

### CORS Errors
Update `Server/index.ts`:
```typescript
app.use(cors({
  origin: ['https://nubiqai.vercel.app', 'https://your-custom-domain.com'],
  credentials: true
}));
```

### API Not Connecting
- Check Railway logs for errors
- Verify environment variables are set
- Check Railway backend URL is correct in `.env.production`

---

**Ready to deploy? Start with Step 1!** 🚀
