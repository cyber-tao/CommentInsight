/**
 * 基础提取器类 - 提供所有平台提取器的通用方法
 */

class BaseExtractor {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * 等待元素出现
     * @param {string} selector - CSS选择器
     * @param {number} maxWaitTime - 最大等待时间（毫秒）
     * @returns {Promise<Element>}
     */
    async waitForElement(selector, maxWaitTime = 30000) {
        return CommonUtils.waitForElement(selector, maxWaitTime);
    }

    /**
     * 滚动加载更多内容
     * @param {Element|Window} scrollContainer - 滚动容器
     */
    async scrollToLoadMore(scrollContainer) {
        let lastHeight = 0;
        let stableCount = 0;

        while (true) {
            const container = scrollContainer || window;
            const currentHeight = container === window ?
                document.documentElement.scrollHeight :
                container.scrollHeight;

            if (currentHeight === lastHeight) {
                stableCount++;
                if (stableCount >= 3) {
                    console.log('连续3次高度未变化，停止滚动');
                    break;
                }
            } else {
                stableCount = 0;
                lastHeight = currentHeight;
            }

            if (container === window) {
                window.scrollTo(0, document.documentElement.scrollHeight);
            } else {
                container.scrollTop = container.scrollHeight;
            }

            await this.delay(1000);
        }
    }

    /**
     * 延迟执行
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     */
    delay(ms) {
        return CommonUtils.delay(ms);
    }

    /**
     * 清理文本
     * @param {string} text - 待清理的文本
     * @returns {string}
     */
    sanitizeText(text) {
        return CommonUtils.sanitizeText(text);
    }

    /**
     * 提取时间戳
     * @param {Element} element - DOM元素
     * @returns {string}
     */
    extractTimestamp(element) {
        const timeSelectors = ['time', '[datetime]', '[data-timestamp]', '.timestamp'];

        for (const selector of timeSelectors) {
            const timeElement = element.querySelector(selector);
            if (timeElement) {
                return timeElement.getAttribute('datetime') ||
                    timeElement.getAttribute('data-timestamp') ||
                    timeElement.textContent;
            }
        }

        return new Date().toISOString();
    }

