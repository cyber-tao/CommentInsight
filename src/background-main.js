/**
 * 后台服务主入口 - 协调所有后台服务
 */

// 导入所有服务模块（Service Worker环境需要使用importScripts）
importScripts(
    'utils/common.js',
    'utils/default-config.js',
    'services/platform-detector.js',
    'services/storage-service.js',
    'services/credential-vault.js',
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

        (async () => {
            try {
                const cfg = await StorageService.loadData('config');
                const logging = (cfg && cfg.logging) || { enabled: true, level: 'info' };
                Logger.enable(logging.enabled !== false);
                Logger.setLevel(logging.level || 'info');
            } catch (_) {}
        })();
    }

    async openSidePanel(tab) {
        try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (error) {
            Logger.error('background', 'Failed to open side panel', error);
        }
    }

    async onInstalled(details) {
        Logger.info('background', 'Extension installed/updated', details);

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
            Logger.info('background', 'Message received', { action: message.action });

            switch (message.action) {
                case 'detectPlatform':
                    const platform = PlatformDetector.detectPlatform(message.url);
                    sendResponse(CommonUtils.ok({ platform }));
                    break;

                case 'extractComments':
                    const comments = await this.extractComments(
                        message.platform,
                        message.url,
                        message.config,
                        message.tabId
                    );
                    sendResponse(CommonUtils.ok({ comments }));
                    break;

                case 'analyzeComments':
                    {
                        const cfg = { ...(message.config || {}) };
                        cfg.ai = cfg.ai || {};
                        if (!cfg.ai.apiKey) {
                            const k = await CredentialVault.getAIKey();
                            cfg.ai.apiKey = k || '';
                        }
                        const analysis = await AIService.analyzeComments(
                            message.comments,
                            cfg,
                            message.videoTitle || '',
                            message.videoDescription || ''
                        );
                        sendResponse(CommonUtils.ok({ analysis }));
                    }
                    break;

                case 'saveData':
                    await StorageService.saveData(message.data);
                    sendResponse(CommonUtils.ok());
                    break;

                case 'loadData':
                    const data = await StorageService.loadData(message.key);
                    sendResponse(CommonUtils.ok({ data }));
                    break;

                case 'testAIConnection':
                    {
                        const cfg = { ...(message.config || {}) };
                        if (!cfg.apiKey) {
                            const k = await CredentialVault.getAIKey();
                            cfg.apiKey = k || '';
                        }
                        const testResult = await AIService.testConnection(cfg);
                        sendResponse(CommonUtils.ok({ result: testResult }));
                    }
                    break;

                case 'getAIModels':
                    {
                        const cfg = { ...(message.config || {}) };
                        if (!cfg.apiKey) {
                            const k = await CredentialVault.getAIKey();
                            cfg.apiKey = k || '';
                        }
                        const models = await AIService.getModels(cfg);
                        sendResponse(CommonUtils.ok({ models }));
                    }
                    break;

                case 'exportData':
                    await ExportService.exportData(
                        message.data,
                        message.format,
                        message.filename
                    );
                    sendResponse(CommonUtils.ok());
                    break;

                case 'exportAnalysis':
                    await ExportService.exportData(
                        message.data,
                        'markdown',
                        message.filename
                    );
                    sendResponse(CommonUtils.ok());
                    break;

                case 'exportComments':
                    await ExportService.exportData(
                        message.data,
                        'csv',
                        message.filename
                    );
                    sendResponse(CommonUtils.ok());
                    break;

                case 'exportHistory':
                    await ExportService.exportData(
                        message.data,
                        'json',
                        message.filename
                    );
                    sendResponse(CommonUtils.ok());
                    break;

                case 'extractProgress':
                    // 内容脚本的进度心跳，仅用于保持后台知情与日志记录
                    try {
                        Logger.info('background', 'Progress', { platform: message?.platform || 'unknown', stage: message?.stage || '', payload: message?.payload || {} });
                    } catch (_) {}
                    sendResponse(CommonUtils.ok());
                    break;

                case 'getConfig':
                    const config = await StorageService.loadData('config');
                    sendResponse(CommonUtils.ok({ data: config }));
                    break;

                case 'youtubeNavigated':
                    // YouTube SPA导航通知 - 触发tabs.onUpdated事件
                    Logger.info('background', 'YouTube SPA navigation', { url: message.url, title: message.title });
                    if (sender.tab) {
                        chrome.tabs.get(sender.tab.id).then(tab => {
                            this.onTabUpdated(sender.tab.id, { 
                                status: 'complete',
                                url: message.url
                            }, tab);
                        }).catch(err => Logger.warn('background', 'tabs.get failed', err));
                    }
                    sendResponse(CommonUtils.ok());
                    break;

                default:
                    sendResponse(CommonUtils.fail('UNKNOWN_ACTION', 'Unknown action'));
            }
        } catch (error) {
            Logger.error('background', 'Error handling message', error);
            sendResponse(CommonUtils.fail('HANDLE_MESSAGE_ERROR', error.message));
        }
    }

    async onTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.url) {
            const platform = PlatformDetector.detectPlatform(changeInfo.url);
            Logger.debug('background', 'Tab updated', { tabId, url: changeInfo.url, platform });
        }
    }

    async extractComments(platform, url, config, tabId) {
        try {
            Logger.info('background', `Start extracting comments for ${platform}`);

            switch (platform) {
                case 'youtube': {
                    let apiKey = (config && config.platforms && config.platforms.youtube && config.platforms.youtube.apiKey) || '';
                    if (!apiKey) {
                        apiKey = await CredentialVault.getYouTubeKey();
                        if (config && config.platforms && config.platforms.youtube) {
                            config.platforms.youtube.apiKey = apiKey || '';
                        }
                    }
                    if (apiKey) {
                        try {
                            return await CommentExtractorService.extractYouTubeComments(url, config);
                        } catch (apiError) {
                            Logger.warn('background', 'YouTube API failed, fallback to DOM', apiError?.message || apiError);
                            return await CommentExtractorService.extractViaContentScript(
                                tabId,
                                'extractYouTubeComments',
                                config
                            );
                        }
                    } else {
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
                    if (twitterConfig.mode === 'api' && !twitterConfig.bearerToken) {
                        twitterConfig.bearerToken = await CredentialVault.getTwitterBearerToken();
                    }
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
                    throw new Error(`Unsupported platform: ${platform}`);
            }
        } catch (error) {
            Logger.error('background', 'Failed to extract comments', error);
            throw error;
        }
    }
}

// 初始化后台服务
new CommentInsightBackground();

