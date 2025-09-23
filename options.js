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
            this.populateForm();
            
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

        // 实时保存配置
        this.setupAutoSave();
    }

    setupAutoSave() {
        // 为所有配置输入元素设置自动保存
        const configInputs = document.querySelectorAll('input, select, textarea');
        
        configInputs.forEach(input => {
            input.addEventListener('change', () => {
                // 延迟保存，避免频繁保存
                clearTimeout(this.autoSaveTimeout);
                this.autoSaveTimeout = setTimeout(() => {
                    this.saveConfig(false); // 静默保存
                }, 1000);
            });
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
    }

    getDefaultConfig() {
        return {
            ai: {
                endpoint: 'https://api.openai.com/v1',
                apiKey: '',
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                maxTokens: 2000,
                systemPrompt: '你是一个专业的社交媒体评论分析师。请分析提供的评论数据，生成包含关键洞察、情感分析、主要主题和趋势的结构化摘要。'
            },
            platforms: {
                youtube: {
                    apiKey: '',
                    maxComments: 100
                },
                tiktok: {
                    mode: 'dom',
                    delay: 1000
                },
                instagram: {
                    token: '',
                    appId: ''
                },
                facebook: {
                    appId: '',
                    appSecret: ''
                },
                twitter: {
                    bearerToken: '',
                    apiVersion: 'v2'
                }
            },
            export: {
                csv: true,
                markdown: true,
                json: false,
                filenamePattern: '{platform}_{title}_{date}'
            }
        };
    }

    populateForm() {
        try {
            // AI配置
            document.getElementById('ai-endpoint').value = this.config.ai.endpoint || '';
            document.getElementById('ai-api-key').value = this.config.ai.apiKey || '';
            document.getElementById('ai-model').value = this.config.ai.model || '';
            document.getElementById('ai-temperature').value = this.config.ai.temperature || 0.7;
            document.getElementById('temperature-value').textContent = this.config.ai.temperature || 0.7;
            document.getElementById('ai-max-tokens').value = this.config.ai.maxTokens || 2000;
            document.getElementById('ai-system-prompt').value = this.config.ai.systemPrompt || '';

            // 平台配置
            // YouTube
            document.getElementById('youtube-api-key').value = this.config.platforms.youtube.apiKey || '';
            document.getElementById('youtube-max-comments').value = this.config.platforms.youtube.maxComments || 100;

            // TikTok
            document.getElementById('tiktok-mode').value = this.config.platforms.tiktok.mode || 'dom';
            document.getElementById('tiktok-delay').value = this.config.platforms.tiktok.delay || 1000;

            // Instagram
            document.getElementById('instagram-token').value = this.config.platforms.instagram.token || '';
            document.getElementById('instagram-app-id').value = this.config.platforms.instagram.appId || '';

            // Facebook
            document.getElementById('facebook-app-id').value = this.config.platforms.facebook.appId || '';
            document.getElementById('facebook-app-secret').value = this.config.platforms.facebook.appSecret || '';

            // Twitter
            document.getElementById('twitter-bearer-token').value = this.config.platforms.twitter.bearerToken || '';
            document.getElementById('twitter-api-version').value = this.config.platforms.twitter.apiVersion || 'v2';

            // 导出设置
            document.getElementById('export-csv').checked = this.config.export.csv || false;
            document.getElementById('export-markdown').checked = this.config.export.markdown || false;
            document.getElementById('export-json').checked = this.config.export.json || false;
            document.getElementById('export-filename-pattern').value = this.config.export.filenamePattern || '{platform}_{title}_{date}';

        } catch (error) {
            console.error('填充表单失败:', error);
            this.showStatus('填充表单失败: ' + error.message, 'error');
        }
    }

    collectFormData() {
        return {
            ai: {
                endpoint: document.getElementById('ai-endpoint').value.trim(),
                apiKey: document.getElementById('ai-api-key').value.trim(),
                model: document.getElementById('ai-model').value.trim(),
                temperature: parseFloat(document.getElementById('ai-temperature').value),
                maxTokens: parseInt(document.getElementById('ai-max-tokens').value),
                systemPrompt: document.getElementById('ai-system-prompt').value.trim()
            },
            platforms: {
                youtube: {
                    apiKey: document.getElementById('youtube-api-key').value.trim(),
                    maxComments: parseInt(document.getElementById('youtube-max-comments').value)
                },
                tiktok: {
                    mode: document.getElementById('tiktok-mode').value,
                    delay: parseInt(document.getElementById('tiktok-delay').value)
                },
                instagram: {
                    token: document.getElementById('instagram-token').value.trim(),
                    appId: document.getElementById('instagram-app-id').value.trim()
                },
                facebook: {
                    appId: document.getElementById('facebook-app-id').value.trim(),
                    appSecret: document.getElementById('facebook-app-secret').value.trim()
                },
                twitter: {
                    bearerToken: document.getElementById('twitter-bearer-token').value.trim(),
                    apiVersion: document.getElementById('twitter-api-version').value
                }
            },
            export: {
                csv: document.getElementById('export-csv').checked,
                markdown: document.getElementById('export-markdown').checked,
                json: document.getElementById('export-json').checked,
                filenamePattern: document.getElementById('export-filename-pattern').value.trim()
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

        if (config.platforms.youtube.maxComments < 10 || config.platforms.youtube.maxComments > 1000) {
            this.showStatus('YouTube最大评论数必须在10-1000之间', 'error');
            return false;
        }

        if (config.platforms.tiktok.delay < 500 || config.platforms.tiktok.delay > 5000) {
            this.showStatus('TikTok延迟设置必须在500-5000ms之间', 'error');
            return false;
        }

        return true;
    }

    async testAIConnection() {
        try {
            const testBtn = document.getElementById('test-ai-btn');
            const testResult = document.getElementById('ai-test-result');
            
            // 获取当前AI配置
            const aiConfig = {
                endpoint: document.getElementById('ai-endpoint').value.trim(),
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
            const aiConfig = {
                endpoint: document.getElementById('ai-endpoint').value.trim(),
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
                // 清空现有选项
                modelSelect.innerHTML = '';
                
                // 添加新模型选项
                response.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name;
                    modelSelect.appendChild(option);
                });

                // 恢复之前选择的模型
                if (this.config.ai.model) {
                    modelSelect.value = this.config.ai.model;
                }

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
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `comment-insight-config-${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showStatus('配置导出成功', 'success');
            
        } catch (error) {
            console.error('导出配置失败:', error);
            this.showStatus('导出配置失败: ' + error.message, 'error');
        }
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
                youtube: ['maxComments'],
                tiktok: ['mode', 'delay'],
                instagram: [],
                facebook: [],
                twitter: ['apiVersion']
            },
            export: ['csv', 'markdown', 'json', 'filenamePattern']
        };

        try {
            // 检查顶级结构
            if (!config.ai || !config.platforms || !config.export) {
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
                if (!config.platforms[platform]) {
                    return false;
                }
                for (const field of fields) {
                    if (!(field in config.platforms[platform])) {
                        return false;
                    }
                }
            }

            // 检查导出配置
            for (const field of requiredStructure.export) {
                if (!(field in config.export)) {
                    return false;
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
}

// 当DOM加载完成时初始化配置页面
document.addEventListener('DOMContentLoaded', () => {
    new CommentInsightOptions();
}); 