    /**
     * 通过多个选择器查找文本
     * @param {Element} element - DOM元素
     * @param {Array<string>} selectors - 选择器数组
     * @returns {string|null}
     */
    findTextBySelectors(element, selectors) {
        for (const selector of selectors) {
            try {
                const target = element.querySelector(selector);
                if (target && target.textContent.trim()) {
                    return target.textContent.trim();
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * 通过多个选择器查找元素
     * @param {Element} root - 根元素
     * @param {Array<string>} selectors - 选择器数组
     * @returns {Element|null}
     */
    findElementBySelectors(root, selectors) {
        for (const selector of selectors) {
            try {
                const element = root.querySelector(selector);
                if (element) {
                    return element;
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * 从Shadow DOM中查找元素
     * @param {Element} host - Shadow Host元素
     * @param {string} selector - CSS选择器
     * @returns {Element|null}
     */
    findInShadowRoot(host, selector) {
        if (!host || !host.shadowRoot) {
            return null;
        }
        try {
            return host.shadowRoot.querySelector(selector);
        } catch (e) {
            return null;
        }
    }

    /**
     * 从Shadow DOM中查找所有元素
     * @param {Element} host - Shadow Host元素
     * @param {string} selector - CSS选择器
     * @returns {NodeList|Array}
     */
    findAllInShadowRoot(host, selector) {
        if (!host || !host.shadowRoot) {
            return [];
        }
        try {
            return host.shadowRoot.querySelectorAll(selector);
        } catch (e) {
            return [];
        }
    }

    /**
     * 查找并点击按钮（支持多种事件触发方式）
     * @param {Element} button - 按钮元素
     * @returns {boolean} - 是否成功点击
     */
    clickButton(button) {
        if (!button) {
            return false;
        }
        try {
            button.scrollIntoView({ block: 'center', behavior: 'smooth' });
            button.click();
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
        } catch (e) {
            console.warn('点击按钮失败:', e);
            return false;
        }
    }

    /**
     * 等待元素数量变化
     * @param {Function} getCountFn - 获取当前数量的函数
     * @param {number} previousCount - 之前的数量
     * @param {number} maxWaitTime - 最大等待时间（毫秒）
     * @returns {Promise<number>} - 新的数量
     */
    async waitForCountChange(getCountFn, previousCount, maxWaitTime = 5000) {
        const start = Date.now();
        while (Date.now() - start < maxWaitTime) {
            const currentCount = getCountFn();
            if (currentCount !== previousCount) {
                return currentCount;
            }
            await this.delay(200);
        }
        return getCountFn();
    }

    /**
     * 解析数字文本（支持K、M等单位）
     * @param {string} text - 数字文本（如 "1.2K", "3M"）
     * @returns {number}
     */
    parseNumberText(text) {
        return CommonUtils.parseNumber(text);
    }

    /**
     * 解析时间文本
     * @param {string} timeText - 时间文本（如 "2小时前", "3天前"）
     * @returns {string} - ISO时间戳
     */
    parseTimeText(timeText) {
        return CommonUtils.parseTime(timeText);
    }

    /**
     * 提取元素属性值
     * @param {Element} element - DOM元素
     * @param {Array<string>} attributes - 属性名数组
     * @returns {string|null}
     */
    extractAttributeValue(element, attributes) {
        if (!element) {
            return null;
        }
        for (const attr of attributes) {
            const value = element.getAttribute(attr);
            if (value) {
                return value;
            }
        }
        return null;
    }

    /**
     * 通用重试机制
     * @param {Function} fn - 要重试的异步函数
     * @param {number} maxRetries - 最大重试次数
     * @param {number} delayMs - 重试延迟（毫秒）
     * @returns {Promise<any>}
     */
    async retryWithBackoff(fn, maxRetries = this.maxRetries, delayMs = this.retryDelay) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`尝试 ${attempt + 1}/${maxRetries} 失败:`, error.message);
                if (attempt < maxRetries - 1) {
                    await this.delay(delayMs * Math.pow(2, attempt));
                }
            }
        }
        throw lastError;
    }

    /**
     * 安全地从元素提取数据
     * @param {Element} element - DOM元素
     * @param {Object} config - 提取配置
     * @returns {Object}
     */
    safeExtractData(element, config) {
        const result = {};
        
        for (const [key, selectors] of Object.entries(config)) {
            try {
                if (Array.isArray(selectors)) {
                    result[key] = this.findTextBySelectors(element, selectors);
                } else if (typeof selectors === 'string') {
                    const el = element.querySelector(selectors);
                    result[key] = el ? el.textContent.trim() : null;
                } else if (typeof selectors === 'function') {
                    result[key] = selectors(element);
                }
            } catch (e) {
                result[key] = null;
            }
        }
        
        return result;
    }

    /**
     * 生成评论唯一ID
     * @param {string} author - 作者
     * @param {string} text - 评论内容
     * @param {string} timestamp - 时间戳
     * @returns {string}
     */
    generateCommentId(author, text, timestamp) {
        const content = `${author}_${text}_${timestamp}`;
        return CommonUtils.generateStableId(content);
    }

    /**
     * 构建标准评论对象
     * @param {Object} data - 评论数据
     * @returns {Object}
     */
    buildCommentObject(data) {
        return {
            id: data.id || this.generateCommentId(data.author, data.text, data.timestamp),
            parentId: data.parentId || "0",
            author: this.sanitizeText(data.author || '匿名用户'),
            text: this.sanitizeText(data.text || ''),
            timestamp: data.timestamp || new Date().toISOString(),
            likes: data.likes || 0,
            replyCount: data.replyCount || 0,
            platform: data.platform,
            url: data.url || window.location.href
        };
    }

    /**
     * 抽象方法：提取评论（子类必须实现）
     * @param {Object} config - 配置对象
     * @returns {Promise<Array>}
     */
    async extract(config) {
        throw new Error('子类必须实现extract方法');
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.BaseExtractor = BaseExtractor;
}
