#!/bin/bash

# 环境检查脚本 - 在部署前运行以检查服务器环境

echo "🔍 邮件助手环境检查工具"
echo "================================"

# 基本信息
echo "📋 系统信息:"
echo "   操作系统: $(uname -s)"
echo "   架构: $(uname -m)"
echo "   当前用户: $(whoami)"
echo "   当前目录: $(pwd)"
echo ""

# 检查 Node.js
echo "🟢 Node.js 检查:"
NODE_PATHS="/usr/bin/node /usr/local/bin/node /opt/node/bin/node $HOME/.nvm/versions/node/*/bin/node"
NODE_FOUND=false

for path in $NODE_PATHS; do
    if [ -x "$path" ]; then
        echo "   ✅ 找到 Node.js: $path"
        echo "   版本: $($path --version)"
        NODE_FOUND=true
        NODE_EXECUTABLE="$path"
        break
    fi
done

if [ "$NODE_FOUND" = false ]; then
    echo "   ❌ 未找到 Node.js"
    echo "   📥 安装建议:"
    if command -v apt-get &> /dev/null; then
        echo "      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "      sudo apt-get install -y nodejs"
    elif command -v yum &> /dev/null; then
        echo "      curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
        echo "      sudo yum install -y nodejs npm"
    fi
fi
echo ""

# 检查 npm
echo "📦 npm 检查:"
NPM_PATHS="/usr/bin/npm /usr/local/bin/npm /opt/node/bin/npm"
NPM_FOUND=false

for path in $NPM_PATHS; do
    if [ -x "$path" ]; then
        echo "   ✅ 找到 npm: $path"
        echo "   版本: $($path --version)"
        NPM_FOUND=true
        break
    fi
done

if [ "$NPM_FOUND" = false ]; then
    echo "   ❌ 未找到 npm"
    echo "   📥 安装建议:"
    if command -v apt-get &> /dev/null; then
        echo "      sudo apt-get install -y npm"
    elif command -v yum &> /dev/null; then
        echo "      sudo yum install -y nodejs-npm"
    fi
fi
echo ""

# 检查 Git
echo "🌐 Git 检查:"
if command -v git &> /dev/null; then
    echo "   ✅ Git 已安装: $(git --version)"
else
    echo "   ❌ 未找到 Git"
    echo "   📥 安装建议:"
    if command -v apt-get &> /dev/null; then
        echo "      sudo apt-get install -y git"
    elif command -v yum &> /dev/null; then
        echo "      sudo yum install -y git"
    fi
fi
echo ""

# 检查权限
echo "🔐 权限检查:"
if [ "$EUID" -eq 0 ]; then
    echo "   ⚠️  当前以 root 用户运行"
    echo "   建议创建普通用户运行应用"
else
    echo "   ✅ 当前用户: $(whoami)"
    if groups | grep -q sudo; then
        echo "   ✅ 具有 sudo 权限"
    else
        echo "   ⚠️  当前用户没有 sudo 权限"
        echo "   部署脚本可能需要 sudo 权限配置系统服务"
    fi
fi
echo ""

# 检查端口
echo "🌐 端口检查:"
if command -v netstat &> /dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":3000 "; then
        echo "   ⚠️  端口 3000 已被占用"
        echo "   占用进程: $(netstat -tlnp 2>/dev/null | grep ":3000 " | awk '{print $7}')"
    else
        echo "   ✅ 端口 3000 可用"
    fi
else
    echo "   ℹ️  无法检查端口状态 (未安装 netstat)"
fi
echo ""

# 检查防火墙
echo "🔥 防火墙检查:"
if command -v ufw &> /dev/null; then
    echo "   检测到 UFW 防火墙"
    if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        echo "   ⚠️  UFW 防火墙已启用，需要开放端口 3000"
        echo "   命令: sudo ufw allow 3000"
    else
        echo "   ✅ UFW 防火墙未启用"
    fi
elif command -v firewall-cmd &> /dev/null; then
    echo "   检测到 firewalld 防火墙"
    echo "   可能需要开放端口: sudo firewall-cmd --permanent --add-port=3000/tcp"
elif command -v iptables &> /dev/null; then
    echo "   检测到 iptables 防火墙"
    echo "   可能需要开放端口: sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT"
else
    echo "   ℹ️  未检测到防火墙或无法检查"
fi
echo ""

# 检查项目文件
echo "📁 项目文件检查:"
if [ -f "package.json" ]; then
    echo "   ✅ 找到 package.json"
else
    echo "   ❌ 未找到 package.json"
    echo "   请确保在项目根目录运行"
fi

if [ -f "scripts/server-deploy.sh" ]; then
    echo "   ✅ 找到部署脚本"
else
    echo "   ❌ 未找到部署脚本"
fi

if [ -f ".env" ]; then
    echo "   ✅ 找到配置文件 .env"
elif [ -f ".env.production" ]; then
    echo "   ⚠️  找到 .env.production 模板，需要复制为 .env"
    echo "   命令: cp .env.production .env"
else
    echo "   ❌ 未找到配置文件"
fi
echo ""

# 总结
echo "📊 检查总结:"
if [ "$NODE_FOUND" = true ] && [ "$NPM_FOUND" = true ]; then
    echo "   ✅ 基础环境就绪，可以运行部署脚本"
    echo "   💡 下一步: ./scripts/server-deploy.sh"
else
    echo "   ❌ 环境不完整，请先安装缺失的组件"
    echo "   💡 下一步: 安装 Node.js 和 npm"
fi
echo ""
echo "🔗 更多帮助: 查看 DEPLOYMENT.md 文档"