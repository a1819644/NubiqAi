@echo off
echo Adding environment variables to Vercel...
echo.
echo Please run these commands one by one:
echo.
echo vercel env add VITE_FIREBASE_API_KEY production
echo vercel env add VITE_FIREBASE_AUTH_DOMAIN production
echo vercel env add VITE_FIREBASE_PROJECT_ID production
echo vercel env add VITE_FIREBASE_STORAGE_BUCKET production
echo vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
echo vercel env add VITE_FIREBASE_APP_ID production
echo vercel env add VITE_API_URL production
echo.
echo After adding all variables, redeploy:
echo vercel --prod
pause
