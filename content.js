// 内容脚本 - 在各个社交媒体平台页面上运行，负责DOM解析和评论提取
class CommentExtractor {
    constructor() {
        this.platform = this.detectCurrentPlatform();
        this.extractors = {
            youtube: new YouTubeExtractor(),
            tiktok: new TikTokExtractor(),
            instagram: new InstagramExtractor(),
            facebook: new FacebookExtractor(),
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
        } else if (hostname.includes('instagram.com')) {
            return 'instagram';
        } else if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
            return 'facebook';
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
            // 必须返回true以保持异步响应通道开放
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        console.log(`评论洞察扩展已在${this.platform}平台加载`);
        
        // 添加心跳检测，确保脚本正常运行
        setInterval(() => {
            console.log('内容脚本心跳:', this.platform, new Date().toISOString());
        }, 30000);
    }

    async handleMessage(message, sender, sendResponse) {
        console.log('接收到消息:', message.action, '平台:', this.platform);
        
        // 使用立即执行的异步函数来确保正确的异步处理
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

                    case 'extractInstagramComments':
                        if (this.platform === 'instagram') {
                            result = await this.extractors.instagram.extract(message.config);
                            sendResponse({ success: true, comments: result });
                        } else {
                            sendResponse({ success: false, error: '当前页面不是Instagram' });
                        }
                        break;

                    case 'extractFacebookComments':
                        if (this.platform === 'facebook') {
                            result = await this.extractors.facebook.extract(message.config);
                            sendResponse({ success: true, comments: result });
                        } else {
                            sendResponse({ success: false, error: '当前页面不是Facebook' });
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
                                console.log('平台匹配，开始提取评论');
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
                            console.log('平台不匹配, 当前平台:', this.platform, '需要的平台: bilibili');
                            sendResponse({ success: false, error: `当前页面不是Bilibili（当前: ${this.platform}）` });
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

// Bilibili评论提取器
class BilibiliExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Bilibili评论（支持Shadow DOM）');

            // 等待评论区域加载
            const commentContainer = await this.waitForCommentContainer();
            if (!commentContainer) {
                throw new Error('找不到评论区域，该视频可能未开启评论功能');
            }

            // 等待Shadow DOM加载完成
            await this.delay(3000);
            
            // 尝试滚动加载更多评论
            await this.scrollToLoadMoreShadow(config?.maxScrolls || 10);
            
            // 等待加载完成
            await this.delay(2000);

            // 提取评论
            const comments = await this.extractShadowComments();
            
            console.log(`成功提取Bilibili评论: ${comments.length}条`);
            return comments;

        } catch (error) {
            console.error('Bilibili评论提取失败:', error);
            throw error;
        }
    }

    async waitForCommentContainer() {
        // 先尝试找到主评论容器（包含Shadow DOM）
        const mainSelectors = [
            '#commentapp',              // 主评论应用
            'bili-comments',           // 评论组件
            '#comment',                // 普通评论区
            '.comment'                 // 评论类
        ];

        for (const selector of mainSelectors) {
            try {
                const element = await this.waitForElement(selector, 3000);
                if (element) {
                    console.log(`找到评论主容器: ${selector}`);
                    return element;
                }
            } catch (e) {
                console.log(`选择器 ${selector} 未找到评论容器`);
                continue;
            }
        }

        return null;
    }
    
    // 支持Shadow DOM的滚动加载
    async scrollToLoadMoreShadow(maxScrolls = 10) {
        console.log('开始滚动加载更多评论...');
        
        for (let i = 0; i < maxScrolls; i++) {
            // 滚动到页面底部
            window.scrollTo(0, document.documentElement.scrollHeight);
            
            // 等待加载
            await this.delay(1500);
            
            // 检查是否有新评论加载
            const currentCommentCount = this.getCurrentShadowCommentCount();
            console.log(`第${i+1}次滚动，当前评论数: ${currentCommentCount}`);
            
            // 如果连续几次没有新评论，停止滚动
            if (i > 2 && currentCommentCount === 0) {
                console.log('连续多次没有找到评论，停止滚动');
                break;
            }
        }
    }
    
