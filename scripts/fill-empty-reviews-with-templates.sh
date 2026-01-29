#!/bin/bash
# Массовая генерация шаблонных жалоб для пустых отзывов (1-3★)
# Использует A/B тестирование с 4 вариантами шаблонов

API_KEY="wbrm_0ab7137430d4fb62948db3a7d9b4b997"
BASE_URL="http://localhost:9002"

echo "📊 WB Reputation Manager - Массовая генерация шаблонов"
echo "========================================================"
echo ""

# 1. Get statistics
echo "1️⃣  Получение статистики пустых отзывов..."
STATS=$(curl -s "$BASE_URL/api/admin/analyze-empty-reviews")
TOTAL=$(echo $STATS | python -c "import sys, json; print(json.load(sys.stdin)['overall']['empty_without_complaint'])")

echo "   Всего пустых отзывов без жалоб: $TOTAL"
echo ""

# 2. Ask for confirmation
read -p "2️⃣  Начать генерацию шаблонов? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Отменено"
    exit 1
fi

# 3. Dry run first (preview)
echo ""
echo "3️⃣  Тестовый запуск (dry run) - проверка первых 10 отзывов..."
curl -s -X POST "$BASE_URL/api/admin/generate-empty-review-complaints?limit=10&dry_run=true" \
  -H "Authorization: Bearer $API_KEY" \
  | python -m json.tool

read -p "4️⃣  Продолжить реальную генерацию? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Отменено"
    exit 1
fi

# 4. Batch generation (1000 per batch to avoid timeouts)
echo ""
echo "5️⃣  Запуск массовой генерации (батчами по 1000)..."
echo ""

BATCH_SIZE=1000
TOTAL_GENERATED=0
BATCH_NUM=1

while [ $TOTAL_GENERATED -lt $TOTAL ]; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Батч #$BATCH_NUM (макс $BATCH_SIZE отзывов)..."

  RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/generate-empty-review-complaints?limit=$BATCH_SIZE" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json")

  GENERATED=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('generated_count', 0))" 2>/dev/null || echo "0")
  DURATION=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('duration_sec', 0))" 2>/dev/null || echo "0")
  VARIANT_A=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('variant_distribution', {}).get('A', 0))" 2>/dev/null || echo "0")
  VARIANT_B=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('variant_distribution', {}).get('B', 0))" 2>/dev/null || echo "0")
  VARIANT_C=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('variant_distribution', {}).get('C', 0))" 2>/dev/null || echo "0")
  VARIANT_D=$(echo $RESPONSE | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('variant_distribution', {}).get('D', 0))" 2>/dev/null || echo "0")

  echo "   ✅ Создано: $GENERATED жалоб за ${DURATION}s"
  echo "   📊 Варианты: A=$VARIANT_A, B=$VARIANT_B, C=$VARIANT_C, D=$VARIANT_D"

  TOTAL_GENERATED=$((TOTAL_GENERATED + GENERATED))

  echo "   📈 Всего обработано: $TOTAL_GENERATED / $TOTAL ($(echo "scale=1; $TOTAL_GENERATED * 100 / $TOTAL" | bc)%)"

  # Stop if batch returned less than requested (no more reviews)
  if [ $GENERATED -lt $BATCH_SIZE ]; then
    echo "   ℹ️  Последний батч (больше нет пустых отзывов)"
    break
  fi

  BATCH_NUM=$((BATCH_NUM + 1))
  echo "   ⏸️  Пауза 2 секунды перед следующим батчем..."
  sleep 2
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ЗАВЕРШЕНО!"
echo "   Всего создано жалоб: $TOTAL_GENERATED"
echo "   💰 Экономия токенов: ~\$$(echo "scale=2; $TOTAL_GENERATED * 0.0042" | bc)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 6. Show final statistics
echo "6️⃣  Финальная статистика:"
curl -s "$BASE_URL/api/admin/analyze-empty-reviews" | python -m json.tool
