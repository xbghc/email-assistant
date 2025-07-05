# 部署故障排除指南

## 🔧 修复"dirname: missing operand"和"npm: command not found"错误

### 问题描述
部署脚本报错：
```
dirname: missing operand
npm: command not found
❌ 依赖安装失败！
```

### 解决方案

#### 1. 使用环境检查工具
在运行部署脚本前，先检查环境：

```bash
# 给环境检查脚本执行权限
chmod +x scripts/check-environment.sh

# 运行环境检查
./scripts/check-environment.sh
```

#### 2. 手动安装Node.js和npm
如果环境检查发现缺少Node.js或npm：

**Ubuntu/Debian系统：**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL系统：**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs npm
```

#### 3. 验证安装
```bash
node --version
npm --version
which node
which npm
```

#### 4. 重新运行部署
```bash
./scripts/server-deploy.sh
```

### 已修复的问题

1. **dirname错误**：修复了空变量导致的dirname命令错误
2. **npm路径检测**：增加了多个常见npm安装路径的检测
3. **PATH环境变量**：自动添加常见Node.js安装路径到PATH
4. **自动安装**：支持Ubuntu/Debian/CentOS/RHEL系统的自动Node.js安装

### 部署成功标志

部署成功后您会看到：
```
✅ 服务启动成功！
🎉 部署完成！
📱 Web管理界面访问地址：
   本地访问: http://localhost:3000
   远程访问: http://YOUR_SERVER_IP:3000
```

### 常用管理命令

```bash
# 查看服务状态
sudo systemctl status email-assistant

# 查看实时日志
sudo journalctl -u email-assistant -f

# 重启服务
sudo systemctl restart email-assistant

# 更新部署
git pull && ./scripts/server-deploy.sh
```

### 需要帮助？

如果仍有问题，请：
1. 运行环境检查工具：`./scripts/check-environment.sh`
2. 查看详细日志：`sudo journalctl -u email-assistant -n 50`
3. 检查配置文件：`cat .env`