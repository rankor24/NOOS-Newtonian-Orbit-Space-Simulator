@echo off
setlocal
title NOSS Dev Server

REM Always run from this file's folder, even if game folder was moved.
cd /d "%~dp0"

echo NOSS dev launcher
echo Folder: %cd%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm not found. Install Node.js first:
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist package.json (
  echo ERROR: package.json not found in this folder.
  echo Put this launcher in the game project root.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo node_modules missing. Running npm install once...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Starting dev server...
echo Open URL shown below, usually http://localhost:3000/
echo.
call npm run dev

echo.
echo Dev server stopped.
pause
