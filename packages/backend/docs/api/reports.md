# 📊 工作报告 API

## 概述

工作报告 API 允许用户提交工作报告，系统将使用 AI 进行智能分析并提供建议。

## API 端点

### 提交工作报告

```http
POST /work-report
Content-Type: application/json

{
  "report": "今天完成了项目的核心功能开发...",
  "date": "2025-07-12",
  "mood": "good",
  "productivity": 8
}
```

**请求参数：**
- `report`: 工作报告内容（必需）
- `date`: 报告日期 YYYY-MM-DD（可选，默认今天）
- `mood`: 心情状态 `excellent|good|neutral|poor`（可选）
- `productivity`: 效率评分 1-10（可选）

**响应：**
```json
{
  "success": true,
  "data": {
    "aiSummary": "用户今天专注于核心功能开发，效率较高...",
    "suggestions": [
      "建议明天安排代码review",
      "可以考虑优化现有功能"
    ],
    "mood": "good",
    "productivity": 8,
    "reportId": "report-123"
  }
}
```

**注意：** 此端点通过邮件识别用户，无需 Authorization 头

### 获取报告历史

```http
GET /api/reports?limit=10&offset=0
Authorization: Bearer <token>
```

**查询参数：**
- `limit`: 返回记录数（默认10，最大100）
- `offset`: 偏移量（默认0）
- `date_from`: 开始日期 YYYY-MM-DD
- `date_to`: 结束日期 YYYY-MM-DD

**响应：**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "report-123",
        "date": "2025-07-12",
        "report": "今天完成了...",
        "aiSummary": "用户今天...",
        "mood": "good",
        "productivity": 8,
        "created_at": "2025-07-12T18:00:00.000Z"
      }
    ],
    "total": 45,
    "hasMore": true
  }
}
```

### 获取单个报告

```http
GET /api/reports/:id
Authorization: Bearer <token>
```

### 删除报告

```http
DELETE /api/reports/:id
Authorization: Bearer <token>
```

## 常见错误

- `400 MISSING_REPORT` - 缺少报告内容
- `400 INVALID_DATE` - 日期格式错误
- `400 INVALID_PRODUCTIVITY` - 效率评分超出范围
- `404 REPORT_NOT_FOUND` - 报告不存在

---

**文档版本**: v1.0.0