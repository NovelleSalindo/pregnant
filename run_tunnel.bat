@echo off
title PregnaCare Public Cloudflare Tunnel
echo ========================================================
echo   PREGNACARE INTERNET ACCESS TUNNEL (Cloudflare)
echo ========================================================
echo Connecting your local Apache server (port 80) to the internet...
echo Keep this window open so people on other Wi-Fi can connect!
echo.
"%TEMP%\cloudflared.exe" tunnel --url http://localhost:80
pause
