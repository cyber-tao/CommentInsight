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
            Logger.info('storage', 'Data saved');
        } catch (error) {
            Logger.error('storage', 'Failed to save data', error);
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
            Logger.error('storage', 'Failed to load data', error);
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
            Logger.info('storage', 'Data removed');
        } catch (error) {
            Logger.error('storage', 'Failed to remove data', error);
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

            let id = '';
            try {
                const arr = new Uint32Array(4);
                if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                    crypto.getRandomValues(arr);
                    id = Array.from(arr).map(n => n.toString(36)).join('');
                } else {
                    id = CommonUtils.generateStableId(String(Date.now()) + storageKey);
                }
            } catch (_) {
                id = CommonUtils.generateStableId(String(Date.now()) + storageKey);
            }
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
            Logger.info('storage', 'Added to analysis history');
        } catch (error) {
            Logger.error('storage', 'Failed to add to analysis history', error);
        }
    }

    static obfuscateConfig(config) {
        if (!config || typeof config !== 'object') {
            return config;
        }

        const safeConfig = JSON.parse(JSON.stringify(config));
        if (safeConfig.ai) safeConfig.ai.apiKey = '';
        if (safeConfig.platforms) {
            if (safeConfig.platforms.youtube) safeConfig.platforms.youtube.apiKey = '';
            if (safeConfig.platforms.twitter) safeConfig.platforms.twitter.bearerToken = '';
        }
        return safeConfig;
    }

    static deobfuscateConfig(config) {
        if (!config || typeof config !== 'object') {
            return config;
        }

        const safeConfig = JSON.parse(JSON.stringify(config));
        if (safeConfig.ai) safeConfig.ai.apiKey = '';
        if (safeConfig.platforms) {
            if (safeConfig.platforms.youtube) safeConfig.platforms.youtube.apiKey = '';
            if (safeConfig.platforms.twitter) safeConfig.platforms.twitter.bearerToken = '';
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
            Logger.warn('storage', 'Failed to decode secret', error);
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

