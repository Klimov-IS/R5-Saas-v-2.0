# рџ”Ќ РђР РҐРРўР•РљРўРЈР РќР«Р™ РђРЈР”РРў: РђРЅР°Р»РёР· РїСЂРѕР±Р»РµРјС‹ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ СЂР°СЃСЃС‹Р»РѕРє

**Р”Р°С‚Р°:** 2026-03-13
**РЎС‚Р°С‚СѓСЃ:** РљСЂРёС‚РёС‡РµСЃРєРѕРµ РІС‹СЏРІР»РµРЅРёРµ СЃРёСЃС‚РµРјРЅС‹С… РїСЂРѕР±Р»РµРј
**РђРІС‚РѕСЂ:** Emergency Response Team
**РўРёРї:** Post-Incident Architecture Review

---

## рџ“‹ EXECUTIVE SUMMARY

**РџСЂРѕР±Р»РµРјР°:** РЎРёСЃС‚РµРјР° РѕС‚РїСЂР°РІР»СЏР»Р° РїРѕ 3-4 СЃРѕРѕР±С‰РµРЅРёСЏ РІРјРµСЃС‚Рѕ 1 РІ РєР°Р¶РґС‹Р№ С‡Р°С‚.

**РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР° (С‚РµС…РЅРёС‡РµСЃРєР°СЏ):**
```
2Г— main app instances (cluster mode)
+ 1Г— wb-reputation-cron process
= 3Г— РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕРµ РІС‹РїРѕР»РЅРµРЅРёРµ CRON Р·Р°РґР°С‡
```

**РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР° (СЃРёСЃС‚РµРјРЅР°СЏ):**
> **РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ in-memory С„Р»Р°РіРѕРІ РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РјРµР¶РґСѓ РїСЂРѕС†РµСЃСЃР°РјРё РІ cluster mode вЂ” С„СѓРЅРґР°РјРµРЅС‚Р°Р»СЊРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅР°СЏ РѕС€РёР±РєР°**

**РРјРїР°РєС‚:**
- 2,075 Р°РєС‚РёРІРЅС‹С… sequences РѕС‚РїСЂР°РІРёР»Рё РґСѓР±Р»РёСЂСѓСЋС‰РёРµ СЃРѕРѕР±С‰РµРЅРёСЏ
- РќРµРіР°С‚РёРІРЅС‹Р№ customer experience
- РџРѕС‚РµРЅС†РёР°Р»СЊРЅС‹Рµ Р¶Р°Р»РѕР±С‹ РІ РїРѕРґРґРµСЂР¶РєСѓ WB

**Р’СЂРµРјСЏ СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёСЏ РїСЂРѕР±Р»РµРјС‹:** РњРёРЅРёРјСѓРј 1 РјРµСЃСЏС† (СЃ РјРѕРјРµРЅС‚Р° РІРєР»СЋС‡РµРЅРёСЏ cluster mode)

---

## рџЋЇ РљР›Р®Р§Р•Р’РћР™ Р’Р«Р’РћР”

**Р­С‚Рѕ РќР• Р±Р°Рі РІ РєРѕРґРµ. Р­С‚Рѕ СЃРёСЃС‚РµРјРЅР°СЏ РїСЂРѕР±Р»РµРјР° РІ:**

| РЈСЂРѕРІРµРЅСЊ | РџСЂРѕР±Р»РµРјР° | РљСЂРёС‚РёС‡РЅРѕСЃС‚СЊ |
|---------|----------|-------------|
| **РђСЂС…РёС‚РµРєС‚СѓСЂР°** | In-memory state РІ cluster mode | рџ”ґ РљСЂРёС‚РёС‡РµСЃРєР°СЏ |
| **РџСЂРѕС†РµСЃСЃС‹** | РћС‚СЃСѓС‚СЃС‚РІРёРµ code review | рџџ  Р’С‹СЃРѕРєР°СЏ |
| **Testing** | Zero integration tests РґР»СЏ production mode | рџџ  Р’С‹СЃРѕРєР°СЏ |
| **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ** | РЈСЃС‚Р°СЂРµРІС€Р°СЏ, СЃРєСЂС‹РІР°РµС‚ РїСЂРѕР±Р»РµРјС‹ | рџџЎ РЎСЂРµРґРЅСЏСЏ |
| **РњРѕРЅРёС‚РѕСЂРёРЅРі** | РќРµС‚ alerts РЅР° РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ | рџџ  Р’С‹СЃРѕРєР°СЏ |

---

## 1. РђР РҐРРўР•РљРўРЈР РќР«Р• РџР РћР‘Р›Р•РњР«

### 1.1 РџСЂРѕР±Р»РµРјР°: In-Memory State РІ Cluster Mode

