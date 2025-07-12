#!/bin/bash

# 紧急防火墙修复脚本
# 用于恢复被锁定的SSH访问

echo "🚨 紧急防火墙修复脚本"
echo "用于恢复SSH访问权限"
echo "================================"

# 检测防火墙类型并修复
if command -v ufw &> /dev/null; then
    echo "🔧 修复UFW防火墙配置..."
    
    # 开放SSH端口
    sudo ufw allow ssh
    sudo ufw allow 22/tcp
    sudo ufw allow 2222/tcp  # 备用SSH端口
    
    # 开放常用端口
    sudo ufw allow 80/tcp   # HTTP
    sudo ufw allow 443/tcp  # HTTPS
    sudo ufw allow 3000/tcp # 邮件助手
    
    echo "✅ SSH访问已恢复"
    sudo ufw status
    
elif command -v firewall-cmd &> /dev/null; then
    echo "🔧 修复firewalld配置..."
    
    # 开放SSH端口
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --permanent --add-port=22/tcp
    sudo firewall-cmd --permanent --add-port=2222/tcp
    
    # 开放应用端口
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --permanent --add-port=3000/tcp
    
    sudo firewall-cmd --reload
    
    echo "✅ SSH访问已恢复"
    sudo firewall-cmd --list-all
    
elif command -v iptables &> /dev/null; then
    echo "🔧 修复iptables配置..."
    
    # 允许SSH
    sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 2222 -j ACCEPT
    
    # 允许应用端口
    sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    
    # 保存规则
    if command -v iptables-save &> /dev/null; then
        sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
    fi
    
    echo "✅ SSH访问已恢复"
    sudo iptables -L
    
else
    echo "⚠️  未检测到防火墙，可能不是防火墙问题"
fi

echo ""
echo "🔗 如果仍无法SSH访问，请尝试："
echo "1. 检查云服务商安全组设置"
echo "2. 重启服务器"
echo "3. 通过云控制台VNC访问"
echo "4. 临时关闭防火墙: sudo ufw disable"