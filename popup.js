// 弹出窗口脚本 - 处理用户界面交互和与后台脚本的通信
class CommentInsightPopup {
    constructor() {
        this.currentTab = null;
        this.currentPlatform = null;
        this.currentComments = [];
        this.currentAnalysis = null;
        this.config = null;
        
        this.initializePopup();
    }

    async initializePopup() {
        try {
            // 获取当前标签页
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];

            // 加载配置
            await this.loadConfig();

            // 初始化UI事件监听器
            this.initializeEventListeners();

            // 检测当前平台
            await this.detectPlatform();

            // 加载已保存的数据
            await this.loadSavedData();

        } catch (error) {
            console.error('初始化弹出窗口失败:', error);
            this.showNotification('初始化失败: ' + error.message, 'error');
        }
    }

    initializeEventListeners() {
        // 设置按钮
        document.getElementById('settings-btn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // 提取评论按钮
        document.getElementById('extract-btn').addEventListener('click', () => {
            this.extractComments();
        });

        // AI分析按钮
        document.getElementById('analyze-btn').addEventListener('click', () => {
            this.analyzeComments();
        });

        // 查看评论按钮
        document.getElementById('view-comments-btn').addEventListener('click', () => {
            this.viewComments();
        });

        // 查看分析按钮
        document.getElementById('view-analysis-btn').addEventListener('click', () => {
            this.viewAnalysis();
        });

        // 导出按钮
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        // 历史记录按钮
        document.getElementById('history-btn').addEventListener('click', () => {
            this.viewHistory();
        });
    }

    async loadConfig() {
        try {
            const response = await this.sendMessage({ action: 'loadData', key: 'config' });
            if (response.success) {
                this.config = response.data || this.getDefaultConfig();
            } else {
                this.config = this.getDefaultConfig();
            }
        } catch (error) {
            console.warn('加载配置失败，使用默认配置:', error);
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
                systemPrompt: '你是一个专业的社交媒体评论分析师。'
            },
            platforms: {
                youtube: { apiKey: '', maxComments: 100 },
                tiktok: { mode: 'dom', delay: 1000 },
                instagram: { token: '', appId: '' },
                facebook: { appId: '', appSecret: '' },
                twitter: { bearerToken: '', apiVersion: 'v2' }
            },
            export: {
                csv: true,
                markdown: true,
                json: false,
                filenamePattern: '{platform}_{title}_{date}'
            }
        };
    }

    async detectPlatform() {
        try {
            if (!this.currentTab) return;

            const response = await this.sendMessage({
                action: 'detectPlatform',
                url: this.currentTab.url
            });

            if (response.success) {
                this.currentPlatform = response.platform;
                this.updatePlatformUI();
            }
        } catch (error) {
            console.error('检测平台失败:', error);
        }
    }

    updatePlatformUI() {
        const platformIcons = {
            youtube: '📺',
            tiktok: '🎵',
            instagram: '📷',
            facebook: '👥',
            twitter: '🐦',
            unknown: '❓'
        };

        const platformNames = {
            youtube: 'YouTube',
            tiktok: 'TikTok',
            instagram: 'Instagram',
            facebook: 'Facebook',
            twitter: 'Twitter/X',
            unknown: '未知平台'
        };

        const platformIconElement = document.getElementById('platform-icon');
        const platformNameElement = document.getElementById('platform-name');
        const pageTitleElement = document.getElementById('page-title');

        if (this.currentPlatform) {
            const platform = this.currentPlatform.name;
            platformIconElement.innerHTML = platformIcons[platform] || platformIcons.unknown;
            platformNameElement.textContent = platformNames[platform] || '未知平台';
            pageTitleElement.textContent = this.currentTab.title || '页面标题';

            // 更新按钮状态
            const extractBtn = document.getElementById('extract-btn');
            if (this.currentPlatform.supported) {
                extractBtn.disabled = false;
                platformIconElement.className = 'w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center';
            } else {
                extractBtn.disabled = true;
                platformIconElement.className = 'w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center';
                this.showNotification('当前平台暂不支持', 'warning');
            }
        }
    }

    async loadSavedData() {
        try {
            const currentPageKey = this.generatePageKey();
            const response = await this.sendMessage({
                action: 'loadData',
                key: `comments_${currentPageKey}`
            });

            if (response.success && response.data) {
                this.currentComments = response.data.comments || [];
                this.currentAnalysis = response.data.analysis || null;
                this.updateUI();
            }
        } catch (error) {
            console.warn('加载已保存数据失败:', error);
        }
    }

    generatePageKey() {
        // 基于URL生成页面唯一键
        return btoa(this.currentTab.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }

    async extractComments() {
        try {
            if (!this.currentPlatform || !this.currentPlatform.supported) {
                this.showNotification('当前平台不支持评论提取', 'error');
                return;
            }

            // 检查配置
            if (!this.validatePlatformConfig()) {
                this.showNotification('请先在设置页面配置相关平台的API密钥', 'warning');
                chrome.runtime.openOptionsPage();
                return;
            }

            this.setLoadingState('extract', true);

            const response = await this.sendMessage({
                action: 'extractComments',
                platform: this.currentPlatform.name,
                url: this.currentTab.url,
                config: this.config
            });

            if (response.success) {
                this.currentComments = response.comments;
                await this.saveCurrentData();
                this.updateUI();
                this.showNotification(`成功提取 ${response.comments.length} 条评论`, 'success');
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('提取评论失败:', error);
            this.showNotification('提取评论失败: ' + error.message, 'error');
        } finally {
            this.setLoadingState('extract', false);
        }
    }

    async analyzeComments() {
        try {
            if (!this.currentComments || this.currentComments.length === 0) {
                this.showNotification('请先提取评论数据', 'warning');
                return;
            }

            if (!this.config.ai.apiKey) {
                this.showNotification('请先配置AI API密钥', 'warning');
                chrome.runtime.openOptionsPage();
                return;
            }

            this.setLoadingState('analyze', true);

            const response = await this.sendMessage({
                action: 'analyzeComments',
                comments: this.currentComments,
                config: this.config
            });

            if (response.success) {
                this.currentAnalysis = response.analysis;
                await this.saveCurrentData();
                this.updateUI();
                this.showNotification('AI分析完成', 'success');
            } else {
                throw new Error(response.error);
            }

        } catch (error) {
            console.error('AI分析失败:', error);
            this.showNotification('AI分析失败: ' + error.message, 'error');
        } finally {
            this.setLoadingState('analyze', false);
        }
    }

    validatePlatformConfig() {
        const platform = this.currentPlatform.name;
        
        switch (platform) {
            case 'youtube':
                return this.config.platforms.youtube.apiKey;
            case 'instagram':
                return this.config.platforms.instagram.token;
            case 'facebook':
                return this.config.platforms.facebook.appId;
            case 'twitter':
                return this.config.platforms.twitter.bearerToken;
            case 'tiktok':
                return true; // TikTok使用DOM解析，不需要API密钥
            default:
                return false;
        }
    }

    async saveCurrentData() {
        try {
            const currentPageKey = this.generatePageKey();
            const data = {
                comments: this.currentComments,
                analysis: this.currentAnalysis,
                platform: this.currentPlatform.name,
                url: this.currentTab.url,
                title: this.currentTab.title,
                timestamp: new Date().toISOString()
            };

            await this.sendMessage({
                action: 'saveData',
                data: { [`comments_${currentPageKey}`]: data }
            });

            // 同时保存到历史记录，传递dataKey
            await this.saveToHistory(data, currentPageKey);

        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }

    async saveToHistory(data, dataKey) {
        try {
            const response = await this.sendMessage({
                action: 'loadData',
                key: 'analysis_history'
            });

            let history = response.success ? (response.data || []) : [];
            
            // 添加新记录
            history.unshift({
                id: Date.now().toString(),
                dataKey: dataKey, // 使用传入的dataKey
                platform: data.platform,
                title: data.title,
                url: data.url,
                commentCount: data.comments?.length || 0,
                hasAnalysis: !!data.analysis,
                timestamp: data.timestamp
            });

            // 保持最多100条历史记录
            if (history.length > 100) {
                history = history.slice(0, 100);
            }

            await this.sendMessage({
                action: 'saveData',
                data: { analysis_history: history }
            });

        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }

    updateUI() {
        // 更新评论数量
        document.getElementById('comment-count').textContent = this.currentComments.length;

        // 更新最后分析时间
        const lastAnalysisElement = document.getElementById('last-analysis');
        if (this.currentAnalysis) {
            const analysisTime = new Date(this.currentAnalysis.timestamp);
            lastAnalysisElement.textContent = analysisTime.toLocaleString('zh-CN');
        } else {
            lastAnalysisElement.textContent = '未分析';
        }

        // 更新按钮状态
        const analyzeBtn = document.getElementById('analyze-btn');
        const viewCommentsBtn = document.getElementById('view-comments-btn');
        const viewAnalysisBtn = document.getElementById('view-analysis-btn');
        const exportBtn = document.getElementById('export-btn');

        analyzeBtn.disabled = this.currentComments.length === 0;
        viewCommentsBtn.disabled = this.currentComments.length === 0;
        viewAnalysisBtn.disabled = !this.currentAnalysis;
        exportBtn.disabled = this.currentComments.length === 0 && !this.currentAnalysis;
    }

    setLoadingState(action, loading) {
        const buttons = {
            extract: document.getElementById('extract-btn'),
            analyze: document.getElementById('analyze-btn')
        };

        const button = buttons[action];
        if (!button) return;

        const textSpan = button.querySelector(`.${action}-text`);
        const loadingSpan = button.querySelector(`.${action}-loading`);

        if (loading) {
            button.disabled = true;
            textSpan.classList.add('hidden');
            loadingSpan.classList.remove('hidden');
        } else {
            button.disabled = false;
            textSpan.classList.remove('hidden');
            loadingSpan.classList.add('hidden');
        }
    }

    viewComments() {
        // 创建评论查看页面
        this.openViewerPage('comments');
    }

    viewAnalysis() {
        // 创建分析查看页面
        this.openViewerPage('analysis');
    }

    viewHistory() {
        // 创建历史记录页面
        this.openViewerPage('history');
    }

    openViewerPage(type) {
        const url = chrome.runtime.getURL(`viewer.html?type=${type}&key=${this.generatePageKey()}`);
        chrome.tabs.create({ url });
    }

    async exportData() {
        try {
            if (!this.currentComments || this.currentComments.length === 0) {
                this.showNotification('没有可导出的数据', 'warning');
                return;
            }

            const data = {
                comments: this.currentComments,
                analysis: this.currentAnalysis,
                platform: this.currentPlatform.name,
                url: this.currentTab.url,
                title: this.currentTab.title,
                timestamp: new Date().toISOString()
            };

            const exportConfig = this.config.export;
            const baseFilename = this.generateFilename();

            const exports = [];

            if (exportConfig.csv) {
                exports.push(this.sendMessage({
                    action: 'exportData',
                    data: data,
                    format: 'csv',
                    filename: `${baseFilename}.csv`
                }));
            }

            if (exportConfig.markdown) {
                exports.push(this.sendMessage({
                    action: 'exportData',
                    data: data,
                    format: 'markdown',
                    filename: `${baseFilename}.md`
                }));
            }

            if (exportConfig.json) {
                exports.push(this.sendMessage({
                    action: 'exportData',
                    data: data,
                    format: 'json',
                    filename: `${baseFilename}.json`
                }));
            }

            await Promise.all(exports);
            this.showNotification('数据导出成功', 'success');

        } catch (error) {
            console.error('导出数据失败:', error);
            this.showNotification('导出数据失败: ' + error.message, 'error');
        }
    }

    generateFilename() {
        const pattern = this.config.export.filenamePattern;
        const now = new Date();
        
        return pattern
            .replace('{platform}', this.currentPlatform.name)
            .replace('{title}', this.sanitizeFilename(this.currentTab.title))
            .replace('{date}', now.toISOString().split('T')[0])
            .replace('{time}', now.toTimeString().split(' ')[0].replace(/:/g, '-'));
    }

    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    }

    async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        
        // 设置消息内容
        notificationText.textContent = message;
        
        // 设置样式
        notification.className = `fixed top-4 right-4 p-3 rounded-lg shadow-lg transform transition-transform duration-300 z-50`;
        
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-500', 'text-white');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-500', 'text-white');
                break;
            case 'error':
                notification.classList.add('bg-red-500', 'text-white');
                break;
            default:
                notification.classList.add('bg-blue-500', 'text-white');
        }
        
        // 显示通知
        notification.style.transform = 'translateX(0)';
        
        // 3秒后隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.className = notification.className.replace(/bg-\w+-500/g, '');
            }, 300);
        }, 3000);
    }
}

// 当DOM加载完成时初始化弹出窗口
document.addEventListener('DOMContentLoaded', () => {
    new CommentInsightPopup();
}); 