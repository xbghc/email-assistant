#!/bin/bash

# Email Assistant 增强型自动化部署脚本
# 使用方法: ./scripts/deploy.sh [production|staging|development]

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 原有邮件助手服务器部署脚本逻辑

# 检测当前目录或使用默认目录
if [ -f "package.json" ] && [ -d "dist" ]; then
    PROJECT_DIR=$(pwd)
    echo "📁 使用当前目录: $PROJECT_DIR"
else
    PROJECT_DIR="/opt/email-assistant"
    echo "📁 使用默认目录: $PROJECT_DIR"
    if [ ! -d "$PROJECT_DIR" ]; then
        echo "❌ 项目目录不存在: $PROJECT_DIR"
        echo "请确保项目已正确上传到服务器"
        exit 1
    fi
    cd $PROJECT_DIR
fi

SERVICE_NAME="email-assistant"
CURRENT_USER=$(whoami)

echo "🚀 开始部署邮件助手服务器..."
echo "👤 当前用户: $CURRENT_USER"
echo "📂 项目目录: $PROJECT_DIR"

# 1. 安装依赖（如果未安装）
if [ ! -d "node_modules" ]; then
    echo "📦 安装Node.js依赖..."
    npm install --production
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败！"
        exit 1
    fi
else
    echo "✅ Node.js依赖已存在"
fi

# 检查是否已编译（部署包应该已包含dist目录）
if [ ! -d "dist" ]; then
    echo "❌ 未找到编译后的文件！"
    echo "请确保部署包包含 dist 目录"
    exit 1
else
    echo "✅ 编译文件已存在"
fi

# 2. 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，从模板创建..."
    cp .env.production .env
    echo "📝 请编辑 .env 文件并配置您的邮件和AI设置"
    echo "配置完成后重新运行此脚本"
    exit 1
fi

# 3. 配置系统服务
echo "⚙️  配置系统服务..."
sudo cp scripts/email-assistant.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

# 4. 配置防火墙
echo "🔥 配置防火墙..."
./scripts/configure-firewall.sh 3000

# 5. 启动服务
echo "🎯 启动服务..."
sudo systemctl restart $SERVICE_NAME

# 6. 检查服务状态
echo "📊 检查服务状态..."
sleep 3
sudo systemctl status $SERVICE_NAME --no-pager

# 7. 显示访问信息
echo ""
echo "✅ 部署完成！"
echo ""
echo "📱 Web管理界面访问地址："
echo "   本地访问: http://localhost:3000"
echo "   远程访问: http://$(curl -s ifconfig.me):3000"
echo ""
echo "🔧 常用命令："
echo "   查看日志: sudo journalctl -u $SERVICE_NAME -f"
echo "   重启服务: sudo systemctl restart $SERVICE_NAME"
echo "   停止服务: sudo systemctl stop $SERVICE_NAME"
echo "   查看状态: sudo systemctl status $SERVICE_NAME"
echo ""
echo "⚠️  重要提醒："
echo "1. 请确保已正确配置 .env 文件中的邮件和AI设置"
echo "2. 如果使用云服务器，请在云控制台开放端口 3000"
echo "3. 建议配置域名和SSL证书以提高安全性"