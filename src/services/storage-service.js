/**
 * 存储服务 - 统一管理数据存储和加载
 */

class StorageService {
    /**
     * 保存数据到本地存储
     * @param {Object} data - 要保存的数据
     * @returns {Promise<void>}
     */
    static async saveData(data) {
        try {
            await chrome.storage.local.set(data);
            console.log('数据保存成功');
        } catch (error) {
            console.error('数据保存失败:', error);
            throw error;
        }
    }

    /**
     * 从本地存储加载数据
     * @param {string} key - 数据键
     * @returns {Promise<*>}
     */
    static async loadData(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key];
        } catch (error) {
            console.error('数据加载失败:', error);
            throw error;
        }
    }

    /**
     * 删除本地存储数据
     * @param {string|Array<string>} keys - 要删除的键
     * @returns {Promise<void>}
     */
    static async removeData(keys) {
        try {
            await chrome.storage.local.remove(keys);
            console.log('数据删除成功');
        } catch (error) {
            console.error('数据删除失败:', error);
            throw error;
        }
    }

    /**
     * 生成页面唯一键
     * @param {string} url - URL
     * @returns {string}
     */
    static generatePageKey(url) {
        try {
            const urlObj = new URL(url);
            const str = urlObj.hostname + urlObj.pathname + urlObj.search;
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
        } catch (error) {
            return Date.now().toString(36);
        }
    }

    /**
     * 添加到分析历史
     * @param {Object} entry - 历史条目
     * @returns {Promise<void>}
     */
    static async addToAnalysisHistory(entry) {
        try {
            const result = await chrome.storage.local.get('analysis_history');
            let history = result.analysis_history || [];

            const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const pageKey = this.generatePageKey(entry.url);

            const newEntry = {
                id,
                pageKey,
                url: entry.url,
                platform: entry.platform,
                commentCount: entry.commentCount,
                timestamp: entry.timestamp,
                summary: entry.analysis.summary || {}
            };

            const existingIndex = history.findIndex(h => h.pageKey === pageKey);
            if (existingIndex >= 0) {
                history[existingIndex] = newEntry;
            } else {
                history.unshift(newEntry);
            }

            if (history.length > 100) {
                history = history.slice(0, 100);
            }

            await chrome.storage.local.set({ analysis_history: history });
            console.log('已添加到分析历史');
        } catch (error) {
            console.error('添加到分析历史失败:', error);
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.StorageService = StorageService;
}

if (typeof self !== 'undefined' && typeof self.StorageService === 'undefined') {
    self.StorageService = StorageService;
}