**Р“РґРµ:** [src/lib/init-server.ts:8](src/lib/init-server.ts#L8)

```typescript
let initialized = false;  // вќЊ РљР РРўРР§Р•РЎРљРђРЇ РћРЁРР‘РљРђ
```

**РџРѕС‡РµРјСѓ СЌС‚Рѕ РѕС€РёР±РєР°:**

```
PM2 Cluster Mode (instances: 2):

в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ Process 1 (PID: 12345)                  в”‚
в”‚ Memory: 0x1000                          в”‚
в”‚ initialized = false в†’ true вњ“            в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ Process 2 (PID: 67890)                  в”‚
в”‚ Memory: 0x2000  в†ђ РћРўР”Р•Р›Р¬РќРђРЇ РџРђРњРЇРўР¬!     в”‚
в”‚ initialized = false в†’ true вњ“            в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

Р РµР·СѓР»СЊС‚Р°С‚: РћР‘Рђ РїСЂРѕС†РµСЃСЃР° СЃС‡РёС‚Р°СЋС‚ СЃРµР±СЏ РµРґРёРЅСЃС‚РІРµРЅРЅС‹РјРё!
```

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:**
- Process 1 Р·Р°РїСѓСЃРєР°РµС‚ CRON вњ“
- Process 2 Р·Р°РїСѓСЃРєР°РµС‚ CRON вњ“
- wb-reputation-cron Р·Р°РїСѓСЃРєР°РµС‚ CRON вњ“
- **= 3Г— РѕРґРЅРѕРІСЂРµРјРµРЅРЅР°СЏ РѕС‚РїСЂР°РІРєР° СЃРѕРѕР±С‰РµРЅРёР№**

**Р¤СѓРЅРґР°РјРµРЅС‚Р°Р»СЊРЅР°СЏ РѕС€РёР±РєР°:**
> **РќРµРІРѕР·РјРѕР¶РЅРѕ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°С‚СЊ РїСЂРѕС†РµСЃСЃС‹ С‡РµСЂРµР· in-memory РїРµСЂРµРјРµРЅРЅС‹Рµ**

---

### 1.2 РџСЂРѕР±Р»РµРјР°: РќР°СЂСѓС€РµРЅРёРµ Separation of Concerns

**РўРµРєСѓС‰Р°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°:**

```
ecosystem.config.js:
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ wb-reputation (instances: 2, cluster)  в”‚
в”‚ в”њв”Ђ HTTP API вњ“                          в”‚
в”‚ в”њв”Ђ Next.js Pages вњ“                     в”‚
в”‚ в”њв”Ђ CRON Jobs вќЊ Р”РћР›Р–РќРћ Р‘Р«РўР¬ РћРўР”Р•Р›Р¬РќРћ! в”‚
в”‚ в””в”Ђ Background tasks вќЊ                  в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ wb-reputation-cron (instances: 1)      в”‚
в”‚ в””в”Ђ CRON Jobs вњ“ (С‡РµСЂРµР· API РІС‹Р·РѕРІ)      в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

РџСЂРѕР±Р»РµРјР°: CRON Р¶РёРІС‘С‚ РІ РћР‘РћРРҐ РјРµСЃС‚Р°С…!
```

**РџСЂР°РІРёР»СЊРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ:**

```
в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ wb-reputation (instances: N, cluster)  в”‚
в”‚ в”њв”Ђ HTTP API вњ“                          в”‚
в”‚ в”њв”Ђ Next.js Pages вњ“                     в”‚
в”‚ в””в”Ђ Р‘Р•Р— CRON! вњ“                         в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

в”Њв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”ђ
в”‚ wb-reputation-worker (instances: 1)    в”‚
в”‚ в”њв”Ђ CRON Jobs РўРћР›Р¬РљРћ Р—Р”Р•РЎР¬ вњ“           в”‚
в”‚ в””в”Ђ Background tasks вњ“                  в”‚
в””в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”

РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:
- РњР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРµ API РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ CRON
- РќРµС‚ СЂРёСЃРєР° РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ
- РџСЂРѕСЃС‚РѕР№ РјРѕРЅРёС‚РѕСЂРёРЅРі
```

---

### 1.3 РџСЂРѕР±Р»РµРјР°: РњРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Рµ СЃРїРѕСЃРѕР±С‹ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё

**РћР±РЅР°СЂСѓР¶РµРЅРѕ 3 СЂР°Р·РЅС‹С… СЃРїРѕСЃРѕР±Р° Р·Р°РїСѓСЃРєР° CRON:**

```
РЎРїРѕСЃРѕР± 1: instrumentation.ts (Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№)
в”Њв”Ђ> instrumentation.ts:register()
в””в”Ђ> init-server.ts:initializeServer()
    в””в”Ђ> startAutoSequenceProcessor()

РЎРїРѕСЃРѕР± 2: wb-reputation-cron РїСЂРѕС†РµСЃСЃ
в”Њв”Ђ> scripts/start-cron.js
в””в”Ђ> POST /api/cron/trigger
    в””в”Ђ> ???  в†ђ РљРђРљ Р РђР‘РћРўРђР•Рў? РќР• Р”РћРљРЈРњР•РќРўРР РћР’РђРќРћ!

РЎРїРѕСЃРѕР± 3: Manual API call (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ)
в””в”Ђ> POST /api/cron/init
    в””в”Ђ> ???

РџСЂРѕР±Р»РµРјР°: РќРµС‚ single source of truth!
```

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:** РќРµРІРѕР·РјРѕР¶РЅРѕ РіР°СЂР°РЅС‚РёСЂРѕРІР°С‚СЊ "Р·Р°РїСѓСЃС‚РёС‚СЃСЏ СЂРѕРІРЅРѕ 1 СЂР°Р·"

---

### 1.4 РџСЂРѕР±Р»РµРјР°: РћС‚СЃСѓС‚СЃС‚РІРёРµ Distributed Lock

**Р”Р»СЏ cluster mode РћР‘РЇР—РђРўР•Р›Р¬РќРћ РЅСѓР¶РµРЅ distributed lock:**

```typescript
// вќЊ РќР•РџР РђР’РР›Р¬РќРћ (С‚РµРєСѓС‰РёР№ РєРѕРґ):
let initialized = false;  // in-memory

if (initialized) return;
initialized = true;
startCronJobs();

// вњ… РџР РђР’РР›Р¬РќРћ:
import Redis from 'ioredis';
const redis = new Redis(REDIS_URL);

async function initializeServer() {
  // Try to acquire lock (TTL: 5 min)
  const acquired = await redis.set(
    'cron:init:lock',
    process.pid,
    'EX', 300,
    'NX'  // Set if Not eXists
  );

  if (!acquired) {
    console.log('[INIT] Another process already initialized CRON');
    return;
  }

  console.log('[INIT] Lock acquired, initializing CRON...');
  startCronJobs();
}
```

**РЎРµР№С‡Р°СЃ РќР•Рў:**
- Redis
- Database-level lock
- File-based lock
- **Р›СЋР±РѕРіРѕ РјРµС…Р°РЅРёР·РјР° РєРѕРѕСЂРґРёРЅР°С†РёРё РјРµР¶РґСѓ РїСЂРѕС†РµСЃСЃР°РјРё!**

---

## 2. РџР РћР¦Р•РЎРЎР« Р РђР—Р РђР‘РћРўРљР

### 2.1 РћС‚СЃСѓС‚СЃС‚РІРёРµ Architecture Decision Records (ADR)

**РќР°Р№РґРµРЅРѕ:** [docs/decisions/ADR-001-why-instrumentation-hook.md](docs/decisions/ADR-001-why-instrumentation-hook.md)

**РџСЂРѕР±Р»РµРјР° РІ ADR:**

```markdown
## Consequences

### Negative
вљ пёЏ PM2 cluster duplication: Each PM2 instance runs instrumentation.ts
```

**РљСЂРёС‚РёС‡РµСЃРєРёР№ РїСЂРѕР±РµР»:**
- ADR СѓРєР°Р·С‹РІР°РµС‚ СЂРёСЃРє вњ“
- ADR РќР• СѓРєР°Р·С‹РІР°РµС‚ СЂРµС€РµРЅРёРµ вќЊ
- ADR РїРѕР»Р°РіР°РµС‚СЃСЏ РЅР° "concurrency protection in cron-jobs.ts" вќЊ
- РќРѕ СЌС‚Р° Р·Р°С‰РёС‚Р° вЂ” in-memory С„Р»Р°Рі! вќЊ

**Р§С‚Рѕ РґРѕР»Р¶РЅРѕ Р±С‹Р»Рѕ Р±С‹С‚СЊ РІ ADR:**

```markdown
## Mitigation: PM2 Cluster Duplication

**Problem:** With instances > 1, each process runs instrumentation.ts

**Solution Options:**

1. вќЊ In-memory flag в†’ IMPOSSIBLE (separate memory per process)
2. вќЊ API lock в†’ Race condition still possible
3. вњ… Environment flag: ENABLE_CRON_IN_MAIN_APP
   - Production: false (all CRON in separate fork process)
   - Development: true (CRON in main app for simplicity)

**Decision:** Use option 3 + distributed lock (Redis) for future scaling

**Validation:**
- Deployment checklist: verify ENABLE_CRON_IN_MAIN_APP=false
- Monitor: count CRON init logs (must be exactly 1)
```

**Р’С‹РІРѕРґ:** ADR Р±С‹Р» РЅРµРїРѕР»РЅС‹Рј вЂ” СЂРёСЃРє СѓРєР°Р·Р°РЅ, РЅРѕ СЂРµС€РµРЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚.

---

### 2.2 Code Review РїСЂР°РєС‚РёРєРё РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚

**Р”РѕРєР°Р·Р°С‚РµР»СЊСЃС‚РІР°:**

**1. РќРµС‚ СѓРїРѕРјРёРЅР°РЅРёР№ РІ git commits:**
```bash
git log --grep="cluster\|instances\|duplication" --oneline
# Р РµР·СѓР»СЊС‚Р°С‚: РџРЈРЎРўРћ
```

**2. РљСЂРёС‚РёС‡РµСЃРєРёРµ РёР·РјРµРЅРµРЅРёСЏ Р±РµР· РєРѕРјРјРµРЅС‚Р°СЂРёРµРІ:**

| Р¤Р°Р№Р» | РР·РјРµРЅРµРЅРёРµ | РљРѕРіРґР° | Code review? |
|------|-----------|-------|--------------|
| ecosystem.config.js | `instances: 2` РґРѕР±Р°РІР»РµРЅРѕ | ? | вќЊ РќРµС‚ СѓРїРѕРјРёРЅР°РЅРёР№ |
| instrumentation.ts | CRON auto-init РґРѕР±Р°РІР»РµРЅ | 2026-01-14 | вњ“ ADR-001, РЅРѕ Р±РµР· РјРёС‚РёРіР°С†РёРё |
| init-server.ts | ENABLE_CRON flag РґРѕР±Р°РІР»РµРЅ | 2026-03-13 | вќЊ РќРµС‚ PR, РЅРµС‚ РґРѕРєСѓРјРµРЅС‚Р°С†РёРё |

**3. РћС‚СЃСѓС‚СЃС‚РІРёРµ PR process:**
- РќРµС‚ issues "РљР°Рє РґРѕР»Р¶РµРЅ СЂР°Р±РѕС‚Р°С‚СЊ CRON РІ production?"
- РќРµС‚ РѕР±СЃСѓР¶РґРµРЅРёСЏ Р°СЂС…РёС‚РµРєС‚СѓСЂС‹
- РќРµС‚ peer review

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:** РљСЂРёС‚РёС‡РµСЃРєРёРµ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СЂРµС€РµРЅРёСЏ РїСЂРёРЅРёРјР°СЋС‚СЃСЏ Р±РµР· review.

---

### 2.3 Deployment Checklist РЅРµРїРѕР»РЅС‹Р№

**РўРµРєСѓС‰РёР№ С‡РµРєР»РёСЃС‚:** [DEPLOYMENT.md:486-497](DEPLOYMENT.md#L486-L497)

```markdown
## РС‚РѕРіРѕРІС‹Р№ С‡РµРєР»РёСЃС‚

- [ ] РЎРµСЂРІРµСЂ РЅР°СЃС‚СЂРѕРµРЅ (Node.js, PM2, Nginx)
- [ ] РџСЂРѕРµРєС‚ СЃРєР»РѕРЅРёСЂРѕРІР°РЅ РёР· GitHub
- [ ] .env.production СЃРѕР·РґР°РЅ СЃ РєРѕСЂСЂРµРєС‚РЅС‹РјРё РґР°РЅРЅС‹РјРё
- [ ] Р—Р°РІРёСЃРёРјРѕСЃС‚Рё СѓСЃС‚Р°РЅРѕРІР»РµРЅС‹
- [ ] РџСЂРѕРµРєС‚ СЃРѕР±СЂР°РЅ
- [ ] PM2 Р·Р°РїСѓС‰РµРЅ Рё СЃРѕС…СЂР°РЅРµРЅ
- [ ] Nginx РЅР°СЃС‚СЂРѕРµРЅ
- [ ] РџСЂРёР»РѕР¶РµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ
- [ ] Р›РѕРіРё РїСЂРѕРІРµСЂРµРЅС‹
```

**РћРўРЎРЈРўРЎРўР’РЈР•Рў:**

```markdown
- [ ] ENABLE_CRON_IN_MAIN_APP=false СѓСЃС‚Р°РЅРѕРІР»РµРЅ РІ .env.production
- [ ] PM2 РїСЂРѕС†РµСЃСЃС‹: wb-reputation (2 instances), wb-reputation-cron (1 instance)
- [ ] РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё: С‚РѕР»СЊРєРѕ РћР”РРќ [INIT] Starting cron jobs
- [ ] РџСЂРѕРІРµСЂРёС‚СЊ РѕС‚СЃСѓС‚СЃС‚РІРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ: pm2 logs | grep -c "[INIT]" в†’ 1
- [ ] РњРѕРЅРёС‚РѕСЂРёРЅРі CRON: sequences РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ 1 СЂР°Р·, РЅРµ 3
```

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:** Deploy РјРѕР¶РµС‚ РїСЂРѕР№С‚Рё СѓСЃРїРµС€РЅРѕ, РЅРѕ CRON Р±СѓРґРµС‚ РґСѓР±Р»РёСЂРѕРІР°С‚СЊСЃСЏ.

---

## 3. РўР•РЎРўРР РћР’РђРќРР•

### 3.1 Integration Tests РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚

**Р§С‚Рѕ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ:**

```typescript
// tests/integration/cron-cluster-mode.test.ts

describe('CRON in cluster mode', () => {
  it('should initialize CRON only once', async () => {
    // Simulate PM2 cluster with 2 instances
    const instance1 = spawnNextJsProcess();
    const instance2 = spawnNextJsProcess();

    await Promise.all([
      instance1.waitForReady(),
      instance2.waitForReady()
    ]);

    // Check logs
    const initLogs = getAllLogs().filter(log => log.includes('[INIT] Starting cron jobs'));

    // Р”РћР›Р–РќРћ Р‘Р«РўР¬ Р РћР’РќРћ 1!
    expect(initLogs.length).toBe(1);
  });

  it('should not send duplicate messages', async () => {
    // Start auto-sequence
    await startSequence({ chatId: 'test-123', storeId: 'store-1' });

    // Wait for first message
    await wait(5000);

    // Check sent messages
    const messages = await getChatMessages('test-123');
    const autoMessages = messages.filter(m => m.is_auto_reply);

    // Р”РћР›Р–РќРћ Р‘Р«РўР¬ Р РћР’РќРћ 1!
    expect(autoMessages.length).toBe(1);
  });
});
```

**РЎРµР№С‡Р°СЃ:** **ZERO integration tests** РґР»СЏ CRON.

---

### 3.2 Load Testing РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚

**Р§С‚Рѕ РќР• РїСЂРѕС‚РµСЃС‚РёСЂРѕРІР°РЅРѕ:**

| РЎС†РµРЅР°СЂРёР№ | РћР¶РёРґР°РµРјРѕРµ | Р¤Р°РєС‚РёС‡РµСЃРєРѕРµ | РўРµСЃС‚ РµСЃС‚СЊ? |
|----------|-----------|-------------|------------|
| 1 instance в†’ CRON init | 1Г— | 1Г— вњ“ | вќЊ |
| 2 instances в†’ CRON init | 1Г— | **3Г—** вќЊ | вќЊ |
| Concurrent sequence send | 1 msg | **3 msg** вќЊ | вќЊ |
| PM2 restart в†’ CRON re-init | 1Г— | ? | вќЊ |

**Р’С‹РІРѕРґ:** РљСЂРёС‚РёС‡РµСЃРєРёРµ СЃС†РµРЅР°СЂРёРё РЅРµ С‚РµСЃС‚РёСЂСѓСЋС‚СЃСЏ.

---

### 3.3 CI/CD РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚

**Р¤Р°Р№Р»С‹ РЅРµ РЅР°Р№РґРµРЅС‹:**
- `.github/workflows/test.yml`
- `.github/workflows/deploy.yml`
- `.gitlab-ci.yml`
- `Jenkinsfile`

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:**
- РќРµС‚ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёС… С‚РµСЃС‚РѕРІ РїСЂРё commit
- РќРµС‚ РІР°Р»РёРґР°С†РёРё РїРµСЂРµРґ deploy
- Р‘Р°РіРё РїРѕРїР°РґР°СЋС‚ РІ production

---

## 4. Р”РћРљРЈРњР•РќРўРђР¦РРЇ

### 4.1 README РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚

**Р¤Р°Р№Р»:** `README.md` вЂ” **РќР• РЎРЈР©Р•РЎРўР’РЈР•Рў!**

**Р”РѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ:**
```markdown
# WB Reputation Manager

## Architecture Overview

This app uses PM2 cluster mode for API scaling:
- wb-reputation: 2 instances (API + UI)
- wb-reputation-cron: 1 instance (CRON jobs ONLY)
- wb-reputation-tg-bot: 1 instance (Telegram bot)

вљ пёЏ IMPORTANT: CRON jobs run ONLY in wb-reputation-cron process!
Main app (wb-reputation) MUST have ENABLE_CRON_IN_MAIN_APP=false.

## Quick Start
...

## Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md)

## Troubleshooting
- Duplicate messages? Check ENABLE_CRON_IN_MAIN_APP=false
- CRON not running? Check wb-reputation-cron process status
```

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:** РќРѕРІС‹Рµ СЂР°Р·СЂР°Р±РѕС‚С‡РёРєРё РЅРµ РїРѕРЅРёРјР°СЋС‚ Р°СЂС…РёС‚РµРєС‚СѓСЂСѓ.

---

### 4.2 DEPLOYMENT.md РґРѕРєСѓРјРµРЅС‚РёСЂСѓРµС‚ РїСЂРѕР±Р»РµРјСѓ РєР°Рє "С„РёС‡Сѓ"

**Р Р°Р·РґРµР»:** [docs/DEPLOYMENT.md:209-218](docs/DEPLOYMENT.md#L209-L218)

```markdown
**Note:** CRON jobs run **inside** the Next.js process via `instrumentation.ts`.
The `wb-reputation-cron` process is a fallback trigger that ensures CRON init
after server is ready. No duplication вЂ” `initializeServer()` has an `initialized` flag.
```

**РџСЂРѕР±Р»РµРјР°:**
- вќЊ РЈС‚РІРµСЂР¶РґР°РµС‚ "No duplication"
- вќЊ РџРѕР»Р°РіР°РµС‚СЃСЏ РЅР° in-memory С„Р»Р°Рі (РЅРµРІРѕР·РјРѕР¶РЅРѕ РІ cluster mode)
- вќЊ РќРµ РѕР±СЉСЏСЃРЅСЏРµС‚ Р·Р°С‡РµРј Р”Р’Рђ СЃРїРѕСЃРѕР±Р° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё

**РџСЂР°РІРёР»СЊРЅР°СЏ РІРµСЂСЃРёСЏ:**

```markdown
**Note:** CRON jobs run in wb-reputation-cron process ONLY.

Main app (wb-reputation) runs with ENABLE_CRON_IN_MAIN_APP=false to prevent
duplicate execution in cluster mode.

Architecture:
- wb-reputation (2 instances): HTTP API + UI
- wb-reputation-cron (1 instance): CRON jobs

вљ пёЏ CRITICAL: If ENABLE_CRON_IN_MAIN_APP is not set to false, CRON will run
in ALL wb-reputation instances в†’ 3Г— duplicate sends!
```

---

### 4.3 CRON_JOBS.md РЅРµ Р°РґСЂРµСЃСѓРµС‚ cluster mode

**Р¤Р°Р№Р»:** [docs/CRON_JOBS.md](docs/CRON_JOBS.md) (1263 lines)

**РҐРѕСЂРѕС€РµРµ:**
- РџРѕРґСЂРѕР±РЅРѕ РѕРїРёСЃС‹РІР°РµС‚ РєР°Р¶РґС‹Р№ CRON job
- РћР±СЉСЏСЃРЅСЏРµС‚ СЂР°СЃРїРёСЃР°РЅРёСЏ
- РџСЂРёРјРµСЂС‹ Р»РѕРіРѕРІ

**РџР»РѕС…РѕРµ:**
- **РќРµС‚ СЂР°Р·РґРµР»Р° "Cluster Mode Safety"**
- РќРµ РїСЂРµРґСѓРїСЂРµР¶РґР°РµС‚ Рѕ `instances: 2` РѕРїР°СЃРЅРѕСЃС‚Рё
- РќРµ РѕР±СЉСЏСЃРЅСЏРµС‚ РїРѕС‡РµРјСѓ CRON РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ РѕС‚РґРµР»СЊРЅРѕРј РїСЂРѕС†РµСЃСЃРµ

**Р”РѕР»Р¶РµРЅ Р±С‹С‚СЊ СЂР°Р·РґРµР»:**

```markdown
## Cluster Mode Safety

### Problem
With PM2 cluster mode (instances > 1), CRON jobs would run multiple times.

### Solution
Use ENABLE_CRON_IN_MAIN_APP flag:
- Production: false в†’ CRON only in wb-reputation-cron
- Development: true в†’ CRON in main app (single instance)

### Verification
After deployment:
```bash
# Should see exactly ONE initialization
pm2 logs wb-reputation-cron --lines 50 | grep -c "[INIT] Starting cron jobs"
# Output: 1 вњ“

# Should NOT see CRON in main app
pm2 logs wb-reputation --lines 50 | grep "[INIT] Starting cron"
# Output: (empty) вњ“
```
```

---

## 5. РњРћРќРРўРћР РРќР“

### 5.1 Р›РѕРіРё РµСЃС‚СЊ, РЅРѕ РЅРµ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ

**CRON РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ Р»РѕРіРёСЂСѓРµС‚СЃСЏ:**

```
[INSTRUMENTATION] рџ“‚ File loaded at: 2026-03-13T10:00:00Z
[INIT] рџљЂ Initializing server at 2026-03-13T10:00:00Z
[INIT] Starting cron jobs...
[CRON] вњ… Auto-sequence processor started (every 30 min)
```

**РџСЂРѕР±Р»РµРјР°:** Р•СЃР»Рё cluster mode СЃ 2 instances, Р±СѓРґРµС‚:

```
[INIT] Starting cron jobs...  в†ђ Instance 1
[INIT] Starting cron jobs...  в†ђ Instance 2
[INIT] Starting cron jobs...  в†ђ wb-reputation-cron
```

**РќРёРєС‚Рѕ РЅРµ СЃРјРѕС‚СЂРµР» РЅР° Р»РѕРіРё!** вќЊ

**Р РµС€РµРЅРёРµ:**

```bash
# Alert script
INIT_COUNT=$(pm2 logs wb-reputation --lines 100 | grep -c "[INIT] Starting cron jobs")

if [ "$INIT_COUNT" -gt 1 ]; then
  echo "вљ пёЏ ALERT: CRON initialized $INIT_COUNT times (expected: 1)"
  # Send to Telegram/Slack/Email
fi
```

---

### 5.2 Alerts РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚

**РќРµС‚ РјРѕРЅРёС‚РѕСЂРёРЅРіР° РґР»СЏ:**

| РњРµС‚СЂРёРєР° | РљР°Рє РїСЂРѕРІРµСЂРёС‚СЊ | Alert РµСЃС‚СЊ? |
|---------|---------------|-------------|
| Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ CRON init | `grep -c "[INIT]"` РІ Р»РѕРіР°С… | вќЊ |
| Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ sequences | `COUNT(*) GROUP BY chat_id` | вќЊ |
| Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ СЃРѕРѕР±С‰РµРЅРёР№ | РћРґРёРЅР°РєРѕРІС‹Р№ text РІ РѕРґРЅРѕРј С‡Р°С‚Рµ < 5 РјРёРЅ | вќЊ |
| CRON РїСЂРѕС†РµСЃСЃ crashed | `pm2 status wb-reputation-cron` | вќЊ |

**РџРѕСЃР»РµРґСЃС‚РІРёРµ:** РџСЂРѕР±Р»РµРјС‹ РѕР±РЅР°СЂСѓР¶РёРІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РєРѕРіРґР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р¶Р°Р»СѓРµС‚СЃСЏ.

---

### 5.3 Healthcheck РЅРµРґРѕСЃС‚Р°С‚РѕС‡РµРЅ

**РўРµРєСѓС‰РёР№:** `GET /health` РІРѕР·РІСЂР°С‰Р°РµС‚ `200 OK`

**РџСЂРѕР±Р»РµРјР°:** РќРµ РїСЂРѕРІРµСЂСЏРµС‚:
- РЎРєРѕР»СЊРєРѕ СЌРєР·РµРјРїР»СЏСЂРѕРІ CRON Р·Р°РїСѓС‰РµРЅРѕ
- Р•СЃС‚СЊ Р»Рё РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ
- РђРєС‚РёРІРЅС‹ Р»Рё CRON jobs

**РџСЂР°РІРёР»СЊРЅС‹Р№ healthcheck:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),

    // CRON status
    cron: {
      enabled: process.env.ENABLE_CRON_IN_MAIN_APP === 'true',
      initialized: isInitialized(),
      warning: process.env.ENABLE_CRON_IN_MAIN_APP === 'true' && process.env.NODE_ENV === 'production'
        ? 'вљ пёЏ CRON should not run in main app in production!'
        : null
    },

    // Cluster info
    cluster: {
      processId: process.pid,
      instanceId: process.env.NODE_APP_INSTANCE,
    }
  };

  return Response.json(health);
}
```

---

## 6. Р’Р Р•РњР•РќРќРђРЇ РЁРљРђР›Рђ РџР РћР‘Р›Р•РњР«

| Р”Р°С‚Р° | РЎРѕР±С‹С‚РёРµ | Р¤Р°Р№Р» | РЎС‚Р°С‚СѓСЃ |
|------|---------|------|--------|
| 2026-01-14 | ADR-001: Р РµС€РµРЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ instrumentation.ts | `docs/decisions/ADR-001-why-instrumentation-hook.md` | вљ пёЏ Р РёСЃРє РЅРµ РјРёС‚РёРіРёСЂРѕРІР°РЅ |
| ~2026-02-08 | ecosystem.config.js: instances: 2 РґРѕР±Р°РІР»РµРЅРѕ | `ecosystem.config.js:9` | вќЊ Code review РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ |
| 2026-02-25 | DEPLOYMENT.md: РґРѕРєСѓРјРµРЅС‚РёСЂСѓРµС‚ "No duplication" | `docs/DEPLOYMENT.md:217` | вќЊ Р›РѕР¶РЅРѕРµ СѓС‚РІРµСЂР¶РґРµРЅРёРµ |
| 2026-03-13 | **РџР РћР‘Р›Р•РњРђ РћР‘РќРђР РЈР–Р•РќРђ** | Production | рџ”ґ РљСЂРёС‚РёС‡РµСЃРєР°СЏ |
| 2026-03-13 | ENABLE_CRON_IN_MAIN_APP С„Р»Р°Рі РґРѕР±Р°РІР»РµРЅ | `src/lib/init-server.ts:29` | вњ… Hotfix |
| 2026-03-13 | 2,075 sequences РѕСЃС‚Р°РЅРѕРІР»РµРЅС‹ | Database | вњ… Emergency stop |
| 2026-03-13 | CRON РїСЂРѕС†РµСЃСЃ РѕСЃС‚Р°РЅРѕРІР»РµРЅ | PM2 | вњ… Р Р°СЃСЃС‹Р»РєР° РѕСЃС‚Р°РЅРѕРІР»РµРЅР° |

**Р’С‹РІРѕРґ:** РџСЂРѕР±Р»РµРјР° СЃСѓС‰РµСЃС‚РІРѕРІР°Р»Р° РјРёРЅРёРјСѓРј **1 РјРµСЃСЏС†** (СЃ РјРѕРјРµРЅС‚Р° РІРєР»СЋС‡РµРЅРёСЏ cluster mode).

---

## 7. РљРћР РќР•Р’Р«Р• РџР РР§РРќР« (ROOT CAUSE ANALYSIS)

### 7.1 РўРµС…РЅРёС‡РµСЃРєРёРµ РїСЂРёС‡РёРЅС‹

| # | РџСЂРёС‡РёРЅР° | Р“РґРµ | РџРѕСЃР»РµРґСЃС‚РІРёРµ |
|---|---------|-----|-------------|
| 1 | In-memory С„Р»Р°Рі РІ cluster mode | `init-server.ts:8` | РќРµРІРѕР·РјРѕР¶РЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ |
| 2 | РћС‚СЃСѓС‚СЃС‚РІРёРµ ENABLE_CRON_IN_MAIN_APP РІ .env | `.env.production` | CRON Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ РІРµР·РґРµ |
| 3 | Cluster mode Р±РµР· distributed lock | `ecosystem.config.js:9` | 2Г— РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ |
| 4 | wb-reputation-cron С‚Р°РєР¶Рµ Р·Р°РїСѓСЃРєР°РµС‚ CRON | `scripts/start-cron.js` | +1Г— РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ |

### 7.2 РЎРёСЃС‚РµРјРЅС‹Рµ РїСЂРёС‡РёРЅС‹ (Р“Р›РђР’РќР«Р•)

| # | РЎРёСЃС‚РµРјРЅР°СЏ РїСЂРѕР±Р»РµРјР° | Р“РґРµ | РРјРїР°РєС‚ |
|---|-------------------|-----|--------|
| **1** | **РђСЂС…РёС‚РµРєС‚СѓСЂР°: Separation of concerns РЅР°СЂСѓС€РµРЅР°** | Р’СЃСЏ СЃРёСЃС‚РµРјР° | рџ”ґ РљСЂРёС‚РёС‡РµСЃРєР°СЏ |
| **2** | **РџСЂРѕС†РµСЃСЃС‹: Code review РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚** | Git workflow | рџџ  Р’С‹СЃРѕРєР°СЏ |
| **3** | **Testing: Zero integration tests РґР»СЏ production mode** | Tests РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚ | рџџ  Р’С‹СЃРѕРєР°СЏ |
| **4** | **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ: РЈСЃС‚Р°СЂРµРІС€Р°СЏ, СЃРєСЂС‹РІР°РµС‚ РїСЂРѕР±Р»РµРјС‹** | DEPLOYMENT.md | рџџЎ РЎСЂРµРґРЅСЏСЏ |
| **5** | **РњРѕРЅРёС‚РѕСЂРёРЅРі: РќРµС‚ alerts РЅР° РєСЂРёС‚РёС‡РµСЃРєРёРµ РјРµС‚СЂРёРєРё** | Observability | рџџ  Р’С‹СЃРѕРєР°СЏ |
| **6** | **Deployment: Checklist РЅРµРїРѕР»РЅС‹Р№** | DEPLOYMENT.md | рџџ  Р’С‹СЃРѕРєР°СЏ |

### 7.3 РџРѕС‡РµРјСѓ РїСЂРѕР±Р»РµРјР° РЅРµ Р±С‹Р»Р° РѕР±РЅР°СЂСѓР¶РµРЅР° СЂР°РЅСЊС€Рµ?

**1. РћС‚СЃСѓС‚СЃС‚РІРёРµ integration tests**
```
Unit tests: вњ“ (РІРѕР·РјРѕР¶РЅРѕ РµСЃС‚СЊ)
Integration tests РґР»СЏ cluster mode: вќЊ РќР•Рў
Load tests: вќЊ РќР•Рў
```

**2. Code review РЅРµ РїСЂРѕРІРѕРґРёР»СЃСЏ**
```
ecosystem.config.js РёР·РјРµРЅС‘РЅ в†’ instances: 2
РљС‚Рѕ review? вќЊ РќРµРёР·РІРµСЃС‚РЅРѕ
Р‘С‹Р»Р° Р»Рё РґРёСЃРєСѓСЃСЃРёСЏ? вќЊ РќРµС‚
```

**3. Deployment checklist РЅРµРїРѕР»РЅС‹Р№**
```
Checklist РїСЂРѕРІРµСЂСЏРµС‚: build, env vars, migrations
Checklist РќР• РїСЂРѕРІРµСЂСЏРµС‚: CRON duplication, process count
```

**4. РњРѕРЅРёС‚РѕСЂРёРЅРі РЅРµ РЅР°СЃС‚СЂРѕРµРЅ**
```
Р›РѕРіРё РµСЃС‚СЊ: вњ“
Alerts РЅР° РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ: вќЊ РќР•Рў
```

**5. Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃРєСЂС‹РІР°РµС‚ РїСЂРѕР±Р»РµРјСѓ**
```
DEPLOYMENT.md СѓС‚РІРµСЂР¶РґР°РµС‚: "No duplication"
Р РµР°Р»СЊРЅРѕСЃС‚СЊ: 3Г— duplication вќЊ
```

---

## 8. Р Р•РљРћРњР•РќР”РђР¦РР

### 8.1 РќР•РњР•Р”Р›Р•РќРќР«Р• (Hotfix - СЃРµРіРѕРґРЅСЏ)

**вњ… Р’Р«РџРћР›РќР•РќРћ:**
- [x] CRON РїСЂРѕС†РµСЃСЃ РѕСЃС‚Р°РЅРѕРІР»РµРЅ
- [x] 2,075 sequences РѕСЃС‚Р°РЅРѕРІР»РµРЅС‹
- [x] ENABLE_CRON_IN_MAIN_APP С„Р»Р°Рі РґРѕР±Р°РІР»РµРЅ РІ РєРѕРґ

**рџ”„ РўР Р•Р‘РЈР•РўРЎРЇ:**

**1. Р—Р°РіСЂСѓР·РёС‚СЊ РёСЃРїСЂР°РІР»РµРЅРЅС‹Р№ РєРѕРґ РЅР° production:**

```bash
ssh ubuntu@158.160.139.99
cd /var/www/wb-reputation

