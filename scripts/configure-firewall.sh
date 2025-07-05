#!/bin/bash

# 邮件助手服务器防火墙配置脚本
# 用于开放Web管理界面的远程访问端口

PORT=${1:-3000}

echo "🔧 配置防火墙以开放端口 $PORT..."

# 检测操作系统和防火墙类型
if command -v ufw &> /dev/null; then
    echo "检测到 UFW 防火墙"
    
    # 启用防火墙（如果未启用）
    sudo ufw --force enable
    
    # 开放端口
    sudo ufw allow $PORT/tcp
    
    # 显示状态
    sudo ufw status
    
elif command -v firewall-cmd &> /dev/null; then
    echo "检测到 firewalld 防火墙"
    
    # 开放端口
    sudo firewall-cmd --permanent --add-port=$PORT/tcp
    sudo firewall-cmd --reload
    
    # 显示状态
    sudo firewall-cmd --list-ports
    
elif command -v iptables &> /dev/null; then
    echo "检测到 iptables 防火墙"
    
    # 开放端口
    sudo iptables -A INPUT -p tcp --dport $PORT -j ACCEPT
    
    # 保存规则（根据系统而定）
    if command -v iptables-save &> /dev/null; then
        sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
    
    # 显示状态
    sudo iptables -L
    
else
    echo "⚠️  未检测到已知的防火墙工具"
    echo "请手动配置防火墙开放端口 $PORT"
fi

echo ""
echo "✅ 防火墙配置完成！"
echo "📱 Web管理界面将在以下地址可用："
echo "   本地访问: http://localhost:$PORT"
echo "   远程访问: http://YOUR_SERVER_IP:$PORT"
echo ""
echo "⚠️  注意事项："
echo "1. 请将 YOUR_SERVER_IP 替换为服务器的实际IP地址"
echo "2. 确保云服务商的安全组也开放了端口 $PORT"
echo "3. 考虑使用反向代理（如Nginx）和SSL证书提高安全性"