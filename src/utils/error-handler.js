/**
 * 统一错误处理工具
 */

class ErrorHandler {
    /**
     * 检查chrome.runtime.lastError并处理
     * @param {string} context - 上下文信息
     * @returns {Error|null} - 如果有错误返回Error对象，否则返回null
     */
    static checkRuntimeError(context = '') {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            const message = error.message || String(error);
            console.error(`${context ? `[${context}] ` : ''}Chrome Runtime Error:`, message);
            return new Error(`Chrome Runtime Error${context ? ` (${context})` : ''}: ${message}`);
        }
        return null;
    }

    /**
     * 安全地发送chrome消息
     * @param {any} message - 要发送的消息
     * @param {Object} options - 选项（可选）
     * @returns {Promise<any>} - 响应结果
     */
    static async safeSendMessage(message, options = {}) {
        const { timeout = 30000, context = 'Message' } = options;
        
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                reject(new Error('Chrome runtime不可用'));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`${context} 超时（${timeout}ms）`));
            }, timeout);

            try {
                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeoutId);
                    
                    // 检查runtime错误
                    const runtimeError = ErrorHandler.checkRuntimeError(context);
                    if (runtimeError) {
                        reject(runtimeError);
                        return;
                    }
                    
                    resolve(response);
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(new Error(`${context} 发送失败: ${error.message}`));
            }
        });
    }

    /**
     * 安全地发送标签页消息
     * @param {number} tabId - 标签页ID
     * @param {any} message - 要发送的消息
     * @param {Object} options - 选项（可选）
     * @returns {Promise<any>} - 响应结果
     */
    static async safeSendTabMessage(tabId, message, options = {}) {
        const { timeout = 30000, context = 'Tab Message' } = options;
        
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
                reject(new Error('Chrome tabs API不可用'));
                return;
            }

            if (!tabId || tabId < 0) {
                reject(new Error('无效的标签页ID'));
                return;
            }

            const timeoutId = setTimeout(() => {
                reject(new Error(`${context} 超时（${timeout}ms）`));
            }, timeout);

            try {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    clearTimeout(timeoutId);
                    
                    // 检查runtime错误
                    const runtimeError = ErrorHandler.checkRuntimeError(context);
                    if (runtimeError) {
                        reject(runtimeError);
                        return;
                    }
                    
                    resolve(response);
                });
            } catch (error) {
                clearTimeout(timeoutId);
                reject(new Error(`${context} 发送失败: ${error.message}`));
            }
        });
    }

    /**
     * 安全地读取存储数据
     * @param {string|Array<string>|null} keys - 键名或键名数组
     * @param {string} context - 上下文信息
     * @returns {Promise<any>} - 存储数据
     */
    static async safeGetStorage(keys, context = 'Storage Get') {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                reject(new Error('Chrome storage API不可用'));
                return;
            }

            try {
                chrome.storage.local.get(keys, (result) => {
                    // 检查runtime错误
                    const runtimeError = ErrorHandler.checkRuntimeError(context);
                    if (runtimeError) {
                        reject(runtimeError);
                        return;
                    }
                    
                    resolve(result);
                });
            } catch (error) {
                reject(new Error(`${context} 失败: ${error.message}`));
            }
        });
    }

    /**
     * 安全地写入存储数据
     * @param {Object} items - 要存储的数据
     * @param {string} context - 上下文信息
     * @returns {Promise<void>}
     */
    static async safeSetStorage(items, context = 'Storage Set') {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                reject(new Error('Chrome storage API不可用'));
                return;
            }

            if (!items || typeof items !== 'object') {
                reject(new Error('无效的存储数据'));
                return;
            }

            try {
                chrome.storage.local.set(items, () => {
                    // 检查runtime错误
                    const runtimeError = ErrorHandler.checkRuntimeError(context);
                    if (runtimeError) {
                        reject(runtimeError);
                        return;
                    }
                    
                    resolve();
                });
            } catch (error) {
                reject(new Error(`${context} 失败: ${error.message}`));
            }
        });
    }

    /**
     * 创建详细错误对象
     * @param {string} message - 错误消息
     * @param {string} code - 错误代码
     * @param {string} context - 上下文
     * @param {Object} details - 详细信息
     * @returns {Error}
     */
    static createDetailedError(message, code, context = '', details = {}) {
        const error = new Error(message);
        error.code = code;
        error.context = context;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * 创建API错误
     * @param {string} message - 错误消息
     * @param {number} statusCode - HTTP状态码
     * @param {string} apiName - API名称
     * @param {Object} response - 响应数据
     * @returns {Error}
     */
    static createAPIError(message, statusCode, apiName, response = {}) {
        return this.createDetailedError(
            message,
            `API_ERROR_${statusCode}`,
            apiName,
            { statusCode, response }
        );
    }

    /**
     * 创建平台错误
     * @param {string} platform - 平台名称
     * @param {string} operation - 操作名称
     * @param {string} message - 错误消息
     * @param {Object} details - 详细信息
     * @returns {Error}
     */
    static createPlatformError(platform, operation, message, details = {}) {
        return this.createDetailedError(
            message,
            'PLATFORM_ERROR',
            `${platform}:${operation}`,
            details
        );
    }

    /**
     * 格式化错误信息以供用户查看
     * @param {Error} error - 错误对象
     * @returns {string} - 格式化后的错误信息
     */
    static formatErrorForUser(error) {
        if (!error) {
            return '未知错误';
        }

        let message = error.message || String(error);
        
        // 添加上下文信息
        if (error.context) {
            message = `[${error.context}] ${message}`;
        }
        
        // 添加建议（如果有）
        if (error.details && error.details.suggestion) {
            message += `\n建议：${error.details.suggestion}`;
        }
        
        return message;
    }

    /**
     * 记录错误（带详细信息）
     * @param {Error} error - 错误对象
     * @param {string} context - 上下文
     */
    static logError(error, context = '') {
        const prefix = context ? `[${context}]` : '';
        
        console.error(`${prefix} 错误:`, error.message);
        
        if (error.code) {
            console.error(`${prefix} 错误代码:`, error.code);
        }
        
        if (error.context) {
            console.error(`${prefix} 上下文:`, error.context);
        }
        
        if (error.details && Object.keys(error.details).length > 0) {
            console.error(`${prefix} 详细信息:`, error.details);
        }
        
        if (error.stack) {
            console.error(`${prefix} 堆栈:`, error.stack);
        }
    }

    /**
     * 包装异步函数，统一处理错误
     * @param {Function} fn - 异步函数
     * @param {string} context - 上下文
     * @returns {Function} - 包装后的函数
     */
    static wrapAsync(fn, context = '') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                ErrorHandler.logError(error, context);
                throw error;
            }
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
}

if (typeof self !== 'undefined') {
    self.ErrorHandler = ErrorHandler;
}
