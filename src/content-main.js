/**
 * 内容脚本主入口 - 统一管理所有平台的评论提取
 */

class CommentExtractor {
    constructor() {
        this.platform = this.detectCurrentPlatform();
        this.extractors = {};
        try {
            if (typeof YouTubeExtractor !== 'undefined' || (typeof window !== 'undefined' && window.YouTubeExtractor)) {
                this.extractors.youtube = typeof YouTubeExtractor !== 'undefined' ? new YouTubeExtractor() : new window.YouTubeExtractor();
            }
            if (typeof TikTokExtractor !== 'undefined' || (typeof window !== 'undefined' && window.TikTokExtractor)) {
                this.extractors.tiktok = typeof TikTokExtractor !== 'undefined' ? new TikTokExtractor() : new window.TikTokExtractor();
            }
            if (typeof TwitterExtractor !== 'undefined' || (typeof window !== 'undefined' && window.TwitterExtractor)) {
                this.extractors.twitter = typeof TwitterExtractor !== 'undefined' ? new TwitterExtractor() : new window.TwitterExtractor();
            }
            if (typeof BilibiliExtractor !== 'undefined' || (typeof window !== 'undefined' && window.BilibiliExtractor)) {
                this.extractors.bilibili = typeof BilibiliExtractor !== 'undefined' ? new BilibiliExtractor() : new window.BilibiliExtractor();
            }
        } catch (e) {
            Logger.warn('content', 'Extractor initialization failed', e);
        }

        this.initializeContentScript();
    }

    detectCurrentPlatform() {
        const hostname = window.location.hostname;

        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return 'youtube';
        } else if (hostname.includes('tiktok.com')) {
            return 'tiktok';
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return 'twitter';
        } else if (hostname.includes('bilibili.com') || hostname.includes('b23.tv')) {
            return 'bilibili';
        }

