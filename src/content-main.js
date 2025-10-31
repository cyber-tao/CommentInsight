/**
 * 内容脚本主入口 - 统一管理所有平台的评论提取
 */

class CommentExtractor {
    constructor() {
        this.platform = this.detectCurrentPlatform();
        this.extractors = {
            youtube: new YouTubeExtractor(),
            tiktok: new TikTokExtractor(),
            twitter: new TwitterExtractor(),
            bilibili: new BilibiliExtractor()
        };

        // 清理引用
        this.heartbeatInterval = null;
        this.messageListener = null;
        this.youtubeListeners = {
            pushState: null,
            replaceState: null,
            popstate: null,
            ytNavigateFinish: null
        };

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
        this.messageListener = (message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持异步响应通道开放
        };
        chrome.runtime.onMessage.addListener(this.messageListener);

        console.log(`评论洞察扩展已在${this.platform}平台加载`);

        // 监听YouTube的SPA导航
        if (this.platform === 'youtube') {
            this.setupYouTubeSPAListener();
        }

        // 心跳检测（仅在开发环境启用）
        if (typeof Constants !== 'undefined' && Constants.DELAY) {
            this.heartbeatInterval = setInterval(() => {
                console.log('内容脚本心跳:', this.platform, new Date().toISOString());
            }, Constants.DELAY.HEARTBEAT_INTERVAL);
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清理心跳定时器
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // 清理消息监听器
        if (this.messageListener) {
            chrome.runtime.onMessage.removeListener(this.messageListener);
            this.messageListener = null;
        }

        // 清理YouTube监听器
        this.cleanupYouTubeListeners();
    }

    setupYouTubeSPAListener() {
        let lastUrl = window.location.href;
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        const notifyUrlChange = () => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                console.log('YouTube SPA导航检测到URL变化:', currentUrl);
                lastUrl = currentUrl;
                
                // 等待页面渲染完成后通知background
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        action: 'youtubeNavigated',
                        url: currentUrl,
                        title: document.title.replace(/ - YouTube$/, '').trim()
                    }).catch(err => console.log('通知导航失败:', err));
                }, 500);
            }
        };
        
        // 保存原始函数引用以便清理
        this.youtubeListeners.pushState = function(...args) {
            originalPushState.apply(this, args);
            notifyUrlChange();
        };
        this.youtubeListeners.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            notifyUrlChange();
        };
        
        history.pushState = this.youtubeListeners.pushState;
        history.replaceState = this.youtubeListeners.replaceState;
        
        // 监听popstate事件（浏览器前进后退）
        this.youtubeListeners.popstate = notifyUrlChange;
        window.addEventListener('popstate', this.youtubeListeners.popstate);
        
        // 监听YouTube特有的yt-navigate-finish事件
        this.youtubeListeners.ytNavigateFinish = notifyUrlChange;
        document.addEventListener('yt-navigate-finish', this.youtubeListeners.ytNavigateFinish);
        
        console.log('YouTube SPA导航监听器已设置');
    }

    /**
     * 清理YouTube监听器
     */
    cleanupYouTubeListeners() {
        if (this.youtubeListeners.pushState && history.pushState !== this.youtubeListeners.pushState) {
            // 如果已被其他代码替换，尝试恢复
            const currentPushState = history.pushState;
            history.pushState = currentPushState;
        }
        
        if (this.youtubeListeners.replaceState && history.replaceState !== this.youtubeListeners.replaceState) {
            const currentReplaceState = history.replaceState;
            history.replaceState = currentReplaceState;
        }
        
        if (this.youtubeListeners.popstate) {
            window.removeEventListener('popstate', this.youtubeListeners.popstate);
            this.youtubeListeners.popstate = null;
        }
        
        if (this.youtubeListeners.ytNavigateFinish) {
            document.removeEventListener('yt-navigate-finish', this.youtubeListeners.ytNavigateFinish);
            this.youtubeListeners.ytNavigateFinish = null;
        }
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('接收到消息:', message.action, '平台:', this.platform);

        (async () => {
            try {
                let result;

                switch (message.action) {
                    case 'extractYouTubeComments':
                        if (this.platform === 'youtube') {
                            result = await this.extractors.youtube.extract(message.config);
                            sendResponse({ success: true, comments: result });
                        } else {
                            sendResponse({ success: false, error: '当前页面不是YouTube' });
                        }
                        break;
                    case 'extractTikTokComments':
                        if (this.platform === 'tiktok') {
                            result = await this.extractors.tiktok.extract(message.config);
                            sendResponse({ success: true, comments: result });
                        } else {
                            sendResponse({ success: false, error: '当前页面不是TikTok' });
                        }
                        break;

                    case 'extractTwitterComments':
                        if (this.platform === 'twitter') {
                            result = await this.extractors.twitter.extract(message.config);
                            sendResponse({ success: true, comments: result });
                        } else {
                            sendResponse({ success: false, error: '当前页面不是Twitter/X' });
                        }
                        break;

                    case 'extractBilibiliComments':
                        console.log('开始提取Bilibili评论...');
                        if (this.platform === 'bilibili') {
                            try {
                                result = await this.extractors.bilibili.extract(message.config);
                                console.log('成功提取Bilibili评论:', result?.length || 0, '条');
                                sendResponse({ success: true, comments: result });
                            } catch (extractError) {
                                console.error('Bilibili评论提取错误:', extractError);
                                sendResponse({
                                    success: false,
                                    error: `Bilibili评论提取失败: ${extractError.message}`
                                });
                            }
                        } else {
                            sendResponse({ 
                                success: false, 
                                error: `当前页面不是Bilibili（当前: ${this.platform}）` 
                            });
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

                                sendResponse({
                                    success: true,
                                    platform: this.platform,
                                    url: window.location.href,
                                    title: pageTitle,
                                    description: pageDescription
                                });
                            } catch (error) {
                                sendResponse({
                                    success: false,
                                    error: error.message
                                });
                            }
                        })();
                        return true;

                    default:
                        console.log('未知的操作类型:', message.action);
                        sendResponse({ success: false, error: '未知的操作类型: ' + message.action });
                }
            } catch (error) {
                console.error('内容脚本处理消息失败:', error);
                sendResponse({ success: false, error: '处理消息时出错: ' + error.message });
            }
        })();
    }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && window.location) {
    new CommentExtractor();
}