# Upload files
# - src/lib/init-server.ts (with ENABLE_CRON_IN_MAIN_APP check)
# - migrations/999_emergency_prevent_duplicate_sequences.sql
# - scripts/EMERGENCY-stop-auto-sequences.mjs
# - scripts/AUDIT-check-duplicate-sends.mjs

# Build
npm run build

# Deploy
pm2 restart all
```

**2. РЈСЃС‚Р°РЅРѕРІРёС‚СЊ ENABLE_CRON_IN_MAIN_APP=false:**

```bash
# .env.production
echo "ENABLE_CRON_IN_MAIN_APP=false" >> .env.production

# Reload env
pm2 restart all
```

**3. РџСЂРѕРІРµСЂРёС‚СЊ Р»РѕРіРё:**

```bash
# Р”РѕР»Р¶РµРЅ Р±С‹С‚СЊ Р РћР’РќРћ 1 INIT Р»РѕРі
pm2 logs wb-reputation-cron --lines 50 | grep -c "[INIT] Starting cron jobs"
# Output: 1 вњ“

# Main app РќР• РґРѕР»Р¶РµРЅ Р·Р°РїСѓСЃРєР°С‚СЊ CRON
pm2 logs wb-reputation --lines 50 | grep "[INIT].*CRON jobs DISABLED"
# Output: [INIT] вљ пёЏ  CRON jobs DISABLED in main app вњ“
```

**4. Р—Р°РїСѓСЃС‚РёС‚СЊ РјРёРіСЂР°С†РёСЋ:**

```bash
cd /var/www/wb-reputation
psql $DATABASE_URL -f migrations/999_emergency_prevent_duplicate_sequences.sql
```

---

### 8.2 РљР РђРўРљРћРЎР РћР§РќР«Р• (Р­С‚Р° РЅРµРґРµР»СЏ)

**1. РЎРѕР·РґР°С‚СЊ TASK РґРѕРєСѓРјРµРЅС‚:**

```markdown
# TASK-20260313-CRON-Architecture-Fix

