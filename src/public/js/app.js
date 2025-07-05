// 全局应用状态
const app = {
    currentPage: 'dashboard',
    data: {
        users: [],
        systemStats: {},
        logs: [],
        settings: {}
    }
};

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
async function initializeApp() {
    setupNavigation();
    setupEventListeners();
    await loadSystemStatus();
    await loadDashboardData();
    
    // 定期刷新系统状态
    setInterval(loadSystemStatus, 30000); // 每30秒刷新一次
}

// 设置导航
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageName = this.dataset.page;
            switchPage(pageName);
        });
    });
}

// 页面切换
function switchPage(pageName) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // 更新页面内容
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // 更新页面标题
    const pageTitle = {
        'dashboard': '仪表板',
        'users': '用户管理',
        'system': '系统状态',
        'reports': '报告管理',
        'logs': '日志查看',
        'settings': '系统配置'
    };
    document.getElementById('page-title').textContent = pageTitle[pageName];
    
    app.currentPage = pageName;
    
    // 加载页面特定数据
    loadPageData(pageName);
}

// 加载页面数据
async function loadPageData(pageName) {
    switch(pageName) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'users':
            await loadUsersData();
            break;
        case 'system':
            await loadSystemData();
            break;
        case 'reports':
            await loadReportsData();
            break;
        case 'logs':
            await loadLogsData();
            break;
        case 'settings':
            await loadSettingsData();
            break;
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', function() {
        loadPageData(app.currentPage);
        showNotification('数据已刷新', 'success');
    });
    
    // 模态框关闭
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// 加载系统状态
async function loadSystemStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        const statusDot = document.getElementById('system-status');
        const statusText = document.getElementById('status-text');
        
        if (response.ok) {
            statusDot.className = 'status-dot online';
            statusText.textContent = '系统正常';
            updateHealthMetrics(data);
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = '系统异常';
        }
    } catch (error) {
        const statusDot = document.getElementById('system-status');
        const statusText = document.getElementById('status-text');
        statusDot.className = 'status-dot error';
        statusText.textContent = '连接失败';
        console.error('Failed to load system status:', error);
    }
}

// 更新健康指标
function updateHealthMetrics(data) {
    document.getElementById('api-status').textContent = '正常';
    document.getElementById('api-status').className = 'metric-value';
    
    document.getElementById('email-status').textContent = 
        data.emailReceiver?.connected ? '已连接' : '未连接';
    document.getElementById('email-status').className = 
        data.emailReceiver?.connected ? 'metric-value' : 'metric-value warning';
    
    document.getElementById('scheduler-status').textContent = '运行中';
    document.getElementById('scheduler-status').className = 'metric-value';
    
    document.getElementById('ai-status').textContent = '可用';
    document.getElementById('ai-status').className = 'metric-value';
}

// 加载仪表板数据
async function loadDashboardData() {
    try {
        // 模拟数据加载
        const stats = {
            totalUsers: 3,
            emailsSent: 12,
            reportsGenerated: 5,
            systemUptime: '2天 15小时'
        };
        
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('emails-sent').textContent = stats.emailsSent;
        document.getElementById('reports-generated').textContent = stats.reportsGenerated;
        document.getElementById('system-uptime').textContent = stats.systemUptime;
        
        app.data.systemStats = stats;
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('加载仪表板数据失败', 'error');
    }
}

// 加载用户数据
async function loadUsersData() {
    try {
        // 从用户管理API获取数据
        const users = [
            {
                id: 'admin',
                name: '管理员',
                email: 'admin@example.com',
                status: 'active',
                createdAt: '2025-01-01'
            },
            {
                id: 'user1',
                name: '张三',
                email: 'zhangsan@example.com',
                status: 'active',
                createdAt: '2025-01-02'
            }
        ];
        
        app.data.users = users;
        renderUsersTable(users);
    } catch (error) {
        console.error('Failed to load users data:', error);
        showNotification('加载用户数据失败', 'error');
    }
}

// 渲染用户表格
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无用户数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>
                <span class="badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}">
                    ${user.status === 'active' ? '活跃' : '非活跃'}
                </span>
            </td>
            <td>${user.createdAt}</td>
            <td>
                <button class="btn btn-outline" onclick="editUser('${user.id}')">编辑</button>
                <button class="btn btn-outline" onclick="deleteUser('${user.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

