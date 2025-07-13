// 新分层架构的导出
export * from './core';
export * from './providers';
export * from './functions';
export * from './services';

// 主要服务类
export { default as AIService } from './aiService'; // 原版服务（向后兼容）
export { default as AIServiceV2 } from './AIServiceV2'; // 新版分层服务
export { default as MockAIService } from './mockAIService';