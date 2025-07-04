export interface DailySchedule {
  date: string;
  events: ScheduleEvent[];
}

export interface ScheduleEvent {
  time: string;
  title: string;
  description?: string;
  location?: string;
}

export interface WorkSummary {
  date: string;
  tasks: CompletedTask[];
  achievements: string[];
  challenges: string[];
  nextDayPlans: string[];
}

export interface CompletedTask {
  title: string;
  description?: string;
  timeSpent?: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface ContextEntry {
  id: string;
  timestamp: Date;
  type: 'schedule' | 'work_summary' | 'feedback' | 'conversation';
  content: string;
  metadata?: Record<string, any> | undefined;
}

// 原始上下文条目（从文件读取时的格式）
export interface RawContextEntry {
  id: string;
  timestamp: string; // JSON中时间戳是字符串
  type: 'schedule' | 'work_summary' | 'feedback' | 'conversation';
  content: string;
  metadata?: Record<string, any>;
}

export interface UserInteraction {
  prompt: string;
  response: string;
  timestamp: Date;
  type: 'morning_reminder' | 'evening_summary' | 'general';
}