// 加载系统数据
async function loadSystemData() {
    try {
        const services = [
            { name: 'API服务', status: 'running', description: 'Express服务器运行正常' },
            { name: '邮件服务', status: 'running', description: 'SMTP/IMAP连接正常' },
            { name: '调度器', status: 'running', description: '定时任务正常执行' },
            { name: 'AI服务', status: 'running', description: 'AI接口响应正常' }
        ];
        
        const metrics = [
            { name: 'CPU使用率', value: '15%', status: 'normal' },
            { name: '内存使用', value: '256MB', status: 'normal' },
            { name: '磁盘空间', value: '2.1GB', status: 'normal' },
            { name: '网络延迟', value: '45ms', status: 'normal' }
        ];
        
        renderSystemServices(services);
        renderPerformanceMetrics(metrics);
    } catch (error) {
        console.error('Failed to load system data:', error);
        showNotification('加载系统数据失败', 'error');
    }
}

// 渲染系统服务
function renderSystemServices(services) {
    const container = document.getElementById('services-status');
    container.innerHTML = services.map(service => `
        <div class="service-item">
            <div>
                <div class="font-medium">${service.name}</div>
                <div class="text-sm text-gray-600">${service.description}</div>
            </div>
            <span class="badge ${service.status === 'running' ? 'badge-success' : 'badge-error'}">
                ${service.status === 'running' ? '运行中' : '停止'}
            </span>
        </div>
    `).join('');
}

// 渲染性能指标
function renderPerformanceMetrics(metrics) {
    const container = document.getElementById('performance-metrics');
    container.innerHTML = metrics.map(metric => `
        <div class="metric-item">
            <span class="font-medium">${metric.name}</span>
            <span class="metric-value ${metric.status === 'normal' ? '' : 'warning'}">${metric.value}</span>
        </div>
    `).join('');
}

// 加载报告数据
async function loadReportsData() {
    try {
        const reports = [
            {
                id: 1,
                type: 'weekly',
                title: '工作周报 - 2025年第1周',
                date: '2025-01-06',
                summary: '本周完成了邮件助手的核心功能开发...'
            },
            {
                id: 2,
                type: 'suggestions',
                title: '个性化建议报告',
                date: '2025-01-05',
                summary: '基于用户工作模式分析生成的个性化建议...'
            }
        ];
        
        renderReports(reports);
    } catch (error) {
        console.error('Failed to load reports data:', error);
        showNotification('加载报告数据失败', 'error');
    }
}

// 渲染报告列表
function renderReports(reports) {
    const container = document.getElementById('reports-list');
    
    if (reports.length === 0) {
        container.innerHTML = '<div class="loading">暂无报告数据</div>';
        return;
    }
    
    container.innerHTML = reports.map(report => `
        <div class="report-item" onclick="viewReport(${report.id})">
            <div class="report-header">
                <div class="report-title">${report.title}</div>
                <div class="report-date">${report.date}</div>
            </div>
            <div class="report-summary">${report.summary}</div>
        </div>
    `).join('');
}

// 加载日志数据
async function loadLogsData() {
    try {
        // 模拟日志数据
        const logs = [
            { timestamp: '2025-01-06 10:30:15', level: 'info', message: '系统启动完成' },
            { timestamp: '2025-01-06 10:31:22', level: 'info', message: '邮件服务初始化成功' },
            { timestamp: '2025-01-06 10:32:10', level: 'warn', message: 'AI服务响应较慢' },
            { timestamp: '2025-01-06 10:35:45', level: 'info', message: '周报生成任务完成' }
        ];
        
        renderLogs(logs);
    } catch (error) {
        console.error('Failed to load logs data:', error);
        showNotification('加载日志数据失败', 'error');
    }
}

