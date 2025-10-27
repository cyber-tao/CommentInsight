/**
 * TikTok评论提取器
 */

class TikTokExtractor extends BaseExtractor {
    async extract(config) {
        try {
            console.log('开始提取TikTok评论');

            await this.delay(3000);

            const maxComments = config.platforms?.maxComments || 100;
            console.log(`目标提取评论数: ${maxComments}`);

            const comments = [];
            const seenTexts = new Set();
            let lastCommentCount = 0;
            let noNewCommentsCount = 0;
            const maxScrollAttempts = 50;
            let scrollAttempts = 0;

            while (comments.length < maxComments && scrollAttempts < maxScrollAttempts) {
                window.scrollTo(0, document.documentElement.scrollHeight);
                await this.delay(2000);

                await this.expandAllReplies();
                await this.delay(1500);

                let commentContainers = document.querySelectorAll('[class*="DivCommentObjectWrapper"]');
                if (commentContainers.length === 0) {
                    commentContainers = document.querySelectorAll('[class*="DivCommentItemWrapper"]');
                }
                console.log(`找到 ${commentContainers.length} 个评论容器`);

                for (const container of commentContainers) {
                    if (comments.length >= maxComments) break;

                    try {
                        const mainComment = this.extractCommentFromElement(container, "0");
                        if (mainComment && !seenTexts.has(mainComment.text)) {
                            seenTexts.add(mainComment.text);
                            comments.push(mainComment);
                            
                            // 提取该主评论的回复
                            if (comments.length < maxComments) {
                                const replyContainer = container.querySelector('[class*="DivReplyContainer"]');
                                if (replyContainer) {
                                    const replyComments = replyContainer.querySelectorAll('[class*="DivCommentContentContainer"]');
                                    for (const replyComment of replyComments) {
                                        if (comments.length >= maxComments) break;

                                        const reply = this.extractCommentFromElement(replyComment, mainComment.id);
                                        if (reply && !seenTexts.has(reply.text)) {
                                            seenTexts.add(reply.text);
                                            comments.push(reply);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('提取单个评论失败:', error);
                    }
                }

                console.log(`第${scrollAttempts + 1}次滚动，当前评论数: ${comments.length}`);

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

                scrollAttempts++;
            }

            console.log(`成功提取${comments.length}条TikTok评论（包含回复）`);

            if (comments.length === 0) {
                throw new Error('未能提取到任何有效评论内容');
            }

            return comments.slice(0, maxComments);

        } catch (error) {
            throw new Error(`TikTok评论提取失败: ${error.message}`);
        }
    }

    async expandAllReplies() {
        try {
            const selectors = [
                '[class*="DivViewRepliesContainer"]',
                '[class*="DivViewMoreRepliesWrapper"]',
                '[data-e2e^="view-more-"]',
                '[class*="DivReplyActionContainer"] span[role="button"]'
            ];

            let allButtons = [];
            for (const selector of selectors) {
                const buttons = document.querySelectorAll(selector);
                allButtons.push(...buttons);
            }

            console.log(`找到 ${allButtons.length} 个可能的展开按钮`);

            let expandedCount = 0;
            for (const button of allButtons) {
                try {
                    const buttonText = button.textContent;
                    if ((buttonText.includes('查看') || buttonText.includes('View') || buttonText.includes('replies')) &&
                        !buttonText.includes('隐藏') && !buttonText.includes('Hide')) {
                        button.click();
                        expandedCount++;
                        console.log(`点击了展开按钮: ${buttonText.substring(0, 20)}`);
                        if (expandedCount % 3 === 0) {
                            await this.delay(800);
                        }
                    }
                } catch (e) {
                    console.warn('点击展开按钮失败:', e);
                }
            }

            if (expandedCount > 0) {
                console.log(`成功展开了 ${expandedCount} 个回复`);
            }
        } catch (error) {
            console.warn('展开回复过程出错:', error);
        }
    }

    extractCommentFromElement(element, parentId) {
        try {
            // parentId: "0"表示主评论，否则是父评论的ID
            const isMainComment = parentId === "0";
            const level = isMainComment ? 1 : 2;
            
            // 提取用户名
            let author = '匿名';
            const usernameSelectors = [
                `[data-e2e="comment-username-${level}"] p`,
                `[data-e2e="comment-username-${level}"]`,
                '[class*="DivUsernameContentWrapper"] p',
                '[class*="StyledTUXText"]'
            ];

            for (const selector of usernameSelectors) {
                const usernameElement = element.querySelector(selector);
                if (usernameElement && usernameElement.textContent.trim()) {
                    author = this.sanitizeText(usernameElement.textContent);
                    break;
                }
            }

            // 提取评论内容
            let text = '';
            const contentSelectors = [
                `[data-e2e="comment-level-${level}"] span`,
                `[data-e2e="comment-level-${level}"]`,
                `span[data-e2e="comment-level-${level}"]`
            ];

            for (const selector of contentSelectors) {
                const contentElement = element.querySelector(selector);
                if (contentElement && contentElement.textContent.trim()) {
                    text = this.sanitizeText(contentElement.textContent);
                    break;
                }
            }

            if (!text || text.length < 1) {
                return null;
            }

            // 提取时间
            let timestamp = new Date().toISOString();
            const timeSelectors = [
                '[class*="DivCommentSubContentWrapper"] span:first-child',
                '[class*="DivCommentSubContentWrapper"] .TUXText:first-child',
                `[data-e2e="comment-time-${level}"]`
            ];

            for (const selector of timeSelectors) {
                const timeElement = element.querySelector(selector);
                if (timeElement && timeElement.textContent.trim()) {
                    const timeText = this.sanitizeText(timeElement.textContent);
                    if (/\d/.test(timeText) && timeText.length < 20) {
                        timestamp = timeText;
                        break;
                    }
                }
            }

            if (timestamp && /^\d{1,2}-\d{1,2}$/.test(timestamp)) {
                const currentYear = new Date().getFullYear();
                timestamp = `${currentYear}-${timestamp}`;
            }

            // 提取点赞数
            let likes = 0;
            const likeSelectors = [
                '[class*="DivLikeContainer"] span.TUXText',
                '[class*="DivLikeContainer"] span:last-child',
                '[data-e2e="comment-like-count"]'
            ];

            for (const selector of likeSelectors) {
                const likeElement = element.querySelector(selector);
                if (likeElement) {
                    const likeText = this.sanitizeText(likeElement.textContent);
                    likes = CommonUtils.parseNumber(likeText);
                    if (likes > 0) break;
                }
            }

            // 生成稳定的ID（基于内容和作者）
            const idString = `${author}_${text.substring(0, 50)}_${timestamp}`;
            const id = CommonUtils.generateStableId(idString);
            
            console.log(`提取到评论: ${author} - ${text.substring(0, 30)}... (${likes} 赞) [parentId: ${parentId}]`);

            return {
                id,
                parentId,
                author,
                text,
                timestamp,
                likes
            };
        } catch (error) {
            console.warn('提取评论数据失败:', error);
            return null;
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.TikTokExtractor = TikTokExtractor;
}