## РЎС‚Р°С‚СѓСЃ: In Progress
## РџСЂРёРѕСЂРёС‚РµС‚: P0 (РљСЂРёС‚РёС‡РµСЃРєРёР№)
## Р”Р°С‚Р°: 2026-03-13

## РџСЂРѕР±Р»РµРјР°
CRON jobs Р·Р°РїСѓСЃРєР°СЋС‚СЃСЏ 3Г— РёР·-Р·Р° cluster mode

## Р РµС€РµРЅРёРµ
1. ENABLE_CRON_IN_MAIN_APP=false РІ production
2. Distributed lock (Redis) РґР»СЏ Р±СѓРґСѓС‰РµРіРѕ РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёСЏ
3. РћР±РЅРѕРІРёС‚СЊ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЋ
4. Р”РѕР±Р°РІРёС‚СЊ integration tests
5. РќР°СЃС‚СЂРѕРёС‚СЊ РјРѕРЅРёС‚РѕСЂРёРЅРі

## РљСЂРёС‚РµСЂРёРё РїСЂРёС‘РјРєРё
- [ ] РўРѕР»СЊРєРѕ 1 CRON init РІ Р»РѕРіР°С…
- [ ] No duplicate messages sent
- [ ] Documentation updated
- [ ] Tests added
- [ ] Monitoring configured
```

**2. РћР±РЅРѕРІРёС‚СЊ DEPLOYMENT.md:**

```markdown
## вљ пёЏ CRITICAL: CRON Configuration

