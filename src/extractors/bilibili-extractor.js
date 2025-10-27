/**
 * Bilibili评论提取器 - 支持Shadow DOM穿透
 */

class BilibiliExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取Bilibili评论（支持Shadow DOM）');

            const commentContainer = await this.waitForCommentContainer();
            if (!commentContainer) {
                throw new Error('找不到评论区域，该视频可能未开启评论功能');
            }

            await this.delay(3000);
            await this.scrollToLoadMoreShadow(config?.maxScrolls || 10);
            await this.delay(2000);

            const comments = await this.extractShadowComments();

            console.log(`成功提取Bilibili评论: ${comments.length}条`);
            return comments;

        } catch (error) {
            console.error('Bilibili评论提取失败:', error);
            throw error;
        }
    }

    async waitForCommentContainer() {
        const mainSelectors = [
            '#commentapp',
            'bili-comments',
            '#comment',
            '.comment'
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

    async scrollToLoadMoreShadow(maxScrolls = 10) {
        console.log('开始滚动加载更多评论...');

        for (let i = 0; i < maxScrolls; i++) {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await this.delay(1500);

            const currentCommentCount = this.getCurrentShadowCommentCount();
            console.log(`第${i + 1}次滚动，当前评论数: ${currentCommentCount}`);

            if (i > 2 && currentCommentCount === 0) {
                console.log('连续多次没有找到评论，停止滚动');
                break;
            }
        }
    }

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

            // 4. 查找所有评论线程
            const commentThreads = biliCommentsRoot.querySelectorAll('bili-comment-thread-renderer');
            console.log(`找到 ${commentThreads.length} 个评论线程`);

            if (commentThreads.length === 0) {
                console.log('未找到评论线程，尝试替代方法');
                return await this.fallbackExtractComments();
            }

            // 5. 遍历每个评论线程
            for (let i = 0; i < commentThreads.length; i++) {
                try {
                    const thread = commentThreads[i];
                    const threadRoot = thread.shadowRoot;
                    if (!threadRoot) continue;

                    const commentElement = threadRoot.querySelector('#comment');
                    if (!commentElement) continue;

                    const commentRoot = commentElement.shadowRoot;
                    if (!commentRoot) continue;

                    const mainElement = commentRoot.querySelector('#main');
                    if (!mainElement) continue;

                    const comment = this.extractFromMainElement(mainElement, i);
                    if (comment) {
                        comments.push(comment);
                        console.log(`成功提取第${i + 1}条评论: ${comment.author} - ${comment.text.substring(0, 30)}...`);
                    }
                } catch (error) {
                    console.warn(`提取第${i + 1}条评论失败:`, error.message);
                }
            }

        } catch (error) {
            console.error('Shadow DOM 评论提取失败:', error);
            return await this.fallbackExtractComments();
        }

        console.log(`Shadow DOM 提取完成，共 ${comments.length} 条评论`);
        return comments;
    }

    extractFromMainElement(mainElement, index) {
        try {
            console.log(`开始从 #main 元素提取第${index + 1}条评论...`);

            // 提取用户名
            let author = '匿名用户';
            const userInfoElement = mainElement.querySelector('bili-comment-user-info');
            if (userInfoElement && userInfoElement.shadowRoot) {
                const userNameElement = userInfoElement.shadowRoot.querySelector('#user-name a');
                if (userNameElement) {
                    author = userNameElement.textContent.trim();
                }
            }

            // 提取评论内容
            let content = '';
            const richTextElement = mainElement.querySelector('bili-rich-text');
            if (richTextElement && richTextElement.shadowRoot) {
                const contentsElement = richTextElement.shadowRoot.querySelector('#contents');
                if (contentsElement) {
                    const spans = contentsElement.querySelectorAll('span');
                    if (spans.length > 0) {
                        content = Array.from(spans).map(span => span.textContent.trim()).join(' ');
                    } else {
                        content = contentsElement.textContent.trim();
                    }
                }
            }

            // 提取时间
            let timeText = '';
            const actionButtonsElement = mainElement.querySelector('bili-comment-action-buttons-renderer');
            if (actionButtonsElement && actionButtonsElement.shadowRoot) {
                const pubdateElement = actionButtonsElement.shadowRoot.querySelector('#pubdate');
                if (pubdateElement) {
                    timeText = pubdateElement.textContent.trim();
                }
            }

            // 提取点赞数
            let likesText = '';
            if (actionButtonsElement && actionButtonsElement.shadowRoot) {
                const likeCountElement = actionButtonsElement.shadowRoot.querySelector('#like #count');
                if (likeCountElement) {
                    likesText = likeCountElement.textContent.trim();
                }
            }

            // 验证评论内容
            if (!content || content.length < 2) {
                return null;
            }

            // 过滤非评论内容
            const excludePatterns = [
                /^点击.*/, /^查看.*/, /^加载.*/, /^更多.*/, /^展开.*/,
                /^登录.*/, /^注册.*/, /^下载.*/, /^分享.*/,
                /^\d+秒$/, /^\d+分钟$/, /^\d+小时$/,
                /^关注$/, /^取消关注$/, /^点赞$/, /^取消点赞$/
            ];

            for (const pattern of excludePatterns) {
                if (pattern.test(content.trim())) {
                    return null;
                }
            }

            const timestamp = CommonUtils.parseTime(timeText);
            const likes = CommonUtils.parseNumber(likesText);
            const id = this.generateCommentId(author, content, timestamp);

            return {
                id,
                parentId: "0",
                author: this.sanitizeText(author),
                text: this.sanitizeText(content),
                timestamp,
                likes,
                platform: 'bilibili',
                url: window.location.href
            };

        } catch (error) {
            console.error(`从 #main 元素提取评论失败:`, error);
            return null;
        }
    }

    async fallbackExtractComments() {
        console.log('尝试传统方法提取评论...');
        const comments = [];

        const commentSelectors = [
            '.reply-item',
            '.comment-item',
            '.list-item.reply-item',
            '.list-item'
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
                continue;
            }
        }

        if (commentElements.length === 0) {
            console.warn('传统方法也找不到评论元素');
            return comments;
        }

        for (let i = 0; i < Math.min(commentElements.length, 50); i++) {
            try {
                const element = commentElements[i];
                const comment = this.extractSingleComment(element);
                if (comment) {
                    comments.push(comment);
                }
            } catch (error) {
                console.warn(`传统方法提取第${i + 1}条评论失败:`, error.message);
            }
        }

        console.log(`传统方法成功提取 ${comments.length} 条有效评论`);
        return comments;
    }

    extractSingleComment(element) {
        const extractors = {
            author: ['.user-name', '.uname', '.user-info .name'],
            content: ['.reply-content', '.comment-content', '.content'],
            time: ['.reply-time', '.time', '.pub-time'],
            likes: ['.like-num', '.reply-btn .num', '.up-num']
        };

        const author = this.findTextBySelectors(element, extractors.author) || '匿名用户';
        const text = this.findTextBySelectors(element, extractors.content);
        const timeText = this.findTextBySelectors(element, extractors.time);
        const likesText = this.findTextBySelectors(element, extractors.likes);

        if (!text || text.trim().length < 2) {
            return null;
        }

        const timestamp = CommonUtils.parseTime(timeText);
        const likes = CommonUtils.parseNumber(likesText);
        const id = this.generateCommentId(author, text, timestamp);

        return {
            id,
            parentId: "0",
            author: this.sanitizeText(author),
            text: this.sanitizeText(text),
            timestamp,
            likes,
            platform: 'bilibili',
            url: window.location.href
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.BilibiliExtractor = BilibiliExtractor;
}

