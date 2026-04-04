# рџЋЇ Next Steps: Sprint Emergency CRON Fix

**РўРµРєСѓС‰РµРµ РІСЂРµРјСЏ:** 2026-03-13 12:50 UTC (15:50 MSK)
**РЎС‚Р°С‚СѓСЃ:** 7/9 P0 Р·Р°РґР°С‡ Р·Р°РІРµСЂС€РµРЅРѕ (78%)
**РЎР»РµРґСѓСЋС‰РёР№ milestone:** Р’РµСЂРёС„РёРєР°С†РёСЏ С‡РµСЂРµР· 15 РјРёРЅСѓС‚ (13:05 UTC)

---

## вњ… Р§С‚Рѕ СѓР¶Рµ СЃРґРµР»Р°РЅРѕ (СЃРµРіРѕРґРЅСЏ)

### P0 (Critical) - Emergency Response
- вњ… P0-1.1: РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє production
- вњ… P0-1.2: РћСЃС‚Р°РЅРѕРІРєР° 2,075 active sequences
- вњ… P0-1.3: Hotfix РІ src/lib/init-server.ts
- вњ… P0-1.4: РЎРѕР·РґР°РЅРёРµ РјРёРіСЂР°С†РёРё (UNIQUE INDEX + helpers)
- вњ… P0-1.5: Deploy hotfix РЅР° production
- вњ… P0-1.6: Р—Р°РїСѓСЃРє РјРёРіСЂР°С†РёРё РІ production DB
- вњ… P0-1.7: Restart PM2 РїСЂРѕС†РµСЃСЃРѕРІ

**Progress:** 7/9 (78%) вњ…

---

## вЏ° РЎРµР№С‡Р°СЃ (СЃР»РµРґСѓСЋС‰РёРµ 30 РјРёРЅСѓС‚)

### P0-1.8: Р’РµСЂРёС„РёРєР°С†РёСЏ deployment (13:05 UTC / 16:05 MSK)

**Р–РґРµРј:** РџРµСЂРІС‹Р№ Р·Р°РїСѓСЃРє auto-sequence processor РїРѕСЃР»Рµ deployment

**РљРѕРјР°РЅРґС‹ РґР»СЏ РїСЂРѕРІРµСЂРєРё:**
```bash
# 1. РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё CRON (РІ 13:05 UTC)
ssh ubuntu@158.160.139.99
pm2 logs wb-reputation-cron --lines 100 | grep "Auto-sequence"

# РћР¶РёРґР°РµРјС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚:
# вњ… РћР”РќРђ Р·Р°РїРёСЃСЊ (РќР• 3):
# [CRON] рџ“Ё Auto-sequence: X sent, Y stopped, Z skipped, 0 errors

# 2. Р—Р°РїСѓСЃС‚РёС‚СЊ audit
cd /var/www/wb-reputation
node scripts/AUDIT-check-duplicate-sends.mjs

# РћР¶РёРґР°РµРјС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚:
# вњ… No duplicate messages found
# вњ… No duplicate active sequences
# вњ… No rapid sends detected
```

**Acceptance Criteria:**
- вњ… РўРѕР»СЊРєРѕ 1 Р»РѕРі Рѕ СЂР°СЃСЃС‹Р»РєРµ (РЅРµ 3)
- вњ… No duplicates РІ audit
- вњ… No errors РІ PM2 logs

**Р’СЂРµРјСЏ:** 15 РјРёРЅСѓС‚
**РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№:** User + Claude

---

## рџ“… РЎРµРіРѕРґРЅСЏ (РѕСЃС‚Р°С‚РѕРє РґРЅСЏ)

### P0-1.9: РњРѕРЅРёС‚РѕСЂРёРЅРі production (24 С‡Р°СЃР°)

**Р—Р°РґР°С‡Рё:**
1. РџСЂРѕРІРµСЂСЏС‚СЊ Р»РѕРіРё РєР°Р¶РґС‹Рµ 2 С‡Р°СЃР°
2. РЎР»РµРґРёС‚СЊ Р·Р° PM2 РїСЂРѕС†РµСЃСЃР°РјРё (РІСЃРµ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ online)
3. РњРѕРЅРёС‚РѕСЂРёС‚СЊ РѕС€РёР±РєРё РІ error logs

