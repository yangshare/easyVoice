@echo off
setlocal enabledelayedexpansion

:: NOTE: This file MUST be saved as UTF-8 (without BOM) with CRLF line endings.
:: The `chcp 65001` below switches the console to UTF-8 at runtime, so the
:: Chinese text below displays correctly regardless of the system default code
:: page (GBK/936 or UTF-8/65001). Do NOT add a BOM -- cmd.exe chokes on it.

chcp 65001 >nul

echo ====================================
echo easyVoice - 发版脚本
echo ====================================
echo.

:: 从 package.json 读取当前版本号，作为默认值
set "current_version="
for /f "tokens=2 delims=:," %%a in ('findstr /b /c:"  \"version\":" package.json') do (
    set "current_version=%%~a"
)
set "current_version=!current_version: =!"
set "current_version=!current_version:"=!"

if not "!current_version!"=="" (
    echo 当前 package.json 版本: !current_version!
    set /p version="请输入版本号（直接回车使用 !current_version!，如 0.0.15）: "
) else (
    set /p version="请输入版本号（如 0.0.15）: "
)

if "!version!"=="" (
    if not "!current_version!"=="" (
        set "version=!current_version!"
    ) else (
        echo 错误：版本号不能为空
        pause
        exit /b 1
    )
)

echo.
echo 准备发布版本: v!version!
echo.

:: 检查 tag 是否已存在
git rev-parse -q --verify "refs/tags/v!version!" >nul 2>&1
if not errorlevel 1 (
    echo 错误：tag v!version! 已存在
    pause
    exit /b 1
)

git tag v!version!
if errorlevel 1 (
    echo 错误：创建 Git Tag 失败
    pause
    exit /b 1
)

echo Git Tag v!version! 创建成功
echo.

git push origin v!version!
if errorlevel 1 (
    echo 错误：推送 Tag 到远程仓库失败
    pause
    exit /b 1
)

echo.
echo ====================================
echo 发布成功！版本 v!version! 已推送到远程仓库
echo GitHub Actions 将自动构建镜像并推送到 Docker Hub
echo ====================================
pause