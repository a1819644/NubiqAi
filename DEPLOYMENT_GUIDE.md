# 🚀 Deployment Guide - NubiqAI

This guide will help you build and deploy your NubiqAI project to a subdomain.

## 📋 Prerequisites

- Node.js installed (v18+ recommended)
- A server with Node.js runtime (for backend)
- A web server (Nginx, Apache, or similar) or static hosting service
- Domain/subdomain configured (e.g., `ai.yourdomain.com`)

---

## 🎯 Quick Deployment Steps

### 1️⃣ Build Frontend (React + Vite)

```bash
# Navigate to project root
cd "d:\flutter project\NubiqAi"

# Install dependencies (if not already)
npm install

# Build for production
npm run build
```

This will create a `dist` folder with optimized static files.

---

### 2️⃣ Build Backend (Node.js + Express)

```bash
# Navigate to server directory
cd Server

# Install dependencies (if not already)
npm install

# Build TypeScript to JavaScript (optional, or run with ts-node)
npx tsc
```

For production, you'll run the server using:
```bash
node dist/index.js
# OR with ts-node:
npx ts-node index.ts
```

---

## 🌐 Deployment Options

### Option A: Deploy on VPS/Cloud Server (Recommended)

#### **Backend Setup**

1. **Upload Server Files**
   ```bash
   # Upload the entire Server folder to your server
   scp -r Server user@your-server.com:/var/www/nubiqai-backend/
   ```

2. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   ```

3. **Create PM2 Ecosystem File**
   Create `Server/ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'nubiqai-backend',
       script: 'index.ts',
       interpreter: 'npx',
       interpreter_args: 'ts-node',
       env: {
         NODE_ENV: 'production',
         PORT: 8000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss'
     }]
   };
   ```

4. **Start Backend with PM2**
   ```bash
   cd /var/www/nubiqai-backend
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Enable auto-start on reboot
   ```

#### **Frontend Setup**

1. **Upload Built Files**
   ```bash
   # Upload dist folder to your server
   scp -r dist/* user@your-server.com:/var/www/ai.yourdomain.com/
   ```

2. **Configure Nginx**
   Create `/etc/nginx/sites-available/nubiqai`:
   ```nginx
   server {
       listen 80;
       server_name ai.yourdomain.com;
       
       root /var/www/ai.yourdomain.com;
       index index.html;
       
       # Frontend
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Backend API Proxy
       location /api/ {
           proxy_pass http://localhost:8000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           
           # Timeout settings for long-running AI requests
           proxy_read_timeout 300s;
           proxy_connect_timeout 75s;
       }
   }
   ```

3. **Enable Site and Restart Nginx**
   ```bash
   sudo ln -s /etc/nginx/sites-available/nubiqai /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl restart nginx
   ```

4. **Setup SSL (HTTPS)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d ai.yourdomain.com
   ```

---

### Option B: Deploy on Vercel/Netlify (Frontend Only)

#### **Frontend on Vercel**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Configure for Production API**
   
   Create `.env.production`:
   ```env
   VITE_API_URL=https://api.yourdomain.com/api
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Configure Domain**
   - Go to Vercel dashboard
   - Add your subdomain `ai.yourdomain.com`
   - Update DNS records as instructed

#### **Backend on Railway/Render**

1. **Create `Procfile` in Server folder**:
   ```
   web: npx ts-node index.ts
   ```

2. **Deploy to Railway**:
   - Connect GitHub repo
   - Select Server folder as root
   - Add environment variables
   - Deploy

---

## 🔧 Environment Configuration

### Frontend (.env.production)

Create `d:\flutter project\NubiqAi\.env.production`:
```env
# API URL (update with your backend URL)
VITE_API_URL=https://api.yourdomain.com/api

# OR if using same domain with proxy:
# VITE_API_URL=/api

# Firebase Config (from Firebase Console)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Backend (Server/.env)

Ensure `Server/.env` has all required variables:
```env
# Google AI
GEMINI_API_KEY=your_gemini_api_key

# Pinecone
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX=your_index_name

# Firebase Admin SDK (path to service account JSON)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-admin-sdk.json

# Server Config
PORT=8000
NODE_ENV=production
```

---

## 📦 Build Commands Summary

```bash
# Frontend Build
cd "d:\flutter project\NubiqAi"
npm install
npm run build
# Output: dist/ folder

# Backend Preparation
cd Server
npm install
# No build needed - runs with ts-node or compile with tsc

# Test Build Locally
npm run preview  # Frontend (from root)
cd Server && npm start  # Backend
```

---

## 🔍 Verify Deployment

### Frontend Checks
✅ Visit `https://ai.yourdomain.com`
✅ Check browser console for errors
✅ Verify Firebase authentication works
✅ Test if API calls reach backend

### Backend Checks
✅ Visit `https://api.yourdomain.com/api/health` (create health endpoint)
✅ Check PM2 status: `pm2 status`
✅ View logs: `pm2 logs nubiqai-backend`
✅ Verify environment variables loaded

---

## 🛡️ Security Checklist

- [ ] All environment variables stored securely
- [ ] Firebase API keys restricted by domain/IP
- [ ] CORS configured properly in backend
- [ ] HTTPS/SSL enabled
- [ ] Rate limiting implemented
- [ ] Sensitive files (.env, service account JSON) not in git

---

## 🐛 Troubleshooting

### Issue: API calls fail after deployment

**Solution:** Update API URL in frontend
```typescript
// src/services/api.ts should use:
this.baseURL = import.meta.env.VITE_API_URL || '/api';
```

### Issue: 404 on page refresh

**Solution:** Configure server for SPA routing
- Nginx: `try_files $uri $uri/ /index.html;`
- Vercel: Create `vercel.json`:
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

### Issue: CORS errors

**Solution:** Update CORS in `Server/index.ts`:
```typescript
app.use(cors({
  origin: ['https://ai.yourdomain.com'],
  credentials: true
}));
```

### Issue: Backend crashes

**Solution:** Check logs
```bash
pm2 logs nubiqai-backend --lines 100
```

---

## 📝 Next Steps

1. **Build both frontend and backend**
2. **Choose deployment platform**
3. **Configure environment variables**
4. **Deploy backend first**
5. **Update frontend API URL**
6. **Deploy frontend**
7. **Test thoroughly**
8. **Monitor with PM2/logging service**

---

## 🎉 Quick Copy-Paste Commands

**Local Build Test:**
```bash
# Terminal 1 - Backend
cd "d:\flutter project\NubiqAi\Server"
npm start

# Terminal 2 - Frontend
cd "d:\flutter project\NubiqAi"
npm run build
npm run preview
```

**Production Build:**
```bash
cd "d:\flutter project\NubiqAi"
npm run build
cd Server
npm install
```

Upload the following to your server:
- `dist/` folder → Web root
- `Server/` folder → Application directory

---

## 📞 Need Help?

If you encounter issues:
1. Check browser console (F12)
2. Check server logs (`pm2 logs`)
3. Verify environment variables
4. Test API endpoints directly
5. Check firewall/security groups

---

**Ready to deploy?** Start with the build commands above! 🚀
