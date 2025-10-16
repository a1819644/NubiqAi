# 📋 Pre-Deployment Checklist

## ✅ Before Building

### Environment Configuration
- [ ] Created `.env.production` with production API URL
- [ ] Firebase configuration updated with production credentials
- [ ] Backend `.env` file configured with all API keys
- [ ] Service account JSON file ready for backend

### Code Review
- [ ] All console.logs removed or conditional
- [ ] No hardcoded localhost URLs
- [ ] Error handling implemented for all API calls
- [ ] Loading states work correctly

### Testing
- [ ] All features tested locally
- [ ] Authentication flow works
- [ ] Chat functionality works
- [ ] Image generation works
- [ ] Memory system saves conversations

---

## 🏗️ Building

### Frontend
- [ ] Run `npm install` in root directory
- [ ] Run `npm run build` successfully
- [ ] Verify `dist/` folder created
- [ ] Check `dist/` folder size (should be < 5MB typically)

### Backend
- [ ] Run `npm install` in `Server/` directory
- [ ] Verify all dependencies installed
- [ ] Test backend starts: `npm start`
- [ ] No TypeScript errors

---

## 🚀 Deployment

### Server Setup
- [ ] Server/VPS provisioned
- [ ] Node.js installed (v18+)
- [ ] PM2 installed globally
- [ ] Nginx/Apache installed (for frontend)
- [ ] SSL certificate obtained (Let's Encrypt)

### File Upload
- [ ] Frontend files uploaded to `/var/www/yourdomain`
- [ ] Backend files uploaded to `/var/www/nubiqai-backend`
- [ ] Environment variables set on server
- [ ] Firebase service account JSON uploaded securely

### Server Configuration
- [ ] Nginx/Apache configured
- [ ] Reverse proxy setup for API
- [ ] SSL enabled
- [ ] Firewall rules configured (ports 80, 443)
- [ ] PM2 ecosystem file configured

### Backend Start
- [ ] Navigate to backend directory
- [ ] Run `pm2 start ecosystem.config.js`
- [ ] Verify process running: `pm2 status`
- [ ] Check logs: `pm2 logs`
- [ ] Enable auto-restart: `pm2 startup`

---

## 🧪 Post-Deployment Testing

### Frontend Checks
- [ ] Website loads at `https://yourdomain.com`
- [ ] No console errors (F12)
- [ ] CSS/styling displays correctly
- [ ] Images load properly
- [ ] Links work

### Backend Checks
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] Chat messages send/receive
- [ ] Image generation works
- [ ] Memory persists across sessions

### Integration Testing
- [ ] Sign in with Google
- [ ] Send a chat message
- [ ] Generate an image
- [ ] Check conversation history
- [ ] Sign out and sign back in
- [ ] Verify data persists

---

## 🔒 Security Verification

- [ ] HTTPS enabled and working
- [ ] Firebase API keys restricted by domain
- [ ] CORS configured for production domain only
- [ ] Environment variables not exposed in client
- [ ] `.env` files not accessible via web
- [ ] Service account JSON not in public directory

---

## 📊 Monitoring Setup

- [ ] PM2 monitoring enabled
- [ ] Error logging configured
- [ ] Backup strategy planned
- [ ] Uptime monitoring setup (optional)

---

## 🎯 Quick Test Commands

### Test Frontend Build Locally
```bash
npm run build
npm run preview
# Visit http://localhost:4173
```

### Test Backend Locally
```bash
cd Server
npm start
# Should see "Server running on port 8000"
```

### Test Production URLs
```bash
# Frontend
curl -I https://yourdomain.com

# Backend Health Check
curl https://yourdomain.com/api/health
```

---

## 📝 Common Issues

### Build fails
- Clear `node_modules` and `package-lock.json`
- Run `npm install` again
- Check Node.js version

### API calls fail
- Check API URL in `.env.production`
- Verify CORS settings
- Check Nginx proxy configuration

### Backend won't start
- Check environment variables
- Verify port 8000 is available
- Review PM2 logs: `pm2 logs`

---

## ✨ Success Criteria

Your deployment is successful when:
- ✅ Website loads without errors
- ✅ Users can sign in
- ✅ Chat functionality works
- ✅ Images generate successfully
- ✅ Conversations persist
- ✅ HTTPS is active
- ✅ Backend stays running

---

**Ready to deploy?** Follow this checklist step by step! 🚀