    // 获取当前可见的Shadow DOM评论数量
    getCurrentShadowCommentCount() {
        try {
            const commentApp = document.querySelector('#commentapp');
            if (!commentApp) return 0;
            
            const biliComments = commentApp.querySelector('bili-comments');
            if (!biliComments || !biliComments.shadowRoot) return 0;
            
            const commentThreads = biliComments.shadowRoot.querySelectorAll('bili-comment-thread-renderer');
            return commentThreads.length;
        } catch (e) {
            return 0;
        }
    }

    // 支持Shadow DOM的评论提取（基于用户提供的精确结构）
    async extractShadowComments() {
        const comments = [];
        console.log('开始从 Shadow DOM 提取评论（使用精确结构）...');
        
        try {
            // 1. 找到主评论应用容器
            const commentApp = document.querySelector('#commentapp');
            if (!commentApp) {
                console.log('未找到 #commentapp 容器');
                return await this.fallbackExtractComments();
            }
            
            // 2. 找到 bili-comments 组件
            const biliComments = commentApp.querySelector('bili-comments');
            if (!biliComments) {
                console.log('未找到 bili-comments 组件');
                return await this.fallbackExtractComments();
            }
            
            // 3. 检查 bili-comments 的 shadowRoot
            const biliCommentsRoot = biliComments.shadowRoot;
            if (!biliCommentsRoot) {
                console.log('bili-comments 没有 shadowRoot');
                return await this.fallbackExtractComments();
            }
            
            console.log('找到 bili-comments shadowRoot');
            
            // 4. 在第一层 shadowRoot 中查找 #feed 容器
            const feedContainer = biliCommentsRoot.querySelector('#feed');
            if (!feedContainer) {
                console.log('未找到 #feed 容器，尝试其他选择器');
                // 尝试其他可能的选择器
                const alternativeContainers = biliCommentsRoot.querySelectorAll('bili-comment-thread-renderer');
                if (alternativeContainers.length === 0) {
                    console.log('未找到任何评论线程容器');
                    return await this.fallbackExtractComments();
                }
            }
            
            // 5. 查找所有评论线程（bili-comment-thread-renderer）
            const commentThreads = biliCommentsRoot.querySelectorAll('bili-comment-thread-renderer');
            console.log(`找到 ${commentThreads.length} 个评论线程`);
            
            if (commentThreads.length === 0) {
                console.log('未找到评论线程，尝试替代方法');
                return await this.fallbackExtractComments();
            }
            
            // 6. 遍历每个评论线程
            for (let i = 0; i < commentThreads.length; i++) {
                try {
                    const thread = commentThreads[i];
                    
                    // 7. 检查线程的 shadowRoot
                    const threadRoot = thread.shadowRoot;
                    if (!threadRoot) {
                        console.log(`线程 ${i} 没有 shadowRoot`);
                        continue;
                    }
                    
                    // 8. 在线程的 shadowRoot 中查找 #comment 元素
                    const commentElement = threadRoot.querySelector('#comment');
                    if (!commentElement) {
                        console.log(`线程 ${i} 没有 #comment 元素`);
                        continue;
                    }
                    
                    // 9. 检查 #comment 的 shadowRoot
                    const commentRoot = commentElement.shadowRoot;
                    if (!commentRoot) {
                        console.log(`线程 ${i} 的 #comment 没有 shadowRoot`);
                        continue;
                    }
                    
                    // 10. 在 #comment 的 shadowRoot 中查找 #main 元素
                    const mainElement = commentRoot.querySelector('#main');
                    if (!mainElement) {
                        console.log(`线程 ${i} 没有 #main 元素`);
                        continue;
                    }
                    
                    // 11. 提取单个评论内容
                    const comment = this.extractFromMainElement(mainElement, i);
                    if (comment) {
                        comments.push(comment);
                        console.log(`成功提取第${i+1}条评论: ${comment.author} - ${comment.text.substring(0, 30)}...`);
                    }
                } catch (error) {
                    console.warn(`提取第${i+1}条评论失败:`, error.message);
                }
            }
            
        } catch (error) {
            console.error('Shadow DOM 评论提取失败:', error);
            return await this.fallbackExtractComments();
        }
        
        console.log(`Shadow DOM 提取完成，共 ${comments.length} 条评论`);
        return comments;
    }
    