**MUST SET in .env.production:**
```bash
ENABLE_CRON_IN_MAIN_APP=false  # Main app: API only, NO CRON
```

**Why:** With cluster mode (instances: 2), CRON would run 2Г— in main app
+ 1Г— in wb-reputation-cron = 3Г— duplicate execution!

**Verification after deployment:**
```bash
pm2 logs wb-reputation-cron | grep -c "[INIT] Starting cron jobs"
# MUST output: 1

pm2 logs wb-reputation | grep "[INIT].*CRON jobs DISABLED"
# MUST output: [INIT] вљ пёЏ  CRON jobs DISABLED in main app
```
```

**3. РћР±РЅРѕРІРёС‚СЊ ADR-001:**

```markdown
## Mitigation: PM2 Cluster Duplication

**Problem:** instances: 2 в†’ each process runs instrumentation.ts

**Solution:** ENABLE_CRON_IN_MAIN_APP environment flag
- Production: false (CRON only in wb-reputation-cron fork)
- Development: true (CRON in main app for simplicity)

**Implementation:**
- [x] Flag check in init-server.ts:29
- [x] Documentation in DEPLOYMENT.md
- [ ] Distributed lock (Redis) for future scaling
- [ ] Integration tests for cluster mode

**Validation:**
```bash
pm2 logs | grep -c "[INIT] Starting cron jobs" в†’ 1 вњ“
```
```

**4. РЎРѕР·РґР°С‚СЊ README.md:**

```bash
touch README.md
```

```markdown
# WB Reputation Manager

