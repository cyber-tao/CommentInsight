/**
 * 统一日志系统 - 提供分级日志和敏感信息过滤
 */

class Logger {
    constructor(moduleName = 'Unknown') {
        this.moduleName = moduleName;
        this.logLevel = this.getLogLevel();
    }

    /**
     * 获取日志级别配置
     * @returns {string} 日志级别
     */
    getLogLevel() {
        // 从存储中读取日志级别配置，默认INFO
        if (typeof chrome !== 'undefined' && chrome.storage) {
            // 异步读取，但这里先返回默认值
            // 实际使用时可以通过ConfigService获取
            return 'INFO';
        }
        return 'INFO';
    }

    /**
     * 获取日志级别数值
     * @param {string} level - 日志级别
     * @returns {number}
     */
    getLevelValue(level) {
        const levels = {
            'DEBUG': 0,
            'INFO': 1,
            'WARN': 2,
            'ERROR': 3,
            'FATAL': 4
        };
        return levels[level] || 1;
    }

    /**
     * 检查是否应该输出日志
     * @param {string} level - 日志级别
     * @returns {boolean}
     */
    shouldLog(level) {
        return this.getLevelValue(level) >= this.getLevelValue(this.logLevel);
    }

    /**
     * 过滤敏感信息
     * @param {*} data - 日志数据
     * @returns {*} 过滤后的数据
     */
    filterSensitiveData(data) {
        if (typeof data === 'string') {
            // 过滤API密钥模式
            let filtered = data;
            
            // 过滤API密钥（sk-开头的OpenAI密钥）
            filtered = filtered.replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***FILTERED***');
            
            // 过滤Bearer Token
            filtered = filtered.replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/g, 'Bearer ***FILTERED***');
            
            // 过滤Google API Key
            filtered = filtered.replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza***FILTERED***');
            
            // 过滤常见密钥字段
            filtered = filtered.replace(/["']api[_-]?key["']\s*[:=]\s*["']([^"']{10,})["']/gi, '"apiKey": "***FILTERED***"');
            filtered = filtered.replace(/["']bearer[_-]?token["']\s*[:=]\s*["']([^"']{10,})["']/gi, '"bearerToken": "***FILTERED***"');
            
            return filtered;
        } else if (typeof data === 'object' && data !== null) {
            // 递归处理对象
            const filtered = Array.isArray(data) ? [] : {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    const lowerKey = key.toLowerCase();
                    // 过滤常见敏感字段
                    if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
                        filtered[key] = '***FILTERED***';
                    } else {
                        filtered[key] = this.filterSensitiveData(data[key]);
                    }
                }
            }
            return filtered;
        }
        return data;
    }

    /**
     * 格式化日志消息
     * @param {string} level - 日志级别
     * @param {string} message - 消息
     * @param {*} data - 附加数据
     * @returns {string}
     */
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const module = this.moduleName;
        const levelStr = level.padEnd(5);
        
        let formatted = `[${timestamp}] [${levelStr}] [${module}] ${message}`;
        
        if (data !== undefined) {
            const filteredData = this.filterSensitiveData(data);
            formatted += ` ${JSON.stringify(filteredData)}`;
        }
        
        return formatted;
    }

    /**
     * DEBUG级别日志
     * @param {string} message - 消息
     * @param {*} data - 附加数据
     */
    debug(message, data) {
        if (this.shouldLog('DEBUG')) {
            const formatted = this.formatMessage('DEBUG', message, data);
            console.debug(formatted);
        }
    }

    /**
     * INFO级别日志
     * @param {string} message - 消息
     * @param {*} data - 附加数据
     */
    info(message, data) {
        if (this.shouldLog('INFO')) {
            const formatted = this.formatMessage('INFO', message, data);
            console.log(formatted);
        }
    }

    /**
     * WARN级别日志
     * @param {string} message - 消息
     * @param {*} data - 附加数据
     */
    warn(message, data) {
        if (this.shouldLog('WARN')) {
            const formatted = this.formatMessage('WARN', message, data);
            console.warn(formatted);
        }
    }

    /**
     * ERROR级别日志
     * @param {string} message - 消息
     * @param {Error|*} error - 错误对象或附加数据
     * @param {*} data - 附加数据
     */
    error(message, error, data) {
        if (this.shouldLog('ERROR')) {
            const formatted = this.formatMessage('ERROR', message, error || data);
            console.error(formatted);
            if (error instanceof Error) {
                console.error('错误堆栈:', error.stack);
            }
        }
    }

    /**
     * FATAL级别日志
     * @param {string} message - 消息
     * @param {Error|*} error - 错误对象或附加数据
     * @param {*} data - 附加数据
     */
    fatal(message, error, data) {
        const formatted = this.formatMessage('FATAL', message, error || data);
        console.error(formatted);
        if (error instanceof Error) {
            console.error('致命错误堆栈:', error.stack);
        }
    }

    /**
     * 设置日志级别
     * @param {string} level - 日志级别
     */
    setLogLevel(level) {
        const validLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        if (validLevels.includes(level)) {
            this.logLevel = level;
        }
    }

    /**
     * 创建子模块日志器
     * @param {string} subModule - 子模块名
     * @returns {Logger}
     */
    createChild(subModule) {
        return new Logger(`${this.moduleName}.${subModule}`);
    }
}

// 创建默认日志器实例
const defaultLogger = new Logger('CommentInsight');

// 导出
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.logger = defaultLogger;
}

if (typeof self !== 'undefined' && typeof self.Logger === 'undefined') {
    self.Logger = Logger;
    self.logger = defaultLogger;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Logger, logger: defaultLogger };
}

