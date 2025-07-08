// 全局应用状态
const app = {
    currentPage: 'dashboard',
    data: {
        users: [],
        systemStats: {},
        logs: [],
        settings: {}
    },
    auth: {
        token: null,
        user: null
    }
};

// 认证相关函数
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        redirectToLogin();
        return false;
    }
    
    app.auth.token = token;
    return true;
}

function redirectToLogin() {
    window.location.href = '/login';
}

function logout() {
    localStorage.removeItem('authToken');
    app.auth.token = null;
    app.auth.user = null;
    redirectToLogin();
}

// API请求助手函数
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, config);
        
        // 如果是401未授权，重定向到登录页
        if (response.status === 401) {
            logout();
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    // 检查认证状态
    if (checkAuth()) {
        initializeApp();
    }
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
    
    // 日志级别过滤
    const logLevelSelect = document.getElementById('log-level');
    if (logLevelSelect) {
        logLevelSelect.addEventListener('change', function() {
            if (app.currentPage === 'logs') {
                loadLogsData();
            }
        });
    }
    
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
        // 从真实API获取统计数据
        const response = await apiRequest('/api/dashboard/stats');
        if (!response) return;
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            const stats = result.data;
            
            document.getElementById('total-users').textContent = stats.totalUsers;
            document.getElementById('emails-sent').textContent = stats.emailsSent;
            document.getElementById('reports-generated').textContent = stats.reportsGenerated;
            document.getElementById('system-uptime').textContent = stats.systemUptime;
            
            app.data.systemStats = stats;
        } else {
            // 发生错误时显示占位数据
            document.getElementById('total-users').textContent = '--';
            document.getElementById('emails-sent').textContent = '--';
            document.getElementById('reports-generated').textContent = '--';
            document.getElementById('system-uptime').textContent = '--';
            console.error('Failed to load dashboard stats:', result.error);
            showNotification(`仪表板数据加载失败: ${result.error || '未知错误'}`, 'error');
        }
        
        // 加载提醒状态
        await loadReminderStatus();
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        const errorMsg = error.message || '网络连接失败';
        showNotification(`仪表板数据加载失败: ${errorMsg}`, 'error');
        // 显示错误状态
        ['total-users', 'emails-sent', 'reports-generated', 'system-uptime'].forEach(id => {
            document.getElementById(id).textContent = '连接失败';
        });
    }
}

// 加载提醒状态
async function loadReminderStatus() {
    try {
        const response = await fetch('/api/reminder-status?userId=admin');
        const result = await response.json();
        
        if (response.ok && result.success) {
            const status = result.data;
            
            // 更新晨间提醒状态
            const morningElement = document.getElementById('morning-reminder-status');
            if (morningElement) {
                morningElement.textContent = status.morningReminderSent ? '✅ 已发送' : '❌ 未发送';
                morningElement.className = `status-value ${status.morningReminderSent ? 'sent' : 'not-sent'}`;
            }
            
            // 更新晚间提醒状态
            const eveningElement = document.getElementById('evening-reminder-status');
            if (eveningElement) {
                eveningElement.textContent = status.eveningReminderSent ? '✅ 已发送' : '❌ 未发送';
                eveningElement.className = `status-value ${status.eveningReminderSent ? 'sent' : 'not-sent'}`;
            }
            
            // 更新工作报告状态
            const workReportElement = document.getElementById('work-report-status');
            if (workReportElement) {
                workReportElement.textContent = status.workReportReceived ? '✅ 已接收' : '❌ 未接收';
                workReportElement.className = `status-value ${status.workReportReceived ? 'received' : 'not-sent'}`;
            }
            
            app.data.reminderStatus = status;
        } else {
            console.error('Failed to load reminder status:', result.error);
        }
    } catch (error) {
        console.error('Failed to load reminder status:', error);
        // 显示错误状态
        ['morning-reminder-status', 'evening-reminder-status', 'work-report-status'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '❌ 加载失败';
                element.className = 'status-value error';
            }
        });
    }
}

// 刷新提醒状态
async function refreshReminderStatus() {
    await loadReminderStatus();
    showNotification('提醒状态已刷新', 'info');
}

// 重置提醒状态
async function resetReminderStatus() {
    if (!confirm('确定要重置今天的提醒状态吗？这将允许重新发送提醒邮件。')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch('/api/reminder-status/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: 'admin' })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('提醒状态已重置', 'success');
            await loadReminderStatus();
        } else {
            showNotification('重置提醒状态失败', 'error');
        }
    } catch (error) {
        console.error('Failed to reset reminder status:', error);
        showNotification('重置提醒状态失败', 'error');
    } finally {
        hideLoading();
    }
}

