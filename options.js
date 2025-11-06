// 配置页面脚本 - 处理所有配置相关的功能
class CommentInsightOptions {
    constructor() {
        this.config = null;
        this.isLoading = false;
        
        this.initializeOptions();
    }

    async initializeOptions() {
        try {
            // 初始化事件监听器
            this.initializeEventListeners();
            
            // 加载配置
            await this.loadConfig();
            
            // 填充表单
            await this.populateForm();
            
            // 设置模式切换
            this.setupModeToggle();
            
            console.log('配置页面初始化完成');
        } catch (error) {
            console.error('初始化配置页面失败:', error);
            this.showStatus('初始化失败: ' + error.message, 'error');
        }
    }

    initializeEventListeners() {
        // 保存按钮
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveConfig();
        });

        // 导入按钮
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        // 导出按钮
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportConfig();
        });

        // 文件导入
        document.getElementById('import-file').addEventListener('change', (event) => {
            this.importConfig(event);
        });

        // 测试AI连接按钮
        document.getElementById('test-ai-btn').addEventListener('click', () => {
            this.testAIConnection();
        });

        // 刷新模型列表按钮
        document.getElementById('refresh-models').addEventListener('click', () => {
            this.refreshAIModels();
        });

        // 温度值滑块
        document.getElementById('ai-temperature').addEventListener('input', (event) => {
            document.getElementById('temperature-value').textContent = event.target.value;
        });

        // 端点选择器变化事件
        document.getElementById('ai-endpoint-select').addEventListener('change', (event) => {
            this.toggleCustomEndpointInput();
        });

        // 导出包含评论选项变化事件
        document.getElementById('export-include-comments').addEventListener('change', (event) => {
            this.toggleExportCommentsSort();
        });

        // 实时保存配置
        this.setupAutoSave();
    }

    toggleCustomEndpointInput() {
        const select = document.getElementById('ai-endpoint-select');
        const customInput = document.getElementById('ai-endpoint-custom');
        
        if (select.value === 'custom') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    }

    toggleExportCommentsSort() {
        const checkbox = document.getElementById('export-include-comments');
        const container = document.getElementById('export-comments-sort-container');
        
        if (checkbox.checked) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    setupAutoSave() {
        // 为所有配置输入元素设置自动保存
        const configInputs = document.querySelectorAll('input, select, textarea');
        
        configInputs.forEach(input => {
            // 为模型选择器添加特殊处理
            if (input.id === 'ai-model') {
                input.addEventListener('change', () => {
                    // 立即保存配置，确保模型选择持久化
                    this.saveConfig(false);
                });
            } else {
                input.addEventListener('change', () => {
                    // 延迟保存，避免频繁保存
                    clearTimeout(this.autoSaveTimeout);
                    this.autoSaveTimeout = setTimeout(() => {
                        this.saveConfig(false); // 静默保存
                    }, 1000);
                });
            }
        });
    }

    async loadConfig() {
        try {
            const response = await this.sendMessage({ action: 'loadData', key: 'config' });
            
            if (response.success && response.data) {
                this.config = response.data;
            } else {
                // 使用默认配置
                this.config = this.getDefaultConfig();
                await this.saveConfig(false);
            }
        } catch (error) {
            console.error('加载配置失败:', error);
            this.config = this.getDefaultConfig();
        }
        
        // 加载完配置后填充表单
        await this.populateForm();
    }

    getDefaultConfig() {
        return (typeof DefaultConfig !== 'undefined') ? DefaultConfig : {};
    }

    /**
     * 获取默认分析模板（从 DefaultConfig 读取）
     * @returns {string}
     */
    getDefaultAnalysisTemplate() {
        const defaultConfig = this.getDefaultConfig();
        return defaultConfig?.ai?.analysisTemplate || '';
    }

    async populateForm() {
        try {
            const defaultConfig = this.getDefaultConfig();
            // AI配置
            const endpointSelect = document.getElementById('ai-endpoint-select');
            const customEndpointInput = document.getElementById('ai-endpoint-custom');
            
            // 处理端点选择
            if (this.config.ai.endpoint === 'https://api.openai.com/v1' ||
                this.config.ai.endpoint === 'https://openrouter.ai/api/v1' ||
                this.config.ai.endpoint === 'https://api.siliconflow.cn/v1' ||
                this.config.ai.endpoint === 'https://open.bigmodel.cn/api/paas/v4' ||
                this.config.ai.endpoint === 'https://api.deepseek.com/v1' ||
                this.config.ai.endpoint === 'https://api.moonshot.cn/v1') {
                endpointSelect.value = this.config.ai.endpoint;
                customEndpointInput.style.display = 'none';
            } else {
                endpointSelect.value = 'custom';
                customEndpointInput.value = this.config.ai.endpoint || '';
                customEndpointInput.style.display = 'block';
            }
            
            document.getElementById('ai-api-key').value = this.config.ai.apiKey || '';
            document.getElementById('ai-model').value = this.config.ai.model || '';
            document.getElementById('ai-temperature').value = this.config.ai.temperature || 0.7;
            document.getElementById('temperature-value').textContent = this.config.ai.temperature || 0.7;
            document.getElementById('ai-max-tokens').value = this.config.ai.maxTokens || 2000;
            document.getElementById('ai-analysis-template').value = this.config.ai.analysisTemplate || this.getDefaultAnalysisTemplate();

            // 尝试加载缓存的模型列表
            const hasLoadedModels = await this.loadCachedModels();
            if (!hasLoadedModels) {
                // 如果没有缓存，设置默认提示
                const modelSelect = document.getElementById('ai-model');
                modelSelect.innerHTML = '<option value="">请先配置API密钥并刷新模型列表</option>';
            }

            // 平台配置
            // YouTube
            document.getElementById('youtube-api-key').value = this.config.platforms.youtube.apiKey || '';
            // 使用公共配置的最大评论数
            document.getElementById('platform-max-comments').value = this.config.platforms.maxComments || 100;

            // TikTok
            document.getElementById('tiktok-mode').value = this.config.platforms.tiktok.mode || 'dom';

            // Twitter
            document.getElementById('twitter-mode').value = this.config.platforms.twitter.mode || 'dom';
            document.getElementById('twitter-bearer-token').value = this.config.platforms.twitter.bearerToken || '';
            document.getElementById('twitter-api-version').value = this.config.platforms.twitter.apiVersion || 'v2';

            // Bilibili
            document.getElementById('bilibili-mode').value = this.config.platforms.bilibili?.mode || 'dom';

            // 导出配置
            const exportConfig = this.config.platforms.export || {};
            document.getElementById('export-include-comments').checked = exportConfig.includeComments || false;
            document.getElementById('export-include-thinking').checked = exportConfig.includeThinking || false;
            document.getElementById('export-comments-sort').value = exportConfig.commentsSort || 'timestamp-desc';
            
            // 根据是否包含评论来显示/隐藏排序选项
            this.toggleExportCommentsSort();

        } catch (error) {
            console.error('填充表单失败:', error);
            this.showStatus('填充表单失败: ' + error.message, 'error');
        }
    }

    collectFormData() {
        const defaultConfig = this.getDefaultConfig();

        // 获取端点值
        let endpointValue;
        const endpointSelect = document.getElementById('ai-endpoint-select');
        if (endpointSelect.value === 'custom') {
            endpointValue = document.getElementById('ai-endpoint-custom').value.trim();
        } else {
            endpointValue = endpointSelect.value;
        }
        
        return {
            ai: {
                endpoint: endpointValue,
                apiKey: document.getElementById('ai-api-key').value.trim(),
                model: document.getElementById('ai-model').value.trim(),
                temperature: parseFloat(document.getElementById('ai-temperature').value),
                maxTokens: parseInt(document.getElementById('ai-max-tokens').value),
                analysisTemplate: document.getElementById('ai-analysis-template').value.trim()
            },
            platforms: {
                youtube: {
                    apiKey: document.getElementById('youtube-api-key').value.trim()
                },
                tiktok: {
                    mode: document.getElementById('tiktok-mode').value
                },
                twitter: {
                    mode: document.getElementById('twitter-mode').value,
                    bearerToken: document.getElementById('twitter-bearer-token').value.trim(),
                    apiVersion: document.getElementById('twitter-api-version').value
                },
                bilibili: {
                    mode: document.getElementById('bilibili-mode').value
                },
                // 公共配置
                maxComments: parseInt(document.getElementById('platform-max-comments').value),
                export: {
                    includeComments: document.getElementById('export-include-comments').checked,
                    includeThinking: document.getElementById('export-include-thinking').checked,
                    commentsSort: document.getElementById('export-comments-sort').value
                }
            }
        };
    }

    async saveConfig(showStatus = true) {
        try {
            if (this.isLoading) return;

            const newConfig = this.collectFormData();
            
            // 验证配置
            if (!this.validateConfig(newConfig)) {
                return;
            }

            this.config = newConfig;

            const response = await this.sendMessage({
                action: 'saveData',
                data: { config: this.config }
            });

            if (response.success) {
                if (showStatus) {
                    this.showStatus('配置保存成功', 'success');
                }
            } else {
                throw new Error(response.error || '保存失败');
            }

        } catch (error) {
            console.error('保存配置失败:', error);
            this.showStatus('保存配置失败: ' + error.message, 'error');
        }
    }

    validateConfig(config) {
        // 基本验证
        if (config.ai.temperature < 0 || config.ai.temperature > 2) {
            this.showStatus('温度值必须在0-2之间', 'error');
            return false;
        }

        if (config.ai.maxTokens < 100 || config.ai.maxTokens > 100000) {
                this.showStatus('最大令牌数必须在100-100000之间', 'error');
            return false;
        }

        // 使用公共配置的最大评论数验证
        if (config.platforms.maxComments < 10 || config.platforms.maxComments > 1000) {
            this.showStatus('最大评论数必须在10-1000之间', 'error');
            return false;
        }

        // 验证自定义端点
        if (document.getElementById('ai-endpoint-select').value === 'custom') {
            const customEndpoint = document.getElementById('ai-endpoint-custom').value.trim();
            if (!customEndpoint) {
                this.showStatus('请输入自定义API端点', 'error');
                return false;
            }
            try {
                new URL(customEndpoint);
            } catch (e) {
                this.showStatus('自定义API端点格式不正确', 'error');
                return false;
            }
        }

        return true;
    }

    async testAIConnection() {
        try {
            const testBtn = document.getElementById('test-ai-btn');
            const testResult = document.getElementById('ai-test-result');
            
            // 获取当前AI配置
            let endpointValue;
            const endpointSelect = document.getElementById('ai-endpoint-select');
            if (endpointSelect.value === 'custom') {
                endpointValue = document.getElementById('ai-endpoint-custom').value.trim();
            } else {
                endpointValue = endpointSelect.value;
            }
            
            const aiConfig = {
                endpoint: endpointValue,
                apiKey: document.getElementById('ai-api-key').value.trim(),
                model: document.getElementById('ai-model').value.trim() || 'gpt-3.5-turbo'
            };

            if (!aiConfig.endpoint || !aiConfig.apiKey) {
                testResult.textContent = '请先填写API端点和密钥';
                testResult.className = 'ml-4 text-sm text-red-600';
                return;
            }

            // 显示加载状态
            testBtn.querySelector('.test-text').classList.add('hidden');
            testBtn.querySelector('.test-loading').classList.remove('hidden');
            testBtn.disabled = true;
            testResult.textContent = '正在测试连接...';
            testResult.className = 'ml-4 text-sm text-blue-600';

            const response = await this.sendMessage({
                action: 'testAIConnection',
                config: aiConfig
            });

            if (response.success && response.result.success) {
                testResult.textContent = `连接成功! 模型: ${response.result.model || aiConfig.model}`;
                testResult.className = 'ml-4 text-sm text-green-600';
            } else {
                testResult.textContent = `连接失败: ${response.result.message || response.error}`;
                testResult.className = 'ml-4 text-sm text-red-600';
            }

        } catch (error) {
            console.error('测试AI连接失败:', error);
            document.getElementById('ai-test-result').textContent = `测试失败: ${error.message}`;
            document.getElementById('ai-test-result').className = 'ml-4 text-sm text-red-600';
        } finally {
            // 恢复按钮状态
            const testBtn = document.getElementById('test-ai-btn');
            testBtn.querySelector('.test-text').classList.remove('hidden');
            testBtn.querySelector('.test-loading').classList.add('hidden');
            testBtn.disabled = false;
        }
    }

    async refreshAIModels() {
        try {
            const refreshBtn = document.getElementById('refresh-models');
            const modelSelect = document.getElementById('ai-model');

            // 获取当前AI配置
            let endpointValue;
            const endpointSelect = document.getElementById('ai-endpoint-select');
            if (endpointSelect.value === 'custom') {
                endpointValue = document.getElementById('ai-endpoint-custom').value.trim();
            } else {
                endpointValue = endpointSelect.value;
            }

            const aiConfig = {
                endpoint: endpointValue,
                apiKey: document.getElementById('ai-api-key').value.trim()
            };

            if (!aiConfig.endpoint || !aiConfig.apiKey) {
                this.showStatus('请先填写API端点和密钥', 'warning');
                return;
            }

            // 显示加载状态
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<svg class="w-4 h-4 loading" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';

            const response = await this.sendMessage({
                action: 'getAIModels',
                config: aiConfig
            });

            if (response.success) {
                // 保存模型列表到缓存
                const modelsCache = {
                    endpoint: aiConfig.endpoint,
                    models: response.models,
                    timestamp: Date.now()
                };
                
                await this.sendMessage({
                    action: 'saveData',
                    data: { ai_models_cache: modelsCache }
                });

                // 更新界面
                this.populateModelSelect(response.models);
                this.showStatus('模型列表刷新成功', 'success');
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('刷新模型列表失败:', error);
            this.showStatus('刷新模型列表失败: ' + error.message, 'error');
        } finally {
            // 恢复按钮状态
            const refreshBtn = document.getElementById('refresh-models');
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
        }
    }

    // 填充模型选择器
    populateModelSelect(models) {
        const modelSelect = document.getElementById('ai-model');
        const currentSelection = modelSelect.value; // 保存当前选择
        
        // 清空现有选项
        modelSelect.innerHTML = '';
        
        // 添加新模型选项
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });

        // 恢复之前的选择
        if (currentSelection && modelSelect.querySelector(`option[value="${currentSelection}"]`)) {
            modelSelect.value = currentSelection;
        } else if (this.config.ai.model && modelSelect.querySelector(`option[value="${this.config.ai.model}"]`)) {
            modelSelect.value = this.config.ai.model;
        }
    }

    // 加载缓存的模型列表
    async loadCachedModels() {
        try {
            const response = await this.sendMessage({
                action: 'loadData',
                key: 'ai_models_cache'
            });
            
            if (response.success && response.data) {
                const cache = response.data;
                let endpointValue;
                const endpointSelect = document.getElementById('ai-endpoint-select');
                if (endpointSelect.value === 'custom') {
                    endpointValue = document.getElementById('ai-endpoint-custom').value.trim();
                } else {
                    endpointValue = endpointSelect.value;
                }
                
                // 检查缓存是否有效（同一端点且在24小时内）
                const isValidCache = cache.endpoint === endpointValue &&
                                  cache.models &&
                                  cache.timestamp &&
                                  (Date.now() - cache.timestamp) < 24 * 60 * 60 * 1000;
                
                if (isValidCache) {
                    this.populateModelSelect(cache.models);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('加载缓存模型失败:', error);
            return false;
        }
    }

    exportConfig() {
        try {
            const configToExport = this.collectFormData();
            
            // 清理敏感信息（可选）
            const exportData = JSON.parse(JSON.stringify(configToExport));
            // 可以选择是否包含API密钥
            // delete exportData.ai.apiKey;
            // delete exportData.platforms.youtube.apiKey;
            // ... 等等

            const dataStr = JSON.stringify(exportData, null, 2);
            const filename = `comment-insight-config-${new Date().toISOString().split('T')[0]}.json`;
            
            // 环境检测和回退机制
            if (this.canUseObjectURL()) {
                // 使用Object URL方式
                this.downloadWithObjectURL(dataStr, 'application/json', filename);
            } else {
                // 回退到Data URL方式
                this.downloadWithDataURL(dataStr, 'application/json', filename);
            }
            
            this.showStatus('配置导出成功', 'success');
            
        } catch (error) {
            console.error('导出配置失败:', error);
            this.showStatus('导出配置失败: ' + error.message, 'error');
        }
    }

    // 检测是否可以使用Object URL
    canUseObjectURL() {
        return typeof URL !== 'undefined' && 
               typeof URL.createObjectURL === 'function' && 
               typeof Blob === 'function';
    }

    // 使用Object URL下载
    downloadWithObjectURL(content, mimeType, filename) {
        const dataBlob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理Object URL
        setTimeout(() => {
            try {
                URL.revokeObjectURL(link.href);
            } catch (e) {
                console.warn('清理Object URL失败:', e);
            }
        }, 1000);
    }

    // 使用Data URL下载
    downloadWithDataURL(content, mimeType, filename) {
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        const dataURL = `data:${mimeType};base64,${base64Content}`;
        
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    importConfig(event) {
        try {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedConfig = JSON.parse(e.target.result);
                    
                    // 验证导入的配置结构
                    if (!this.validateImportedConfig(importedConfig)) {
                        throw new Error('配置文件格式不正确');
                    }
                    
                    // 合并配置（保持现有配置的结构）
                    this.config = this.mergeConfigs(this.config, importedConfig);
                    
                    // 更新表单
                    this.populateForm();
                    
                    // 保存配置
                    this.saveConfig();
                    
                    this.showStatus('配置导入成功', 'success');
                    
                } catch (error) {
                    console.error('解析配置文件失败:', error);
                    this.showStatus('配置文件格式错误: ' + error.message, 'error');
                }
            };
            
            reader.readAsText(file);
            
        } catch (error) {
            console.error('导入配置失败:', error);
            this.showStatus('导入配置失败: ' + error.message, 'error');
        }
    }

    validateImportedConfig(config) {
        // 检查必要的配置结构
        const requiredStructure = {
            ai: ['endpoint', 'model', 'temperature', 'maxTokens'],
            platforms: {
                youtube: [],
                tiktok: ['mode'],
                twitter: ['mode', 'apiVersion'],
                bilibili: ['mode'],
                maxComments: [], // 公共配置
                export: ['includeComments', 'commentsSort'] // 导出配置
            }
        };

        try {
            // 检查顶级结构
            if (!config.ai || !config.platforms) {
                return false;
            }

            // 检查AI配置
            for (const field of requiredStructure.ai) {
                if (!(field in config.ai)) {
                    return false;
                }
            }

            // 检查平台配置
            for (const [platform, fields] of Object.entries(requiredStructure.platforms)) {
                if (platform === 'export') {
                    // 特殊处理导出配置
                    if (!config.platforms.export) {
                        return false;
                    }
                    for (const field of fields) {
                        if (!(field in config.platforms.export)) {
                            return false;
                        }
                    }
                } else if (platform === 'maxComments') {
                    // 特殊处理公共配置
                    if (!(platform in config.platforms)) {
                        return false;
                    }
                } else {
                    // 处理平台特定配置
                    if (!config.platforms[platform]) {
                        return false;
                    }
                    for (const field of fields) {
                        if (!(field in config.platforms[platform])) {
                            return false;
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    mergeConfigs(current, imported) {
        const merged = JSON.parse(JSON.stringify(current));
        
        // 深度合并配置
        const deepMerge = (target, source) => {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    target[key] = target[key] || {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        };
        
        deepMerge(merged, imported);
        return merged;
    }

    async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    showStatus(message, type = 'info') {
        const statusBar = document.getElementById('status-bar');
        const statusIcon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        
        // 设置图标和颜色
        const statusConfig = {
            success: { color: 'bg-green-500', icon: '✓' },
            error: { color: 'bg-red-500', icon: '✗' },
            warning: { color: 'bg-yellow-500', icon: '⚠' },
            info: { color: 'bg-blue-500', icon: 'ℹ' }
        };
        
        const config = statusConfig[type] || statusConfig.info;
        
        statusIcon.className = `w-4 h-4 rounded-full ${config.color}`;
        statusIcon.textContent = config.icon;
        statusText.textContent = message;
        
        // 显示状态栏
        statusBar.classList.remove('hidden');
        
        // 3秒后隐藏
        setTimeout(() => {
            statusBar.classList.add('hidden');
        }, 3000);
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    setupModeToggle() {
        // Twitter模式切换
        const twitterMode = document.getElementById('twitter-mode');
        const twitterBearerToken = document.getElementById('twitter-bearer-token');
        const twitterApiVersion = document.getElementById('twitter-api-version');
        
        if (!twitterMode) {
            console.warn('Twitter模式选择器未找到');
            return;
        }
        
        const toggleTwitterFields = () => {
            try {
                const isApiMode = twitterMode.value === 'api';
                
                // 查找Bearer Token字段的父容器
                if (twitterBearerToken) {
                    const bearerTokenDiv = twitterBearerToken.closest('div');
                    if (bearerTokenDiv) {
                        bearerTokenDiv.style.display = isApiMode ? 'block' : 'none';
                    }
                }
                
                // 查找API Version字段的父容器
                if (twitterApiVersion) {
                    const apiVersionDiv = twitterApiVersion.closest('div');
                    if (apiVersionDiv) {
                        apiVersionDiv.style.display = isApiMode ? 'block' : 'none';
                    }
                }
            } catch (error) {
                console.error('切换Twitter字段显示失败:', error);
            }
        };
        
        twitterMode.addEventListener('change', toggleTwitterFields);
        
        // 初始化显示状态
        setTimeout(() => {
            toggleTwitterFields();
        }, 100);
    }
}

// 当DOM加载完成时初始化配置页面
document.addEventListener('DOMContentLoaded', () => {
    new CommentInsightOptions();
});