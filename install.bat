@echo off
setlocal enabledelayedexpansion
title Fear ^& Hunger - AI Companion Mod Installer
color 0B

echo ===============================================================
echo    Fear ^& Hunger - AI Companion Mod Installer (Windows)
echo ===============================================================
echo.

set "SCRIPT_DIR=%~dp0"

:: Check required files
if not exist "%SCRIPT_DIR%plugins\AI_Companion.js" (
    echo [ERROR] plugins\AI_Companion.js not found!
    echo Make sure you're running this from the mod directory.
    pause
    exit /b 1
)

echo [1] Install mod
echo [2] Uninstall mod
echo [3] Exit
echo.
set /p CHOICE="Choose an option [1-3]: "

if "%CHOICE%"=="3" exit /b 0
if "%CHOICE%"=="2" goto :uninstall

:: ── Auto-detect game path ──────────────────────
echo.
echo Searching for Fear ^& Hunger...

set "GAME_PATH="

:: Check common Steam paths
for %%D in (
    "C:\Program Files (x86)\Steam\steamapps\common\Fear & Hunger"
    "C:\Program Files (x86)\Steam\steamapps\common\Fear and Hunger"
    "D:\SteamLibrary\steamapps\common\Fear & Hunger"
    "D:\SteamLibrary\steamapps\common\Fear and Hunger"
    "E:\SteamLibrary\steamapps\common\Fear & Hunger"
    "E:\SteamLibrary\steamapps\common\Fear and Hunger"
    "C:\Games\Fear & Hunger"
) do (
    if exist "%%~D\www\js\plugins" (
        set "GAME_PATH=%%~D"
        goto :found
    )
)

:: Check GOG paths
for %%D in (
    "C:\GOG Games\Fear & Hunger"
    "C:\Program Files\GOG Galaxy\Games\Fear & Hunger"
) do (
    if exist "%%~D\www\js\plugins" (
        set "GAME_PATH=%%~D"
        goto :found
    )
)

goto :notfound

:found
echo [OK] Found game at: %GAME_PATH%
set /p "CONFIRM=Use this path? [Y/n]: "
if /i "%CONFIRM%"=="n" goto :notfound
goto :install

:notfound
echo.
echo Could not auto-detect game path.
echo Enter the full path to your Fear ^& Hunger installation:
echo Example: C:\Program Files (x86)\Steam\steamapps\common\Fear ^& Hunger
echo.
set /p "GAME_PATH=Game path: "

:: Validate
if not exist "%GAME_PATH%\www\js\plugins" (
    echo [ERROR] Invalid path - www\js\plugins not found!
    pause
    exit /b 1
)

:install
echo.
echo Installing to: %GAME_PATH%
echo.

:: Backup plugins.js
if not exist "%GAME_PATH%\www\js\plugins.js.bak" (
    copy "%GAME_PATH%\www\js\plugins.js" "%GAME_PATH%\www\js\plugins.js.bak" >nul
    echo [OK] Backed up plugins.js
) else (
    echo [SKIP] Backup already exists
)

:: Copy plugins
copy /y "%SCRIPT_DIR%plugins\AI_Companion.js" "%GAME_PATH%\www\js\plugins\" >nul
echo [OK] Copied AI_Companion.js

copy /y "%SCRIPT_DIR%plugins\FearHungerKB.js" "%GAME_PATH%\www\js\plugins\" >nul
echo [OK] Copied FearHungerKB.js

:: Copy face assets
if exist "%SCRIPT_DIR%assets\faces" (
    copy /y "%SCRIPT_DIR%assets\faces\*.png" "%GAME_PATH%\www\img\faces\" >nul 2>nul
    echo [OK] Copied face assets
)

:: Check if plugins already registered
findstr /c:"FearHungerKB" "%GAME_PATH%\www\js\plugins.js" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SKIP] Plugins already registered
) else (
    echo [INFO] You need to manually add the plugins to plugins.js:
    echo        Open: %GAME_PATH%\www\js\plugins.js
    echo        Add before the closing ']':
    echo        ,{"name":"FearHungerKB","status":true,"description":"KB","parameters":{}}
    echo        ,{"name":"AI_Companion","status":true,"description":"AI","parameters":{"companionActorId":"15"}}
)

echo.
echo ===============================================================
echo    Installation complete!
echo ===============================================================
echo.
echo Next steps:
echo   1. Launch Fear ^& Hunger
echo   2. Press F5 to open AI Companion settings
echo   3. Enter your API key (get free at https://console.groq.com)
echo   4. Press C in-game to chat
echo.
pause
exit /b 0

:uninstall
echo.
set /p "GAME_PATH=Enter game path to uninstall from: "

if exist "%GAME_PATH%\www\js\plugins\AI_Companion.js" (
    del "%GAME_PATH%\www\js\plugins\AI_Companion.js"
    echo [OK] Removed AI_Companion.js
)
if exist "%GAME_PATH%\www\js\plugins\FearHungerKB.js" (
    del "%GAME_PATH%\www\js\plugins\FearHungerKB.js"
    echo [OK] Removed FearHungerKB.js
)
if exist "%GAME_PATH%\www\js\plugins.js.bak" (
    copy /y "%GAME_PATH%\www\js\plugins.js.bak" "%GAME_PATH%\www\js\plugins.js" >nul
    echo [OK] Restored plugins.js from backup
)
echo [OK] Uninstall complete
pause
exit /b 0