**РљРѕРјР°РЅРґС‹:**
```bash
# РљР°Р¶РґС‹Рµ 2 С‡Р°СЃР°
pm2 list
pm2 logs wb-reputation-cron --lines 50 --nostream | grep -E "(Auto-sequence|ERROR)"

# Р•СЃР»Рё РµСЃС‚СЊ РїСЂРѕР±Р»РµРјС‹
pm2 logs wb-reputation-cron --err --lines 200
```

**Р”РµРґР»Р°Р№РЅ:** 2026-03-14 12:35 UTC (С‡РµСЂРµР· 24 С‡Р°СЃР°)

---

## рџљЂ РЎР»РµРґСѓСЋС‰РёРµ Р·Р°РґР°С‡Рё (РјРѕР¶РЅРѕ РЅР°С‡Р°С‚СЊ СЃРµР№С‡Р°СЃ)

РџРѕРєР° Р¶РґРµРј РІРµСЂРёС„РёРєР°С†РёСЋ, РјРѕР¶РµРј РїР°СЂР°Р»Р»РµР»СЊРЅРѕ СЂР°Р±РѕС‚Р°С‚СЊ РЅР°Рґ P1 (High Priority) Р·Р°РґР°С‡Р°РјРё:

### Option 1: EPIC-3 - Monitoring & Alerting (РјРѕР¶РЅРѕ РґРµР»Р°С‚СЊ РїР°СЂР°Р»Р»РµР»СЊРЅРѕ)

**P1-3.1: РЎРѕР·РґР°С‚СЊ monitoring views** вЏі Ready
- Р¤Р°Р№Р»: `migrations/100_create_monitoring_views.sql`
- Р’СЂРµРјСЏ: 30 РјРёРЅСѓС‚

**Р§С‚Рѕ СЃРѕР·РґР°С‚СЊ:**
```sql
-- View: Rapid sends (< 5 min apart)
CREATE OR REPLACE VIEW v_rapid_sends AS ...

-- View: Stale processing locks (> 30 min)
CREATE OR REPLACE VIEW v_stale_locks AS ...

-- View: Sequences by status (dashboard)
CREATE OR REPLACE VIEW v_sequences_dashboard AS ...
```

**РџРѕР»СЊР·Р°:** РЈРїСЂРѕСЃС‚РёС‚ РјРѕРЅРёС‚РѕСЂРёРЅРі, РјРѕР¶РЅРѕ Р·Р°РїСЂРѕСЃР°РјРё РїСЂРѕРІРµСЂСЏС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРёСЃС‚РµРјС‹

---

### Option 2: EPIC-4 - Documentation Update (РЅРµ С‚СЂРµР±СѓРµС‚ production)

**P1-4.1: РћР±РЅРѕРІРёС‚СЊ DEPLOYMENT.md** вЏі Ready
- Р”РѕР±Р°РІРёС‚СЊ СЃРµРєС†РёСЋ РїСЂРѕ ENABLE_CRON_IN_MAIN_APP
- Р”РѕРєСѓРјРµРЅС‚РёСЂРѕРІР°С‚СЊ РЅРѕРІС‹Рµ emergency scripts
- РћР±РЅРѕРІРёС‚СЊ PM2 РїСЂРѕС†РµСЃСЃС‹ (С‚РµРїРµСЂСЊ CRON РѕС‚РґРµР»СЊРЅС‹Р№)
- Р’СЂРµРјСЏ: 30 РјРёРЅСѓС‚

**P1-4.2: РћР±РЅРѕРІРёС‚СЊ database-schema.md** вЏі Ready
- Р”РѕР±Р°РІРёС‚СЊ РЅРѕРІС‹Р№ UNIQUE INDEX
- Р”РѕРєСѓРјРµРЅС‚РёСЂРѕРІР°С‚СЊ helper functions
- Р”РѕР±Р°РІРёС‚СЊ monitoring views
- Р’СЂРµРјСЏ: 20 РјРёРЅСѓС‚

**P1-4.5: РЎРѕР·РґР°С‚СЊ docs/CRON_JOBS.md** вЏі Ready
- РЎРїРёСЃРѕРє РІСЃРµС… CRON jobs
- Р Р°СЃРїРёСЃР°РЅРёРµ Р·Р°РїСѓСЃРєР°
- Р§С‚Рѕ РґРµР»Р°РµС‚ РєР°Р¶РґС‹Р№ job
- РљР°Рє РІРєР»СЋС‡РёС‚СЊ/РІС‹РєР»СЋС‡РёС‚СЊ
- Р’СЂРµРјСЏ: 1 С‡Р°СЃ

