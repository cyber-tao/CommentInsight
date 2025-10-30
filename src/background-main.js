/**
 * 后台服务主入口 - 协调所有后台服务
 */

// 导入所有服务模块（Service Worker环境需要使用importScripts）
importScripts(
    'utils/common.js',
    'utils/default-config.js',
    'services/platform-detector.js',
    'services/storage-service.js',
    'services/ai-service.js',
    'services/export-service.js',
    'services/comment-extractor-service.js'
);

class CommentInsightBackground {
    constructor() {
        this.initializeBackground();
    }

    initializeBackground() {
        // 监听扩展安装事件
        chrome.runtime.onInstalled.addListener((details) => {
            this.onInstalled(details);
        });

        // 监听消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // 监听标签页更新
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.onTabUpdated(tabId, changeInfo, tab);
        });

        // 监听扩展图标点击，打开侧边栏
        chrome.action.onClicked.addListener((tab) => {
            this.openSidePanel(tab);
        });
    }

    async openSidePanel(tab) {
        try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (error) {
            console.error('打开侧边栏失败:', error);
        }
    }

    async onInstalled(details) {
        console.log('评论洞察扩展已安装/更新', details);

        if (details.reason === 'install') {
            await StorageService.saveData({ config: DefaultConfig });
        } else if (details.reason === 'update') {
            const existing = await StorageService.loadData('config');
            if (!existing) {
                await StorageService.saveData({ config: DefaultConfig });
            }
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('收到消息:', message);

            switch (message.action) {
                case 'detectPlatform':
                    const platform = PlatformDetector.detectPlatform(message.url);
                    sendResponse({ success: true, platform });
                    break;

                case 'extractComments':
                    const comments = await this.extractComments(
                        message.platform,
                        message.url,
                        message.config,
                        message.tabId
                    );
                    sendResponse({ success: true, comments });
                    break;

                case 'analyzeComments':
                    const analysis = await AIService.analyzeComments(
                        message.comments,
                        message.config,
                        message.videoTitle || '',
                        message.videoDescription || ''
                    );
                    sendResponse({ success: true, analysis });
                    break;

                case 'saveData':
                    await StorageService.saveData(message.data);
                    sendResponse({ success: true });
                    break;

                case 'loadData':
                    const data = await StorageService.loadData(message.key);
                    sendResponse({ success: true, data });
                    break;

                case 'testAIConnection':
                    const testResult = await AIService.testConnection(message.config);
                    sendResponse({ success: true, result: testResult });
                    break;

                case 'getAIModels':
                    const models = await AIService.getModels(message.config);
                    sendResponse({ success: true, models });
                    break;

                case 'exportData':
                    await ExportService.exportData(
                        message.data,
                        message.format,
                        message.filename
                    );
                    sendResponse({ success: true });
                    break;

                case 'exportAnalysis':
                    await ExportService.exportData(
                        message.data,
                        'markdown',
                        message.filename
                    );
                    sendResponse({ success: true });
                    break;

                case 'exportComments':
                    await ExportService.exportData(
                        message.data,
                        'csv',
                        message.filename
                    );
                    sendResponse({ success: true });
                    break;

                case 'exportHistory':
                    await ExportService.exportData(
                        message.data,
                        'json',
                        message.filename
                    );
                    sendResponse({ success: true });
                    break;

                case 'extractProgress':
                    // 内容脚本的进度心跳，仅用于保持后台知情与日志记录
                    try {
                        console.log('[Progress]', message?.platform || 'unknown', message?.stage || '', message?.payload || {});
                    } catch (_) {}
                    sendResponse({ success: true });
                    break;

                case 'getConfig':
                    const config = await StorageService.loadData('config');
                    sendResponse({ success: true, data: config });
                    break;

                case 'youtubeNavigated':
                    // YouTube SPA导航通知 - 触发tabs.onUpdated事件
                    console.log('YouTube SPA导航:', message.url, message.title);
                    if (sender.tab) {
                        // 强制触发tabs.onUpdated，让popup可以更新标题
                        chrome.tabs.get(sender.tab.id).then(tab => {
                            this.onTabUpdated(sender.tab.id, { 
                                status: 'complete',
                                url: message.url
                            }, tab);
                        });
                    }
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('处理消息时出错:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async onTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.url) {
            const platform = PlatformDetector.detectPlatform(changeInfo.url);
            // 可以在这里发送消息给popup更新界面
        }
    }

    async extractComments(platform, url, config, tabId) {
        try {
            console.log(`开始提取${platform}平台的评论`);

            switch (platform) {
                case 'youtube': {
                    const apiKey = (config && config.platforms && config.platforms.youtube && config.platforms.youtube.apiKey) || '';
                    if (apiKey) {
                        try {
                            return await CommentExtractorService.extractYouTubeComments(url, config);
                        } catch (apiError) {
                            console.warn('YouTube API 提取失败，回退到 DOM 提取:', apiError?.message || apiError);
                            return await CommentExtractorService.extractViaContentScript(
                                tabId,
                                'extractYouTubeComments',
                                config
                            );
                        }
                    } else {
                        // 无 API Key，直接使用 DOM 提取
                        return await CommentExtractorService.extractViaContentScript(
                            tabId,
                            'extractYouTubeComments',
                            config
                        );
                    }
                }

                case 'tiktok':
                    return await CommentExtractorService.extractViaContentScript(
                        tabId,
                        'extractTikTokComments',
                        config
                    );

                case 'twitter':
                    const twitterConfig = config.platforms.twitter;
                    if (twitterConfig.mode === 'api') {
                        return await CommentExtractorService.extractTwitterCommentsViaAPI(url, config);
                    } else {
                        return await CommentExtractorService.extractViaContentScript(
                            tabId,
                            'extractTwitterComments',
                            config
                        );
                    }

                case 'bilibili':
                    return await CommentExtractorService.extractViaContentScript(
                        tabId,
                        'extractBilibiliComments',
                        config
                    );

                default:
                    throw new Error(`不支持的平台: ${platform}`);
            }
        } catch (error) {
            console.error('提取评论失败:', error);
            throw error;
        }
    }
}

// 初始化后台服务
new CommentInsightBackground();