    // 从 #main 元素中提取评论内容（基于用户提供的精确DOM结构）
    extractFromMainElement(mainElement, index) {
        try {
            console.log(`开始从 #main 元素提取第${index+1}条评论...`);
            
            // 1. 提取用户名
            let author = '匿名用户';
            
            // 查找 bili-comment-user-info 组件
            const userInfoElement = mainElement.querySelector('bili-comment-user-info');
            if (userInfoElement && userInfoElement.shadowRoot) {
                const userNameElement = userInfoElement.shadowRoot.querySelector('#user-name a');
                if (userNameElement) {
                    author = userNameElement.textContent.trim();
                    console.log(`找到用户名: ${author}`);
                }
            }
            
            // 2. 提取评论内容
            let content = '';
            
            // 查找 bili-rich-text 组件
            const richTextElement = mainElement.querySelector('bili-rich-text');
            if (richTextElement && richTextElement.shadowRoot) {
                const contentsElement = richTextElement.shadowRoot.querySelector('#contents');
                if (contentsElement) {
                    // 获取纯文本内容，过滤HTML标签
                    const spans = contentsElement.querySelectorAll('span');
                    if (spans.length > 0) {
                        // 如果有span元素，提取span中的文本
                        content = Array.from(spans).map(span => span.textContent.trim()).join(' ');
                    } else {
                        // 否则提取整个元素的文本内容
                        content = contentsElement.textContent.trim();
                    }
                    console.log(`找到评论内容: ${content.substring(0, 50)}...`);
                }
            }
            
            // 3. 提取时间
            let timeText = '';
            
            // 查找 bili-comment-action-buttons-renderer 组件
            const actionButtonsElement = mainElement.querySelector('bili-comment-action-buttons-renderer');
            if (actionButtonsElement && actionButtonsElement.shadowRoot) {
                const pubdateElement = actionButtonsElement.shadowRoot.querySelector('#pubdate');
                if (pubdateElement) {
                    timeText = pubdateElement.textContent.trim();
                    console.log(`找到时间: ${timeText}`);
                }
            }
            
            // 4. 提取点赞数
            let likesText = '';
            
            if (actionButtonsElement && actionButtonsElement.shadowRoot) {
                const likeCountElement = actionButtonsElement.shadowRoot.querySelector('#like #count');
                if (likeCountElement) {
                    likesText = likeCountElement.textContent.trim();
                    console.log(`找到点赞数: ${likesText}`);
                }
            }
            
            // 5. 验证评论内容
            if (!content || content.length < 2) {
                console.log(`评论 ${index+1} 内容为空或过短: "${content}"`);
                return null;
            }
            
            // 6. 过滤明显不是评论的内容
            const excludePatterns = [
                /^点击.*/, /^查看.*/, /^加载.*/, /^更多.*/, /^展开.*/,
                /^登录.*/, /^注册.*/, /^下载.*/, /^分享.*/,
                /^\d+秒$/, /^\d+分钟$/, /^\d+小时$/,
                /^关注$/, /^取消关注$/, /^点赞$/, /^取消点赞$/
            ];
            
            for (const pattern of excludePatterns) {
                if (pattern.test(content.trim())) {
                    console.log(`过滤非评论内容: ${content.trim()}`);
                    return null;
                }
            }
            
            // 7. 处理数据
            const timestamp = this.parseTime(timeText);
            const likes = this.parseNumber(likesText);
            const id = this.generateCommentId(author, content, timestamp);
            
            const comment = {
                id,
                author: this.sanitizeText(author),
                text: this.sanitizeText(content),
                timestamp,
                likes,
                replies: 0,
                platform: 'bilibili',
                url: window.location.href
            };
            
            console.log(`成功提取Shadow DOM评论: ${comment.author} - ${comment.text.substring(0, 30)}...`);
            return comment;
            
        } catch (error) {
            console.error(`从 #main 元素提取评论失败:`, error);
            return null;
        }
    }
    
