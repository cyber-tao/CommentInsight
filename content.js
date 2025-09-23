// 内容脚本 - 在各个社交媒体平台页面上运行，负责DOM解析和评论提取
class CommentExtractor {
    constructor() {
        this.platform = this.detectCurrentPlatform();
        this.extractors = {
            youtube: new YouTubeExtractor(),
            tiktok: new TikTokExtractor(),
            instagram: new InstagramExtractor(),
            facebook: new FacebookExtractor(),
            twitter: new TwitterExtractor()
        };
        
        this.initializeContentScript();
    }

    detectCurrentPlatform() {
        const hostname = window.location.hostname;
        
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            return 'youtube';
        } else if (hostname.includes('tiktok.com')) {
            return 'tiktok';
        } else if (hostname.includes('instagram.com')) {
            return 'instagram';
        } else if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
            return 'facebook';
        } else if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
            return 'twitter';
        }
        
        return 'unknown';
    }

    initializeContentScript() {
        // 监听来自后台脚本的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持消息通道开放
        });

        console.log(`评论洞察扩展已在${this.platform}平台加载`);
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'extractTikTokComments':
                    if (this.platform === 'tiktok') {
                        const comments = await this.extractors.tiktok.extract(message.config);
                        sendResponse({ success: true, comments });
                    } else {
                        sendResponse({ success: false, error: '当前页面不是TikTok' });
                    }
                    break;

                case 'extractInstagramComments':
                    if (this.platform === 'instagram') {
                        const comments = await this.extractors.instagram.extract(message.config);
                        sendResponse({ success: true, comments });
                    } else {
                        sendResponse({ success: false, error: '当前页面不是Instagram' });
                    }
                    break;

                case 'extractFacebookComments':
                    if (this.platform === 'facebook') {
                        const comments = await this.extractors.facebook.extract(message.config);
                        sendResponse({ success: true, comments });
                    } else {
                        sendResponse({ success: false, error: '当前页面不是Facebook' });
                    }
                    break;

                case 'extractTwitterComments':
                    if (this.platform === 'twitter') {
                        const comments = await this.extractors.twitter.extract(message.config);
                        sendResponse({ success: true, comments });
                    } else {
                        sendResponse({ success: false, error: '当前页面不是Twitter/X' });
                    }
                    break;

                case 'getPlatformInfo':
                    sendResponse({
                        success: true,
                        platform: this.platform,
                        url: window.location.href,
                        title: document.title
                    });
                    break;

                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('内容脚本处理消息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
}

