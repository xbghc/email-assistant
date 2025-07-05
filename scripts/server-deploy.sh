#!/bin/bash

# 邮件助手服务器端部署脚本（用于Git部署方式）

SERVICE_NAME="email-assistant"
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)
NODE_EXECUTABLE=$(which node)
NODE_PATH=$(dirname $NODE_EXECUTABLE)

echo "🚀 开始服务器端部署..."
echo "👤 当前用户: $CURRENT_USER"
echo "📂 项目目录: $PROJECT_DIR"
echo "🟢 Node.js路径: $NODE_EXECUTABLE"

# 检查必要条件
if [ ! -f "package.json" ]; then
    echo "❌ 未找到 package.json，请确保在项目根目录运行"
    exit 1
fi

if [ ! command -v node &> /dev/null ]; then
    echo "❌ 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

if [ ! command -v npm &> /dev/null ]; then
    echo "❌ 未找到 npm，请先安装 npm"
    exit 1
fi

# 1. 安装依赖
echo "📦 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败！"
    exit 1
fi

# 2. 编译TypeScript
echo "🔨 编译TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 编译失败！"
    exit 1
fi

# 3. 检查配置文件
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在"
    if [ -f ".env.production" ]; then
        echo "📋 从 .env.production 创建 .env..."
        cp .env.production .env
        echo "📝 请编辑 .env 文件并配置您的邮件和AI设置"
        echo "配置完成后重新运行此脚本"
        exit 1
    else
        echo "❌ 未找到配置文件模板"
        exit 1
    fi
fi

# 4. 验证配置
echo "🔍 验证配置..."
if ! grep -q "SMTP_USER=" .env || ! grep -q "AI_PROVIDER=" .env; then
    echo "⚠️  配置文件可能未完整设置，请检查 .env 文件"
    echo "必须配置邮件设置和AI提供商"
fi

# 5. 配置系统服务
echo "⚙️  配置系统服务..."

# 创建服务文件
SERVICE_FILE="/tmp/email-assistant.service"
cp scripts/email-assistant.service.template $SERVICE_FILE

# 替换占位符
sed -i "s|USER_PLACEHOLDER|$CURRENT_USER|g" $SERVICE_FILE
sed -i "s|PROJECT_DIR_PLACEHOLDER|$PROJECT_DIR|g" $SERVICE_FILE
sed -i "s|NODE_PATH_PLACEHOLDER|$NODE_PATH|g" $SERVICE_FILE
sed -i "s|NODE_EXECUTABLE_PLACEHOLDER|$NODE_EXECUTABLE|g" $SERVICE_FILE

# 安装服务文件
sudo cp $SERVICE_FILE /etc/systemd/system/email-assistant.service
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME

# 清理临时文件
rm $SERVICE_FILE

# 6. 配置防火墙
echo "🔥 配置防火墙..."
if [ -f "scripts/configure-firewall.sh" ]; then
    chmod +x scripts/configure-firewall.sh
    ./scripts/configure-firewall.sh 3000
else
    echo "⚠️  防火墙配置脚本未找到，请手动开放端口3000"
    echo "Ubuntu/Debian: sudo ufw allow 3000"
    echo "CentOS/RHEL: sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload"
fi

# 7. 启动服务
echo "🎯 启动服务..."
sudo systemctl restart $SERVICE_NAME

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 8. 检查服务状态
echo "📊 检查服务状态..."
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ 服务启动成功！"
    sudo systemctl status $SERVICE_NAME --no-pager -l
else
    echo "❌ 服务启动失败！"
    echo "查看错误日志:"
    sudo journalctl -u $SERVICE_NAME -n 20 --no-pager
    exit 1
fi

# 9. 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "获取失败")

# 10. 显示访问信息
echo ""
echo "🎉 部署完成！"
echo "================================"
echo "📱 Web管理界面访问地址："
echo "   本地访问: http://localhost:3000"
if [ "$SERVER_IP" != "获取失败" ]; then
    echo "   远程访问: http://$SERVER_IP:3000"
else
    echo "   远程访问: http://YOUR_SERVER_IP:3000"
fi
echo ""
echo "🔧 常用管理命令："
echo "   查看日志: sudo journalctl -u $SERVICE_NAME -f"
echo "   重启服务: sudo systemctl restart $SERVICE_NAME"
echo "   停止服务: sudo systemctl stop $SERVICE_NAME"
echo "   查看状态: sudo systemctl status $SERVICE_NAME"
echo ""
echo "🔄 更新部署："
echo "   git pull && ./scripts/server-deploy.sh"
echo ""
echo "⚠️  重要提醒："
echo "1. 请确保 .env 文件已正确配置邮件和AI设置"
echo "2. 如果使用云服务器，请在云控制台开放端口 3000"
echo "3. 建议配置域名和SSL证书以提高安全性"