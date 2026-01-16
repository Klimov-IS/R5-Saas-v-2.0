#!/bin/bash

# Monitor Dialogue Sync Script
# Helps track sync progress and detect WB API rate limit issues

echo "🔍 Мониторинг синхронизации диалогов"
echo "====================================="
echo ""

# Configuration
API_URL="http://localhost:9002"
AUTH_TOKEN="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check stores before sync
check_stores() {
    echo -e "${BLUE}📊 Проверка магазинов...${NC}"
    response=$(curl -s -X GET "${API_URL}/api/stores" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")

    store_count=$(echo "$response" | grep -o '"id"' | wc -l)
    echo -e "${GREEN}✓ Найдено магазинов: ${store_count}${NC}"
    echo ""

    # Show store details
    echo "$response" | grep -oP '"id":"[^"]*"|"name":"[^"]*"' | paste - - | sed 's/"id":"\([^"]*\)".*"name":"\([^"]*\)"/  - \1: \2/'
    echo ""
}

# Function to start sync
start_sync() {
    echo -e "${YELLOW}🚀 Запуск синхронизации всех магазинов...${NC}"
    echo ""

    start_time=$(date +%s)

    response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
        -X POST "${API_URL}/api/stores/dialogues/update-all" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" \
        -H "Content-Type: application/json")

    # Extract HTTP code and time
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    time_total=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d' | sed '/TIME_TOTAL:/d')

    echo -e "${BLUE}HTTP Status: ${http_code}${NC}"
    echo -e "${BLUE}Время выполнения: ${time_total}s${NC}"
    echo ""

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Синхронизация завершена успешно!${NC}"
        echo ""

        # Parse results
        success_count=$(echo "$body" | grep -oP '"status":"success"' | wc -l)
        error_count=$(echo "$body" | grep -oP '"status":"error"' | wc -l)

        echo -e "Результаты:"
        echo -e "  ${GREEN}✓ Успешно: ${success_count}${NC}"
        echo -e "  ${RED}✗ Ошибки: ${error_count}${NC}"
        echo ""

        # Show detailed results
        echo "Детали по магазинам:"
        echo "$body" | grep -oP '"storeName":"[^"]*"|"status":"[^"]*"|"message":"[^"]*"' | \
            paste - - - | \
            sed 's/"storeName":"\([^"]*\)".*"status":"\([^"]*\)".*"message":"\([^"]*\)"/  - \1: [\2] \3/'

    else
        echo -e "${RED}❌ Синхронизация завершилась с ошибкой!${NC}"
        echo ""
        echo "Детали ошибки:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi

    echo ""
}

# Function to check sync results
check_results() {
    echo -e "${BLUE}📈 Проверка результатов синхронизации...${NC}"
    echo ""

    # Get all stores
    stores=$(curl -s -X GET "${API_URL}/api/stores" \
        -H "Authorization: Bearer ${AUTH_TOKEN}" | \
        grep -oP '"id":"[^"]*"' | cut -d'"' -f4)

    for store_id in $stores; do
        store_data=$(curl -s -X GET "${API_URL}/api/stores/${store_id}" \
            -H "Authorization: Bearer ${AUTH_TOKEN}")

        store_name=$(echo "$store_data" | grep -oP '"name":"[^"]*"' | cut -d'"' -f4)
        total_chats=$(echo "$store_data" | grep -oP '"totalChats":\d+' | cut -d: -f2)
        deletion_candidates=$(echo "$store_data" | grep -oP '"deletion_candidate":\d+' | cut -d: -f2)

        echo -e "  ${GREEN}${store_name}${NC} (${store_id}):"
        echo "    Всего чатов: ${total_chats:-0}"
        echo "    🎯 Кандидаты на удаление: ${deletion_candidates:-0}"

        # Show tag distribution
        echo "$store_data" | grep -oP '"chatTagCounts":\{[^}]*\}' | \
            sed 's/.*{\(.*\)}/\1/' | \
            tr ',' '\n' | \
            sed 's/"//g' | \
            sed 's/^\s*/      /' | \
            grep -v '^\s*$'

        echo ""
    done
}

# Function to monitor for errors
check_logs() {
    echo -e "${YELLOW}⚠️  Проверка на ошибки лимитов WB API...${NC}"
    echo ""

    # Note: This would require access to server logs
    # For now, we'll just remind the user to check
    echo "📝 Проверьте консоль dev сервера на наличие:"
    echo "  - Error fetching WB events: 429 Too Many Requests"
    echo "  - Error fetching WB chats: 503 Service Unavailable"
    echo "  - [DIALOGUES] Chat xyz: Classification failed"
    echo ""
    echo "Если видите ошибки 429/503, увеличьте задержки в:"
    echo "  - src/app/api/stores/[storeId]/dialogues/update/route.ts:107"
    echo "  - src/app/api/stores/dialogues/update-all/route.ts:129"
    echo ""
}

# Main menu
main_menu() {
    echo ""
    echo "Выберите действие:"
    echo "  1) Проверить магазины"
    echo "  2) Запустить синхронизацию"
    echo "  3) Проверить результаты"
    echo "  4) Информация об ошибках"
    echo "  5) Выполнить всё (1→2→3→4)"
    echo "  q) Выход"
    echo ""
    read -p "Ваш выбор: " choice

    case $choice in
        1)
            check_stores
            main_menu
            ;;
        2)
            start_sync
            main_menu
            ;;
        3)
            check_results
            main_menu
            ;;
        4)
            check_logs
            main_menu
            ;;
        5)
            check_stores
            echo ""
            read -p "Продолжить с синхронизацией? (y/n): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                start_sync
                echo ""
                echo -e "${BLUE}⏳ Ожидание 10 секунд перед проверкой результатов...${NC}"
                sleep 10
                check_results
                check_logs
            fi
            main_menu
            ;;
        q|Q)
            echo "Выход..."
            exit 0
            ;;
        *)
            echo -e "${RED}Неверный выбор. Попробуйте снова.${NC}"
            main_menu
            ;;
    esac
}

# Start
main_menu
