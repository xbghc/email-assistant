#!/bin/bash

# 邮件助手服务器端部署脚本（用于Git部署方式）

SERVICE_NAME="email-assistant"
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)

echo "🚀 开始服务器端部署..."
echo "👤 当前用户: $CURRENT_USER"
echo "📂 项目目录: $PROJECT_DIR"

# 尝试找到 Node.js 和 npm
echo "🔍 检查 Node.js 和 npm 环境..."

# 常见的 Node.js 路径
POSSIBLE_PATHS="/usr/bin:/usr/local/bin:/opt/node/bin:$HOME/.nvm/versions/node/*/bin:/snap/bin"
export PATH="$PATH:$POSSIBLE_PATHS"

# 检查 Node.js
NODE_EXECUTABLE=$(which node 2>/dev/null || echo "")
if [ -z "$NODE_EXECUTABLE" ]; then
    # 手动查找常见位置
    for path in /usr/bin/node /usr/local/bin/node /opt/node/bin/node; do
        if [ -x "$path" ]; then
            NODE_EXECUTABLE="$path"
            break
        fi
    done
fi

# 检查 npm
NPM_EXECUTABLE=$(which npm 2>/dev/null || echo "")
if [ -z "$NPM_EXECUTABLE" ]; then
    # 手动查找常见位置
    for path in /usr/bin/npm /usr/local/bin/npm /opt/node/bin/npm; do
        if [ -x "$path" ]; then
            NPM_EXECUTABLE="$path"
            break
        fi
    done
fi

echo "🟢 Node.js路径: ${NODE_EXECUTABLE:-未找到}"
echo "🟢 npm路径: ${NPM_EXECUTABLE:-未找到}"

# 检查必要条件
if [ ! -f "package.json" ]; then
    echo "❌ 未找到 package.json，请确保在项目根目录运行"
    exit 1
fi

# 检查 Node.js 和 npm 是否可用
if [ -z "$NODE_EXECUTABLE" ]; then
    echo "⚠️  未找到 Node.js，正在安装..."
    
    # 检测操作系统并安装Node.js
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        echo "检测到Ubuntu/Debian系统，安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        echo "检测到CentOS/RHEL系统，安装Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs npm
    elif command -v dnf &> /dev/null; then
        # Fedora
        echo "检测到Fedora系统，安装Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs npm
    else
        echo "❌ 无法自动安装Node.js，请手动安装："
        echo "   https://nodejs.org/en/download/"
        exit 1
    fi
    
    # 重新检查安装
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js安装失败，请手动安装"
        exit 1
    fi
fi

if [ -z "$NPM_EXECUTABLE" ]; then
    echo "❌ 未找到npm，但Node.js已安装。尝试重新安装npm..."
    
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y npm
    elif command -v yum &> /dev/null; then
        sudo yum install -y nodejs-npm
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y npm
    fi
    
    # 重新检查npm
    NPM_EXECUTABLE=$(which npm 2>/dev/null || echo "")
    if [ -z "$NPM_EXECUTABLE" ]; then
        for path in /usr/bin/npm /usr/local/bin/npm /opt/node/bin/npm; do
            if [ -x "$path" ]; then
                NPM_EXECUTABLE="$path"
                break
            fi
        done
    fi
    
    if [ -z "$NPM_EXECUTABLE" ]; then
        echo "❌ npm安装失败，请手动安装"
        exit 1
    fi
fi

# 更新路径信息
if [ -n "$NODE_EXECUTABLE" ]; then
    NODE_PATH=$(dirname "$NODE_EXECUTABLE")
else
    NODE_PATH="/usr/bin"
fi

echo "✅ Node.js版本: $($NODE_EXECUTABLE --version)"
echo "✅ npm版本: $($NPM_EXECUTABLE --version)"

# 1. 安装依赖
echo "📦 安装依赖..."
$NPM_EXECUTABLE install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败！"
    exit 1
fi

# 2. 编译TypeScript
echo "🔨 编译TypeScript..."
$NPM_EXECUTABLE run build
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