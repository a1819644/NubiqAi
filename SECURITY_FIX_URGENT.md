# 🚨 EMERGENCY: Remove Leaked Secrets from Git

## ⚠️ CRITICAL - Do This IMMEDIATELY!

Your API keys have been exposed in Git history. Follow these steps NOW:

---

## 🔥 Quick Fix (Automated)

**Run this script:**
```powershell
cd "d:\flutter project\NubiqAi"
.\REMOVE_SECRETS.bat
```

---

## 📋 Manual Steps (If script fails)

### Step 1: Remove secrets from Git tracking

```powershell
cd "d:\flutter project\NubiqAi"

# Remove from Git cache (doesn't delete files locally)
git rm --cached .env 2>$null
git rm --cached .env.production 2>$null
git rm --cached Server/.env 2>$null
git rm --cached Server/serviceAccountKey.json 2>$null
git rm --cached Server/*.json 2>$null
```

### Step 2: Reset last commit (removes secrets from history)

```powershell
# Option A: Remove ONLY last commit (recommended)
git reset --soft HEAD~1

# Option B: Remove last 2 commits (if secrets in both)
git reset --soft HEAD~2
```

### Step 3: Commit changes

```powershell
git add .
git commit -m "Security: Remove leaked secrets and update .gitignore"
```

### Step 4: Force push to overwrite GitHub history

```powershell
git push --force origin main
```

---

## 🔐 Rotate ALL Compromised Keys IMMEDIATELY

### 1. Firebase (HIGH PRIORITY)

**Delete compromised project and create new one:**
1. Go to https://console.firebase.google.com
2. Select your project → Settings (⚙️)
3. Scroll down → **"Delete Project"**
4. Create NEW project with different name
5. Enable Google Authentication
6. Generate NEW service account key
7. Update Vercel environment variables

**OR restrict existing keys:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your project
3. Find your API key → Edit
4. Add **Application restrictions**:
   - Set to "HTTP referrers"
   - Add: `vectorslabai.vercel.app/*`
5. Add **API restrictions**:
   - Select "Restrict key"
   - Enable only: Firebase Authentication API

### 2. Google Gemini API

1. Go to https://aistudio.google.com/apikey
2. **Delete** exposed API key
3. **Create** new API key
4. Update in Railway/Render environment variables

### 3. Pinecone API

1. Go to https://app.pinecone.io
2. Go to **API Keys** section
3. **Delete** exposed key
4. **Create** new key
5. Update in Railway/Render environment variables

---

## ✅ Verify Secrets Are Removed

```powershell
# Check Git status
git status

# Verify .env files are NOT tracked
git ls-files | findstr .env

# Should return nothing - if it shows files, they're still tracked!
```

---

## 🛡️ Prevent Future Leaks

### 1. Double-check .gitignore

```powershell
# Verify .gitignore is working
git check-ignore .env
git check-ignore Server/.env
git check-ignore .env.production

# Should output the filenames - means they're ignored ✅
```

### 2. Use environment variable templates

Create `.env.example` (safe to commit):
```env
# Copy this to .env and fill in your actual values
GEMINI_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
```

### 3. Use Git hooks (optional)

Create `.git/hooks/pre-commit`:
```bash
#!/bin/sh
if git diff --cached --name-only | grep -E '\.(env|key|pem|json)$'; then
    echo "ERROR: Attempting to commit sensitive files!"
    exit 1
fi
```

---

## 📊 Damage Assessment

### What was potentially exposed:
- ✅ Firebase API keys (restrict by domain)
- ✅ Firebase service account JSON (regenerate)
- ✅ Gemini API key (delete & regenerate)
- ✅ Pinecone API key (delete & regenerate)
- ✅ Any other keys in .env files

### Timeline:
- **When**: When you committed and pushed to GitHub
- **Exposure**: Public if repo is public, or to anyone with access
- **Duration**: From commit time until now

---

## 🚀 Recovery Checklist

After removing secrets:

- [ ] Secrets removed from Git history (`git log` shows no secrets)
- [ ] Force pushed to GitHub (history overwritten)
- [ ] Firebase project deleted OR keys restricted by domain
- [ ] New Firebase project created (if deleted old one)
- [ ] Gemini API key rotated
- [ ] Pinecone API key rotated
- [ ] All new keys added to Vercel
- [ ] All new keys added to Railway/Render
- [ ] Redeployed frontend: `vercel --prod`
- [ ] Redeployed backend
- [ ] Tested app works with new keys
- [ ] .gitignore properly configured
- [ ] No .env files in `git status`

---

## 🔍 How to Check if Secrets Are Gone

```powershell
# Search entire Git history for sensitive strings
git log --all -S "GEMINI_API_KEY" --oneline
git log --all -S "PINECONE_API_KEY" --oneline

# Should return NOTHING if properly removed
```

---

## 📞 If You Need Help

If automatic removal fails:

1. **Nuclear option**: Delete repo and recreate
2. **BFG Repo Cleaner**: https://rtyley.github.io/bfg-repo-cleaner/
3. **Contact me** with the error message

---

## ⏰ DO THIS NOW!

1. **Run**: `.\REMOVE_SECRETS.bat`
2. **Rotate**: All API keys
3. **Update**: Vercel + Railway with new keys
4. **Test**: Deploy and verify everything works

**Time is critical - exposed keys can be found by bots within minutes!** 🚨

---

## 📝 Prevention for Future

**Golden Rules:**
1. ❌ NEVER commit .env files
2. ❌ NEVER commit *key.json files
3. ❌ NEVER commit API keys in code
4. ✅ ALWAYS use environment variables
5. ✅ ALWAYS check `git status` before committing
6. ✅ ALWAYS use .env.example for templates

---

**START NOW! Run the script or follow manual steps!** ⚡
