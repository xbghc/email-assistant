#!/bin/bash

# 生产环境就绪检查脚本
# 用于确保没有mock数据或测试配置

echo "🔍 检查生产环境配置..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境变量
echo ""
echo "📋 检查必要的环境变量..."

check_env_var() {
    local var_name=$1
    local var_value=${!var_name}
    local required=$2
    
    if [ -z "$var_value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}❌ $var_name 未设置 (必需)${NC}"
            return 1
        else
            echo -e "${YELLOW}⚠️  $var_name 未设置 (可选)${NC}"
            return 0
        fi
    else
        # 检查是否为测试值
        if [[ "$var_value" =~ (test@example\.com|localhost|mock|your-|CHANGE_THIS) ]]; then
            echo -e "${RED}❌ $var_name 包含测试/占位符值: $var_value${NC}"
            return 1
        else
            echo -e "${GREEN}✅ $var_name 已正确设置${NC}"
            return 0
        fi
    fi
}

# 检查关键环境变量
errors=0

# 必需变量
check_env_var "NODE_ENV" true || errors=$((errors + 1))
check_env_var "AI_PROVIDER" true || errors=$((errors + 1))
check_env_var "SMTP_HOST" true || errors=$((errors + 1))
check_env_var "SMTP_USER" true || errors=$((errors + 1))
check_env_var "SMTP_PASS" true || errors=$((errors + 1))
check_env_var "USER_EMAIL" true || errors=$((errors + 1))
check_env_var "USER_NAME" true || errors=$((errors + 1))
check_env_var "JWT_SECRET" true || errors=$((errors + 1))

# 检查NODE_ENV
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  NODE_ENV 不是 'production' (当前: $NODE_ENV)${NC}"
fi

# 检查AI_PROVIDER
if [ "$AI_PROVIDER" = "mock" ]; then
    echo -e "${RED}❌ AI_PROVIDER 设置为 'mock'，生产环境不应使用mock服务${NC}"
    errors=$((errors + 1))
fi

# 检查数据文件
echo ""
echo "📁 检查数据文件..."

# 检查用户文件
if [ -f "users.json" ]; then
    if command -v jq >/dev/null 2>&1; then
        user_count=$(jq length users.json 2>/dev/null || echo "invalid")
        if [ "$user_count" = "0" ] || [ "$user_count" = "[]" ]; then
            echo -e "${GREEN}✅ users.json 已清空 (无测试数据)${NC}"
        elif [ "$user_count" = "invalid" ]; then
            echo -e "${RED}❌ users.json 格式无效${NC}"
            errors=$((errors + 1))
        else
            echo -e "${YELLOW}⚠️  users.json 包含 $user_count 个用户，请确认是否为真实用户${NC}"
        fi
    else
        # Fallback check without jq
        if grep -q "^\[\]$" users.json || [ "$(wc -c < users.json | tr -d ' ')" = "2" ]; then
            echo -e "${GREEN}✅ users.json 已清空 (无测试数据)${NC}"
        elif grep -q "test@example\|mock\|sample" users.json; then
            echo -e "${RED}❌ users.json 包含测试数据${NC}"
            errors=$((errors + 1))
        else
            echo -e "${YELLOW}⚠️  users.json 存在，请手动检查内容${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ users.json 不存在 (正常)${NC}"
fi

# 检查上下文数据
if [ -f "data/context.json" ]; then
    if grep -q "今天完成了\|测试\|模拟\|OAuth2.0实现" data/context.json; then
        echo -e "${RED}❌ data/context.json 包含测试数据${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ data/context.json 无明显测试数据${NC}"
    fi
else
    echo -e "${GREEN}✅ data/context.json 不存在 (正常)${NC}"
fi

# 检查源代码中的测试内容
echo ""
echo "🔍 检查源代码中的测试内容..."

if grep -r "test@example\.com\|localhost.*smtp\|AI_PROVIDER.*mock" src/ --exclude-dir=__tests__ --exclude="*.test.ts" --quiet; then
    echo -e "${YELLOW}⚠️  源代码中发现测试相关内容，请检查:${NC}"
    grep -r "test@example\.com\|localhost.*smtp\|AI_PROVIDER.*mock" src/ --exclude-dir=__tests__ --exclude="*.test.ts" | head -5
fi

# 检查.env文件
echo ""
echo "⚙️  检查配置文件..."

if [ -f ".env" ]; then
    if grep -q "AI_PROVIDER=mock\|test@example\.com\|localhost" .env; then
        echo -e "${RED}❌ .env 文件包含测试配置${NC}"
        errors=$((errors + 1))
    else
        echo -e "${GREEN}✅ .env 文件看起来正常${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env 文件不存在，请从 .env.production.example 复制并配置${NC}"
fi

# 总结
echo ""
echo "📊 检查结果汇总："

if [ $errors -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！系统已准备好部署到生产环境。${NC}"
    exit 0
else
    echo -e "${RED}❌ 发现 $errors 个问题需要修复后才能部署到生产环境。${NC}"
    
    echo ""
    echo "🔧 建议的修复步骤："
    echo "1. 复制 .env.production.example 为 .env 并设置真实配置"
    echo "2. 确保 AI_PROVIDER 不是 'mock'"
    echo "3. 设置真实的 SMTP 邮件服务器配置"
    echo "4. 设置强密码的 JWT_SECRET"
    echo "5. 清理所有测试数据文件"
    
    exit 1
fi