@echo off
echo ========================================
echo   URGENT: Removing Secrets from Git
echo ========================================
echo.
echo This will:
echo 1. Remove sensitive files from Git history
echo 2. Delete last commit with secrets
echo 3. Force push to overwrite remote
echo.
echo WARNING: This rewrites Git history!
echo.
pause

echo.
echo [Step 1] Removing secrets from Git cache...
git rm --cached .env
git rm --cached .env.production
git rm --cached Server/.env
git rm --cached Server/serviceAccountKey.json
git rm --cached Server/*-key.json
git rm --cached Server/firebase*.json

echo.
echo [Step 2] Resetting to previous commit (before secrets were added)...
git reset --soft HEAD~1

echo.
echo [Step 3] Committing without secrets...
git add .
git commit -m "Security: Remove leaked secrets and update .gitignore"

echo.
echo [Step 4] Force pushing to overwrite remote (removes secrets from GitHub)...
git push --force origin main

echo.
echo ========================================
echo   DONE! Secrets removed from Git
echo ========================================
echo.
echo IMPORTANT NEXT STEPS:
echo 1. Rotate ALL API keys immediately:
echo    - Firebase API keys
echo    - Gemini API key
echo    - Pinecone API key
echo    - Any other exposed keys
echo.
echo 2. Generate new Firebase service account JSON
echo 3. Update all keys in Vercel/Railway
echo 4. Never commit .env files again!
echo.
pause
