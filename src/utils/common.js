/**
 * 通用工具类 - 提供项目中常用的工具函数
 */

class CommonUtils {
    /**
     * 延迟执行
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清理文本（去除多余空格）
     * @param {string} text - 待清理的文本
     * @returns {string}
     */
    static sanitizeText(text) {
        return text ? text.trim().replace(/\s+/g, ' ') : '';
    }

    /**
     * HTML转义
     * @param {string} str - 待转义的字符串
     * @returns {string}
     */
    static escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 正则表达式转义
     * @param {string} str - 待转义的字符串
     * @returns {string}
     */
    static escapeRegExp(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 生成稳定的哈希ID
     * @param {string} str - 输入字符串
     * @returns {string}
     */
    static generateStableId(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 生成URL的唯一键
     * @param {string} url - URL字符串
     * @returns {string}
     */
    static generatePageKey(url) {
        if (!url) {
            return this.generateStableId(String(Date.now()));
        }

        try {
            const urlObj = new URL(url);
            const keySource = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;
            return this.generateStableId(keySource);
        } catch (error) {
            return this.generateStableId(String(url));
        }
    }

    /**
     * 解析数字（支持K、M等单位）
     * @param {string} text - 文本
     * @returns {number}
     */
    static parseNumber(text) {
        if (!text) return 0;

        const cleaned = text.replace(/[^\d\.]/g, '');
        const number = parseFloat(cleaned);

        if (isNaN(number)) return 0;

        if (text.includes('万')) {
            return Math.floor(number * 10000);
        } else if (text.includes('千')) {
            return Math.floor(number * 1000);
        } else if (text.includes('K')) {
            return Math.round(number * 1000);
        } else if (text.includes('M')) {
            return Math.round(number * 1000000);
        }

        return Math.floor(number);
    }

    /**
     * 解析时间格式
     * @param {string} timeText - 时间文本
     * @returns {string} ISO格式时间
     */
    static parseTime(timeText) {
        if (!timeText) return new Date().toISOString();

        const patterns = {
            '刚刚': () => new Date(),
            '秒前': (match) => {
                const seconds = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - seconds * 1000);
            },
            '分钟前': (match) => {
                const minutes = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - minutes * 60 * 1000);
            },
            '小时前': (match) => {
                const hours = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - hours * 60 * 60 * 1000);
            },
            '天前': (match) => {
                const days = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            }
        };

        for (const [pattern, handler] of Object.entries(patterns)) {
            if (timeText.includes(pattern)) {
                try {
                    return handler(timeText).toISOString();
                } catch (e) {
                    continue;
                }
            }
        }

        try {
            const date = new Date(timeText);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (e) {
            // 忽略
        }

        return new Date().toISOString();
    }

    /**
     * 清理文件名中的非法字符
     * @param {string} title - 文件名
     * @returns {string}
     */
    static sanitizeFilename(title) {
        return title
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 50);
    }

    /**
     * 生成格式化的文件名
     * @param {string} platform - 平台名
     * @param {string} title - 标题
     * @param {string} extension - 扩展名
     * @returns {string}
     */
    static generateFilename(platform, title, extension) {
        const now = new Date();
        const dateTime = now.toLocaleDateString('zh-CN').replace(/[^\d]/g, '-') + '_' + 
                        now.toLocaleTimeString('zh-CN', { hour12: false }).replace(/:/g, '-');
        
        const cleanTitle = this.sanitizeFilename(title || '未知标题');
        
        return `${platform}-${cleanTitle}-${dateTime}.${extension}`;
    }

    /**
     * 判断是否是时间模式
     * @param {string} text - 文本
     * @returns {boolean}
     */
    static isTimePattern(text) {
        if (!text) return false;

        const timePatterns = [
            /\d+秒前/, /\d+分钟前/, /\d+小时前/, /\d+天前/,
            /\d{4}-\d{2}-\d{2}/, /\d{2}-\d{2}/, /\d{2}:\d{2}/,
            /刚刚/, /昨天/, /前天/
        ];

        return timePatterns.some(pattern => pattern.test(text));
    }

    /**
     * CSV单元格安全处理
     * @param {string} raw - 原始文本
     * @returns {string}
     */
    static safeCsvCell(raw) {
        let v = String(raw || '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(v)) {
            v = "'" + v;
        }
        v = v.replace(/\r?\n/g, ' ');
        return `"${v}"`;
    }

    /**
     * 等待DOM元素出现
     * @param {string} selector - CSS选择器
     * @param {number} maxWaitTime - 最大等待时间（毫秒），0表示无限等待
     * @returns {Promise<Element>}
     */
    static waitForElement(selector, maxWaitTime = 30000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    if (timeoutId) clearTimeout(timeoutId);
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 如果设置了最大等待时间，则在超时后停止观察
            let timeoutId = null;
            if (maxWaitTime > 0) {
                timeoutId = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`等待元素超时: ${selector} (${maxWaitTime}ms)`));
                }, maxWaitTime);
            }
        });
    }
}

// 导出到全局（兼容Chrome扩展环境）
if (typeof window !== 'undefined') {
    window.CommonUtils = CommonUtils;
}

// 支持模块导出（如果环境支持）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUtils;
}

