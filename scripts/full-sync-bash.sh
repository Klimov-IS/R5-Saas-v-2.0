#!/bin/bash

API_KEY="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
BASE_URL="http://localhost:9002"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         FULL REVIEW SYNC FOR ALL STORES                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get all store IDs and names
echo "📋 Fetching all stores..."

# Array of stores (storeId|storeName)
stores=(
  "ss6Y8orHTX6vS7SgJl4k|20Grace ИП Ширазданова Г. М."
  "TwKRrPji2KhTS8TmYJlD|ИП Абагалаев Г. Т."
  "haNp15vW6FWomNLPesHC|ИП Авакова"
  "0rCKlFCdrT7L3B2ios45|ИП Алиев"
  "xOMA8naL3Q9eSuR2Oewr|ИП Аникеев М. Ю."
  "7kKX9WgLvOPiXYIHk6hi|ИП Артюшина"
  "Ycor9h1JdbJn7DTjyAXX|ИП Ахметов Д. Э."
  "1V7vaBiI85BGDQOJq26z|ИП Бобоев С. С."
  "D3jDZIW4hILTmhHuQjqG|ИП Бойко"
  "M0vc4AIe9BngybePlCaF|ИП Бойко (2)"
  "wHekFiPAjp3dq7a1aGpL|ИП Бугаев Б."
  "TOJiqdSbjCqpJeMd4pLm|ИП Виниченко М."
  "J2KuBG1mNLwHCIeZtNuK|ИП Гаврилов"
  "7tHLDZ0LsmRMVMuXfxYz|ИП Деменев"
  "ihMDtsRIFCx6B5fbvnC5|ИП Дулесов Д. О."
  "QwCbM8MSPOdreDXWVII6|ИП Корольков"
  "6TbcNUQ6tt8AWfJU8YDI|ИП Крылов Б. В."
  "6jTfJ4abVsjkgx8SHXZ4|ИП Крылов Д. Б."
  "dkHBFs7lGKoBwhM31Sqh|ИП Крылов Д. Б. (2)"
  "GEizKVDFzgFNqtu6D2w6|ИП Кузнецов Р."
  "CwzAIccNF3nmfNoVEFOr|ИП Луспикоян"
  "6GEUOuJaAMHusA9WPZzY|ИП Мальнева"
  "M0eBCsFSqeNInDhibesQ|ИП Мамедов Рафик (новый)"
  "pPVdNwvLHGIG5bDCMo8j|ИП Мамедова Т. Н."
  "eb2QyxdWYOydWkySEPlL|ИП Матвеева"
  "rpixYkH1iGxOSYraLqVR|ИП Мочалова"
  "xyrH43QC4bx0eij9b0o7|ИП Мылыгин А. Б."
  "Zj0bMemYny4G9zGO64zc|ИП Никитин С. О."
  "9twKSDRjs4c27jQNDSzn|ИП Пацюк"
  "MUDoyx5ZeTQ4sit64pCH|ИП Пересадина Д. А."
  "qFCXjaKxwv2vRQkBvUrM|ИП Пересадина Д. А. (2)"
  "7A1nEmSYSi1ejHkeqB2j|ИП Русаков Р. А."
  "wI7Qwj7ScOdqqVDtwJKv|ИП Русакова Н. Р."
  "ROpMsZSmzLUFtpwqQq3t|ИП Страх Р. И."
  "1Hjrlzp1OLfYNmgC6HQd|ИП Тургунов Ф. Ф."
  "Exq56AqEKvUNOgjQ8X47|ИП Тюрина"
  "bTOtBtK5qDiydqEQmbB7|ИП Чаевцев Р. Ю."
  "8WD63TveZwygvB0MrPVN|ИП Чеканов Д. Ю."
  "fjSmr8MEPEWXJIXBu6qE|ИП Черемных Д. В."
  "BhWUBJfOFTozPN1EkFml|Макшуз Тест 2"
  "8W7W9MpNGtSoHPggjhbW|ООО АМОР ФЛЕРС"
  "8zFlmuTc828C8rvc7PWr|ООО Вертон Групп"
  "sTtXcI2WoTTF4Nmbng6N|ООО КотоМото"
  "ueF6r5SKlh8KjSy3czm4|ООО МИРИК"
  "8kfIwfLv7Fn4DyuimLqG|ООО Моли Бьюти"
  "CtsBDHrouotaPHt7ukZy|ООО РИГ"
  "ZO4F6yiFVEPJR9KfH4DO|ООО Рубин"
  "Cb5WpaZpztP0hfi15aNt|ООО СделаемЛегко"
  "UiLCn5HyzRPphSRvR11G|ООО Тайди центр"
  "v8qsdC96M7FL9WUqKBrG|ООО ЭМУНА РУ"
  "LudS4BzOTqj8904BGsHz|тест Тайди"
)

total=${#stores[@]}
success=0
failed=0
total_reviews=0

echo "Found $total stores"
echo ""

start_time=$(date +%s)

for i in "${!stores[@]}"; do
  IFS='|' read -r store_id store_name <<< "${stores[$i]}"
  index=$((i+1))

  echo -e "\n[${index}/${total}] Processing: $store_name"
  echo -e "[$(date -Iseconds)] 🔄 Starting FULL sync..."

  # Make API request
  response=$(curl -X POST "${BASE_URL}/api/stores/${store_id}/reviews/update?mode=full" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -s \
    --max-time 300)

  # Extract HTTP code and body
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    # Extract number of reviews from response
    reviews=$(echo "$body" | grep -oP '\d+' | head -n1)
    if [ -z "$reviews" ]; then
      reviews=0
    fi

    echo -e "${GREEN}✅ Success: $reviews reviews${NC}"
    ((success++))
    total_reviews=$((total_reviews + reviews))
  else
    echo -e "${RED}❌ Failed (HTTP $http_code)${NC}"
    ((failed++))
  fi

  # Wait 3 seconds before next store
  if [ $index -lt $total ]; then
    echo "⏳ Waiting 3 seconds..."
    sleep 3
  fi
done

end_time=$(date +%s)
duration=$((end_time - start_time))
minutes=$((duration / 60))
seconds=$((duration % 60))

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    SYNC COMPLETED                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   Total stores: $total"
echo -e "   ${GREEN}✅ Success: $success${NC}"
echo -e "   ${RED}❌ Failed: $failed${NC}"
echo "   📝 Total reviews added: $(printf "%'d" $total_reviews)"
echo "   ⏱️  Total duration: ${minutes}m ${seconds}s"
echo ""
