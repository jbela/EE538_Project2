@echo off
cd /d %~dp0\backend
if not exist node_modules (
  echo Installing backend deps...
  npm install
)
echo Starting demo backend at http://localhost:3000 ...
node server.js