    // 回退方法：当Shadow DOM失败时使用传统方法
    async fallbackExtractComments() {
        console.log('尝试传统方法提取评论...');
        const comments = [];
        
        // 尝试多个可能的评论项选择器
        const commentSelectors = [
            '.reply-item',               // Bilibili新版单条评论
            '.comment-item',            // 通用评论项
            '.list-item.reply-item',    // 组合选择器
            '.list-item',               // 列表项
            '.comment-list-item',       // 评论列表项
            '.reply-wrap',              // 评论包装
            '.comment-wrap',            // 评论包装器
            '[data-testid="comment-item"]', // 测试ID
            '.bb-comment-item',         // 旧版评论项
            '.reply-box',               // 回复框
            '[class*="reply"][class*="item"]',  // 任何包含reply和item的类
            '.comment > div',           // 评论容器下的直接子元素
            'div[class^="comment"]'     // 以comment开头的类
        ];

        let commentElements = [];
        let usedSelector = null;
        
        for (const selector of commentSelectors) {
            try {
                commentElements = document.querySelectorAll(selector);
                if (commentElements.length > 0) {
                    console.log(`传统方法使用选择器: ${selector}, 找到评论: ${commentElements.length}条`);
                    usedSelector = selector;
                    break;
                }
            } catch (e) {
                console.log(`选择器 ${selector} 出错:`, e.message);
                continue;
            }
        }

        if (commentElements.length === 0) {
            console.warn('传统方法也找不到评论元素');
            return comments;
        }

        console.log(`传统方法开始提取 ${commentElements.length} 个评论元素`);
        
        // 提取每条评论
        for (let i = 0; i < Math.min(commentElements.length, 50); i++) {
            try {
                const element = commentElements[i];
                const comment = this.extractSingleBilibiliComment(element, usedSelector);
                if (comment) {
                    comments.push(comment);
                }
            } catch (error) {
                console.warn(`传统方法提取第${i+1}条评论失败:`, error.message);
            }
        }

        console.log(`传统方法成功提取 ${comments.length} 条有效评论`);
        return comments;
    }

