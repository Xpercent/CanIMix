@echo off
setlocal
chcp 65001 >nul
title Generate item asset manifest

set "ART=%~dp0"
set "ART=%ART:~0,-1%"
set "ITEMS=%ART%\..\src\assets\items"

if not exist "%ITEMS%\" (
  echo [ERROR] Item folder not found:
  echo         %ITEMS%
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root=[IO.Path]::GetFullPath($env:ITEMS); $files=@(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Extension -match '^\.(svg|png|jpe?g|webp|gif)$' } | Sort-Object FullName | ForEach-Object { $_.FullName.Substring($root.Length+1).Replace('\','/') }); $utf8=New-Object System.Text.UTF8Encoding $false; [IO.File]::WriteAllLines((Join-Path $env:ART 'items.txt'), $files, $utf8); $lines=@($files | ForEach-Object { '  ' + ($_ | ConvertTo-Json) }); $js='window.ITEM_FILES = [' + [Environment]::NewLine + ($lines -join (',' + [Environment]::NewLine)) + [Environment]::NewLine + '];' + [Environment]::NewLine; [IO.File]::WriteAllText((Join-Path $env:ART 'items.js'), $js, (New-Object System.Text.UTF8Encoding $true)); Write-Host ('Generated items.txt / items.js: ' + $files.Count + ' files.')"

if errorlevel 1 (
  echo [ERROR] Failed to generate manifest. Check that PowerShell is available.
  pause
  exit /b 1
)

echo.
echo Output : %ART%\items.txt
echo Output : %ART%\items.js
echo Preview: %ART%\items.html
echo.
pause