// 基础提取器类
class BaseExtractor {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    async waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations) => {
                const element = document.querySelector(selector);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素超时: ${selector}`));
            }, timeout);
        });
    }

    async scrollToLoadMore(scrollContainer, maxScrolls = 10) {
        let scrollCount = 0;
        let lastHeight = 0;

        while (scrollCount < maxScrolls) {
            const container = scrollContainer || window;
            const currentHeight = container === window ? 
                document.documentElement.scrollHeight : 
                container.scrollHeight;

            if (currentHeight === lastHeight) {
                break; // 没有新内容加载
            }

            lastHeight = currentHeight;
            
            if (container === window) {
                window.scrollTo(0, document.documentElement.scrollHeight);
            } else {
                container.scrollTop = container.scrollHeight;
            }

            await this.delay(1000); // 等待内容加载
            scrollCount++;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    sanitizeText(text) {
        return text ? text.trim().replace(/\s+/g, ' ') : '';
    }

    extractTimestamp(element) {
        // 尝试从各种可能的时间属性中提取时间戳
        const timeSelectors = ['time', '[datetime]', '[data-timestamp]', '.timestamp'];
        
        for (const selector of timeSelectors) {
            const timeElement = element.querySelector(selector);
            if (timeElement) {
                return timeElement.getAttribute('datetime') || 
                       timeElement.getAttribute('data-timestamp') || 
                       timeElement.textContent;
            }
        }
        
        return new Date().toISOString(); // 默认使用当前时间
    }
}

// YouTube评论提取器
class YouTubeExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取YouTube评论');

            // 等待评论区域加载
            await this.waitForElement('#comments');
            
            // 滚动加载更多评论
            const commentsContainer = document.querySelector('#comments');
            await this.scrollToLoadMore(commentsContainer);

            // 提取评论
            const commentElements = document.querySelectorAll('ytd-comment-thread-renderer');
            const comments = [];

            for (const element of commentElements) {
                try {
                    const comment = this.extractSingleYouTubeComment(element);
                    if (comment) {
                        comments.push(comment);
                    }
                } catch (error) {
                    console.warn('提取单个YouTube评论失败:', error);
                }
            }

            console.log(`成功提取${comments.length}条YouTube评论`);
            return comments;

        } catch (error) {
            throw new Error(`YouTube评论提取失败: ${error.message}`);
        }
    }

    extractSingleYouTubeComment(element) {
        const authorElement = element.querySelector('#author-text');
        const contentElement = element.querySelector('#content-text');
        const timeElement = element.querySelector('.published-time-text');
        const likesElement = element.querySelector('#vote-count-middle');

        if (!contentElement) return null;

        return {
            id: element.getAttribute('data-cid') || Date.now().toString(),
            author: authorElement ? this.sanitizeText(authorElement.textContent) : '匿名',
            text: this.sanitizeText(contentElement.textContent),
            timestamp: timeElement ? timeElement.textContent : new Date().toISOString(),
            likes: likesElement ? parseInt(likesElement.textContent) || 0 : 0,
            replies: 0 // YouTube的回复需要额外处理
        };
    }
}

// TikTok评论提取器
class TikTokExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取TikTok评论');

            // 等待评论区域加载
            await this.waitForElement('[data-e2e="comment-list"]', 10000);
            
            // 滚动加载更多评论
            const commentsContainer = document.querySelector('[data-e2e="comment-list"]');
            if (commentsContainer) {
                await this.scrollToLoadMore(commentsContainer);
            }

            // TikTok的评论选择器可能会变化，尝试多个可能的选择器
            const commentSelectors = [
                '[data-e2e="comment-item"]',
                '.comment-item',
                '[class*="comment"]'
            ];

            let commentElements = [];
            for (const selector of commentSelectors) {
                commentElements = document.querySelectorAll(selector);
                if (commentElements.length > 0) break;
            }

            const comments = [];
            for (const element of commentElements) {
                try {
                    const comment = this.extractSingleTikTokComment(element);
                    if (comment) {
                        comments.push(comment);
                    }
                } catch (error) {
                    console.warn('提取单个TikTok评论失败:', error);
                }
            }

            console.log(`成功提取${comments.length}条TikTok评论`);
            return comments;

        } catch (error) {
            throw new Error(`TikTok评论提取失败: ${error.message}`);
        }
    }

    extractSingleTikTokComment(element) {
        // TikTok的DOM结构经常变化，使用多种策略提取
        const authorSelectors = ['[data-e2e="comment-username"]', '.username', '[class*="username"]'];
        const contentSelectors = ['[data-e2e="comment-text"]', '.comment-text', '[class*="comment-text"]'];
        const timeSelectors = ['[data-e2e="comment-time"]', '.time', '[class*="time"]'];

        let author = '匿名';
        let text = '';
        let timestamp = new Date().toISOString();

        // 提取作者
        for (const selector of authorSelectors) {
            const authorElement = element.querySelector(selector);
            if (authorElement) {
                author = this.sanitizeText(authorElement.textContent);
                break;
            }
        }

        // 提取内容
        for (const selector of contentSelectors) {
            const contentElement = element.querySelector(selector);
            if (contentElement) {
                text = this.sanitizeText(contentElement.textContent);
                break;
            }
        }

        // 提取时间
        for (const selector of timeSelectors) {
            const timeElement = element.querySelector(selector);
            if (timeElement) {
                timestamp = timeElement.textContent || timeElement.getAttribute('datetime');
                break;
            }
        }

        if (!text) return null;

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            author,
            text,
            timestamp,
            likes: 0, // TikTok不总是显示点赞数
            replies: 0
        };
    }
}

// Instagram评论提取器
class InstagramExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Instagram评论');

            // Instagram的评论通常在帖子详情页面
            await this.waitForElement('article', 10000);
            
            // 尝试点击"查看所有评论"按钮
            const viewAllButton = document.querySelector('button[class*="comment"]');
            if (viewAllButton && viewAllButton.textContent.includes('查看')) {
                viewAllButton.click();
                await this.delay(2000);
            }

            // 滚动加载更多评论
            await this.scrollToLoadMore(window);

            // Instagram评论选择器
            const commentSelectors = [
                'article ul > div > li',
                '[class*="comment"]',
                'article div[role="button"]'
            ];

            let commentElements = [];
            for (const selector of commentSelectors) {
                commentElements = document.querySelectorAll(selector);
                if (commentElements.length > 0) break;
            }

            const comments = [];
            for (const element of commentElements) {
                try {
                    const comment = this.extractSingleInstagramComment(element);
                    if (comment) {
                        comments.push(comment);
                    }
                } catch (error) {
                    console.warn('提取单个Instagram评论失败:', error);
                }
            }

            console.log(`成功提取${comments.length}条Instagram评论`);
            return comments;

        } catch (error) {
            throw new Error(`Instagram评论提取失败: ${error.message}`);
        }
    }

    extractSingleInstagramComment(element) {
        // Instagram的评论结构相对稳定
        const authorElement = element.querySelector('a[role="link"]');
        const contentSpans = element.querySelectorAll('span');
        
        let author = '匿名';
        let text = '';

        if (authorElement) {
            author = this.sanitizeText(authorElement.textContent);
        }

        // Instagram评论文本通常在span元素中
        for (const span of contentSpans) {
            const spanText = this.sanitizeText(span.textContent);
            if (spanText && spanText !== author && spanText.length > 3) {
                text = spanText;
                break;
            }
        }

        if (!text || text === author) return null;

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            author,
            text,
            timestamp: new Date().toISOString(),
            likes: 0,
            replies: 0
        };
    }
}

// Facebook评论提取器
class FacebookExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Facebook评论');

            // Facebook的DOM结构比较复杂，需要等待动态加载
            await this.delay(3000);

            // 尝试多种Facebook评论选择器
            const commentSelectors = [
                '[data-testid="UFI2Comment/root"]',
                '[aria-label*="comment"]',
                '[class*="comment"]'
            ];

            let commentElements = [];
            for (const selector of commentSelectors) {
                commentElements = document.querySelectorAll(selector);
                if (commentElements.length > 0) break;
            }

            // 滚动加载更多评论
            await this.scrollToLoadMore(window);

            const comments = [];
            for (const element of commentElements) {
                try {
                    const comment = this.extractSingleFacebookComment(element);
                    if (comment) {
                        comments.push(comment);
                    }
                } catch (error) {
                    console.warn('提取单个Facebook评论失败:', error);
                }
            }

            console.log(`成功提取${comments.length}条Facebook评论`);
            return comments;

        } catch (error) {
            throw new Error(`Facebook评论提取失败: ${error.message}`);
        }
    }

    extractSingleFacebookComment(element) {
        // Facebook的评论结构经常变化，使用灵活的提取策略
        const textContent = this.sanitizeText(element.textContent);
        
        if (!textContent || textContent.length < 3) return null;

        // 尝试提取作者名
        const authorElement = element.querySelector('a[role="link"]') || 
                             element.querySelector('strong') ||
                             element.querySelector('[class*="author"]');
        
        const author = authorElement ? this.sanitizeText(authorElement.textContent) : '匿名';

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            author,
            text: textContent,
            timestamp: new Date().toISOString(),
            likes: 0,
            replies: 0
        };
    }
}

// Twitter/X评论提取器
class TwitterExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Twitter评论');

            // 等待推文和回复加载
            await this.waitForElement('[data-testid="tweet"]', 10000);
            
            // 滚动加载更多回复
            await this.scrollToLoadMore(window);

            // Twitter的回复/评论选择器
            const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
            const comments = [];

            for (const element of tweetElements) {
                try {
                    const comment = this.extractSingleTwitterComment(element);
                    if (comment) {
                        comments.push(comment);
                    }
                } catch (error) {
                    console.warn('提取单个Twitter评论失败:', error);
                }
            }

            console.log(`成功提取${comments.length}条Twitter评论`);
            return comments;

        } catch (error) {
            throw new Error(`Twitter评论提取失败: ${error.message}`);
        }
    }

    extractSingleTwitterComment(element) {
        // Twitter的评论就是回复推文
        const authorElement = element.querySelector('[data-testid="User-Names"] span');
        const contentElement = element.querySelector('[data-testid="tweetText"]');
        const timeElement = element.querySelector('time');
        
        if (!contentElement) return null;

        const author = authorElement ? this.sanitizeText(authorElement.textContent) : '匿名';
        const text = this.sanitizeText(contentElement.textContent);
        const timestamp = timeElement ? timeElement.getAttribute('datetime') : new Date().toISOString();

        if (!text) return null;

        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            author,
            text,
            timestamp,
            likes: 0, // Twitter的点赞数需要额外解析
            replies: 0
        };
    }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && window.location) {
    new CommentExtractor();
} 