# NubiqAI Production Deployment Guide

This runbook documents the exact steps used to ship the NubiqAI backend to **Google Cloud Run** and the frontend to **Firebase Hosting**, with Vertex AI as the primary model provider and Gemini as the fallback. Follow it end-to-end when rebuilding or troubleshooting the live stack.

---

## 1. Prerequisites

- Google Cloud project: `vectorslabai-16a5b` (billing enabled)
- Firebase project linked to the same GCP project
- Local tooling:
  - Node.js 20+
  - npm 9+
  - `gcloud` CLI (>= 488)
  - `firebase-tools` (>= 13)
- Repository cloned locally (branch `nubiqtest-anoop`)
- Service account permissions for your user:
  - `roles/run.admin`
  - `roles/artifactregistry.admin`
  - `roles/secretmanager.admin`
  - `roles/firebase.admin`
  - `roles/aiplatform.admin`

---

## 2. Backend · Cloud Run

### 2.1 Configure CLI

```powershell
# Authenticate and target the project
gcloud auth login
gcloud config set project vectorslabai-16a5b

# Enable required APIs
 gcloud services enable \
   run.googleapis.com cloudbuild.googleapis.com \
   artifactregistry.googleapis.com secretmanager.googleapis.com \
   aiplatform.googleapis.com firestore.googleapis.com
```

### 2.2 Build container image

```powershell
cd "D:\flutter project\NubiqAi\Server"

# Install deps + compile TypeScript
npm install
npm run build

# Submit build to Artifact Registry
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/vectorslabai-16a5b/nubiqai/server:latest
```

### 2.3 Create required secrets

```powershell
# Gemini API key
Set-Content gemini-key.txt -Value "<GEMINI_KEY>" -NoNewline
gcloud secrets create GEMINI_API_KEY --replication-policy=automatic 2>$null
gcloud secrets versions add GEMINI_API_KEY --data-file=gemini-key.txt
Remove-Item gemini-key.txt

# Pinecone API key
Set-Content pinecone-key.txt -Value "<PINECONE_KEY>" -NoNewline
gcloud secrets create PINECONE_API_KEY --replication-policy=automatic 2>$null
gcloud secrets versions add PINECONE_API_KEY --data-file=pinecone-key.txt
Remove-Item pinecone-key.txt

# Firebase project metadata
Set-Content firebase-project-id.txt -Value "vectorslabai-16a5b" -NoNewline
gcloud secrets create FIREBASE_PROJECT_ID --replication-policy=automatic 2>$null
gcloud secrets versions add FIREBASE_PROJECT_ID --data-file=firebase-project-id.txt
Remove-Item firebase-project-id.txt

Set-Content firebase-client-email.txt -Value "<FIREBASE_CLIENT_EMAIL>" -NoNewline
gcloud secrets create FIREBASE_CLIENT_EMAIL --replication-policy=automatic 2>$null
gcloud secrets versions add FIREBASE_CLIENT_EMAIL --data-file=firebase-client-email.txt
Remove-Item firebase-client-email.txt

# Convert PEM private key to single-line string with literal \n
$escapedKey = (Get-Content .\firebase-private-key.pem -Raw).Replace("`r", "").Replace("`n", "\n")
Set-Content firebase-private-key.txt -Value $escapedKey -NoNewline
gcloud secrets create FIREBASE_PRIVATE_KEY --replication-policy=automatic 2>$null
gcloud secrets versions add FIREBASE_PRIVATE_KEY --data-file=firebase-private-key.txt
Remove-Item firebase-private-key.txt
```

### 2.4 Grant Cloud Run access to secrets

```powershell
$svc = "serviceAccount:677205113063-compute@developer.gserviceaccount.com"

foreach ($secret in @("GEMINI_API_KEY","PINECONE_API_KEY","FIREBASE_PROJECT_ID","FIREBASE_CLIENT_EMAIL","FIREBASE_PRIVATE_KEY")) {
  gcloud secrets add-iam-policy-binding $secret \
    --member=$svc \
    --role="roles/secretmanager.secretAccessor"
}
```

### 2.5 Ensure Vertex permissions for the runtime service account

```powershell
gcloud projects add-iam-policy-binding vectorslabai-16a5b \
  --member=$svc \
  --role=roles/aiplatform.user
```

### 2.6 Deploy / update Cloud Run service

Create a temporary env file:

