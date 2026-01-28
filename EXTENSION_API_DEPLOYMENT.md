# Chrome Extension API - Deployment Guide

**Version:** 2.0.0
**Created:** 2026-01-28
**Production URL:** http://158.160.217.236

---

## 🎯 Overview

This guide walks you through deploying the Chrome Extension API endpoints to production.

**What's New:**
- 2 new API endpoints for Chrome Extension
- Bearer token authentication with api_tokens table
- Rate limiting (100 req/min per token)
- Enhanced health check
- CORS support for chrome-extension://*

---

## 📋 Pre-Deployment Checklist

### 1. Local Testing

```bash
# Navigate to project directory
cd "c:\Users\79025\Desktop\проекты\R5\Pilot-entry\R5 saas-prod"

# Install dependencies (if needed)
npm install

# Type check
npm run typecheck

# Build check
npm run build

# If build succeeds, you're ready to deploy!
```

**Expected Output:**
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### 2. Database Migration

The api_tokens table is required for authentication.

**Check if table exists:**
```bash
# SSH to production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# Connect to PostgreSQL
psql -h <your-db-host> -U <your-db-user> -d <your-db-name>

# Check if table exists
\dt api_tokens

# If table doesn't exist, run migration (see step 3)
```

**Run Migration:**
```bash
# On production server
cd /var/www/wb-reputation

# Run migration
psql -h <db-host> -U <db-user> -d <db-name> -f migrations/001_create_api_tokens_table.sql

# Verify
psql -h <db-host> -U <db-user> -d <db-name> -c "\d api_tokens"
```

---

## 🚀 Deployment Steps

### Step 1: Commit and Push Changes

```bash
# On local machine
cd "c:\Users\79025\Desktop\проекты\R5\Pilot-entry\R5 saas-prod"

# Check what's changed
git status

# Stage all changes
git add .

# Commit
git commit -m "feat: Add Chrome Extension API endpoints with auth and rate limiting"

# Push to GitHub
git push origin main
```

### Step 2: Deploy to Production

```bash
# SSH to production server
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

# Use the one-command deployment script
cd /var/www/wb-reputation && bash deploy/update-app.sh
```

**OR manual deployment:**
```bash
# Navigate to application directory
cd /var/www/wb-reputation

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --production=false

# Build application
npm run build

# Reload PM2
pm2 reload wb-reputation

# Monitor logs
pm2 logs wb-reputation --lines 50
```

### Step 3: Verify Deployment

```bash
# Test health endpoint
curl http://158.160.217.236/api/health

# Expected response (status: healthy)
{
  "status": "healthy",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "uptime_seconds": 123,
  "version": "2.0.0",
  "services": {
    "database": {"status": "healthy"},
    "cronJobs": {"status": "healthy"},
    "rateLimiter": {"status": "healthy"}
  }
}
```

**Check PM2 Status:**
```bash
pm2 status

# Should show:
# wb-reputation │ online │ 0 restarts
```

**Monitor Logs:**
```bash
# Watch logs for 2-3 minutes
pm2 logs wb-reputation

# Look for errors - should show normal HTTP requests
# Press Ctrl+C to exit
```

---

## 🔑 Generate API Token

After successful deployment, generate an API token for testing:

### On Production Server

```bash
# SSH to production
ssh -i ~/.ssh/yandex-cloud-wb-reputation ubuntu@158.160.217.236

cd /var/www/wb-reputation

# First, get a store ID
npm run test-db  # This will list stores

# Generate token (replace with actual store ID)
npm run generate-extension-token cm5abc123 "Chrome Extension - Production"
```

**Expected Output:**
```
✨ API Token Generated Successfully!

📋 Token ID:       token_xxxx
🏪 Store ID:       cm5abc123
🏷️  Store Name:     <Store Name>
📝 Token Name:     Chrome Extension - Production
📅 Created At:     2026-01-28T12:00:00.000Z

🔐 Bearer Token (copy this - shown only once):

   a1b2c3d4e5f6...  (64 characters)

📌 Usage Example (curl):
   curl -H "Authorization: Bearer a1b2c3d4..." \
        http://158.160.217.236/api/stores/cm5abc123/complaints
```

**⚠️ SAVE THIS TOKEN SECURELY - It won't be shown again!**

---

## 🧪 Testing Endpoints

### Test 1: Health Check (No Auth Required)

```bash
curl http://158.160.217.236/api/health
```

**Expected:** Status 200, "status": "healthy"

---

### Test 2: GET Complaints (Requires Auth)

```bash
# Replace <TOKEN> and <STORE_ID> with your values
curl -H "Authorization: Bearer <TOKEN>" \
     http://158.160.217.236/api/stores/<STORE_ID>/complaints?skip=0&take=10
```

**Expected Response:**
```json
[
  {
    "id": "rev_xyz789",
    "productId": "123456789",
    "rating": 1,
    "reviewDate": "2026-01-28T10:15:30.000Z",
    "reviewText": "Плохое качество товара",
    "authorName": "Иван И.",
    "createdAt": "2026-01-28T11:00:00.000Z",
    "complaintText": "```json\n{\"reasonId\":\"1\",\"reasonName\":\"Оскорбление\",\"complaintText\":\"...\"}\n```",
    "status": "draft",
    "attempts": 0
  }
]
```

**Check Headers:**
```bash
curl -I -H "Authorization: Bearer <TOKEN>" \
     http://158.160.217.236/api/stores/<STORE_ID>/complaints