B2B SaaS for Wildberries sellers: reputation management, reviews, complaints, chats.

## Architecture

### PM2 Processes
- **wb-reputation** (2 instances, cluster): HTTP API + Next.js UI
- **wb-reputation-cron** (1 instance, fork): CRON jobs ONLY
- **wb-reputation-tg-bot** (1 instance, fork): Telegram bot

вљ пёЏ **CRITICAL:** CRON runs ONLY in wb-reputation-cron!
Main app MUST have `ENABLE_CRON_IN_MAIN_APP=false` in production.

## Quick Start
See [DEPLOYMENT.md](DEPLOYMENT.md)

## Troubleshooting
- **Duplicate messages?** в†’ Check `ENABLE_CRON_IN_MAIN_APP=false`
- **CRON not running?** в†’ Check `pm2 status wb-reputation-cron`
- **Logs:** `pm2 logs wb-reputation-cron`
```

**5. Р”РѕР±Р°РІРёС‚СЊ deployment validation:**

```bash
# deploy/validate-deployment.sh
#!/bin/bash

echo "рџ”Ќ Validating deployment..."

# Check ENABLE_CRON_IN_MAIN_APP
if grep -q "ENABLE_CRON_IN_MAIN_APP=false" .env.production; then
  echo "вњ… ENABLE_CRON_IN_MAIN_APP=false"
else
  echo "вќЊ ERROR: ENABLE_CRON_IN_MAIN_APP must be 'false' in production!"
  exit 1
fi

# Check PM2 processes
CRON_COUNT=$(pm2 jlist | jq '[.[] | select(.name=="wb-reputation-cron")] | length')
if [ "$CRON_COUNT" -eq 1 ]; then
  echo "вњ… wb-reputation-cron: 1 instance"
else
  echo "вќЊ ERROR: wb-reputation-cron must have exactly 1 instance!"
  exit 1
fi

# Check CRON initialization count
sleep 10  # Wait for init
INIT_COUNT=$(pm2 logs wb-reputation-cron --lines 50 --nostream | grep -c "[INIT] Starting cron jobs")
if [ "$INIT_COUNT" -eq 1 ]; then
  echo "вњ… CRON initialized exactly once"
else
  echo "вќЊ ERROR: CRON initialized $INIT_COUNT times (expected: 1)!"
  exit 1
fi

echo "вњ… Deployment validation passed!"
```

---

### 8.3 РЎР Р•Р”РќР•РЎР РћР§РќР«Р• (Р­С‚РѕС‚ РјРµСЃСЏС†)

**1. Р”РѕР±Р°РІРёС‚СЊ integration tests:**

```typescript
// tests/integration/cron/cluster-mode.test.ts
import { spawn } from 'child_process';
import { expect } from '@jest/globals';

describe('CRON РІ cluster mode', () => {
  it('РґРѕР»Р¶РµРЅ РёРЅРёС†РёР°Р»РёР·РёСЂРѕРІР°С‚СЊ CRON СЂРѕРІРЅРѕ 1 СЂР°Р·', async () => {
    // Simulate PM2 cluster: 2 instances
    const instances = [
      spawnNextJs({ instanceId: 0 }),
      spawnNextJs({ instanceId: 1 })
    ];

    await Promise.all(instances.map(i => i.waitForReady()));

    // Count CRON init logs
    const logs = getAllLogs();
    const initLogs = logs.filter(log => log.includes('[INIT] Starting cron jobs'));

    expect(initLogs.length).toBe(1);
  });

  it('РќР• РґРѕР»Р¶РµРЅ РѕС‚РїСЂР°РІР»СЏС‚СЊ РґСѓР±Р»РёСЂСѓСЋС‰РёРµ СЃРѕРѕР±С‰РµРЅРёСЏ', async () => {
    const chatId = 'test-chat-123';

    // Start auto-sequence
    await db.query(`
      INSERT INTO chat_auto_sequences (id, chat_id, status, current_step, max_steps)
      VALUES ('seq-test', $1, 'active', 0, 15)
    `, [chatId]);

    // Trigger CRON manually
    await triggerCronJobs();

    // Wait for send
    await wait(5000);

    // Check messages
    const messages = await db.query(`
      SELECT * FROM chat_messages
      WHERE chat_id = $1 AND is_auto_reply = TRUE
    `, [chatId]);

    expect(messages.rows.length).toBe(1);  // Р РћР’РќРћ 1 СЃРѕРѕР±С‰РµРЅРёРµ!
  });
});
```

**2. РќР°СЃС‚СЂРѕРёС‚СЊ РјРѕРЅРёС‚РѕСЂРёРЅРі:**

```typescript
// scripts/monitoring/check-cron-duplication.mjs
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkDuplication() {
  // Check CRON init count
  const { stdout } = await execAsync(
    'pm2 logs wb-reputation-cron --lines 100 --nostream | grep -c "[INIT] Starting cron jobs"'
  );

  const initCount = parseInt(stdout.trim());

  if (initCount > 1) {
    // ALERT!
    await sendAlert({
      severity: 'critical',
      title: 'рџљЁ CRON Duplication Detected',
      message: `CRON initialized ${initCount} times (expected: 1)`,
      action: 'Check ENABLE_CRON_IN_MAIN_APP flag'
    });
  }
}

