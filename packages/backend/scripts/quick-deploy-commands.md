# Git部署方式 - 快速部署命令

## 🚀 在服务器上一键部署

### 方法1：完整自动部署
```bash
# 克隆项目到服务器
git clone https://github.com/your-username/email-assistant.git
cd email-assistant

# 一键部署
chmod +x scripts/server-deploy.sh && ./scripts/server-deploy.sh
```

### 方法2：手动步骤部署
```bash
# 1. 克隆项目
git clone https://github.com/your-username/email-assistant.git
cd email-assistant

# 2. 安装依赖
npm install

# 3. 编译项目
npm run build

# 4. 配置环境（首次部署需要）
cp .env.production .env
nano .env  # 编辑配置文件

# 5. 配置防火墙
chmod +x scripts/configure-firewall.sh
sudo ./scripts/configure-firewall.sh 3000

# 6. 启动服务
npm start
# 或者后台运行
nohup npm start > server.log 2>&1 &
```

## 🔄 更新部署
```bash
cd email-assistant
git pull origin main
npm install  # 如果有新依赖
npm run build
sudo systemctl restart email-assistant  # 如果使用了系统服务
```

## 📋 必要配置项

### .env 文件最小配置
```env
# 邮件配置
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
USER_EMAIL=your-email@gmail.com
USER_NAME=Your Name

# AI配置
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
```

## 🔧 端口和访问
- 默认端口：3000
- 本地访问：http://localhost:3000
- 远程访问：http://YOUR_SERVER_IP:3000

## ⚠️ 重要提醒
1. 确保服务器安装了Node.js 16+
2. 配置防火墙开放端口3000
3. 云服务器需在安全组开放端口3000
4. 首次部署必须配置.env文件