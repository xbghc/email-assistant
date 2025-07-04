import OpenAI from 'openai';
import config from '../config';
import logger from '../utils/logger';
import { WorkSummary, ContextEntry } from '../models';

class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
You are a personal productivity assistant. Based on the following information, provide 3-5 actionable suggestions for today.

Today's Schedule:
${todaySchedule}

Yesterday's Performance:
${yesterdayPerformance}

Historical Context:
${contextText}

Please provide specific, actionable suggestions that will help improve productivity and address any challenges from yesterday. Keep the tone encouraging and professional.
      `.trim();

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful productivity assistant that provides actionable daily suggestions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const suggestions = response.choices[0]?.message?.content || '';
      logger.info('Morning suggestions generated successfully');
      return suggestions;
    } catch (error) {
      logger.error('Failed to generate morning suggestions:', error);
      throw error;
    }
  }

  async summarizeWorkReport(workReport: string, context: ContextEntry[]): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
You are a professional work summary assistant. Based on the following work report, create a well-structured summary.

Work Report:
${workReport}

Historical Context:
${contextText}

Please create a summary that includes:
1. Key accomplishments
2. Challenges faced and how they were addressed
3. Time management insights
4. Progress towards goals
5. Recommendations for tomorrow

Keep the summary professional, concise, and actionable.
      `.trim();

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a professional work summary assistant that creates structured, insightful summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 600,
        temperature: 0.5,
      });

      const summary = response.choices[0]?.message?.content || '';
      logger.info('Work summary generated successfully');
      return summary;
    } catch (error) {
      logger.error('Failed to generate work summary:', error);
      throw error;
    }
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
You are a context compression assistant. Please compress the following historical context into a concise summary that preserves the most important information for future reference.

Focus on:
1. Key patterns in work habits
2. Recurring challenges and solutions
3. Important achievements and milestones
4. Productivity insights
5. Goal progress

Historical Context:
${contextText}

Please provide a compressed summary that captures the essential information while reducing the overall length by at least 50%.
      `.trim();

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a context compression specialist that preserves important information while reducing length.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const compressed = response.choices[0]?.message?.content || '';
      logger.info('Context compressed successfully');
      return compressed;
    } catch (error) {
      logger.error('Failed to compress context:', error);
      throw error;
    }
  }

  private formatContext(context: ContextEntry[]): string {
    return context
      .slice(-10)
      .map(entry => `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.content}`)
      .join('\n\n');
  }
}

export default AIService;