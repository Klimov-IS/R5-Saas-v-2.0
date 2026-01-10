#!/bin/bash

# Sync Configuration
# This file contains configurable parameters for review sync scripts

# ============================================
# STORE EXCLUSIONS
# ============================================
# Store ID to exclude from sync (already fully synced)
EXCLUDE_STORE_ID="UiLCn5HyzRPphSRvR11G"  # Тайди Центр (1.3M reviews synced)

# ============================================
# TIMING CONFIGURATION
# ============================================
# Delay between stores (in seconds)
# Recommended: 600s (10 min) to avoid WB API Rate Limit (429)
DELAY_BETWEEN_STORES=600  # 10 minutes

# ============================================
# RETRY CONFIGURATION
# ============================================
# Maximum number of retry attempts per store
MAX_RETRIES=3

# Delay after 1st failure (seconds)
RETRY_DELAY_1=600   # 10 minutes

# Delay after 2nd failure (seconds)
RETRY_DELAY_2=1200  # 20 minutes

# ============================================
# API CONFIGURATION
# ============================================
API_URL="http://localhost:3000"
API_KEY="wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue"