// Run every 5 minutes
setInterval(checkDuplication, 5 * 60 * 1000);
```

**3. Р”РѕР±Р°РІРёС‚СЊ distributed lock (Redis):**

```typescript
// src/lib/distributed-lock.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function acquireLock(
  key: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const lockValue = process.pid.toString();

  const acquired = await redis.set(
    key,
    lockValue,
    'EX', ttlSeconds,
    'NX'  // Set if Not eXists
  );

  return acquired === 'OK';
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}

// Usage in init-server.ts:
import { acquireLock, releaseLock } from './distributed-lock';

export async function initializeServer() {
  const lockKey = 'cron:init:lock';
  const acquired = await acquireLock(lockKey, 300);

  if (!acquired) {
    console.log('[INIT] Another process already initialized CRON');
    return;
  }

  try {
    console.log('[INIT] Lock acquired, initializing CRON...');
    startCronJobs();
  } finally {
    // Keep lock for 5 min to prevent re-init
    setTimeout(() => releaseLock(lockKey), 5 * 60 * 1000);
  }
}
```

---

### 8.4 Р”РћР›Р“РћРЎР РћР§РќР«Р• (РЎР»РµРґСѓСЋС‰РёР№ РєРІР°СЂС‚Р°Р»)

**1. РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Р№ СЂРµС„Р°РєС‚РѕСЂРёРЅРі:**

```
РўРµРєСѓС‰Р°СЏ:
в”Њв”Ђ wb-reputation (2 instances) в†ђ API + UI + CRON (bug!)
в”њв”Ђ wb-reputation-cron (1 instance)
в””в”Ђ wb-reputation-tg-bot (1 instance)

РџСЂР°РІРёР»СЊРЅР°СЏ (Separation of Concerns):
в”Њв”Ђ wb-reputation-api (N instances, cluster) в†ђ РўРћР›Р¬РљРћ API + UI
в”њв”Ђ wb-reputation-worker (1 instance, fork) в†ђ РўРћР›Р¬РљРћ CRON + background jobs
в””в”Ђ wb-reputation-tg-bot (1 instance, fork) в†ђ РўРћР›Р¬РљРћ Telegram
```

**РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- вњ… РњР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРµ API РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ CRON
- вњ… РќРµРІРѕР·РјРѕР¶РЅРѕ СЃР»СѓС‡Р°Р№РЅРѕ Р·Р°РїСѓСЃС‚РёС‚СЊ CRON РІ API
- вњ… РџСЂРѕСЃС‚РѕР№ РјРѕРЅРёС‚РѕСЂРёРЅРі
- вњ… Distributed lock РѕРїС†РёРѕРЅР°Р»РµРЅ (РЅРµ РѕР±СЏР·Р°С‚РµР»РµРЅ РґР»СЏ 1 worker)

**2. Database-driven CRON (РІРјРµСЃС‚Рѕ node-cron):**

```typescript
// Р’РјРµСЃС‚Рѕ:
cron.schedule('*/30 * * * *', autoSequenceProcessor);

// РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ:
// PostgreSQL pg_cron extension
SELECT cron.schedule(
  'auto-sequence-processor',
  '*/30 * * * *',
  $$SELECT process_auto_sequences()$$
);
```

**РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- вњ… CRON Р¶РёРІС‘С‚ РІ Р‘Р”, РЅРµ РІ РїСЂРѕС†РµСЃСЃРµ
- вњ… РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РЅРµ РґСѓР±Р»РёСЂСѓРµС‚СЃСЏ
- вњ… РњРѕР¶РЅРѕ РјРѕРЅРёС‚РѕСЂРёС‚СЊ С‡РµСЂРµР· SQL
- вњ… РџРµСЂРµР¶РёРІР°РµС‚ restart РїСЂРѕС†РµСЃСЃРѕРІ

**3. Observability stack:**

```
Prometheus + Grafana:
- cron_init_count (gauge) в†’ alert if > 1
- cron_job_runs_total (counter) в†’ alert if stale
- auto_sequence_messages_sent (counter) в†’ detect spikes
- chat_duplicate_sequences (gauge) в†’ alert if > 0

