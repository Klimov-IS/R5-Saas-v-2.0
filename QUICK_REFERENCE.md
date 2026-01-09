# 🚀 Quick Reference - WB Reputation Manager

**Production:** http://158.160.217.236

---

## 🔑 SSH Connection

```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
```

---

## 📊 Check Status (30 seconds)

```bash
# Quick health check
curl http://158.160.217.236/health

# PM2 status
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 status"

# View logs (last 20 lines)
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --lines 20 --nostream"
```

---

## 🔄 Update Application (2 minutes)

```bash
# One command update (recommended)
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "cd /var/www/wb-reputation && bash deploy/update-app.sh"
```

**Or manual steps:**
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
cd /var/www/wb-reputation
git pull origin main
npm ci --production=false
npm run build
pm2 reload wb-reputation
pm2 logs wb-reputation --lines 50
```

---

## 🛠️ Common Commands

### Restart Application
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 restart wb-reputation"
```

### View Live Logs
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation"
```

### View Error Logs Only
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --err --lines 50"
```

### Monitor Resources
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 monit"
```

### Reload Nginx
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "sudo systemctl reload nginx"
```

---

## 🐛 Emergency Troubleshooting

### Application not responding
```bash
# 1. Check PM2
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 status"

# 2. Check errors
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 logs wb-reputation --err --lines 100"

# 3. Restart
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236 "pm2 restart wb-reputation"
```

### Port 3000 blocked
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
sudo netstat -tulpn | grep :3000
sudo kill -9 $(sudo lsof -t -i:3000)
pm2 restart wb-reputation
```

### Out of memory
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
free -h
pm2 restart wb-reputation
```

### Nginx issues
```bash
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

---

## 📁 Important Paths

```
Application:     /var/www/wb-reputation
Logs:            /var/www/wb-reputation/logs/
Environment:     /var/www/wb-reputation/.env.production
PM2 Config:      /var/www/wb-reputation/ecosystem.config.js
Nginx Config:    /etc/nginx/sites-available/wb-reputation
Nginx Logs:      /var/log/nginx/
```

---

## 🔐 Security Checklist

- ✅ SSH key authentication
- ✅ PM2 auto-restart
- ✅ Nginx reverse proxy
- ⚠️ HTTP only (add SSL when domain ready)
- ⏳ Firewall (recommended to configure)
- ⏳ External monitoring (recommended)

---

## 📞 Quick Links

- **Production URL:** http://158.160.217.236
- **Health Check:** http://158.160.217.236/health
- **API Base:** http://158.160.217.236/api
- **GitHub Repo:** https://github.com/Klimov-IS/R5-Saas-v-2.0

---

## 🎯 Daily Checklist

### Morning
- [ ] Check application status: `curl http://158.160.217.236/health`
- [ ] Review overnight logs: `pm2 logs wb-reputation --lines 50 --nostream`
- [ ] Check PM2 status: `pm2 status`

### After Code Changes
- [ ] Commit and push to GitHub
- [ ] Run update script: `bash deploy/update-app.sh`
- [ ] Verify deployment: Check logs and test application
- [ ] Monitor for 5-10 minutes: `pm2 logs wb-reputation`

### Weekly
- [ ] Review error logs
- [ ] Check disk space: `df -h`
- [ ] Check memory usage: `free -h`
- [ ] Review Nginx logs: `sudo tail -100 /var/log/nginx/error.log`

---

*For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md) and [DEPLOYMENT_SUCCESS.md](./DEPLOYMENT_SUCCESS.md)*