```

**Expected Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2026-01-28T12:01:00.000Z
Access-Control-Allow-Origin: *
```

---

### Test 3: Mark Complaint as Sent

```bash
# Replace values
curl -X POST \
     -H "Authorization: Bearer <TOKEN>" \
     http://158.160.217.236/api/stores/<STORE_ID>/reviews/<REVIEW_ID>/complaint/sent
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Complaint marked as sent",
  "data": {
    "reviewId": "rev_xyz789",
    "status": "sent",
    "sentAt": "2026-01-28T12:00:00.000Z"
  }
}
```

---

### Test 4: Authentication Error

```bash
# Request without token
curl http://158.160.217.236/api/stores/<STORE_ID>/complaints
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API token",
  "code": "INVALID_TOKEN"
}
```

---

### Test 5: Rate Limiting

```bash
# Make 101 requests in quick succession
for i in {1..101}; do
  curl -H "Authorization: Bearer <TOKEN>" \
       http://158.160.217.236/api/stores/<STORE_ID>/complaints
done
```

**Expected:** First 100 requests succeed, 101st returns 429:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 100 requests per minute.",
  "code": "RATE_LIMIT_EXCEEDED",
  "resetAt": "2026-01-28T12:01:00.000Z"
}
```

---

## 📊 Monitoring

### Check Logs

```bash
# On production server
pm2 logs wb-reputation --lines 100

# Filter for errors only
pm2 logs wb-reputation --err --lines 50

# Follow logs in real-time
pm2 logs wb-reputation
```

### Check PM2 Status

```bash
pm2 status
pm2 monit  # Interactive monitoring
```

### Check Application Health

```bash
# Run every 5 minutes
watch -n 300 'curl -s http://158.160.217.236/api/health | jq'
```

---

## 🐛 Troubleshooting

### Issue: "Table api_tokens does not exist"

**Solution:**
```bash
# Run migration
cd /var/www/wb-reputation
psql -h <db-host> -U <db-user> -d <db-name> -f migrations/001_create_api_tokens_table.sql
```

---

### Issue: "Cannot read property 'rows' of undefined"

**Cause:** Database connection issue

**Solution:**
```bash
# Check .env.production file
cat /var/www/wb-reputation/.env.production

# Verify DATABASE_URL is set correctly
# Test database connection
npm run test-db
```

---

### Issue: Application not restarting

**Solution:**
```bash
# Force restart
pm2 restart wb-reputation

# If still not working
pm2 delete wb-reputation
pm2 start ecosystem.config.js
```

---

### Issue: Rate limiter not working

**Cause:** In-memory rate limiter resets on restart

**Note:** This is expected behavior. For persistent rate limiting across restarts, implement Redis-based solution.

**Temporary Fix:**
```bash
# Restart application to reset rate limits
pm2 restart wb-reputation
```

---

### Issue: CORS errors in Chrome Extension

**Check:**
1. Extension manifest.json has correct permissions
2. Request includes `Authorization` header
3. Origin header is `chrome-extension://...`

**Debug:**
```bash
# Check middleware logs
pm2 logs wb-reputation | grep "CORS"
```

---

## 📝 Post-Deployment Tasks

### 1. Update Extension Configuration

Provide the following to Extension Team:

```
Production API URL: http://158.160.217.236
API Token: <generated_token>
Store ID: <store_id>

Documentation: docs/EXTENSION_API_DOCUMENTATION.md
```

### 2. Monitor for 24 Hours

```bash
# Check health every hour
*/60 * * * * curl -s http://158.160.217.236/api/health

# Review logs daily
pm2 logs wb-reputation --lines 100 --nostream
```

### 3. Set Up Alerts (Recommended)

Consider adding monitoring service:
- **Uptime monitoring:** UptimeRobot, Pingdom
- **Error tracking:** Sentry, Rollbar
- **Performance:** New Relic, DataDog

---

## 🎉 Success Criteria

Deployment is successful when:

- ✅ `npm run build` completes without errors
- ✅ Migration creates api_tokens table
- ✅ Health endpoint returns 200 with "healthy" status
- ✅ GET /complaints returns complaints array
- ✅ POST /complaint/sent successfully marks complaint
- ✅ 401 error when token missing
- ✅ 429 error after 100 requests/minute
- ✅ CORS headers present in responses
- ✅ PM2 shows "online" status
- ✅ No errors in PM2 logs

---

## 📞 Support

- **Documentation:** [EXTENSION_API_DOCUMENTATION.md](./docs/EXTENSION_API_DOCUMENTATION.md)
- **Implementation Summary:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Quick Reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Database Schema:** [docs/database-schema.md](./docs/database-schema.md)

---

## 📅 Version History

### v2.0.0 (2026-01-28)
- ✅ Initial Chrome Extension API implementation
- ✅ Bearer token authentication
- ✅ Rate limiting (100 req/min)
- ✅ Enhanced health check
- ✅ Complete documentation

---

**Last Updated:** 2026-01-28
**Deployed By:** Claude Agent
**Status:** ✅ Ready for Production
