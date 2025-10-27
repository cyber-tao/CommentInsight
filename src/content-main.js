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

        console.log(`评论洞察扩展已在${this.platform}平台加载`);

        // 监听YouTube的SPA导航
        if (this.platform === 'youtube') {
            this.setupYouTubeSPAListener();
        }

        // 心跳检测
        setInterval(() => {
            console.log('内容脚本心跳:', this.platform, new Date().toISOString());
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
        
        console.log('YouTube SPA导航监听器已设置');
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('接收到消息:', message.action, '平台:', this.platform);

        (async () => {
            try {
                let result;

                switch (message.action) {
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
                                    const descElement = document.querySelector('[data-e2e="new-desc-span"]');
                                    if (descElement) {
                                        pageTitle = descElement.textContent.trim();
                                        pageDescription = pageTitle; // TikTok的描述就是标题
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

