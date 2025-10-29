# Vertex AI Not Working - Fix Guide

## Issues Found

1. **Project ID Mismatch**
   - Environment variable: `GOOGLE_CLOUD_PROJECT=vectorlabsai`
   - Credentials file: `vectorslabai-16a5b`
   - ❌ These don't match!

2. **Permissions Denied (403)**
   - Error: `Permission 'aiplatform.endpoints.predict' denied`
   - Service account lacks Vertex AI access

3. **Internet Access Required**
   - ✅ YES - Vertex AI requires internet to reach Google Cloud APIs
   - Without internet, system falls back to GEMINI_API_KEY (which also needs internet)

## Fix #1: Update .env with Correct Project ID

Add to `Server/.env`:

```env
# ================================
# Google Cloud / Vertex AI
# ================================
GOOGLE_CLOUD_PROJECT=vectorslabai-16a5b
GOOGLE_APPLICATION_CREDENTIALS=C:\keys\vertex-app.json
VERTEX_LOCATION=us-central1
```

This matches the project ID in your credentials file.

## Fix #2: Grant Vertex AI Permissions

Your service account needs the "Vertex AI User" role:

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=vectorslabai-16a5b

2. Find service account: `firebase-adminsdk-fbsvc@vectorslabai-16a5b.iam.gserviceaccount.com`

3. Click "Edit" (pencil icon)

4. Click "+ ADD ANOTHER ROLE"

5. Search for and add: **"Vertex AI User"**

6. Save

## Alternative: Use Google AI Studio Instead (No Vertex AI)

If you don't want to deal with Vertex AI permissions, the system automatically falls back to Google AI Studio using `GEMINI_API_KEY`.

Your current setup:
- ✅ `GEMINI_API_KEY` is set in `.env`
- ✅ System will use this as fallback

To force Google AI Studio only (disable Vertex AI):
```env
# Remove or comment out these lines:
# GOOGLE_CLOUD_PROJECT=vectorslabai-16a5b
# GOOGLE_APPLICATION_CREDENTIALS=C:\keys\vertex-app.json
```

## Test After Fixing

Run the diagnostic again:
```powershell
npx ts-node Server/check-vertex-setup.ts
```

Expected output:
```
✅ API call successful!
Response: Hi there friend!

✅ Vertex AI is working correctly!
```

## Quick Summary

**Q: Does Vertex AI need internet?**
**A: YES** - It's a cloud API service. Without internet, neither Vertex AI nor Google AI Studio will work.

**Current Status:**
- ❌ Vertex AI: Not working (wrong project ID + permissions)
- ✅ Google AI Studio: Working (using GEMINI_API_KEY as fallback)
- ✅ Your app still works because of the automatic fallback

**Recommended Action:**
1. Fix project ID in .env → matches credentials
2. Add "Vertex AI User" role to service account
3. Restart server
