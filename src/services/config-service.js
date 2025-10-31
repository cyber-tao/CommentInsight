/**
 * 配置管理服务 - 统一处理配置的加载、保存和验证
 */

class ConfigService {
    constructor() {
        this.config = null;
        this.listeners = [];
        this.logger = new Logger('ConfigService');
    }

    /**
     * 获取默认配置
     * @returns {Object}
     */
    getDefaultConfig() {
        if (typeof DefaultConfig !== 'undefined') {
            return JSON.parse(JSON.stringify(DefaultConfig));
        }
        return {};
    }

    /**
     * 加载配置
     * @returns {Promise<Object>}
     */
    async loadConfig() {
        try {
            const stored = await StorageService.loadData('config');
            
            if (stored && typeof stored === 'object') {
                // 合并默认配置，确保新字段被添加
                this.config = this.mergeConfig(this.getDefaultConfig(), stored);
                this.logger.info('配置加载成功', { hasStoredConfig: true });
            } else {
                // 使用默认配置
                this.config = this.getDefaultConfig();
                await this.saveConfig(this.config);
                this.logger.info('使用默认配置');
            }
            
            return this.config;
        } catch (error) {
            this.logger.error('加载配置失败', error);
            // 失败时使用默认配置
            this.config = this.getDefaultConfig();
            return this.config;
        }
    }

    /**
     * 保存配置
     * @param {Object} config - 配置对象
     * @returns {Promise<void>}
     */
    async saveConfig(config) {
        try {
            const configToSave = config || this.config;
            if (!configToSave) {
                throw new Error('配置对象为空');
            }

            // 验证配置
            this.validateConfig(configToSave);

            // 保存到存储
            await StorageService.saveData({ config: configToSave });
            
            // 更新内存中的配置
            this.config = JSON.parse(JSON.stringify(configToSave));
            
            // 通知监听器
            this.notifyListeners('change', this.config);
            
            this.logger.info('配置保存成功');
        } catch (error) {
            this.logger.error('保存配置失败', error);
            throw error;
        }
    }

    /**
     * 获取当前配置
     * @returns {Object}
     */
    getConfig() {
        if (!this.config) {
            return this.getDefaultConfig();
        }
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * 更新配置部分字段
     * @param {Object} partialConfig - 部分配置对象
     * @returns {Promise<void>}
     */
    async updateConfig(partialConfig) {
        const currentConfig = this.getConfig();
        const mergedConfig = this.mergeConfig(currentConfig, partialConfig);
        await this.saveConfig(mergedConfig);
    }

    /**
     * 合并配置对象
     * @param {Object} defaultConfig - 默认配置
     * @param {Object} userConfig - 用户配置
     * @returns {Object}
     */
    mergeConfig(defaultConfig, userConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = target[key] || {};
                        deepMerge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        };
        
        deepMerge(merged, userConfig);
        return merged;
    }

    /**
     * 验证配置
     * @param {Object} config - 配置对象
     * @throws {Error} 配置验证失败时抛出错误
     */
    validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('配置必须是对象');
        }

        // 验证AI配置
        if (config.ai) {
            if (config.ai.temperature !== undefined) {
                if (typeof config.ai.temperature !== 'number' || 
                    config.ai.temperature < 0 || config.ai.temperature > 2) {
                    throw new Error('AI温度值必须在0-2之间');
                }
            }

            if (config.ai.maxTokens !== undefined) {
                if (typeof config.ai.maxTokens !== 'number' || 
                    config.ai.maxTokens < 100 || config.ai.maxTokens > 100000) {
                    throw new Error('AI最大令牌数必须在100-100000之间');
                }
            }

            if (config.ai.endpoint && typeof config.ai.endpoint === 'string') {
                try {
                    new URL(config.ai.endpoint);
                } catch (e) {
                    throw new Error('AI端点URL格式不正确');
                }
            }
        }

        // 验证平台配置
        if (config.platforms) {
            if (config.platforms.maxComments !== undefined) {
                const maxComments = config.platforms.maxComments;
                if (typeof maxComments !== 'number' || 
                    maxComments < Constants.LIMITS.MAX_COMMENTS_MIN || 
                    maxComments > Constants.LIMITS.MAX_COMMENTS_MAX) {
                    throw new Error(`最大评论数必须在${Constants.LIMITS.MAX_COMMENTS_MIN}-${Constants.LIMITS.MAX_COMMENTS_MAX}之间`);
                }
            }
        }
    }

    /**
     * 重置为默认配置
     * @returns {Promise<void>}
     */
    async resetToDefault() {
        const defaultConfig = this.getDefaultConfig();
        await this.saveConfig(defaultConfig);
    }

    /**
     * 添加配置变更监听器
     * @param {Function} listener - 监听器函数
     */
    addListener(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        }
    }

    /**
     * 移除配置变更监听器
     * @param {Function} listener - 监听器函数
     */
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * 通知所有监听器
     * @param {string} event - 事件类型
     * @param {Object} data - 事件数据
     */
    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                this.logger.error('配置监听器执行失败', error);
            }
        });
    }

    /**
     * 获取配置值（支持路径，如 'ai.model'）
     * @param {string} path - 配置路径
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    get(path, defaultValue = undefined) {
        const config = this.getConfig();
        const parts = path.split('.');
        let value = config;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    /**
     * 设置配置值（支持路径）
     * @param {string} path - 配置路径
     * @param {*} value - 配置值
     * @returns {Promise<void>}
     */
    async set(path, value) {
        const config = this.getConfig();
        const parts = path.split('.');
        const lastPart = parts.pop();
        let target = config;
        
        for (const part of parts) {
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        
        target[lastPart] = value;
        await this.saveConfig(config);
    }
}

// 创建全局单例实例
const configService = new ConfigService();

// 导出
if (typeof window !== 'undefined') {
    window.ConfigService = ConfigService;
    window.configService = configService;
}

if (typeof self !== 'undefined' && typeof self.ConfigService === 'undefined') {
    self.ConfigService = ConfigService;
    self.configService = configService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigService, configService };
}