---

### Option 3: EPIC-2 - Database Protection (С‡Р°СЃС‚РёС‡РЅРѕ СѓР¶Рµ СЃРґРµР»Р°РЅРѕ)

**P1-2.5: РЎРѕР·РґР°С‚СЊ С‚Р°Р±Р»РёС†Сѓ cron_job_locks** вЏі Ready
- РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РїР°СЂР°Р»Р»РµР»СЊРЅРѕРіРѕ Р·Р°РїСѓСЃРєР° CRON jobs
- Advisory locks РЅР° СѓСЂРѕРІРЅРµ PostgreSQL
- Р’СЂРµРјСЏ: 1 С‡Р°СЃ

**РљРѕРґ:**
```sql
-- migrations/101_create_cron_job_locks.sql
CREATE TABLE cron_job_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT,  -- process ID or hostname
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_cron_locks_expires ON cron_job_locks(expires_at);
```

---

## рџЋЇ Р РµРєРѕРјРµРЅРґСѓРµРјС‹Р№ РїР»Р°РЅ (СЃРµР№С‡Р°СЃ в†’ РІРµС‡РµСЂ)

### РЎРµР№С‡Р°СЃ (12:50 - 13:05 UTC): РџРѕРґРіРѕС‚РѕРІРєР° Рє РІРµСЂРёС„РёРєР°С†РёРё
- [ ] РџРѕРґРіРѕС‚РѕРІРёС‚СЊ РєРѕРјР°РЅРґС‹ РґР»СЏ РїСЂРѕРІРµСЂРєРё
- [ ] РќР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ РЅР°Рґ РґРѕРєСѓРјРµРЅС‚Р°С†РёРµР№ (EPIC-4)

### 13:05 - 13:20 UTC: Р’РµСЂРёС„РёРєР°С†РёСЏ P0-1.8 в­ђ
- [ ] РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё CRON
- [ ] Р—Р°РїСѓСЃС‚РёС‚СЊ audit script
- [ ] РЈР±РµРґРёС‚СЊСЃСЏ, С‡С‚Рѕ РЅРµС‚ РґСѓР±Р»РёРєР°С‚РѕРІ
- [ ] вњ… Р—Р°РєСЂС‹С‚СЊ P0-1.8 РєР°Рє completed

### 13:20 - 15:00 UTC: EPIC-4 - Documentation
- [ ] P1-4.1: РћР±РЅРѕРІРёС‚СЊ DEPLOYMENT.md
- [ ] P1-4.2: РћР±РЅРѕРІРёС‚СЊ database-schema.md
- [ ] P1-4.5: РЎРѕР·РґР°С‚СЊ CRON_JOBS.md

### 15:00 - 17:00 UTC: EPIC-3 - Monitoring
- [ ] P1-3.1: РЎРѕР·РґР°С‚СЊ monitoring views
- [ ] P1-3.2: РўРµСЃС‚РёСЂРѕРІР°С‚СЊ views
- [ ] Deploy views РЅР° production

### Р’РµС‡РµСЂ: EPIC-2 - Advanced Protection
- [ ] P1-2.5: РЎРѕР·РґР°С‚СЊ cron_job_locks table
- [ ] P1-2.6: Р РµР°Р»РёР·РѕРІР°С‚СЊ acquireLock() / releaseLock()

---

## рџ“Љ Sprint Progress Tracking

| EPIC | Tasks Total | Completed | In Progress | Remaining | Progress |
|------|-------------|-----------|-------------|-----------|----------|
| EPIC-1: Emergency | 9 | 7 | 1 | 1 | 78% |
| EPIC-2: DB Protection | 9 | 1 | 0 | 8 | 11% |
| EPIC-3: Monitoring | 7 | 0 | 0 | 7 | 0% |
| EPIC-4: Documentation | 9 | 0 | 0 | 9 | 0% |
| **Total Week 1** | 34 | 8 | 1 | 25 | 24% |

**Target for today:** Complete P0 (EPIC-1) + Start P1 (EPIC-3, EPIC-4)

---

