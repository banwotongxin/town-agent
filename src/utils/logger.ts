/**
 * 日志工具类
 * 提供可配置的日志输出功能
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

/**
 * 日志配置接口
 */
export interface LogConfig {
  level: LogLevel;        // 日志级别
  enableTimestamp: boolean; // 是否显示时间戳
  enableColors: boolean;    // 是否启用颜色（终端）
}

/**
 * 默认日志配置
 */
const defaultConfig: LogConfig = {
  level: LogLevel.INFO,
  enableTimestamp: true,
  enableColors: false
};

/**
 * 当前日志配置
 */
let currentConfig: LogConfig = { ...defaultConfig };

/**
 * 设置日志配置
 * @param config 日志配置
 */
export function setLogConfig(config: Partial<LogConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 获取当前日志配置
 * @returns 日志配置
 */
export function getLogConfig(): LogConfig {
  return { ...currentConfig };
}

/**
 * 格式化日志消息
 * @param level 日志级别
 * @param message 消息内容
 * @param args 额外参数
 * @returns 格式化后的消息
 */
function formatMessage(level: string, message: any, ...args: any[]): string {
  const parts: string[] = [];
  
  // 添加时间戳
  if (currentConfig.enableTimestamp) {
    const now = new Date();
    parts.push(`[${now.toISOString()}]`);
  }
  
  // 添加级别
  parts.push(`[${level}]`);
  
  // 添加消息
  parts.push(typeof message === 'string' ? message : JSON.stringify(message));
  
  // 添加额外参数
  if (args.length > 0) {
    parts.push(...args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ));
  }
  
  return parts.join(' ');
}

/**
 * 调试日志
 * @param message 消息
 * @param args 额外参数
 */
export function debug(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.DEBUG) {
    console.log(formatMessage('DEBUG', message, ...args));
  }
}

/**
 * 信息日志
 * @param message 消息
 * @param args 额外参数
 */
export function info(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.INFO) {
    console.log(formatMessage('INFO', message, ...args));
  }
}

/**
 * 警告日志
 * @param message 消息
 * @param args 额外参数
 */
export function warn(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.WARN) {
    console.warn(formatMessage('WARN', message, ...args));
  }
}

/**
 * 错误日志
 * @param message 消息
 * @param args 额外参数
 */
export function error(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.ERROR) {
    console.error(formatMessage('ERROR', message, ...args));
  }
}

/**
 * 重置为默认配置
 */
export function resetLogConfig(): void {
  currentConfig = { ...defaultConfig };
}