// 渲染日志
function renderLogs(logs) {
    const container = document.getElementById('logs-container');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="loading">暂无日志数据</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-entry">
            <span class="log-timestamp">${log.timestamp}</span>
            <span class="log-level ${log.level}">[${log.level.toUpperCase()}]</span>
            ${log.message}
        </div>
    `).join('');
}

// 加载设置数据
async function loadSettingsData() {
    try {
        // 从配置API获取设置
        const settings = {
            email: {
                smtpHost: 'smtp.example.com',
                smtpPort: 587,
                emailUser: 'user@example.com'
            },
            ai: {
                provider: 'mock',
                model: 'gpt-3.5-turbo'
            }
        };
        
        app.data.settings = settings;
        populateSettingsForm(settings);
    } catch (error) {
        console.error('Failed to load settings data:', error);
        showNotification('加载配置数据失败', 'error');
    }
}

// 填充设置表单
function populateSettingsForm(settings) {
    document.getElementById('smtp-host').value = settings.email.smtpHost || '';
    document.getElementById('smtp-port').value = settings.email.smtpPort || '';
    document.getElementById('email-user').value = settings.email.emailUser || '';
    document.getElementById('ai-provider').value = settings.ai.provider || '';
    document.getElementById('ai-model').value = settings.ai.model || '';
}

// 测试功能函数
async function testMorningReminder() {
    showLoading('发送晨间提醒测试...');
    try {
        const response = await fetch('/test/morning-reminder', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            showNotification('晨间提醒测试发送成功', 'success');
        } else {
            showNotification('晨间提醒测试失败', 'error');
        }
    } catch (error) {
        showNotification('晨间提醒测试失败', 'error');
        console.error('Morning reminder test failed:', error);
    } finally {
        hideLoading();
    }
}

async function testEveningReminder() {
    showLoading('发送晚间提醒测试...');
    try {
        const response = await fetch('/test/evening-reminder', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            showNotification('晚间提醒测试发送成功', 'success');
        } else {
            showNotification('晚间提醒测试失败', 'error');
        }
    } catch (error) {
        showNotification('晚间提醒测试失败', 'error');
        console.error('Evening reminder test failed:', error);
    } finally {
        hideLoading();
    }
}

async function generateWeeklyReport() {
    showLoading('生成周报中...');
    try {
        const response = await fetch('/test/weekly-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'admin', weekOffset: 0 })
        });
        const result = await response.json();
        
        if (response.ok) {
            showNotification('周报生成成功', 'success');
            await loadReportsData(); // 刷新报告列表
        } else {
            showNotification('周报生成失败', 'error');
        }
    } catch (error) {
        showNotification('周报生成失败', 'error');
        console.error('Weekly report generation failed:', error);
    } finally {
        hideLoading();
    }
}

async function generateSuggestions() {
    showLoading('生成个性化建议中...');
    try {
        const response = await fetch('/test/personalized-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'admin' })
        });
        const result = await response.json();
        
        if (response.ok) {
            showNotification('个性化建议生成成功', 'success');
            await loadReportsData(); // 刷新报告列表
        } else {
            showNotification('个性化建议生成失败', 'error');
        }
    } catch (error) {
        showNotification('个性化建议生成失败', 'error');
        console.error('Suggestions generation failed:', error);
    } finally {
        hideLoading();
    }
}

// 生成报告
async function generateReports() {
    const reportType = document.getElementById('report-type').value;
    showLoading(`生成${reportType === 'weekly' ? '周报' : '个性化建议'}中...`);
    
    try {
        const endpoint = reportType === 'weekly' ? '/test/weekly-report' : '/test/personalized-suggestions';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'all' })
        });
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`${reportType === 'weekly' ? '周报' : '个性化建议'}生成成功`, 'success');
            await loadReportsData();
        } else {
            showNotification(`${reportType === 'weekly' ? '周报' : '个性化建议'}生成失败`, 'error');
        }
    } catch (error) {
        showNotification('报告生成失败', 'error');
        console.error('Report generation failed:', error);
    } finally {
        hideLoading();
    }
}

// 用户管理函数
function showAddUserModal() {
    showModal('add-user-modal');
}

function editUser(userId) {
    // 实现用户编辑功能
    showNotification('用户编辑功能开发中', 'info');
}

function deleteUser(userId) {
    if (confirm('确定要删除这个用户吗？')) {
        // 实现用户删除功能
        showNotification('用户删除功能开发中', 'info');
    }
}

async function addUser() {
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const timezone = document.getElementById('user-timezone').value;
    
    if (!name || !email) {
        showNotification('请填写完整的用户信息', 'warning');
        return;
    }
    
    showLoading('添加用户中...');
    try {
        // 这里应该调用添加用户的API
        await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
        
        showNotification('用户添加成功', 'success');
        closeModal('add-user-modal');
        document.getElementById('add-user-form').reset();
        await loadUsersData();
    } catch (error) {
        showNotification('用户添加失败', 'error');
        console.error('Add user failed:', error);
    } finally {
        hideLoading();
    }
}

// 设置保存函数
async function saveSettings() {
    const settings = {
        email: {
            smtpHost: document.getElementById('smtp-host').value,
            smtpPort: document.getElementById('smtp-port').value,
            emailUser: document.getElementById('email-user').value
        },
        ai: {
            provider: document.getElementById('ai-provider').value,
            model: document.getElementById('ai-model').value
        }
    };
    
    showLoading('保存配置中...');
    try {
        // 这里应该调用保存配置的API
        await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
        
        app.data.settings = settings;
        showNotification('配置保存成功', 'success');
    } catch (error) {
        showNotification('配置保存失败', 'error');
        console.error('Save settings failed:', error);
    } finally {
        hideLoading();
    }
}

// 日志刷新
async function refreshLogs() {
    await loadLogsData();
    showNotification('日志已刷新', 'success');
}

// 查看报告
function viewReport(reportId) {
    showNotification('报告查看功能开发中', 'info');
}

// 模态框控制
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 加载状态控制
function showLoading(message = '处理中...') {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('p').textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

// 通知系统
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="font-medium">${message}</div>
    `;
    
    container.appendChild(notification);
    
    // 自动移除通知
    setTimeout(() => {
        notification.remove();
    }, 5000);
}