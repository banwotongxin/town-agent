#!/bin/bash

# 赛博小镇启动脚本 (Linux/Mac)

echo "===================================="
echo "  赛博小镇 - Cyber Town"
echo "  多智能体社会模拟系统"
echo "===================================="
echo

# 检查Python是否安装
if ! command -v python3 &> /dev/null
then
    echo "[错误] 未找到Python3,请先安装Python 3.7+"
    exit 1
fi

echo "[1/3] 检查依赖..."
if ! pip3 show colorama &> /dev/null; then
    echo "正在安装依赖..."
    pip3 install -r requirements.txt
fi

echo
echo "[2/3] 选择运行模式:"
echo
echo "  1. 快速演示 (5个智能体, 20步)"
echo "  2. 标准模拟 (10个智能体, 50步)"
echo "  3. 大规模模拟 (25个智能体, 100步)"
echo "  4. 交互式模式"
echo "  5. 自定义模拟"
echo

read -p "请选择 [1-5]: " choice

echo
echo "[3/3] 启动赛博小镇..."
echo

case $choice in
    1)
        python3 -m cyber_town.main --mode quick
        ;;
    2)
        python3 -m cyber_town.main --mode standard
        ;;
    3)
        python3 -m cyber_town.main --mode large
        ;;
    4)
        python3 -m cyber_town.main --mode interactive
        ;;
    5)
        python3 -m cyber_town.main --mode custom
        ;;
    *)
        echo "无效选择,启动交互式菜单..."
        python3 -m cyber_town.main
        ;;
esac

echo
