@echo off
REM Monitor Dialogue Sync Script for Windows
REM Helps track sync progress and detect WB API rate limit issues

echo.
echo ============================================
echo     Monitoring synhronizacii dialogov
echo ============================================
echo.

REM Configuration
set API_URL=http://localhost:9002
set AUTH_TOKEN=wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue

:MENU
echo.
echo Vybierite deistvie:
echo   1) Proverit magaziny
echo   2) Zapustit sinhronizaciyu
echo   3) Proverit rezultaty
echo   4) Zapustit vse (1-2-3)
echo   q) Vyhod
echo.
set /p choice="Vash vybor: "

if "%choice%"=="1" goto CHECK_STORES
if "%choice%"=="2" goto START_SYNC
if "%choice%"=="3" goto CHECK_RESULTS
if "%choice%"=="4" goto RUN_ALL
if /i "%choice%"=="q" goto EXIT
echo Neviernyj vybor. Poprobujte snova.
goto MENU

:CHECK_STORES
echo.
echo [Proverka magazinov...]
echo.
curl -s -X GET "%API_URL%/api/stores" -H "Authorization: Bearer %AUTH_TOKEN%"
echo.
echo.
goto MENU

:START_SYNC
echo.
echo [Zapusk sinhronizacii vseh magazinov...]
echo.
echo Start time: %time%
echo.

curl -X POST "%API_URL%/api/stores/dialogues/update-all" ^
  -H "Authorization: Bearer %AUTH_TOKEN%" ^
  -H "Content-Type: application/json" ^
  -w "\n\nHTTP Status: %%{http_code}\nTime: %%{time_total}s\n" ^
  -s

echo.
echo End time: %time%
echo.
echo VAZHNO: Proverite konsol dev servera na nalichie oshibok 429/503!
echo.
goto MENU

:CHECK_RESULTS
echo.
echo [Proverka rezultatov sinhronizacii...]
echo.

REM Store 1: TwKRrPji2KhTS8TmYJlD
echo.
echo --- Store: Rating5 OPS (TwKRrPji2KhTS8TmYJlD) ---
curl -s -X GET "%API_URL%/api/stores/TwKRrPji2KhTS8TmYJlD" ^
  -H "Authorization: Bearer %AUTH_TOKEN%" | findstr /C:"totalChats" /C:"deletion_candidate" /C:"chatTagCounts"
echo.

REM Store 2: 0rCKlFCdrT7L3B2ios45
echo.
echo --- Store: IP Sokolov A.A. (0rCKlFCdrT7L3B2ios45) ---
curl -s -X GET "%API_URL%/api/stores/0rCKlFCdrT7L3B2ios45" ^
  -H "Authorization: Bearer %AUTH_TOKEN%" | findstr /C:"totalChats" /C:"deletion_candidate" /C:"chatTagCounts"
echo.

echo.
goto MENU

:RUN_ALL
echo.
echo [Vypolnenie polnoi proverki...]
echo.

call :CHECK_STORES
timeout /t 3 /nobreak >nul

echo.
set /p confirm="Prodolzhit s sinhronizaciei? (y/n): "
if /i not "%confirm%"=="y" goto MENU

call :START_SYNC
echo.
echo [Ozhidanie 10 sekund pered proverkoj rezultatov...]
timeout /t 10 /nobreak

call :CHECK_RESULTS

echo.
echo ========================================
echo   VAZHNO: Proverka na oshibki limitov
echo ========================================
echo.
echo Proveryte konsol dev servera na nalichie:
echo   - Error fetching WB events: 429 Too Many Requests
echo   - Error fetching WB chats: 503 Service Unavailable
echo   - [DIALOGUES] Chat xyz: Classification failed
echo.
echo Esli vidite oshibki 429/503, uvelichte zaderzhki v:
echo   - src/app/api/stores/[storeId]/dialogues/update/route.ts:107
echo   - src/app/api/stores/dialogues/update-all/route.ts:129
echo.

goto MENU

:EXIT
echo.
echo Vyhod...
exit /b 0
