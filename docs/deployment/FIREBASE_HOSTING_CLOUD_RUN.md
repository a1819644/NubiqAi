# Firebase Hosting + Cloud Run Deployment Guide

This guide walks through deploying NubiqAI with a static frontend on **Firebase Hosting** and the Express/TypeScript backend on **Google Cloud Run**. Use it as your end-to-end runbook for test or staging environments.

---

## 0. Prerequisites

- Google Cloud project with billing enabled
- Local tools: `gcloud` (>= 488.0.0), `firebase-tools` (>= 13), Node.js 20+, npm 9+
- Project cloned locally with access to the `nubiqtest-anoop` branch
- IAM permissions: `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/storage.admin`, plus Firebase Hosting admin access
- API quota prerequisites enabled on the Google Cloud project:
  - Cloud Run API
  - Cloud Build API
  - Artifact Registry API
  - Secret Manager API
  - Firebase Hosting (enable in the Firebase console)

---

## 1. Backend (Cloud Run)

### 1.1 Configure tooling

```sh
# Authenticate the CLI and select the target project
gcloud auth login
gcloud config set project <PROJECT_ID>

# Enable required services
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 1.2 Prepare a production build script

Inside `Server/package.json` add a build script so the TypeScript is emitted to `dist/`:

```json
"scripts": {
  "build": "rm -rf dist && tsc",
  "start": "nodemon index.ts",
  "start:prod": "node dist/index.js"
}
```

> Run `npm install` in `Server/` if you have not already. The repository already includes `typescript` and `ts-node`.

### 1.3 Provision runtime secrets

Store sensitive configuration in Secret Manager (example names shown — adjust to match your .env):

```sh
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
printf "%s" "$GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Repeat for each secret you need
# gcloud secrets create PINECONE_API_KEY ...
```

Suggested minimum list (adapt as needed):

- `GEMINI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (single-line with `\n` escapes)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (full service account JSON if you prefer a single secret)

### 1.4 Create `Server/Dockerfile`

```Dockerfile
# Stage 1: build TypeScript
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY . ./
RUN npm run build

# Stage 2: runtime image
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY ecosystem.config.js ./ecosystem.config.js
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

> If you have static assets or JSON configuration files under `Server/`, ensure they are copied before the build step or directly into the runtime image.

### 1.5 Build and deploy to Cloud Run

```sh
cd Server

# Build the container image (Artifact Registry automatically created in the same project)
gcloud builds submit --tag "us-central1-docker.pkg.dev/<PROJECT_ID>/nubiqai/server:latest"

# Deploy the image to Cloud Run (fully managed)
gcloud run deploy nubiqai-api \
  --image "us-central1-docker.pkg.dev/<PROJECT_ID>/nubiqai/server:latest" \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 3 \
  --memory 1Gi \
  --cpu 2 \
  --port 8000
```

### 1.6 Attach secrets and environment variables

```sh
# Grant the Cloud Run service account access to each secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:<PROJECT_ID>-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run service with env vars (referencing secrets)
gcloud run services update nubiqai-api \
  --update-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,PINECONE_API_KEY=PINECONE_API_KEY:latest \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "ENABLE_EMOJI=true" \
  --region us-central1
```

Continue adding additional secrets or plain environment variables as needed. You can also use `--update-env-vars "VITE_API_URL=https://<cloud-run-domain>"` but remember to keep frontend variables prefixed with `VITE_` during the build.

### 1.7 Smoke test

```sh
CLOUD_RUN_URL=$(gcloud run services describe nubiqai-api \
  --region us-central1 --format='value(status.url)')

curl "$CLOUD_RUN_URL/api/health"  # Replace with an existing lightweight endpoint
```

Keep this URL handy; it becomes the value for `VITE_API_URL` during the frontend build.

---

## 2. Frontend (Firebase Hosting)

### 2.1 Configure environment variables

Create or update `.env.production` at the repository root:

```
VITE_API_URL=https://<your-cloud-run-url>/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
# etc.
```

Do **not** commit secrets. For CI builds, inject them using the `firebase` CLI (`firebase functions:secrets:set`) or your favorite pipeline tool.

### 2.2 Build the static bundle

```sh
npm install
npm run build
```

The Vite output is generated in `dist/`.

### 2.3 Initialize Firebase Hosting (first-time setup)

```sh
firebase login
firebase init hosting
```

Use these answers:

- Select your Firebase project (same as the GCP project or linked one)
- Public directory: `dist`
- Configure as a single-page app: **Yes** (rewrites all routes to `index.html`)
- Set up automatic builds with GitHub: optional for now

This creates `firebase.json` and `.firebaserc`. Adjust `firebase.json` to proxy API calls to Cloud Run:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "nubiqai-api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

The rewrite ensures browser calls to `/api/*` get reverse-proxied to Cloud Run without exposing the raw URL in the client.

### 2.4 Deploy the frontend

```sh
firebase deploy --only hosting
```

The CLI prints the live Firebase Hosting URL (e.g., `https://<project-id>.web.app`). Add a custom domain later via the Firebase console if needed.

### 2.5 Post-deploy checks

- Visit the Hosting URL and verify the app loads
- Perform an image edit to confirm the Firebase Storage credentials still work via Cloud Run
- Open browser devtools → Network tab to ensure `/api/*` requests hit the proxy successfully

---

## 3. Optional: CI/CD Automation

- **Cloud Build Trigger (backend)**: Configure a trigger on the `Server/` directory that runs `gcloud builds submit` and `gcloud run deploy` on merges to `main` or `staging`.
- **GitHub Actions (frontend)**: Use Firebase’s GitHub integration or a custom action that runs `npm ci`, `npm run build`, and `firebase deploy --only hosting` when tagged or merged.
- Store environment variables and Firebase tokens as GitHub secrets (`FIREBASE_TOKEN`, `VITE_API_URL`, etc.).

---

## 4. Rollback, Monitoring, and Costs

- Cloud Run keeps revision history. Roll back with `gcloud run services update-traffic nubiqai-api --to-revisions <REVISION>=100`.
- Firebase Hosting keeps previous releases. `firebase hosting:channel:deploy staging` lets you create preview channels before promoting to production.
- Observe logs via `gcloud logs tail --project <PROJECT_ID>` (Cloud Run) and the Firebase console (Hosting). Consider enabling Cloud Monitoring dashboards for long-term metrics.
- Costs stay low in testing mode; Cloud Run and Hosting have generous free tiers. Watch for Pinecone and Gemini usage in their respective dashboards.

---

## 5. Quick Reference

| Component | Command |
|-----------|---------|
| Build backend | `cd Server && npm run build` |
| Deploy backend | `gcloud run deploy nubiqai-api --image ...` |
| Build frontend | `npm run build` |
| Deploy frontend | `firebase deploy --only hosting` |
| Check Cloud Run URL | `gcloud run services describe nubiqai-api --format='value(status.url)'` |
| Tail backend logs | `gcloud logs tail --service=nubiqai-api` |

With this setup you can push production-like builds to Google Cloud quickly while keeping frontend and backend concerns separated.
