#!/bin/bash

# Email Assistant 健康检查脚本
# 用于监控应用程序的运行状态

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}
TIMEOUT=${TIMEOUT:-10}
MAX_RETRIES=${MAX_RETRIES:-3}

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# 健康检查函数
check_process() {
    log_info "检查进程状态..."
    
    if pgrep -f "node.*email-assistant" > /dev/null; then
        log_success "应用进程正在运行"
        return 0
    else
        log_error "应用进程未运行"
        return 1
    fi
}

check_port() {
    local port=${1:-3000}
    log_info "检查端口 $port..."
    
    if netstat -ln | grep -q ":$port "; then
        log_success "端口 $port 正在监听"
        return 0
    else
        log_error "端口 $port 未监听"
        return 1
    fi
}

check_api_health() {
    log_info "检查API健康状态..."
    
    local response
    local status_code
    
    for ((i=1; i<=MAX_RETRIES; i++)); do
        if response=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT" "$API_BASE_URL/health" 2>/dev/null); then
            status_code=$(echo "$response" | tail -n1)
            body=$(echo "$response" | head -n -1)
            
            if [ "$status_code" = "200" ]; then
                log_success "API健康检查通过 (HTTP $status_code)"
                echo "    响应: $body"
                return 0
            else
                log_warning "API返回异常状态码: $status_code (尝试 $i/$MAX_RETRIES)"
            fi
        else
            log_warning "API请求失败 (尝试 $i/$MAX_RETRIES)"
        fi
        
        if [ $i -lt $MAX_RETRIES ]; then
            sleep 2
        fi
    done
    
    log_error "API健康检查失败"
    return 1
}

check_memory_usage() {
    log_info "检查内存使用情况..."
    
    local pid=$(pgrep -f "node.*email-assistant" | head -1)
    if [ -n "$pid" ]; then
        local memory_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
        if [ -n "$memory_kb" ]; then
            local memory_mb=$((memory_kb / 1024))
            log_success "进程内存使用: ${memory_mb}MB"
            
            # 检查是否超过阈值 (500MB)
            if [ "$memory_mb" -gt 500 ]; then
                log_warning "内存使用过高: ${memory_mb}MB > 500MB"
                return 1
            fi
        else
            log_error "无法获取内存使用信息"
            return 1
        fi
    else
        log_error "找不到应用进程"
        return 1
    fi
}

check_disk_space() {
    log_info "检查磁盘空间..."
    
    local usage=$(df . | awk 'NR==2 {print $5}' | sed 's/%//')
    log_success "磁盘使用率: ${usage}%"
    
    if [ "$usage" -gt 90 ]; then
        log_error "磁盘空间不足: ${usage}% > 90%"
        return 1
    elif [ "$usage" -gt 80 ]; then
        log_warning "磁盘空间偏低: ${usage}% > 80%"
    fi
}

check_log_files() {
    log_info "检查日志文件..."
    
    local log_dir="./logs"
    if [ -d "$log_dir" ]; then
        local error_count=$(find "$log_dir" -name "*.log" -mtime -1 -exec grep -l "ERROR" {} \; | wc -l)
        if [ "$error_count" -gt 0 ]; then
            log_warning "发现 $error_count 个日志文件包含ERROR"
        else
            log_success "最近24小时无ERROR日志"
        fi
    else
        log_warning "日志目录不存在: $log_dir"
    fi
}

check_database_files() {
    log_info "检查数据文件..."
    
    local data_dir="./data"
    if [ -d "$data_dir" ]; then
        local required_files=("users.json" "schedule.json")
        local missing_files=()
        
        for file in "${required_files[@]}"; do
            if [ ! -f "$data_dir/$file" ]; then
                missing_files+=("$file")
            fi
        done
        
        if [ ${#missing_files[@]} -eq 0 ]; then
            log_success "所有必要数据文件存在"
        else
            log_error "缺少数据文件: ${missing_files[*]}"
            return 1
        fi
    else
        log_error "数据目录不存在: $data_dir"
        return 1
    fi
}

# 生成健康报告
generate_report() {
    local overall_status=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo "=================================================================="
    echo "                    Email Assistant 健康报告"
    echo "=================================================================="
    echo "检查时间: $timestamp"
    echo "服务地址: $API_BASE_URL"
    echo ""
    
    if [ "$overall_status" -eq 0 ]; then
        echo -e "总体状态: ${GREEN}健康${NC} ✅"
        echo ""
        echo "建议操作:"
        echo "  • 继续监控服务状态"
        echo "  • 定期检查日志文件"
        echo "  • 保持系统更新"
    else
        echo -e "总体状态: ${RED}异常${NC} ❌"
        echo ""
        echo "建议操作:"
        echo "  • 检查应用日志: tail -f logs/combined.log"
        echo "  • 重启服务: npm run start"
        echo "  • 检查系统资源使用情况"
        echo "  • 联系系统管理员"
    fi
    
    echo ""
    echo "=================================================================="
}

# 主函数
main() {
    echo "🏥 Email Assistant 健康检查"
    echo "时间: $(date)"
    echo ""
    
    local failed_checks=0
    
    # 执行各项检查
    check_process || ((failed_checks++))
    check_port 3000 || ((failed_checks++))
    check_api_health || ((failed_checks++))
    check_memory_usage || ((failed_checks++))
    check_disk_space || ((failed_checks++))
    check_log_files || true  # 非关键检查
    check_database_files || ((failed_checks++))
    
    # 生成报告
    if [ "$failed_checks" -eq 0 ]; then
        generate_report 0
        exit 0
    else
        generate_report 1
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "Email Assistant 健康检查脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示帮助信息"
    echo "  -u, --url URL  指定API基础URL (默认: http://localhost:3000)"
    echo "  -t, --timeout  设置超时时间 (默认: 10秒)"
    echo "  -r, --retries  设置重试次数 (默认: 3次)"
    echo ""
    echo "环境变量:"
    echo "  API_BASE_URL   API基础URL"
    echo "  TIMEOUT        超时时间"
    echo "  MAX_RETRIES    最大重试次数"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  $0 --url http://localhost:3000 --timeout 5"
    echo "  API_BASE_URL=http://prod.example.com $0"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--url)
            API_BASE_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 运行健康检查
main