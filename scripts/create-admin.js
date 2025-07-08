#!/usr/bin/env node

/**
 * 创建管理员账户脚本
 * 
 * 使用方法：
 * node scripts/create-admin.js <email> <password>
 * 
 * 示例：
 * node scripts/create-admin.js admin@example.com mypassword123
 */

 

const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// 获取命令行参数
const [,, email, password] = process.argv;

if (!email || !password) {
    console.error('用法: node scripts/create-admin.js <email> <password>');
    console.error('示例: node scripts/create-admin.js admin@example.com mypassword123');
    process.exit(1);
}

// 验证邮箱格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
    console.error('错误: 邮箱格式不正确');
    process.exit(1);
}

// 验证密码强度
if (password.length < 6) {
    console.error('错误: 密码长度至少需要6位');
    process.exit(1);
}

async function createAdmin() {
    try {
        console.log('🔐 正在创建管理员账户...');
        
        const usersFilePath = path.join(process.cwd(), 'users.json');
        
        // 检查是否已存在用户文件
        let users = [];
        try {
            const data = await fs.readFile(usersFilePath, 'utf-8');
            users = JSON.parse(data);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('读取用户文件失败:', error.message);
                process.exit(1);
            }
            console.log('📝 创建新的用户文件');
        }
        
        // 检查邮箱是否已存在
        const existingUser = users.find(user => user.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            console.error(`❌ 邮箱 ${email} 已被使用`);
            process.exit(1);
        }
        
        // 加密密码
        console.log('🔒 正在加密密码...');
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // 创建管理员用户
        const adminUser = {
            id: uuidv4(),
            email: email,
            name: 'Administrator',
            role: 'admin',
            password: hashedPassword,
            isActive: true,
            emailVerified: true,
            config: {
                schedule: {
                    morningReminderTime: '09:00',
                    eveningReminderTime: '18:00',
                    timezone: 'Asia/Shanghai'
                },
                language: 'zh'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 添加到用户列表
        users.push(adminUser);
        
        // 保存到文件
        console.log('💾 正在保存用户信息...');
        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
        
        console.log('✅ 管理员账户创建成功！');
        console.log('');
        console.log('账户信息:');
        console.log(`📧 邮箱: ${email}`);
        console.log(`🔑 密码: ${password}`);
        console.log(`👤 用户ID: ${adminUser.id}`);
        console.log(`🛡️  角色: ${adminUser.role}`);
        console.log('');
        console.log('🌐 现在您可以使用这些凭据登录管理界面:');
        console.log('   http://localhost:3000/login');
        console.log('');
        console.log('⚠️  请妥善保管您的登录凭据，建议首次登录后修改密码');
        
    } catch (error) {
        console.error('❌ 创建管理员账户失败:', error.message);
        process.exit(1);
    }
}

// 运行脚本
createAdmin();