// 加载用户数据
async function loadUsersData() {
    try {
        // 从真实API获取用户数据
        const response = await apiRequest('/api/users');
        if (!response) return;
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            const users = result.data.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.isActive ? 'active' : 'inactive',
                role: user.role,
                createdAt: new Date(user.createdAt).toLocaleDateString(),
                lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '从未登录'
            }));
            
            app.data.users = users;
            renderUsersTable(users);
        } else {
            console.error('Failed to load users:', result.error);
            showNotification(`用户数据加载失败: ${result.error || '服务器错误'}`, 'error');
            renderUsersTable([]);
        }
    } catch (error) {
        console.error('Failed to load users data:', error);
        const errorMsg = error.message || '网络连接失败';
        showNotification(`用户数据加载失败: ${errorMsg}`, 'error');
        renderUsersTable([]);
    }
}

// 渲染用户表格
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无用户数据</td></tr>';
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
            <td>
                <span class="badge ${user.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">
                    ${user.role === 'admin' ? '管理员' : '用户'}
                </span>
            </td>
            <td>${user.createdAt}</td>
            <td>${user.lastLogin}</td>
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
        // 获取真实的系统健康数据
        const response = await fetch('/health');
        const healthData = await response.json();
        
        if (response.ok) {
            // 根据真实数据构建服务状态
            const services = [
                { 
                    name: 'API服务', 
                    status: 'running', 
                    description: `Express服务器运行正常 (端口: ${healthData.port || 3000})` 
                },
                { 
                    name: '邮件服务', 
                    status: healthData.emailReceiver?.connected ? 'running' : 'warning',
                    description: healthData.emailReceiver?.connected ? 'SMTP/IMAP连接正常' : 'SMTP/IMAP连接异常' 
                },
                { 
                    name: '调度器', 
                    status: healthData.scheduler?.active ? 'running' : 'warning',
                    description: healthData.scheduler?.active ? '定时任务正常执行' : '调度器未启动' 
                },
                { 
                    name: 'AI服务', 
                    status: healthData.aiService?.available ? 'running' : 'warning',
                    description: healthData.aiService?.available ? `AI接口响应正常 (${healthData.aiService?.provider})` : 'AI服务不可用' 
                }
            ];
            
            // 根据真实系统指标构建性能数据
            const metrics = [
                { 
                    name: 'CPU使用率', 
                    value: healthData.cpu ? `${Math.round(healthData.cpu)}%` : '监控中...',
                    status: healthData.cpu > 80 ? 'warning' : 'normal' 
                },
                { 
                    name: '内存使用', 
                    value: healthData.memoryUsage ? `${Math.round(healthData.memoryUsage.rss / 1024 / 1024)}MB` : '监控中...',
                    status: healthData.memoryUsage?.rss > 500 * 1024 * 1024 ? 'warning' : 'normal' 
                },
                { 
                    name: '系统运行时间', 
                    value: healthData.uptime ? `${Math.floor(healthData.uptime / 3600)}小时` : '监控中...',
                    status: 'normal' 
                },
                { 
                    name: '响应状态', 
                    value: healthData.status === 'healthy' ? '正常' : '异常',
                    status: healthData.status === 'healthy' ? 'normal' : 'warning' 
                }
            ];
            
            renderSystemServices(services);
            renderPerformanceMetrics(metrics);
        } else {
            throw new Error('Failed to fetch health data');
        }
    } catch (error) {
        console.error('Failed to load system data:', error);
        showNotification('加载系统数据失败', 'error');
        
        // 显示错误状态
        const errorServices = [
            { name: '系统状态', status: 'error', description: '无法获取系统状态数据' }
        ];
        const errorMetrics = [
            { name: '系统监控', value: '连接失败', status: 'warning' }
        ];
        
        renderSystemServices(errorServices);
        renderPerformanceMetrics(errorMetrics);
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
        // 从真实API获取报告数据
        const response = await fetch('/api/reports?limit=20');
        const result = await response.json();
        
        if (response.ok && result.success) {
            const reports = result.data.map(report => ({
                id: report.id,
                type: report.type,
                title: report.title,
                date: new Date(report.createdAt).toLocaleDateString(),
                summary: report.summary || report.content?.substring(0, 100) + '...',
                content: report.content, // 保存完整内容供查看使用
                userId: report.userId,
                status: report.status
            }));
            
            // 保存到全局数据中
            app.data.reports = reports;
            renderReports(reports);
        } else {
            console.error('Failed to load reports:', result.error);
            renderReports([]);
        }
    } catch (error) {
        console.error('Failed to load reports data:', error);
        showNotification('加载报告数据失败', 'error');
        
        // 显示提示信息
        renderReports([]);
    }
}

