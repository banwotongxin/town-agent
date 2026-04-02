@echo off
chcp 65001
echo 清理端口5000的占用进程...

:: 查找占用端口5000的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo 发现进程 %%a 占用端口5000
    taskkill /F /PID %%a
)

echo 清理完成！
pause