Alertmanager:
- Slack/Telegram alerts
- PagerDuty for critical
```

---

## 9. LESSONS LEARNED

### 9.1 Р§С‚Рѕ СЃРґРµР»Р°Р»Рё РџР РђР’РР›Р¬РќРћ

вњ… **Р‘С‹СЃС‚СЂР°СЏ СЂРµР°РєС†РёСЏ РЅР° РїСЂРѕР±Р»РµРјСѓ:**
- Emergency stop РІС‹РїРѕР»РЅРµРЅ Р·Р° 10 РјРёРЅСѓС‚
- 2,075 sequences РѕСЃС‚Р°РЅРѕРІР»РµРЅС‹
- CRON РїСЂРѕС†РµСЃСЃ РѕСЃС‚Р°РЅРѕРІР»РµРЅ

вњ… **РџРѕРґСЂРѕР±РЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ:**
- Р’СЃРµ CRON РѕРїРµСЂР°С†РёРё Р»РѕРіРёСЂСѓСЋС‚СЃСЏ
- РњРѕР¶РЅРѕ РїСЂРѕСЃР»РµРґРёС‚СЊ РёРЅРёС†РёР°Р»РёР·Р°С†РёСЋ

вњ… **ADR-001 СЃСѓС‰РµСЃС‚РІСѓРµС‚:**
- Р РёСЃРє cluster mode Р±С‹Р» СѓРєР°Р·Р°РЅ
- РҐРѕС‚СЏ РјРёС‚РёРіР°С†РёСЏ РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»Р°

### 9.2 Р§С‚Рѕ СЃРґРµР»Р°Р»Рё РќР•РџР РђР’РР›Р¬РќРћ

вќЊ **РђСЂС…РёС‚РµРєС‚СѓСЂР°:**
- In-memory state РІ cluster mode
- Separation of concerns РЅР°СЂСѓС€РµРЅР°
- РњРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Рµ СЃРїРѕСЃРѕР±С‹ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё

вќЊ **РџСЂРѕС†РµСЃСЃС‹:**
- Code review РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚
- ADR РЅРµРїРѕР»РЅС‹Р№ (СЂРёСЃРє Р±РµР· РјРёС‚РёРіР°С†РёРё)
- Deployment checklist РЅРµРїРѕР»РЅС‹Р№

вќЊ **Testing:**
- Zero integration tests РґР»СЏ production mode
- РќРµ РїСЂРѕС‚РµСЃС‚РёСЂРѕРІР°РЅ cluster mode
- CI/CD РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚

вќЊ **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ:**
- README РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚
- DEPLOYMENT.md РґРѕРєСѓРјРµРЅС‚РёСЂСѓРµС‚ РѕС€РёР±РєСѓ РєР°Рє "С„РёС‡Сѓ"
- CRON_JOBS.md РЅРµ Р°РґСЂРµСЃСѓРµС‚ cluster mode

вќЊ **РњРѕРЅРёС‚РѕСЂРёРЅРі:**
- РќРµС‚ alerts РЅР° РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ
- Healthcheck РЅРµРґРѕСЃС‚Р°С‚РѕС‡РµРЅ
- Р›РѕРіРё РЅРµ Р°РЅР°Р»РёР·РёСЂСѓСЋС‚СЃСЏ

### 9.3 РљР»СЋС‡РµРІС‹Рµ РІС‹РІРѕРґС‹

**1. In-memory state РќР• СЂР°Р±РѕС‚Р°РµС‚ РІ cluster mode**
> Р¤СѓРЅРґР°РјРµРЅС‚Р°Р»СЊРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅР°СЏ РѕС€РёР±РєР°. РўСЂРµР±СѓРµС‚ distributed state (Redis/Database).

**2. Separation of Concerns РєСЂРёС‚РёС‡РЅР°**
> CRON РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РІ РѕС‚РґРµР»СЊРЅРѕРј РїСЂРѕС†РµСЃСЃРµ, РЅРµ РІ API server.

**3. Testing РѕР±СЏР·Р°С‚РµР»РµРЅ РґР»СЏ production scenarios**
> Cluster mode РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСЂРѕС‚РµСЃС‚РёСЂРѕРІР°РЅ Р”Рћ production.

**4. Code review РЅРµРѕР±С…РѕРґРёРј РґР»СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅС‹С… СЂРµС€РµРЅРёР№**
> `instances: 2` вЂ” РєСЂРёС‚РёС‡РµСЃРєРѕРµ РёР·РјРµРЅРµРЅРёРµ, С‚СЂРµР±СѓРµС‚ review.

**5. Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ С‡РµСЃС‚РЅРѕР№**
> РќРµ СЃРєСЂС‹РІР°С‚СЊ РїСЂРѕР±Р»РµРјС‹, РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°С‚СЊ РѕРіСЂР°РЅРёС‡РµРЅРёСЏ.

**6. РњРѕРЅРёС‚РѕСЂРёРЅРі РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РїСЂРѕР°РєС‚РёРІРЅС‹Рј**
> РџСЂРѕР±Р»РµРјС‹ РґРѕР»Р¶РЅС‹ РѕР±РЅР°СЂСѓР¶РёРІР°С‚СЊСЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, РЅРµ РѕС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.

---

## 10. ACTION ITEMS

### РћС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚СЊ

| # | Action | РћС‚РІРµС‚СЃС‚РІРµРЅРЅС‹Р№ | Р”РµРґР»Р°Р№РЅ | РЎС‚Р°С‚СѓСЃ |
|---|--------|---------------|---------|--------|
| 1 | Deploy hotfix (ENABLE_CRON_IN_MAIN_APP) | DevOps | РЎРµРіРѕРґРЅСЏ | рџ”„ In Progress |
| 2 | РћР±РЅРѕРІРёС‚СЊ DEPLOYMENT.md | Tech Lead | Р­С‚Р° РЅРµРґРµР»СЏ | вЏі Pending |
| 3 | РЎРѕР·РґР°С‚СЊ README.md | Tech Lead | Р­С‚Р° РЅРµРґРµР»СЏ | вЏі Pending |
| 4 | Р”РѕР±Р°РІРёС‚СЊ integration tests | QA Lead | Р­С‚РѕС‚ РјРµСЃСЏС† | вЏі Pending |
| 5 | РќР°СЃС‚СЂРѕРёС‚СЊ РјРѕРЅРёС‚РѕСЂРёРЅРі | DevOps | Р­С‚РѕС‚ РјРµСЃСЏС† | вЏі Pending |
| 6 | РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Р№ СЂРµС„Р°РєС‚РѕСЂРёРЅРі | Architect | Q2 2026 | вЏі Planned |
| 7 | Р’РЅРµРґСЂРёС‚СЊ CI/CD | DevOps | Q2 2026 | вЏі Planned |

---

## 11. Р—РђРљР›Р®Р§Р•РќРР•

**РљРѕСЂРЅРµРІР°СЏ РїСЂРѕР±Р»РµРјР°:**
> РќРµ Р±Р°Рі РІ РєРѕРґРµ, Р° **СЃРёСЃС‚РµРјРЅР°СЏ РїСЂРѕР±Р»РµРјР° РІ Р°СЂС…РёС‚РµРєС‚СѓСЂРµ, РїСЂРѕС†РµСЃСЃР°С… Рё РєСѓР»СЊС‚СѓСЂРµ СЂР°Р·СЂР°Р±РѕС‚РєРё**.

**РљР»СЋС‡РµРІС‹Рµ РґРµС„РµРєС‚С‹:**

1. **РђСЂС…РёС‚РµРєС‚СѓСЂР°:** In-memory state РІ cluster mode вЂ” С„СѓРЅРґР°РјРµРЅС‚Р°Р»СЊРЅР°СЏ РѕС€РёР±РєР°
2. **РџСЂРѕС†РµСЃСЃС‹:** РћС‚СЃСѓС‚СЃС‚РІРёРµ code review РґР»СЏ РєСЂРёС‚РёС‡РµСЃРєРёС… РёР·РјРµРЅРµРЅРёР№
3. **Testing:** Zero tests РґР»СЏ production scenarios
4. **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ:** РЎРєСЂС‹РІР°РµС‚ РїСЂРѕР±Р»РµРјС‹ РІРјРµСЃС‚Рѕ РёС… РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅРёСЏ
5. **РњРѕРЅРёС‚РѕСЂРёРЅРі:** РџСЂРѕР±Р»РµРјС‹ РѕР±РЅР°СЂСѓР¶РёРІР°СЋС‚СЃСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё, РЅРµ СЃРёСЃС‚РµРјРѕР№

**РџСѓС‚СЊ РІРїРµСЂС‘Рґ:**

вњ… **Immediate:** Deploy hotfix (СЃРµРіРѕРґРЅСЏ)
рџ”„ **Short-term:** Documentation + validation (СЌС‚Р° РЅРµРґРµР»СЏ)
рџ“Љ **Mid-term:** Testing + monitoring (СЌС‚РѕС‚ РјРµСЃСЏС†)
рџЏ—пёЏ **Long-term:** Architecture refactoring (Q2 2026)

---

**РћС‚С‡С‘С‚ СЃРѕСЃС‚Р°РІР»РµРЅ:** 2026-03-13
**РђРІС‚РѕСЂ:** Emergency Response Team
**РЎС‚Р°С‚СѓСЃ:** Final Review
**РљР°С‚РµРіРѕСЂРёСЏ:** Post-Incident Architecture Audit

**РўСЂРµР±СѓРµС‚СЃСЏ СЃСЂРѕС‡РЅРѕРµ РІРЅРёРјР°РЅРёРµ:** вњ… Р”Рђ
**РљСЂРёС‚РёС‡РЅРѕСЃС‚СЊ:** рџ”ґ P0 (Critical)

---

## РџР РР›РћР–Р•РќРРЇ

### A. Р¤Р°Р№Р»С‹ РґР»СЏ review

- [x] `src/lib/init-server.ts` вЂ” ENABLE_CRON_IN_MAIN_APP check
- [x] `ecosystem.config.js` вЂ” instances: 2
- [x] `instrumentation.ts` вЂ” auto CRON init
- [ ] `.env.production` вЂ” ENABLE_CRON_IN_MAIN_APP=false (РўР Р•Р‘РЈР•РўРЎРЇ)
- [x] `docs/decisions/ADR-001-why-instrumentation-hook.md`
- [ ] `DEPLOYMENT.md` вЂ” РѕР±РЅРѕРІРёС‚СЊ (РўР Р•Р‘РЈР•РўРЎРЇ)
- [ ] `README.md` вЂ” СЃРѕР·РґР°С‚СЊ (РўР Р•Р‘РЈР•РўРЎРЇ)
- [ ] `docs/CRON_JOBS.md` вЂ” РґРѕР±Р°РІРёС‚СЊ Cluster Mode Safety СЂР°Р·РґРµР» (РўР Р•Р‘РЈР•РўРЎРЇ)

### B. РЎРІСЏР·Р°РЅРЅС‹Рµ РґРѕРєСѓРјРµРЅС‚С‹

- [START-HERE.md](START-HERE.md) вЂ” Quick start guide
- [EMERGENCY-FIX-SUMMARY.md](EMERGENCY-FIX-SUMMARY.md) вЂ” Р”РµС‚Р°Р»СЊРЅС‹Р№ РїР»Р°РЅ С„РёРєСЃР°
- [EMERGENCY-STOP-GUIDE.md](EMERGENCY-STOP-GUIDE.md) вЂ” Troubleshooting guide
- [migrations/999_emergency_prevent_duplicate_sequences.sql](migrations/999_emergency_prevent_duplicate_sequences.sql) вЂ” DB migration

---

**END OF REPORT**