        return 'unknown';
    }

    initializeContentScript() {
        // 监听来自后台脚本的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持异步响应通道开放
        });

        Logger.info('content', `Extension loaded on ${this.platform}`);
        try {
            chrome.runtime.sendMessage({ action: 'getConfig' }, (resp) => {
                if (resp && resp.success && resp.data) {
                    const logging = resp.data.logging || { enabled: true, level: 'info' };
                    Logger.enable(logging.enabled !== false);
                    Logger.setLevel(logging.level || 'info');
                }
            });
        } catch (_) {}

        // 监听YouTube的SPA导航
        if (this.platform === 'youtube') {
            this.setupYouTubeSPAListener();
        }

        // 心跳检测
        setInterval(() => {
            Logger.debug('content', 'Heartbeat', { platform: this.platform, time: new Date().toISOString() });
        }, 30000);
    }

    setupYouTubeSPAListener() {
        let lastUrl = window.location.href;
        
        // 监听History API的变化
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        const notifyUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                Logger.info('content', 'YouTube SPA navigation URL changed', { url: currentUrl });
                lastUrl = currentUrl;
                
                // 等待页面渲染完成后通知background
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: 'youtubeNavigated',
                        url: currentUrl,
                        title: document.title.replace(/ - YouTube$/, '').trim()
                    }).catch(err => Logger.warn('content', 'Failed to notify navigation', err));
                }, 500);
            }
        };
        
        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            notifyUrlChange();
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            notifyUrlChange();
        };
        
        // 监听popstate事件（浏览器前进后退）
        window.addEventListener('popstate', notifyUrlChange);
        
        // 监听YouTube特有的yt-navigate-finish事件
        document.addEventListener('yt-navigate-finish', notifyUrlChange);
        
        Logger.info('content', 'YouTube SPA listener set');
    }

    async handleMessage(message, sender, sendResponse) {
        Logger.info('content', 'Message received', { action: message.action, platform: this.platform });

        (async () => {
            try {
                let result;

                switch (message.action) {
                    case 'extractYouTubeComments':
                        if (this.platform === 'youtube' && this.extractors.youtube) {
                            result = await this.extractors.youtube.extract(message.config);
                            sendResponse(CommonUtils.ok({ comments: result }));
                        } else {
                            const msg = this.platform !== 'youtube' ? 'Current page is not YouTube' : 'Extractor not available';
                            sendResponse(CommonUtils.fail(this.platform !== 'youtube' ? 'PLATFORM_MISMATCH' : 'EXTRACTOR_NOT_AVAILABLE', msg));
                        }
                        break;
                    case 'extractTikTokComments':
                        if (this.platform === 'tiktok' && this.extractors.tiktok) {
                            result = await this.extractors.tiktok.extract(message.config);
                            sendResponse(CommonUtils.ok({ comments: result }));
                        } else {
                            const msg = this.platform !== 'tiktok' ? 'Current page is not TikTok' : 'Extractor not available';
                            sendResponse(CommonUtils.fail(this.platform !== 'tiktok' ? 'PLATFORM_MISMATCH' : 'EXTRACTOR_NOT_AVAILABLE', msg));
                        }
                        break;

                    case 'extractTwitterComments':
                        if (this.platform === 'twitter' && this.extractors.twitter) {
                            result = await this.extractors.twitter.extract(message.config);
                            sendResponse(CommonUtils.ok({ comments: result }));
                        } else {
                            const msg = this.platform !== 'twitter' ? 'Current page is not Twitter/X' : 'Extractor not available';
                            sendResponse(CommonUtils.fail(this.platform !== 'twitter' ? 'PLATFORM_MISMATCH' : 'EXTRACTOR_NOT_AVAILABLE', msg));
                        }
                        break;

                    case 'extractBilibiliComments':
                        Logger.info('content', 'Start extracting Bilibili comments');
                        if (this.platform === 'bilibili' && this.extractors.bilibili) {
                            try {
                                result = await this.extractors.bilibili.extract(message.config);
                                Logger.info('content', 'Bilibili comments extracted', { count: result?.length || 0 });
                                sendResponse(CommonUtils.ok({ comments: result }));
                            } catch (extractError) {
                                Logger.error('content', 'Bilibili extraction error', extractError);
                                sendResponse(CommonUtils.fail('BILIBILI_EXTRACT_ERROR', `Bilibili extract failed: ${extractError.message}`));
                            }
                        } else {
                            const msg = this.platform !== 'bilibili' ? `Current page is not Bilibili (current: ${this.platform})` : 'Extractor not available';
                            sendResponse(CommonUtils.fail(this.platform !== 'bilibili' ? 'PLATFORM_MISMATCH' : 'EXTRACTOR_NOT_AVAILABLE', msg));
                        }
                        break;

                    case 'getPlatformInfo':
                        (async () => {
                            try {
                                let pageTitle = document.title;
                                let pageDescription = '';
                                
                                if (this.platform === 'youtube') {
                                    pageTitle = document.title.replace(/ - YouTube$/, '').trim();
                                    // 提取YouTube视频描述
                                    const descElement = document.querySelector('#description-inline-expander yt-attributed-string');
                                    if (descElement) {
                                        pageDescription = descElement.textContent.trim();
                                    }
                                } else if (this.platform === 'tiktok') {
                    const descriptionSelectors = [
                        '[data-e2e="browse-video-desc"]',
                        '[data-e2e="video-desc"]',
                        '[data-e2e="new-desc"]',
                        '[data-e2e="new-desc-span"]'
                    ];

                    let descText = '';
                    for (const selector of descriptionSelectors) {
                        const descNode = document.querySelector(selector);
                        if (descNode && descNode.textContent && descNode.textContent.trim()) {
                            descText = descNode.textContent.trim();
                            break;
                        }
                    }

                    if (!descText) {
                        const metaDesc = document.querySelector('meta[name="description"]');
                        if (metaDesc && metaDesc.content) {
                            descText = metaDesc.content.trim();
                        }
                    }

                    if (descText) {
                        pageTitle = descText;
                        pageDescription = descText;
                    }
                                } else if (this.platform === 'bilibili') {
                                    const startTime = Date.now();
                                    while (Date.now() - startTime < 2000) {
                                        const titleElement = document.querySelector('h1.video-title');
                                        if (titleElement && titleElement.textContent.trim()) {
                                            pageTitle = titleElement.textContent.trim();
                                            break;
                                        }
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                    // 提取Bilibili视频简介
                                    const descElement = document.querySelector('.desc-info-text');
                                    if (descElement) {
                                        pageDescription = descElement.textContent.trim();
                                    }
                                }

                                sendResponse(CommonUtils.ok({
                                    platform: this.platform,
                                    url: window.location.href,
                                    title: pageTitle,
                                    description: pageDescription
                                }));
                            } catch (error) {
                                sendResponse(CommonUtils.fail('GET_PLATFORM_INFO_ERROR', error.message));
                            }
                        })();
                        return true;

                    default:
                        Logger.warn('content', 'Unknown action', { action: message.action });
                        sendResponse(CommonUtils.fail('UNKNOWN_ACTION', 'Unknown action: ' + message.action));
                }
            } catch (error) {
                Logger.error('content', 'Failed to handle message', error);
                sendResponse(CommonUtils.fail('HANDLE_MESSAGE_ERROR', 'Error handling message: ' + error.message));
            }
        })();
    }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && window.location) {
    new CommentExtractor();
}