## рџљ¦ Decision Points

### Р’РѕРїСЂРѕСЃ 1: РЎ С‡РµРіРѕ РЅР°С‡Р°С‚СЊ РїРѕСЃР»Рµ РІРµСЂРёС„РёРєР°С†РёРё?

**Р’Р°СЂРёР°РЅС‚С‹:**
- A) **Documentation** (EPIC-4) - Р±РµР·РѕРїР°СЃРЅРѕ, РЅРµ С‚СЂРµР±СѓРµС‚ production changes
- B) **Monitoring views** (EPIC-3) - РїРѕР»РµР·РЅРѕ РґР»СЏ РјРѕРЅРёС‚РѕСЂРёРЅРіР°, РјРёРЅРёРјР°Р»СЊРЅС‹Р№ СЂРёСЃРє
- C) **Job locks** (EPIC-2) - Р±РѕР»РµРµ СЃР»РѕР¶РЅРѕ, С‚СЂРµР±СѓРµС‚ С‚РµСЃС‚РёСЂРѕРІР°РЅРёСЏ

**Р РµРєРѕРјРµРЅРґР°С†РёСЏ:** **A в†’ B в†’ C** (РѕС‚ РїСЂРѕСЃС‚РѕРіРѕ Рє СЃР»РѕР¶РЅРѕРјСѓ)

### Р’РѕРїСЂРѕСЃ 2: РљРѕРіРґР° РґРµРїР»РѕРёС‚СЊ РЅРѕРІС‹Рµ РёР·РјРµРЅРµРЅРёСЏ?

**Р РµРєРѕРјРµРЅРґР°С†РёСЏ:**
- Monitoring views: РЎРµРіРѕРґРЅСЏ РІРµС‡РµСЂРѕРј (РїРѕСЃР»Рµ РІРµСЂРёС„РёРєР°С†РёРё 24С‡ РЅРµ РѕР±СЏР·Р°С‚РµР»СЊРЅР°)
- Job locks: Р—Р°РІС‚СЂР° (РїРѕСЃР»Рµ 24С‡ РјРѕРЅРёС‚РѕСЂРёРЅРіР° P0)
- Documentation: РњРѕР¶РЅРѕ РєРѕРјРјРёС‚РёС‚СЊ СЃСЂР°Р·Сѓ (РЅРµ РІР»РёСЏРµС‚ РЅР° production)

---

## рџ“ќ Quick Commands Reference

```bash
# РџСЂРѕРІРµСЂРєР° СЃС‚Р°С‚СѓСЃР°
ssh ubuntu@158.160.139.99 "pm2 list"

# Р›РѕРіРё CRON
ssh ubuntu@158.160.139.99 "pm2 logs wb-reputation-cron --lines 100 --nostream"

# Audit
ssh ubuntu@158.160.139.99 "cd /var/www/wb-reputation && node scripts/AUDIT-check-duplicate-sends.mjs"

# РџСЂРѕРІРµСЂРєР° sequences
ssh ubuntu@158.160.139.99 "cd /var/www/wb-reputation && node scripts/check-sequences-status.mjs"
```

---

## рџЋЇ Today's Goals

**Must Have (P0):**
- вњ… Deploy emergency fix (DONE)
- вЏі Verify fix works (13:05 UTC)
- вЏі Start 24h monitoring

**Should Have (P1):**
- вЏі Update documentation (3-4 docs)
- вЏі Create monitoring views

**Nice to Have:**
- вЏі Start job locks implementation

---

## рџ† If Something Goes Wrong

### Rollback Plan
```bash
# РќР° production
pm2 stop wb-reputation-cron
export ENABLE_CRON_IN_MAIN_APP=true
pm2 restart wb-reputation --update-env
pm2 logs wb-reputation | grep CRON
```

**Note:** Р’РµСЂРЅРµС‚ РґСѓР±Р»РёРєР°С‚С‹ (2Г— main app), РЅРѕ CRON Р±СѓРґРµС‚ СЂР°Р±РѕС‚Р°С‚СЊ.

---

**РЎР»РµРґСѓСЋС‰РёР№ update:** РџРѕСЃР»Рµ РІРµСЂРёС„РёРєР°С†РёРё РІ 13:05 UTC
**Prepared by:** Claude Code Assistant
**Status:** вњ… READY TO PROCEED
