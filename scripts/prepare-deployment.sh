#!/bin/bash

# 邮件助手项目部署准备脚本
# 用于在本地准备部署包

PROJECT_NAME="email-assistant"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="${PROJECT_NAME}_${TIMESTAMP}.tar.gz"

echo "📦 准备项目部署包..."

# 编译项目
echo "🔨 编译TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 编译失败！"
    exit 1
fi

# 创建部署目录
DEPLOY_DIR="deploy_package"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

echo "📁 复制必要文件..."

# 复制编译后的文件
cp -r dist $DEPLOY_DIR/

# 复制配置文件
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp .env.production $DEPLOY_DIR/.env.template

# 复制脚本文件
cp -r scripts $DEPLOY_DIR/

# 复制静态资源（Web界面）
cp -r src/public $DEPLOY_DIR/

# 复制数据目录结构（空目录）
mkdir -p $DEPLOY_DIR/data
echo "# 数据目录，程序运行时会自动创建文件" > $DEPLOY_DIR/data/README.md

# 创建部署说明文件
cat > $DEPLOY_DIR/DEPLOYMENT_GUIDE.md << 'EOF'
# 邮件助手服务器部署指南

## 环境要求
- Node.js 16+ 
- npm
- Linux服务器（推荐 Ubuntu 20.04+）

## 部署步骤

### 1. 上传文件到服务器
将整个部署包上传到服务器，例如：
```bash
scp -r email-assistant_* user@your-server:/opt/
```

### 2. 在服务器上解压并安装
```bash
cd /opt/email-assistant_*
npm install --production
```

### 3. 配置环境
```bash
# 复制配置模板
cp .env.template .env

# 编辑配置文件
nano .env
```
**重要：必须配置邮件账号和AI API密钥！**

### 4. 运行部署脚本
```bash
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

### 5. 访问Web界面
- 本地访问: http://localhost:3000
- 远程访问: http://YOUR_SERVER_IP:3000

## 配置说明

### 邮件配置
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
```

### AI配置（选择一个）
```env
# OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key

# 或 DeepSeek
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-api-key

# 或 其他支持的AI提供商
```

## 管理命令
```bash
# 查看服务状态
sudo systemctl status email-assistant

# 查看日志
sudo journalctl -u email-assistant -f

# 重启服务
sudo systemctl restart email-assistant

# 停止服务
sudo systemctl stop email-assistant
```

## 故障排除
1. 检查端口3000是否开放
2. 检查防火墙设置
3. 确认配置文件正确
4. 查看系统日志
EOF

# 创建打包文件
echo "📦 创建部署包..."
tar -czf $PACKAGE_NAME $DEPLOY_DIR/

# 清理临时目录
rm -rf $DEPLOY_DIR

echo "✅ 部署包准备完成！"
echo "📁 文件名: $PACKAGE_NAME"
echo "📊 文件大小: $(du -h $PACKAGE_NAME | cut -f1)"
echo ""
echo "📋 下一步操作："
echo "1. 将 $PACKAGE_NAME 上传到服务器"
echo "2. 在服务器上解压: tar -xzf $PACKAGE_NAME"
echo "3. 进入目录并运行部署脚本"
echo ""
echo "📤 上传命令示例："
echo "scp $PACKAGE_NAME user@your-server:/opt/"