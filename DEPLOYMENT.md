# 邮件助手服务器部署指南

## 📋 部署方式说明

本项目支持通过Git克隆到服务器，然后在服务器上构建和运行。

## 🔧 环境要求

### 服务器环境
- Ubuntu 18.04+ / CentOS 7+ / Debian 10+
- Node.js 16.0+ 
- npm 或 yarn
- Git
- sudo权限（用于配置系统服务）

### 必要的外部服务
- 邮箱账号（支持SMTP/IMAP，如Gmail、QQ邮箱等）
- AI API密钥（OpenAI、DeepSeek、Google Gemini等）

## 🚀 部署步骤

### 1. 克隆项目到服务器

```bash
# 克隆项目
git clone https://github.com/your-username/email-assistant.git
cd email-assistant

# 或者如果已有项目，更新代码
git pull origin main
```

### 2. 运行自动部署脚本

```bash
# 给脚本执行权限
chmod +x scripts/server-deploy.sh

# 运行部署脚本
./scripts/server-deploy.sh
```

脚本会自动完成：
- 安装Node.js依赖
- 编译TypeScript代码
- 创建配置文件模板
- 配置系统服务
- 配置防火墙
- 启动服务

### 3. 配置环境变量

如果是首次部署，脚本会提示您配置环境变量：

```bash
# 编辑配置文件
nano .env
```

**必须配置的项目：**

```env
# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

USER_EMAIL=your-email@gmail.com
USER_NAME=Your Name

# AI配置（选择一个）
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
```

配置完成后重新运行部署：
```bash
./scripts/server-deploy.sh
```

### 4. 验证部署

部署成功后，您可以通过以下方式访问：

- **本地访问**: http://localhost:3000
- **远程访问**: http://YOUR_SERVER_IP:3000

## 🔄 更新部署

当有代码更新时：

```bash
cd email-assistant
git pull origin main
./scripts/server-deploy.sh
```

## 🔧 管理命令

```bash
# 查看服务状态
sudo systemctl status email-assistant

# 查看实时日志
sudo journalctl -u email-assistant -f

# 重启服务
sudo systemctl restart email-assistant

# 停止服务
sudo systemctl stop email-assistant

# 启动服务
sudo systemctl start email-assistant

# 禁用自启动
sudo systemctl disable email-assistant
```

## 🌐 远程访问配置

### 防火墙配置
部署脚本会自动配置防火墙，如需手动配置：

```bash
# Ubuntu/Debian
sudo ufw allow 3000
sudo ufw status

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

### 云服务器安全组
如果使用云服务器（阿里云、腾讯云、AWS等），还需要在云控制台配置安全组：
- 开放入方向端口：3000
- 协议：TCP
- 源：0.0.0.0/0（或指定IP段）

## 🔐 安全建议

### 1. 使用反向代理（推荐）
```bash
# 安装Nginx
sudo apt update
sudo apt install nginx

# 复制Nginx配置
sudo cp scripts/nginx-email-assistant.conf /etc/nginx/sites-available/email-assistant
sudo ln -s /etc/nginx/sites-available/email-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. 配置SSL证书
建议使用Let's Encrypt免费SSL证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 修改默认端口
如需修改端口，编辑 `.env` 文件：
```env
PORT=8080
```

## 📝 配置说明

### 邮件配置详解
- **Gmail**: 需要启用"应用专用密码"
- **QQ邮箱**: 需要开启SMTP/IMAP服务并获取授权码
- **企业邮箱**: 联系管理员获取SMTP/IMAP配置

### AI提供商配置
支持多个AI提供商，任选其一：
- OpenAI (ChatGPT)
- DeepSeek
- Google Gemini
- Anthropic Claude
- Azure OpenAI

### 时间配置
```env
MORNING_REMINDER_TIME=08:00
EVENING_REMINDER_TIME=20:00
```

## 🔍 故障排除

### 1. 服务无法启动
```bash
# 查看详细错误信息
sudo journalctl -u email-assistant -n 50

# 检查配置文件
cat .env

# 手动测试启动
node dist/index.js
```

### 2. 无法远程访问
- 检查防火墙设置
- 检查云服务器安全组
- 确认服务绑定到 0.0.0.0:3000

### 3. 邮件功能异常
- 检查邮箱配置是否正确
- 确认邮箱已开启SMTP/IMAP
- 查看邮件服务日志

### 4. AI功能异常
- 检查API密钥是否正确
- 确认网络可以访问AI服务
- 查看AI服务调用日志

## 📞 支持

如遇到问题，请查看：
1. 项目日志：`sudo journalctl -u email-assistant -f`
2. 系统日志：`dmesg | tail`
3. 网络连接：`netstat -tlnp | grep 3000`

## 🎯 功能特性

部署完成后，您将获得：
- 📧 智能邮件助手
- 🕐 定时提醒功能
- 📊 周报生成
- 🎯 个性化建议
- 🌐 Web管理界面
- 🚫 重复邮件防护
- ⏸️ 提醒取消和暂停功能