    extractSingleBilibiliComment(element, usedSelector) {
        // 基于2024年最新Bilibili结构的选择器
        const extractors = {
            // 提取用户名（更多可能性）
            author: [
                '.user-name',               // 常见用户名类
                '.uname',                   // Bilibili用户名
                '.user-info .name',         // 用户信息中的名称
                '.reply-face .name',        // 回复者名称
                '.up-name',                 // UP主名称
                '.username',                // 用户名
                '.author',                  // 作者
                '.name',                    // 简单名称类
                'a[href*="/space/"]',       // 用户空间链接
                'a[data-usercard-mid]',     // 用户卡片链接
                '[class*="user"][class*="name"]', // 包含user和name的类
                '.reply-tag .name',         // 回复标签中的名称
                'span[title]',              // 带有title属性的span（用户名常在这里）
                'a[title]'                  // 带有title属性的链接
            ],
            // 提取评论内容（更多可能性）
            content: [
                '.reply-content',           // 评论内容
                '.comment-content',         // 评论内容
                '.content',                 // 内容
                '.text-content',            // 文本内容
                '.reply-text',              // 回复文本
                '.comment-text',            // 评论文本
                '.message',                 // 消息
                '.text',                    // 简单文本类
                'p',                        // 段落标签
                '[class*="content"]',       // 包含content的类
                '[class*="text"]',          // 包含text的类
                'span:not([class*="time"]):not([class*="like"]):not([class*="user"]):not([class*="author"])', // 非特殊功能的span
                'div:not([class*="time"]):not([class*="like"]):not([class*="user"]):not([class*="author"]):not([class*="avatar"])' // 非特殊功能的div
            ],
            // 提取时间（更多可能性）
            time: [
                '.reply-time',              // 评论时间
                '.time',                    // 简单时间类
                '.pub-time',                // 发布时间
                '.pubdate',                 // 发布日期
                '.comment-time',            // 评论时间
                '.create-time',             // 创建时间
                'time',                     // time标签
                '[data-time]',              // 数据时间属性
                '[datetime]',               // datetime属性
                '[data-ts]',                // 时间戳属性
                '[class*="time"]',          // 包含time的类
                '[class*="date"]',          // 包含date的类
                'span[title*=":"]',         // 包含冒号的时间格式
                'span[title*="-"]'          // 包含连字符的日期格式
            ],
            // 提取点赞数（更多可能性）
            likes: [
                '.like-num',                // 点赞数量
                '.reply-btn .num',          // 评论按钮中的数字
                '.up-num',                  // 赞同数
                '.like-count',              // 点赞计数
                '.vote-up',                 // 投票赞成
                '.thumbs-up',               // 点赞
                '[class*="like"] .num',     // 点赞相关类中的数字
                '[class*="like"] span',     // 点赞相关类中的span
                '.operation .num',          // 操作区域的数字
                '[data-like-count]',        // 点赞数据属性
                '.count'                    // 通用计数
            ]
        };

        // 提取各个字段
        const author = this.findTextBySelectors(element, extractors.author) || 
                      this.extractAuthorFallback(element) || '匿名用户';
        
        const text = this.findTextBySelectors(element, extractors.content) ||
                    this.extractContentFallback(element);
        
        const timeText = this.findTextBySelectors(element, extractors.time) ||
                        this.extractTimeFallback(element);
        
        const likesText = this.findTextBySelectors(element, extractors.likes);

        // 验证评论内容
        if (!text || text.trim().length === 0 || text.trim().length < 2) {
            console.log('评论内容为空或过短，跳过');
            return null;
        }

        // 过滤明显不是评论的内容
        const excludePatterns = [
            /^点击.*/, /^查看.*/, /^加载.*/, /^更多.*/, /^展开.*/,
            /^登录.*/, /^注册.*/, /^下载.*/, /^分享.*/,
            /^d+秒$/, /^d+分钟$/, /^d+小时$/,
            /^关注$/, /^取消关注$/, /^点赞$/, /^取消点赞$/
        ];
        
        for (const pattern of excludePatterns) {
            if (pattern.test(text.trim())) {
                console.log(`过滤非评论内容: ${text.trim()}`);
                return null;
            }
        }

        // 处理时间格式
        const timestamp = this.parseTime(timeText);
        
        // 处理点赞数
        const likes = this.parseNumber(likesText);

        // 生成唯一ID
        const id = this.generateCommentId(author, text, timestamp);

        const comment = {
            id,
            author: this.sanitizeText(author),
            text: this.sanitizeText(text),
            timestamp,
            likes,
            replies: 0, // Bilibili回复数需要额外解析
            platform: 'bilibili',
            url: window.location.href
        };
        
        console.log(`提取评论: ${comment.author}: ${comment.text.substring(0, 30)}...`);
        return comment;
    }

    // 通过多个选择器查找文本
    findTextBySelectors(element, selectors) {
        for (const selector of selectors) {
            try {
                const target = element.querySelector(selector);
                if (target && target.textContent.trim()) {
                    return target.textContent.trim();
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    // 解析时间格式
    parseTime(timeText) {
        if (!timeText) return new Date().toISOString();

        // 常见的Bilibili时间格式
        const patterns = {
            // 相对时间
            '刚刚': () => new Date(),
            '秒前': (match) => {
                const seconds = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - seconds * 1000);
            },
            '分钟前': (match) => {
                const minutes = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - minutes * 60 * 1000);
            },
            '小时前': (match) => {
                const hours = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - hours * 60 * 60 * 1000);
            },
            '天前': (match) => {
                const days = parseInt(match.replace(/\D/g, '')) || 0;
                return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            }
        };

        // 尝试匹配相对时间
        for (const [pattern, handler] of Object.entries(patterns)) {
            if (timeText.includes(pattern)) {
                try {
                    return handler(timeText).toISOString();
                } catch (e) {
                    continue;
                }
            }
        }

        // 尝试解析绝对时间
        try {
            // 常见格式: 2024-01-01, 01-01, 等
            const date = new Date(timeText);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }
        } catch (e) {
            // 忽略解析错误
        }

        // 默认返回当前时间
        return new Date().toISOString();
    }

