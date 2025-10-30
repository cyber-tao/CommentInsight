/**
 * Twitter/X评论提取器
 */

class TwitterExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Twitter评论');

            await this.waitForElement('[data-testid="tweet"]');
            await this.delay(2000);

            const maxComments = config.platforms?.maxComments || 100;
            console.log(`目标提取评论数: ${maxComments}`);

            const comments = [];
            const seenIds = new Set();
            let lastCommentCount = 0;
            let noNewCommentsCount = 0;
            let scrollCount = 0;

            while (comments.length < maxComments) {
                window.scrollTo(0, document.documentElement.scrollHeight);
                await this.delay(2000);

                const tweetElements = document.querySelectorAll('[data-testid="tweet"]');

                for (const element of tweetElements) {
                    if (comments.length >= maxComments) break;

                    try {
                        const comment = this.extractSingleComment(element);
                        if (comment && !seenIds.has(comment.id)) {
                            seenIds.add(comment.id);
                            comments.push(comment);
                        }
                    } catch (error) {
                        console.warn('提取单个Twitter评论失败:', error);
                    }
                }

                scrollCount++;
                console.log(`当前评论数: ${comments.length}/${maxComments}`);

                if (comments.length === lastCommentCount) {
                    noNewCommentsCount++;
                    if (noNewCommentsCount >= 3) {
                        console.log('连续3次没有新评论，停止滚动');
                        break;
                    }
                } else {
                    noNewCommentsCount = 0;
                    lastCommentCount = comments.length;
                }
            }

            console.log(`成功提取${comments.length}条Twitter评论`);

            if (comments.length === 0) {
                throw new Error('未能提取到任何有效评论内容');
            }

            return comments.slice(0, maxComments);

        } catch (error) {
            throw new Error(`Twitter评论提取失败: ${error.message}`);
        }
    }

    extractSingleComment(element) {
        // 提取用户名
        let author = '匿名';
        const authorSelectors = [
            '[data-testid="User-Name"] [dir="ltr"] span',
            '[data-testid="User-Name"] span[class*="css"]',
            'a[role="link"][href*="/"] span',
            '[data-testid="User-Names"] a span'
        ];

        for (const selector of authorSelectors) {
            const authorElement = element.querySelector(selector);
            if (authorElement) {
                const authorText = this.sanitizeText(authorElement.textContent);
                if (authorText && !authorText.match(/^\d+[smhd]$/) && 
                    authorText.length > 0 && authorText.length < 50) {
                    author = authorText.startsWith('@') ? authorText : `@${authorText}`;
                    break;
                }
            }
        }

        // 从链接中提取用户名
        if (author === '匿名') {
            const userLink = element.querySelector('a[href^="/"][href*="/status/"]');
            if (userLink) {
                const href = userLink.getAttribute('href');
                const match = href.match(/^\/([^\/]+)\//);
                if (match) {
                    author = `@${match[1]}`;
                }
            }
        }

        // 提取评论内容
        const contentElement = element.querySelector('[data-testid="tweetText"]');
        if (!contentElement) return null;

        const text = this.sanitizeText(contentElement.textContent);
        if (!text) return null;

        // 提取时间
        const timeElement = element.querySelector('time');
        const timestamp = timeElement ? 
            timeElement.getAttribute('datetime') : 
            new Date().toISOString();

        // 提取点赞数
        let likes = 0;
        const likeButton = element.querySelector('[data-testid="like"]');
        if (likeButton) {
            const ariaLabel = likeButton.getAttribute('aria-label');
            if (ariaLabel) {
                const likeMatch = ariaLabel.match(/(\d+)/);
                if (likeMatch) {
                    likes = parseInt(likeMatch[1]);
                }
            }

            if (likes === 0) {
                const likeText = likeButton.textContent;
                const likeMatch = likeText.match(/(\d+)/);
                if (likeMatch) {
                    likes = parseInt(likeMatch[1]);
                }
            }
        }

        // 提取回复数
        let replies = 0;
        const replyButton = element.querySelector('[data-testid="reply"]');
        if (replyButton) {
            const ariaLabel = replyButton.getAttribute('aria-label');
            if (ariaLabel) {
                const replyMatch = ariaLabel.match(/(\d+)/);
                if (replyMatch) {
                    replies = parseInt(replyMatch[1]);
                }
            }

            if (replies === 0) {
                const replyText = replyButton.textContent;
                const replyMatch = replyText.match(/(\d+)/);
                if (replyMatch) {
                    replies = parseInt(replyMatch[1]);
                }
            }
        }

        // 生成稳定的ID
        const idString = `${author}_${timestamp}_${text.substring(0, 50)}`;
        const id = CommonUtils.generateStableId(idString);

        return {
            id,
            parentId: "0",
            author,
            text,
            timestamp,
            likes,
            platform: 'twitter',
            url: window.location.href
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.TwitterExtractor = TwitterExtractor;
}

