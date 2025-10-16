# 🚀 Quick Start - Build for Production

## Super Fast Build (Copy & Paste)

### Windows PowerShell
```powershell
cd "d:\flutter project\NubiqAi"
npm install
npm run build
cd Server
npm install
cd ..
Write-Host "✅ Build Complete! Check dist/ folder" -ForegroundColor Green
```

### Windows CMD
```cmd
cd "d:\flutter project\NubiqAi"
npm install && npm run build && cd Server && npm install && cd .. && echo Build Complete!
```

### Linux/Mac
```bash
cd "/path/to/NubiqAi"
npm install && npm run build && cd Server && npm install && cd .. && echo "✅ Build Complete!"
```

---

## What Gets Built?

After running the build:

📁 **dist/** (Frontend - Upload to web server)
- index.html
- assets/ (CSS, JS, images)
- All optimized and minified

📁 **Server/** (Backend - Upload to app server)
- All Node.js files
- node_modules/
- .env (configure separately)

---

## Quick Deploy Steps

1. **Run build command above**
2. **Upload files:**
   - `dist/` → Web server (Nginx/Apache root)
   - `Server/` → Application server
3. **Configure .env files**
4. **Start backend:**
   ```bash
   cd Server
   pm2 start ecosystem.config.js
   ```
5. **Done!** 🎉

---

## File Sizes

Expected output:
- **dist/**: ~2-4 MB (frontend bundle)
- **Server/node_modules**: ~150-200 MB (backend deps)

---

## Need More Details?

- 📖 Full guide: `DEPLOYMENT_GUIDE.md`
- ✅ Checklist: `DEPLOYMENT_CHECKLIST.md`

---

**Just run the build command and you're ready to upload!** 🚀
