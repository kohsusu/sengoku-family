@echo off
chcp 65001 >nul
title 戰國家族記 — 手機/平板連線
echo.
echo   ============================================
echo    《戰國家族記》 手機・平板 連線伺服器
echo   ============================================
echo.
echo   請確認手機與這台電腦連到「同一個 Wi-Fi」。
echo.
echo   手機瀏覽器請輸入下列網址其中之一:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo        http://%%b:5877
)
echo.
echo   ============================================
echo   ※ 若手機連不上,多半是 Windows 防火牆擋住:
echo      控制台 - Windows Defender 防火牆 -
echo      允許應用程式 - 勾選 Python 的「私人網路」
echo.
echo   ※ 關閉此視窗即停止伺服器。
echo   ============================================
echo.
cd /d "%~dp0"
python -m http.server 5877 --bind 0.0.0.0
pause