```powershell
@"
NODE_ENV: "production"
CORS_ORIGINS: "https://vectorslabai-16a5b.firebaseapp.com,https://vectorslabai-16a5b.web.app"
GOOGLE_CLOUD_PROJECT: "vectorslabai-16a5b"
VERTEX_LOCATION: "us-central1"
ENABLE_EMOJI: "true"
FIREBASE_STORAGE_BUCKET: "vectorslabai-16a5b.firebasestorage.app"
"@ | Set-Content -Path cloudrun-env.yaml
```

Deploy:

```powershell
gcloud run deploy nubiqai-api \
  --image us-central1-docker.pkg.dev/vectorslabai-16a5b/nubiqai/server:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8000 \
  --memory 1Gi \
  --cpu 2

# Attach secrets + env vars
gcloud run services update nubiqai-api \
  --region us-central1 \
  --update-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest,PINECONE_API_KEY=PINECONE_API_KEY:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest" \
  --env-vars-file cloudrun-env.yaml

Remove-Item cloudrun-env.yaml
```

### 2.7 Verify backend

```powershell
# Get service URL
gcloud run services describe nubiqai-api --region us-central1 --format='value(status.url)'

# Health check
curl https://nubiqai-api-677205113063.us-central1.run.app/api/health

# Tail logs
gcloud run services logs tail nubiqai-api --region us-central1
```

Successful startup logs show:

- `Vertex AI client initialized. project=vectorslabai-16a5b`
- `Firebase Admin initialized`
- No PEM or credential warnings

---

## 3. Frontend · Firebase Hosting

### 3.1 Environment files

- `.env` retains localhost values for local dev
- `.env.production` contains production endpoints:

  ```env
  VITE_API_URL=https://nubiqai-api-677205113063.us-central1.run.app/api
  VITE_WS_URL=ws://nubiqai-api-677205113063.us-central1.run.app
  VITE_FIREBASE_API_KEY=AIzaSyDNgVHPO4JRRvqAm3g3pryKC5_WSVloiaI
  VITE_FIREBASE_AUTH_DOMAIN=vectorslabai-16a5b.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=vectorslabai-16a5b
  VITE_FIREBASE_STORAGE_BUCKET=vectorslabai-16a5b.firebasestorage.app
  VITE_FIREBASE_MESSAGING_SENDER_ID=677205113063
  VITE_FIREBASE_APP_ID=11:677205113063:web:4e853ac934867d35eb4a42
  ```

### 3.2 Initialize Hosting config (one-time)

```powershell
cd "D:\flutter project\NubiqAi"
firebase init hosting
# Answer: project vectorslabai-16a5b, public dir = dist, SPA = yes, no GitHub integration, keep existing dist/index.html
```

`firebase.json` should contain:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

### 3.3 Build & deploy

```powershell
npm install
npm run build
firebase deploy --only hosting
```

Deployment output includes the live URLs:

- `https://vectorslabai-16a5b.web.app`
- `https://vectorslabai-16a5b.firebaseapp.com`

### 3.4 Post-deploy smoke tests

- Open the live site, hard-refresh (`Ctrl+Shift+R`)
- Login via Google; no `auth/api-key-not-valid` errors
- Network tab shows `/api/*` requests hitting `https://nubiqai-api-677205113063.us-central1.run.app`
- Check Cloud Run logs for 200 responses to `/api/chats`, `/api/ask-ai`, etc.
- Validate chat persistence (Firestore) and image workflows (Firebase Storage) complete without warnings

---

## 4. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid PEM formatted message` in logs | Re-upload `FIREBASE_PRIVATE_KEY` with literal `\n` escapes, redeploy. |
| CORS blocked from Firebase site | Ensure `CORS_ORIGINS` env var includes both `.firebaseapp.com` and `.web.app`. |
| Frontend still hitting localhost | Verify `.env.production` has the Cloud Run URL and rebuild. |
| Firebase auth complains about API key | Confirm `VITE_FIREBASE_API_KEY` matches the Firebase console snippet. |
| Vertex permission denied | Grant `roles/aiplatform.user` to the Cloud Run compute service account. |

---

## 5. Maintenance Notes

- Update secrets with `gcloud secrets versions add <SECRET> --data-file=...`; no need to recreate secrets.
- Cloud Run revisions keep history—rollback via `gcloud run services update-traffic nubiqai-api --to-revisions <REV>=100`.
- For CI/CD, replicate the commands above in Cloud Build (backend) and GitHub Actions or Firebase Hosting channels (frontend).

Happy shipping! 🚀
