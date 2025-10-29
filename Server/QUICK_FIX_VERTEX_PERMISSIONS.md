# Quick Fix: Grant Vertex AI Permissions

## Problem
Your server logs show:
```
Vertex AI client initialized. project=vectorlabsai, location=us-central1
⚠️ Vertex AI permission denied (gemini-2.0-flash-lite-001) - using Google AI Studio fallback
```

This means Vertex AI is initialized but lacks permissions.

## Solution: Add IAM Role

### Option 1: Via Google Cloud Console (Recommended - Takes 2 minutes)

1. **Open IAM page:**
   https://console.cloud.google.com/iam-admin/iam?project=vectorslabai-16a5b

2. **Find your service account:**
   Look for: `firebase-adminsdk-fbsvc@vectorslabai-16a5b.iam.gserviceaccount.com`

3. **Edit permissions:**
   - Click the pencil (✏️) icon next to the service account
   - Click "+ ADD ANOTHER ROLE"
   - Search for: **"Vertex AI User"**
   - Select it and click "SAVE"

4. **Restart your server** (Ctrl+C, then `npm start`)

### Option 2: Via gcloud CLI (Fast if you have it installed)

```bash
gcloud projects add-iam-policy-binding vectorslabai-16a5b \
  --member="serviceAccount:firebase-adminsdk-fbsvc@vectorslabai-16a5b.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

Then restart your server.

## After Fixing

You should see in the logs:
```
✅ AI response generated (123 chars) in 2.5s
```

Instead of:
```
⚠️ Vertex AI permission denied - using Google AI Studio fallback
```

## Current Status

- ✅ Vertex AI client initialized correctly
- ✅ Project ID correct: vectorslabsai-16a5b
- ❌ Missing IAM role: "Vertex AI User"
- ✅ Fallback working: Google AI Studio (GEMINI_API_KEY)

**Your app still works** because of the automatic fallback, but Vertex AI will be faster and more scalable once permissions are added.

## Why This Happened

The service account was created for Firebase Admin SDK but doesn't automatically have Vertex AI permissions. They need to be added separately.
