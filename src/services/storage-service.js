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
            const payload = { ...data };

            if (Object.prototype.hasOwnProperty.call(payload, 'config')) {
                payload.config = this.obfuscateConfig(payload.config);
            }

            await chrome.storage.local.set(payload);
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
            let value = result[key];

            if (key === 'config' && value) {
                value = this.deobfuscateConfig(value);
            }

            return value;
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
        return CommonUtils.generatePageKey(url);
    }

    static getSecretPrefix() {
        return '__ci::';
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
            const storageKey = this.generatePageKey(entry.url);

            const newEntry = {
                id,
                storageKey,
                url: entry.url,
                platform: entry.platform,
                commentCount: entry.commentCount,
                timestamp: entry.timestamp,
                summary: (entry.analysis && entry.analysis.summary) ? entry.analysis.summary : {}
            };

            const existingIndex = history.findIndex(h => {
                return h.storageKey === storageKey;
            });
            if (existingIndex >= 0) {
                // 保留原有ID，避免影响历史记录引用
                newEntry.id = history[existingIndex].id;
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

    static obfuscateConfig(config) {
        if (!config || typeof config !== 'object') {
            return config;
        }

        const safeConfig = JSON.parse(JSON.stringify(config));

        if (safeConfig.ai && typeof safeConfig.ai.apiKey === 'string') {
            safeConfig.ai.apiKey = this.encodeSecret(safeConfig.ai.apiKey);
        }

        if (safeConfig.platforms) {
            if (safeConfig.platforms.youtube && typeof safeConfig.platforms.youtube.apiKey === 'string') {
                safeConfig.platforms.youtube.apiKey = this.encodeSecret(safeConfig.platforms.youtube.apiKey);
            }

            if (safeConfig.platforms.twitter && typeof safeConfig.platforms.twitter.bearerToken === 'string') {
                safeConfig.platforms.twitter.bearerToken = this.encodeSecret(safeConfig.platforms.twitter.bearerToken);
            }
        }

        return safeConfig;
    }

    static deobfuscateConfig(config) {
        if (!config || typeof config !== 'object') {
            return config;
        }

        const safeConfig = JSON.parse(JSON.stringify(config));

        if (safeConfig.ai && typeof safeConfig.ai.apiKey === 'string') {
            safeConfig.ai.apiKey = this.decodeSecret(safeConfig.ai.apiKey);
        }

        if (safeConfig.platforms) {
            if (safeConfig.platforms.youtube && typeof safeConfig.platforms.youtube.apiKey === 'string') {
                safeConfig.platforms.youtube.apiKey = this.decodeSecret(safeConfig.platforms.youtube.apiKey);
            }

            if (safeConfig.platforms.twitter && typeof safeConfig.platforms.twitter.bearerToken === 'string') {
                safeConfig.platforms.twitter.bearerToken = this.decodeSecret(safeConfig.platforms.twitter.bearerToken);
            }
        }

        return safeConfig;
    }

    static encodeSecret(value) {
        if (!value || typeof value !== 'string') {
            return value;
        }

        if (value.startsWith(this.getSecretPrefix())) {
            return value;
        }

        const key = 'comment-insight-secure-key';
        let obfuscated = '';
        for (let i = 0; i < value.length; i++) {
            const keyChar = key.charCodeAt(i % key.length);
            const encodedChar = value.charCodeAt(i) ^ keyChar;
            obfuscated += String.fromCharCode(encodedChar);
        }

        return `${this.getSecretPrefix()}${btoa(obfuscated)}`;
    }

    static decodeSecret(value) {
        if (!value || typeof value !== 'string') {
            return value || '';
        }

        const prefix = this.getSecretPrefix();
        if (!value.startsWith(prefix)) {
            return value;
        }

        const encoded = value.slice(prefix.length);

        try {
            const binary = atob(encoded);
            const key = 'comment-insight-secure-key';
            let decoded = '';

            for (let i = 0; i < binary.length; i++) {
                const keyChar = key.charCodeAt(i % key.length);
                const originalChar = binary.charCodeAt(i) ^ keyChar;
                decoded += String.fromCharCode(originalChar);
            }

            return decoded;
        } catch (error) {
            console.warn('解密配置失败:', error);
            return '';
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

