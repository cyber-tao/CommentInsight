// 弹出窗口脚本 - 处理用户界面交互和与后台脚本的通信
class CommentInsightPopup {
    constructor() {
        this.currentTab = null;
        this.currentPlatform = null;
        this.currentComments = [];
        this.currentAnalysis = null;
        this.config = null;
        this.currentDescription = ''; // 视频简介
        
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

            // 监听标签页切换
            this.setupTabListener();

            // 检测当前平台
            await this.detectPlatform();

            // 加载已保存的数据
            await this.loadSavedData();

            // 更新版本和模型显示
            this.updateVersionDisplay();
            this.updateAIModelDisplay();

        } catch (error) {
            console.error('初始化弹出窗口失败:', error);
            this.showNotification('初始化失败: ' + error.message, 'error');
        }
    }

    updateVersionDisplay() {
        const manifest = chrome.runtime.getManifest();
        const versionDisplay = document.getElementById('extension-version');
        if (versionDisplay) {
            versionDisplay.textContent = `v${manifest.version}`;
        }
    }

    updateAIModelDisplay() {
        const modelDisplay = document.getElementById('ai-model-display');
        if (this.config && this.config.ai && this.config.ai.model) {
            // 简化模型名显示
            let modelName = this.config.ai.model;
            // 如果模型名太长，进行简化显示
            if (modelName.length > 25) {
                modelName = modelName.substring(0, 22) + '...';
            }
            modelDisplay.textContent = `模型: ${modelName}`;
        } else {
            modelDisplay.textContent = '未配置AI模型';
        }
    }

    setupTabListener() {
        // 监听活动标签页变化
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            await this.onTabChanged(activeInfo.tabId, { isTabSwitch: true });
        });

        // 监听标签页更新（URL变化或标题变化）
        chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            // 只处理当前活动标签页的更新
            const currentTabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (currentTabs.length > 0 && currentTabs[0].id === tabId) {
                // URL变化时立即更新
                if (changeInfo.url) {
                    console.log('检测到URL变化:', changeInfo.url);
                    await this.onTabChanged(tabId, { isUrlChange: true });
                }
                // 页面加载完成时更新标题（无论URL是否变化）
                if (changeInfo.status === 'complete' && this.currentTab && this.currentTab.id === tabId) {
                    console.log('页面加载完成，更新标题');
                    await this.updateTabTitle(tabId);
                }
            }
        });

        // 监听来自content script的YouTube SPA导航通知
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'youtubeNavigated') {
                console.log('接收到YouTube SPA导航通知:', message.url, message.title);
                // 检查是否是当前标签页
                if (sender.tab && this.currentTab && sender.tab.id === this.currentTab.id) {
                    // 更新当前标签页信息
                    this.currentTab.url = message.url;
                    this.currentTab.title = message.title;
                    
                    // 重置评论和分析数据
                    this.currentComments = [];
                    this.currentAnalysis = null;
                    
                    // 重新检测平台并更新UI
                    this.detectPlatform(true).then(() => {
                        // 加载新页面的数据
                        return this.loadSavedData();
                    }).catch(err => {
                        console.error('处理YouTube导航失败:', err);
                    });
                }
            }
        });
    }

    async onTabChanged(tabId, changeInfo = {}) {
        try {
            // 获取新的标签页信息
            const tab = await chrome.tabs.get(tabId);
            
            // 检查是否是插件自己的页面（viewer.html, options.html等）
            const isExtensionPage = tab.url && tab.url.startsWith('chrome-extension://');
            
            // 如果是插件页面，不更新面板
            if (isExtensionPage) {
                console.log('切换到插件页面，保持当前状态');
                return;
            }
            
            // 如果URL没有变化，只更新标题
            if (this.currentTab && this.currentTab.url === tab.url) {
                // 只更新标题，不重新加载数据
                if (this.currentTab.title !== tab.title) {
                    this.currentTab.title = tab.title;
                    this.updatePlatformUI();
                }
                return;
            }

            // URL变化了，完全重置状态
            // 区分场景：TAB切换时使用当前标题，URL变化时使用临时标题
            if (changeInfo.isTabSwitch) {
                // TAB切换：页面已经加载完成，直接使用tab的标题
                this.currentTab = tab;
                console.log('TAB切换，使用当前标题:', tab.title);
            } else if (changeInfo.isUrlChange) {
                // URL变化：页面正在加载，使用临时标题
                this.currentTab = {
                    id: tab.id,
                    url: tab.url,
                    title: '加载中...'
                };
                console.log('URL变化，等待标题加载');
            } else {
                // 其他情况，使用tab的标题
                this.currentTab = tab;
            }
            
            this.currentComments = [];
            this.currentAnalysis = null;

            // 重新检测平台
            // TAB切换时可以立即获取标题，URL变化时等页面加载完成
            await this.detectPlatform(changeInfo.isTabSwitch);

            // 加载新页面的数据（从历史记录恢复）
            await this.loadSavedData();

            console.log('页面已切换，面板已更新');
        } catch (error) {
            console.error('页面切换处理失败:', error);
        }
    }

    async updateTabTitle(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            
            if (!this.currentTab || this.currentTab.id !== tabId) {
                console.log('updateTabTitle: tab不匹配，跳过');
                return;
            }

            // 直接使用tab.title，Chrome已经帮我们管理好了
            const oldTitle = this.currentTab.title;
            this.currentTab.title = tab.title;
            console.log('updateTabTitle: 标题更新', {
                旧标题: oldTitle,
                新标题: tab.title,
                URL: tab.url
            });
            
            this.updatePlatformUI();
        } catch (error) {
            console.warn('更新标题失败:', error);
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

        // 历史记录按钮
        document.getElementById('view-history-btn').addEventListener('click', () => {
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
        // 统一从 DefaultConfig 获取
        return (typeof DefaultConfig !== 'undefined') ? DefaultConfig : {};
    }

    async detectPlatform(fetchTitle = true) {
        try {
            if (!this.currentTab) return;

            const response = await this.sendMessage({
                action: 'detectPlatform',
                url: this.currentTab.url
            });

            if (response.success) {
                this.currentPlatform = response.platform;
                
                // 只在需要时获取标题和简介（初始化时获取，URL变化时不获取，等页面加载完成再获取）
                if (fetchTitle && this.currentPlatform.supported) {
                    try {
                        const platformInfo = await this.sendMessageToTab({
                            action: 'getPlatformInfo'
                        });
                        
                        if (platformInfo.success) {
                            if (platformInfo.title) {
                                this.currentTab.title = platformInfo.title;
                                console.log('从content script获取标题:', platformInfo.title);
                            }
                            if (platformInfo.description) {
                                this.currentDescription = platformInfo.description;
                                console.log('从content script获取简介:', platformInfo.description.substring(0, 100) + '...');
                            }
                        }
                    } catch (e) {
                        console.warn('获取平台信息失败:', e);
                    }
                }
                
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
            bilibili: '🌸',
            unknown: '❓'
        };

        const platformNames = {
            youtube: 'YouTube',
            tiktok: 'TikTok',
            instagram: 'Instagram',
            facebook: 'Facebook',
            twitter: 'Twitter/X',
            bilibili: 'Bilibili',
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
                platformIconElement.className = 'w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center';
            } else {
                extractBtn.disabled = true;
                platformIconElement.className = 'w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center';
                // 不在这里显示提示，等用户点击按钮时再提示
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
                console.log('从历史记录恢复数据:', {
                    commentCount: this.currentComments.length,
                    hasAnalysis: !!this.currentAnalysis
                });
            } else {
                // 没有历史数据，重置为空
                this.currentComments = [];
                this.currentAnalysis = null;
            }
            
            // 更新UI显示
            this.updateUI();
        } catch (error) {
            console.warn('加载已保存数据失败:', error);
            // 出错时也要重置数据
            this.currentComments = [];
            this.currentAnalysis = null;
            this.updateUI();
        }
    }

    generatePageKey(url = null) {
        // 基于URL生成页面唯一键（Unicode安全）
        // 如果提供url参数，使用该url；否则使用当前标签页url
        const targetUrl = url || (this.currentTab?.url || '');
        
        // 使用简单哈希函数确保同一URL生成相同key
        let hash = 0;
        for (let i = 0; i < targetUrl.length; i++) {
            const char = targetUrl.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return Math.abs(hash).toString(36).substring(0, 16);
    }

    getTotalCommentCount(comments) {
        // 所有评论都在平级数组中，直接返回长度
        return comments.length;
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

            // 🔒 锁定当前视频信息（防止标签页切换导致数据错乱）
            const videoSnapshot = {
                url: this.currentTab.url,
                title: this.currentTab.title,
                tabId: this.currentTab.id,
                platform: this.currentPlatform.name,
                description: this.currentDescription || ''
            };
            
            console.log('🔒 锁定视频信息:', {
                title: videoSnapshot.title,
                url: videoSnapshot.url
            });

            this.setLoadingState('extract', true);
            this.showNotification('正在提取评论，请勿关闭侧边栏...', 'warning');

            const response = await this.sendMessage({
                action: 'extractComments',
                platform: videoSnapshot.platform,
                url: videoSnapshot.url,
                config: this.config,
                tabId: videoSnapshot.tabId
            });

            if (response.success) {
                console.log('✅ 提取成功，评论数量:', response.comments.length);
                console.log('📊 评论数据结构检查:');
                console.log('  - 第一条评论:', response.comments[0]);
                console.log('  - 有parentId字段:', response.comments.every(c => 'parentId' in c));
                console.log('  - 主评论数:', response.comments.filter(c => c.parentId === "0").length);
                console.log('  - 回复数:', response.comments.filter(c => c.parentId !== "0").length);
                
                // 检查当前URL是否与操作开始时的URL一致
                const currentUrl = this.currentTab?.url || '';
                const isCurrentTab = (currentUrl === videoSnapshot.url);
                
                if (isCurrentTab) {
                    // URL一致，更新内存中的数据
                    this.currentComments = response.comments;
                } else {
                    // URL不一致，创建临时数据用于保存
                    console.log('⚠️ 标签页已切换，不更新内存数据');
                }
                
                // 使用快照保存数据到存储（总是保存）
                const tempComments = isCurrentTab ? this.currentComments : response.comments;
                await this.saveDataWithSnapshot(videoSnapshot, tempComments, this.currentAnalysis);
                
                if (isCurrentTab) {
                    // URL一致，更新UI
                    this.updateUI();
                    this.showNotification(`成功提取 ${response.comments.length} 条评论（含回复）`, 'success');
                    console.log('✅ 更新UI（当前标签页匹配）');
                } else {
                    // URL不一致，静默完成
                    console.log('💾 数据已保存，但不更新UI');
                    console.log('  - 操作URL:', videoSnapshot.url);
                    console.log('  - 当前URL:', currentUrl);
                }
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

            // 🔒 锁定当前视频信息（防止标签页切换导致数据错乱）
            const videoSnapshot = {
                url: this.currentTab.url,
                title: this.currentTab.title,
                tabId: this.currentTab.id,
                platform: this.currentPlatform.name,
                description: this.currentDescription || ''
            };
            
            console.log('🔒 锁定视频信息（分析）:', {
                title: videoSnapshot.title,
                url: videoSnapshot.url
            });

            this.setLoadingState('analyze', true);
            this.showNotification('正在进行AI分析，请勿关闭侧边栏...', 'warning');

            const startTime = Date.now(); // 记录开始时间

            // currentComments已经是平级结构，直接使用
            const comments = this.currentComments;

            const response = await this.sendMessage({
                action: 'analyzeComments',
                comments: comments,
                config: this.config,
                videoTitle: videoSnapshot.title || '',
                videoDescription: videoSnapshot.description || ''
            });

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2); // 计算耗时

            if (response.success) {
                // 保存统计信息
                response.analysis.elapsedTime = elapsedTime;
                
                // 检查当前URL是否与操作开始时的URL一致
                const currentUrl = this.currentTab?.url || '';
                const isCurrentTab = (currentUrl === videoSnapshot.url);
                
                if (isCurrentTab) {
                    // URL一致，更新内存中的数据
                    this.currentAnalysis = response.analysis;
                } else {
                    // URL不一致，不更新内存数据
                    console.log('⚠️ 标签页已切换，不更新内存数据');
                }
                
                // 使用快照保存数据到存储（总是保存）
                const tempAnalysis = isCurrentTab ? this.currentAnalysis : response.analysis;
                await this.saveDataWithSnapshot(videoSnapshot, this.currentComments, tempAnalysis);
                
                if (isCurrentTab) {
                    // URL一致，更新UI
                    this.updateUI();
                    this.showNotification('AI分析完成', 'success');
                    console.log('✅ 更新UI（当前标签页匹配）');
                } else {
                    // URL不一致，静默完成
                    console.log('💾 分析结果已保存，但不更新UI');
                    console.log('  - 操作URL:', videoSnapshot.url);
                    console.log('  - 当前URL:', currentUrl);
                }
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
            case 'twitter':
                return this.config.platforms.twitter.bearerToken;
            case 'tiktok':
                return true; // TikTok使用DOM解析，不需要API密钥
            case 'bilibili':
                return true; // Bilibili使用DOM解析，不需要API密钥
            default:
                return false;
        }
    }

    async saveCurrentData(videoSnapshot = null) {
        try {
            // 使用快照信息（如果提供）或当前标签页信息
            const url = videoSnapshot ? videoSnapshot.url : this.currentTab.url;
            const title = videoSnapshot ? videoSnapshot.title : this.currentTab.title;
            const platform = videoSnapshot ? videoSnapshot.platform : this.currentPlatform.name;
            
            // 基于URL生成pageKey（确保相同视频有相同的key）
            const currentPageKey = this.generatePageKey(url);
            
            const data = {
                comments: this.currentComments,
                analysis: this.currentAnalysis,
                platform: platform,
                url: url,
                title: title,
                timestamp: new Date().toISOString()
            };

            if (videoSnapshot) {
                console.log('💾 保存数据（使用快照）:', {
                    title: title,
                    url: url,
                    pageKey: currentPageKey,
                    commentCount: this.currentComments?.length || 0
                });
            } else {
                console.log('💾 保存数据（使用当前标签页）:', {
                    title: title,
                    url: url,
                    pageKey: currentPageKey,
                    commentCount: this.currentComments?.length || 0
                });
            }
            
            console.log('评论数据示例:', this.currentComments?.[0]);

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

    async saveDataWithSnapshot(videoSnapshot, comments, analysis) {
        try {
            const url = videoSnapshot.url;
            const title = videoSnapshot.title;
            const platform = videoSnapshot.platform;
            
            // 基于URL生成pageKey
            const currentPageKey = this.generatePageKey(url);
            
            const data = {
                comments: comments,
                analysis: analysis,
                platform: platform,
                url: url,
                title: title,
                timestamp: new Date().toISOString()
            };

            console.log('💾 保存数据（使用快照和独立数据）:', {
                title: title,
                url: url,
                pageKey: currentPageKey,
                commentCount: comments?.length || 0,
                hasAnalysis: !!analysis
            });

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
            console.log('开始保存历史记录:', {
                dataKey,
                url: data.url,
                platform: data.platform,
                title: data.title
            });
            
            const response = await this.sendMessage({
                action: 'loadData',
                key: 'analysis_history'
            });

            let history = response.success ? (response.data || []) : [];
            console.log('当前历史记录数量:', history.length);
            
            // 实现去重逻辑：只对相同的dataKey进行更新，不同的URL应该保留为独立记录
            const existingIndex = history.findIndex(item => 
                item.dataKey === dataKey
            );

            const historyItem = {
                id: existingIndex !== -1 ? history[existingIndex].id : Date.now().toString(),
                dataKey: dataKey,
                platform: data.platform,
                title: data.title,
                url: data.url,
                commentCount: data.comments?.length || 0,
                hasAnalysis: !!data.analysis,
                analyzing: false,
                timestamp: existingIndex !== -1 ? history[existingIndex].timestamp : new Date().toISOString()
            };
            
            console.log('准备保存的历史记录:', historyItem);

            if (existingIndex !== -1) {
                // 更新现有记录
                history[existingIndex] = historyItem;
                console.log('更新现有历史记录，索引:', existingIndex);
            } else {
                // 添加新记录到列表头部
                history.unshift(historyItem);
                console.log('添加新历史记录，新总数:', history.length);
            }

            // 保持最多100条历史记录
            if (history.length > 100) {
                history = history.slice(0, 100);
                console.log('超出限制，裁剪到100条');
            }

            const saveResult = await this.sendMessage({
                action: 'saveData',
                data: { analysis_history: history }
            });
            
            if (saveResult.success) {
                console.log('历史记录保存成功，当前总数:', history.length);
            } else {
                console.error('历史记录保存失败:', saveResult.error);
            }

        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }

    updateUI() {
        // 更新评论数量（包含回复）
        const totalCount = this.getTotalCommentCount(this.currentComments);
        document.getElementById('comments-count').textContent = totalCount;

        // 更新分析状态
        const analysisStatusElement = document.getElementById('analysis-status');
        const analysisStatsElement = document.getElementById('analysis-stats');
        
        if (this.currentAnalysis) {
            analysisStatusElement.textContent = '已完成';
            analysisStatusElement.className = 'text-2xl font-bold text-green-600';
            
            // 显示统计信息
            const tokens = this.currentAnalysis.tokensUsed || 0;
            const elapsedTime = this.currentAnalysis.elapsedTime || '?';
            analysisStatsElement.textContent = `耗时: ${elapsedTime}秒 | Tokens: ${tokens}`;
        } else {
            analysisStatusElement.textContent = '未分析';
            analysisStatusElement.className = 'text-2xl font-bold text-gray-400';
            analysisStatsElement.textContent = '';
        }

        // 更新最后更新时间
        const lastUpdateElement = document.getElementById('last-update');
        if (this.currentComments.length > 0) {
            const updateTime = this.currentAnalysis 
                ? new Date(this.currentAnalysis.timestamp)
                : new Date();
            lastUpdateElement.textContent = `最后更新: ${updateTime.toLocaleString('zh-CN')}`;
        } else {
            lastUpdateElement.textContent = '暂无数据';
        }

        // 更新按钮状态
        const analyzeBtn = document.getElementById('analyze-btn');
        const viewCommentsBtn = document.getElementById('view-comments-btn');
        const viewAnalysisBtn = document.getElementById('view-analysis-btn');

        analyzeBtn.disabled = this.currentComments.length === 0;
        viewCommentsBtn.disabled = this.currentComments.length === 0;
        viewAnalysisBtn.disabled = !this.currentAnalysis;
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

    async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    async sendMessageToTab(message) {
        return new Promise((resolve) => {
            if (!this.currentTab || !this.currentTab.id) {
                resolve({ success: false, error: 'No active tab' });
                return;
            }
            
            chrome.tabs.sendMessage(this.currentTab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response' });
                }
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
    window.commentInsightPopup = new CommentInsightPopup();
    console.log('🚀 CommentInsight Popup 已初始化');
    console.log('💡 提示：在控制台中使用 window.commentInsightPopup 访问实例');
});