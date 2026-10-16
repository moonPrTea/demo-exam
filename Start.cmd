@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm is missing. Reinstall Node.js from nodejs.org.
  pause
  exit /b 1
)
node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 12)) process.exit(1)"
if errorlevel 1 (
  echo Node.js 22.12 or newer is required.
  pause
  exit /b 1
)
if not exist node_modules\electron\dist\electron.exe goto install
if not exist node_modules\typescript\bin\tsc goto install
goto start
:install
  echo Installing dependencies. Internet access is required for this first step.
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
:start
call npm start
if errorlevel 1 pause
