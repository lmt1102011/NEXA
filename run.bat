@echo off
chcp 65001 >nul 2>nul
title NEXA - Setup ^& Run
cd /d "%~dp0"

echo ==========================================
echo    NEXA - Tu setup va chay dev server
echo ==========================================
echo.

rem --- Neu server dang chay san thi chi mo trinh duyet ---
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 1) | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo [OK] Server da chay san tai http://localhost:5173
  start "" http://localhost:5173
  pause
  exit /b 0
)

rem --- Kiem tra Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js tren may.
  echo       Dang mo trang tai Node.js... hay cai roi chay lai file nay.
  start "" https://nodejs.org
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_V=%%v
echo [OK] Node.js %NODE_V%

rem --- Cai dat phu thuoc neu chua co ---
if not exist "node_modules" (
  echo [..] Lan dau chay - dang cai dat phu thuoc, vui long cho 30 giay den 2 phut...
  call npm install
  if errorlevel 1 (
    echo [LOI] npm install that bai - kiem tra mang roi chay lai.
    pause
    exit /b 1
  )
  echo [OK] Cai dat xong.
) else (
  echo [OK] node_modules da co - bo qua cai dat.
)
echo.

rem --- Chay dev server trong cua so rieng ---
echo [..] Dang khoi dong dev server...
start "NEXA dev server" cmd /k "npm run dev"

rem --- Doi server len port 5173 (toi da 25s) ---
set /a TRY=0
:wait
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 1) | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto ready
set /a TRY+=1
if %TRY% LSS 25 goto wait
echo [CANH BAO] Chua kich duoc port 5173 - hay xem cua so "NEXA dev server" co bao loi gi khong.
goto open

:ready
echo [OK] Server chay tai http://localhost:5173
:open
start "" http://localhost:5173

echo.
echo  - Chay trinh duyet: http://localhost:5173
echo  - Mo 2 tab trinh duyet de test host duyet guest (realtime giua 2 tab)
echo  - Dung server: dong cua so "NEXA dev server" (Ctrl+C trong do)
echo.
pause
