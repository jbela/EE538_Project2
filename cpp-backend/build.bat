@echo off
setlocal

where cl >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] MSVC cl not found. Use Developer Command Prompt or build with CMake.
  exit /b 1
)

cl /EHsc /std:c++17 main.cpp /Fe:server.exe
if %errorlevel% neq 0 exit /b %errorlevel%

echo Build successful: server.exe