    // 解析数字（点赞数等）
    parseNumber(text) {
        if (!text) return 0;
        
        // 移除非数字字符
        const cleaned = text.replace(/[^\d\.]/g, '');
        const number = parseFloat(cleaned);
        
        if (isNaN(number)) return 0;
        
        // 处理中文单位
        if (text.includes('万')) {
            return Math.floor(number * 10000);
        } else if (text.includes('千')) {
            return Math.floor(number * 1000);
        }
        
        return Math.floor(number);
    }

    // 生成评论唯一ID
    generateCommentId(author, text, timestamp) {
        // 使用作者、内容和时间生成哈希
        const content = `${author}_${text}_${timestamp}`;
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(36);
    }
    
    // 提取作者名的回退方法
    extractAuthorFallback(element) {
        // 尝试通过文本内容和结构特征找到作者名
        const possibleAuthors = element.querySelectorAll('a, span, div');
        for (const el of possibleAuthors) {
            const text = el.textContent.trim();
            const href = el.getAttribute('href');
            
            // 如果是用户空间链接
            if (href && href.includes('/space/') && text.length > 0 && text.length < 20) {
                return text;
            }
            
            // 如果有title属性且长度合适
            const title = el.getAttribute('title');
            if (title && title.length > 0 && title.length < 20 && 
                !title.includes('时间') && !title.includes('点赞')) {
                return title;
            }
            
            // 如果文本短且不包含明显的非用户名内容
            if (text.length > 1 && text.length < 15 && 
                !text.includes('点赞') && !text.includes('回复') && 
                !text.includes('关注') && !text.includes('分享') &&
                !/\d+小时|分钟|秒前/.test(text)) {
                return text;
            }
        }
        return null;
    }
    
    // 提取内容的回退方法
    extractContentFallback(element) {
        // 查找最长的文本内容
        let longestText = '';
        const textElements = element.querySelectorAll('*');
        
        for (const el of textElements) {
            const text = el.textContent.trim();
            // 过滤明显不是评论内容的元素
            if (text.length > longestText.length && 
                text.length > 10 && text.length < 2000 &&
                !text.includes('点击') && !text.includes('查看') &&
                !text.includes('下载') && !text.includes('登录') &&
                !el.querySelector('button') && !el.querySelector('input')) {
                longestText = text;
            }
        }
        
        return longestText || null;
    }
    
    // 提取时间的回退方法
    extractTimeFallback(element) {
        // 查找可能是时间的文本
        const timeElements = element.querySelectorAll('*');
        for (const el of timeElements) {
            const text = el.textContent.trim();
            const title = el.getAttribute('title');
            
            // 检查时间模式
            if (this.isTimePattern(text) || this.isTimePattern(title)) {
                return text || title;
            }
        }
        return null;
    }
    
    // 判断是否是时间模式
    isTimePattern(text) {
        if (!text) return false;
        
        const timePatterns = [
            /\d+秒前/, /\d+分钟前/, /\d+小时前/, /\d+天前/,
            /\d{4}-\d{2}-\d{2}/, /\d{2}-\d{2}/, /\d{2}:\d{2}/,
            /刚刚/, /昨天/, /前天/
        ];
        
        return timePatterns.some(pattern => pattern.test(text));
    }
}

// 初始化内容脚本
if (typeof window !== 'undefined' && window.location) {
    new CommentExtractor();
} 