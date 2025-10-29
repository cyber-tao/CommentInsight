/**
 * YouTube评论提取器
 */

class YouTubeExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取YouTube评论');

            // 等待评论区域加载
            await this.waitForElement('#comments');

            // 滚动加载更多评论
            const commentsContainer = document.querySelector('#comments');
            await this.scrollToLoadMore(commentsContainer);

            // 提取评论 - 支持普通视频和Shorts视频
            const commentElements = document.querySelectorAll('ytd-comment-thread-renderer, ytd-comment-view-model');
            const comments = [];

            for (const element of commentElements) {
                try {
                    const comment = this.extractSingleComment(element);
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

    extractSingleComment(element) {
        // 支持普通YouTube视频和Shorts视频的DOM结构
        const authorElement = element.querySelector('#author-text');
        const contentElement = element.querySelector('#content-text') || 
                              element.querySelector('yt-attributed-string#content-text');
        const timeElement = element.querySelector('.published-time-text') || 
                           element.querySelector('#published-time-text');
        const likesElement = element.querySelector('#vote-count-middle');

        if (!contentElement) return null;

        // 获取作者名
        let author = '匿名';
        if (authorElement) {
            const authorSpan = authorElement.querySelector('span');
            author = authorSpan ? 
                this.sanitizeText(authorSpan.textContent) : 
                this.sanitizeText(authorElement.textContent);
        }

        // 获取评论内容
        let text = '';
        if (contentElement) {
            if (contentElement.tagName === 'YT-ATTRIBUTED-STRING') {
                const span = contentElement.querySelector('span');
                text = span ? 
                    this.sanitizeText(span.textContent) : 
                    this.sanitizeText(contentElement.textContent);
            } else {
                text = this.sanitizeText(contentElement.textContent);
            }
        }

        // 获取时间戳
        let timestamp = new Date().toISOString();
        if (timeElement) {
            const timeLink = timeElement.querySelector('a');
            timestamp = timeLink ? timeLink.textContent : timeElement.textContent;
        }

        // 获取点赞数
        let likes = 0;
        if (likesElement) {
            likes = parseInt(likesElement.textContent) || 0;
        }

        // 生成ID：优先使用data-cid，否则基于内容生成
        let id = element.getAttribute('data-cid');
        if (!id) {
            const idString = `${author}_${text.substring(0, 50)}_${timestamp}`;
            id = CommonUtils.generateStableId(idString);
        }
        
        return {
            id,
            parentId: "0",
            author: author,
            text: text,
            timestamp: timestamp,
            likes: likes,
            platform: 'youtube',
            url: window.location.href
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.YouTubeExtractor = YouTubeExtractor;
}

