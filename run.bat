@echo off
REM 赛博小镇启动脚本 (Windows)

echo ====================================
echo   赛博小镇 - Cyber Town

echo   多智能体社会模拟系统

echo ====================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到Python,请先安装Python 3.7+
    pause
    exit /b 1
)

echo [1/3] 检查依赖...
pip show colorama >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r requirements.txt
)

echo.
echo [2/3] 选择运行模式:
echo.
echo   1. 快速演示 (5个智能体, 20步)
echo   2. 标准模拟 (10个智能体, 50步)
echo   3. 大规模模拟 (25个智能体, 100步)
echo   4. 交互式模式
echo   5. 自定义模拟
echo.

set /p choice="请选择 [1-5]: "

echo.
echo [3/3] 启动赛博小镇...
echo.

if "%choice%"=="1" (
    python main.py --mode quick
) else if "%choice%"=="2" (
    python main.py --mode standard
) else if "%choice%"=="3" (
    python main.py --mode large
) else if "%choice%"=="4" (
    python main.py --mode interactive
) else if "%choice%"=="5" (
    python main.py --mode custom
) else (
    echo 无效选择,启动交互式菜单...
    python main.py
)

echo.
pause