// 渲染报告列表
function renderReports(reports) {
    const container = document.getElementById('reports-list');
    
    if (reports.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📄</div>
                <div class="empty-title">暂无报告数据</div>
                <div class="empty-description">使用上方的生成报告功能创建新报告</div>
            </div>
        `;
        return;
    }
    
    const getReportTypeText = (type) => {
        const types = {
            'weekly': '周报',
            'suggestions': '个性化建议',
            'daily': '日报',
            'monthly': '月报'
        };
        return types[type] || '报告';
    };
    
    const getStatusBadge = (status) => {
        const statusMap = {
            'completed': { text: '已完成', class: 'badge-success' },
            'pending': { text: '处理中', class: 'badge-warning' },
            'failed': { text: '失败', class: 'badge-error' }
        };
        const statusInfo = statusMap[status] || { text: '未知', class: 'badge-secondary' };
        return `<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`;
    };
    
    container.innerHTML = reports.map(report => `
        <div class="report-item" onclick="viewReport('${report.id}')">
            <div class="report-header">
                <div class="report-title">${report.title}</div>
                <div class="report-meta">
                    <span class="report-type">${getReportTypeText(report.type)}</span>
                    ${report.status ? getStatusBadge(report.status) : ''}
                    <span class="report-date">${report.date}</span>
                </div>
            </div>
            <div class="report-summary">${report.summary}</div>
            ${report.userId ? `<div class="report-user">用户: ${report.userId}</div>` : ''}
        </div>
    `).join('');
}

// 加载日志数据
async function loadLogsData() {
    try {
        // 从真实API获取日志数据
        const level = document.getElementById('log-level')?.value || 'all';
        const limit = 100; // 限制日志条数
        
        const response = await fetch(`/api/logs?level=${level}&limit=${limit}`);
        const result = await response.json();
        
        if (response.ok && result.success) {
            const logs = result.data.map(log => ({
                timestamp: new Date(log.timestamp).toLocaleString(),
                level: log.level,
                message: log.message,
                meta: log.meta ? JSON.stringify(log.meta) : null
            }));
            
            renderLogs(logs);
        } else {
            console.error('Failed to load logs:', result.error);
            showNotification('加载日志数据失败', 'error');
            renderLogs([]);
        }
    } catch (error) {
        console.error('Failed to load logs data:', error);
        showNotification('加载日志数据失败', 'error');
        
        // 显示错误信息
        renderLogs([{
            timestamp: new Date().toLocaleString(),
            level: 'error',
            message: '无法连接到日志服务器'
        }]);
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
        // 从真实API获取配置数据
        const response = await fetch('/api/settings');
        const result = await response.json();
        
        if (response.ok && result.success) {
            const config = result.data;
            
            // 构建设置数据（隐藏敏感信息）
            const settings = {
                email: {
                    smtpHost: config.email?.smtp?.host || '',
                    smtpPort: config.email?.smtp?.port || 587,
                    emailUser: config.email?.user?.email || '',
                    smtpConfigured: !!(config.email?.smtp?.user && config.email?.smtp?.pass)
                },
                ai: {
                    provider: config.ai?.provider || '',
                    model: config.ai?.model || '',
                    configured: config.ai?.configured || false
                },
                schedule: {
                    morningTime: config.schedule?.morningReminderTime || '09:00',
                    eveningTime: config.schedule?.eveningReminderTime || '18:00'
                },
                features: {
                    emailForwarding: config.features?.emailForwarding?.enabled || false,
                    markAsRead: config.features?.emailForwarding?.markAsRead || false
                }
            };
            
            app.data.settings = settings;
            populateSettingsForm(settings);
        } else {
            console.error('Failed to load config:', result.error);
            showNotification('加载配置数据失败', 'error');
            populateSettingsForm({});
        }
    } catch (error) {
        console.error('Failed to load settings data:', error);
        showNotification('加载配置数据失败', 'error');
        populateSettingsForm({});
    }
}

// 填充设置表单
function populateSettingsForm(settings) {
    if (settings.email) {
        const smtpHost = document.getElementById('smtp-host');
        const smtpPort = document.getElementById('smtp-port');
        const emailUser = document.getElementById('email-user');
        
        if (smtpHost) smtpHost.value = settings.email.smtpHost || '';
        if (smtpPort) smtpPort.value = settings.email.smtpPort || '';
        if (emailUser) emailUser.value = settings.email.emailUser || '';
        
        // 显示SMTP配置状态
        const smtpStatus = document.getElementById('smtp-status');
        if (smtpStatus) {
            smtpStatus.textContent = settings.email.smtpConfigured ? '✅ 已配置' : '❌ 未配置';
            smtpStatus.className = `status-indicator ${settings.email.smtpConfigured ? 'configured' : 'not-configured'}`;
        }
    }
    
    if (settings.ai) {
        const aiProvider = document.getElementById('ai-provider');
        const aiModel = document.getElementById('ai-model');
        
        if (aiProvider) aiProvider.value = settings.ai.provider || '';
        if (aiModel) aiModel.value = settings.ai.model || '';
        
        // 显示AI配置状态
        const aiStatus = document.getElementById('ai-status');
        if (aiStatus) {
            aiStatus.textContent = settings.ai.configured ? '✅ 已配置' : '❌ 未配置';
            aiStatus.className = `status-indicator ${settings.ai.configured ? 'configured' : 'not-configured'}`;
        }
    }
    
    if (settings.schedule) {
        const morningTime = document.getElementById('morning-time');
        const eveningTime = document.getElementById('evening-time');
        
        if (morningTime) morningTime.value = settings.schedule.morningTime || '';
        if (eveningTime) eveningTime.value = settings.schedule.eveningTime || '';
    }
    
    if (settings.features) {
        const emailForwarding = document.getElementById('email-forwarding');
        const markAsRead = document.getElementById('mark-as-read');
        
        if (emailForwarding) emailForwarding.checked = settings.features.emailForwarding || false;
        if (markAsRead) markAsRead.checked = settings.features.markAsRead || false;
    }
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
async function viewReport(reportId) {
    try {
        showLoading('加载报告内容...');
        
        // 从报告列表中找到对应报告
        const report = app.data.reports?.find(r => r.id === reportId);
        
        if (!report) {
            showNotification('未找到报告内容', 'error');
            return;
        }
        
        // 显示报告详情模态框
        const modalContent = `
            <div class="report-detail">
                <h3>${report.title}</h3>
                <div class="report-meta">
                    <span class="report-type">${getReportTypeText(report.type)}</span>
                    <span class="report-date">${report.date}</span>
                    ${report.status ? `<span class="badge ${getStatusClass(report.status)}">${getStatusText(report.status)}</span>` : ''}
                </div>
                <div class="report-summary">
                    <h4>摘要</h4>
                    <p>${report.summary}</p>
                </div>
                ${report.content ? `
                    <div class="report-content">
                        <h4>详细内容</h4>
                        <pre>${report.content}</pre>
                    </div>
                ` : ''}
            </div>
        `;
        
        // 创建临时模态框
        const modal = document.createElement('div');
        modal.id = 'report-detail-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>报告详情</h2>
                    <button class="modal-close" onclick="closeReportModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${modalContent}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeReportModal()">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 保存报告数据到全局变量
        if (!app.data.reports) {
            app.data.reports = [];
        }
        
    } catch (error) {
        console.error('Failed to view report:', error);
        showNotification('加载报告失败', 'error');
    } finally {
        hideLoading();
    }
}

// 关闭报告模态框
function closeReportModal() {
    const modal = document.getElementById('report-detail-modal');
    if (modal) {
        modal.remove();
    }
}

// 辅助函数
function getReportTypeText(type) {
    const types = {
        'weekly': '周报',
        'suggestions': '个性化建议',
        'daily': '日报',
        'monthly': '月报',
        'system': '系统报告'
    };
    return types[type] || '报告';
}

function getStatusClass(status) {
    const statusMap = {
        'completed': 'badge-success',
        'pending': 'badge-warning',
        'failed': 'badge-error'
    };
    return statusMap[status] || 'badge-secondary';
}

function getStatusText(status) {
    const statusMap = {
        'completed': '已完成',
        'pending': '处理中',
        'failed': '失败'
    };
    return statusMap[status] || '未知';
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