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
     * @param {number} timeout - 超时时间
     * @returns {Promise<Element>}
     */
    async waitForElement(selector, timeout = 5000) {
        return CommonUtils.waitForElement(selector, timeout);
    }

    /**
     * 滚动加载更多内容
     * @param {Element|Window} scrollContainer - 滚动容器
     * @param {number} maxScrolls - 最大滚动次数
     */
    async scrollToLoadMore(scrollContainer, maxScrolls = 10) {
        let scrollCount = 0;
        let lastHeight = 0;

        while (scrollCount < maxScrolls) {
            const container = scrollContainer || window;
            const currentHeight = container === window ?
                document.documentElement.scrollHeight :
                container.scrollHeight;

            if (currentHeight === lastHeight) {
                break;
            }

            lastHeight = currentHeight;

            if (container === window) {
                window.scrollTo(0, document.documentElement.scrollHeight);
            } else {
                container.scrollTop = container.scrollHeight;
            }

            await this.delay(1000);
            scrollCount++;
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

