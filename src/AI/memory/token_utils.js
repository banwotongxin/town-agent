"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenUtils = void 0;
/**
 * Token计算工具类
 * 使用tiktoken库进行准确的token计算，当tiktoken不可用时使用fallback方案
 */
class TokenUtils {
    /**
     * 初始化编码
     */
    static initializeEncoding() {
        if (!this.encoding && !this.useFallback) {
            try {
                // 尝试动态导入tiktoken
                const tiktoken = require('tiktoken');
                // 使用cl100k_base编码，适用于gpt-4, gpt-3.5-turbo等模型
                this.encoding = tiktoken.get_encoding('cl100k_base');
            }
            catch (error) {
                console.warn('tiktoken库不可用，使用fallback方案进行token计算:', error.message);
                this.useFallback = true;
            }
        }
    }
    /**
     * 计算文本的token数
     * @param text 文本内容
     * @returns token数
     */
    static calculateTokenCount(text) {
        this.initializeEncoding();
        if (!this.useFallback && this.encoding) {
            try {
                const tokens = this.encoding.encode(text);
                return tokens.length;
            }
            catch (error) {
                console.error('Error calculating token count with tiktoken:', error);
                this.useFallback = true;
            }
        }
        // fallback到简单的字符计数
        // 粗略估计：1个中文字符≈1个token，4个英文字符≈1个token
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const nonChineseText = text.replace(/[\u4e00-\u9fa5]/g, '');
        const englishTokens = Math.ceil(nonChineseText.length / 4);
        return chineseChars + englishTokens;
    }
    /**
     * 计算消息数组的token数
     * @param messages 消息数组
     * @returns token数
     */
    static calculateMessagesTokenCount(messages) {
        return messages.reduce((total, msg) => total + this.calculateTokenCount(msg.content), 0);
    }
}
exports.TokenUtils = TokenUtils;
TokenUtils.useFallback = false;
