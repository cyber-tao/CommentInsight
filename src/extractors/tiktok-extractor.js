/**
 * TikTok评论提取器
 */

class TikTokExtractor extends BaseExtractor {
    async extract(config) {
        try {
            Logger.info('extractor-tiktok', 'Start extracting TikTok comments');

            await this.delay(3000);

            const maxComments = config.platforms?.maxComments || 100;
            Logger.debug('extractor-tiktok', 'Target max comments', { maxComments });

            const comments = [];
            const seenIds = new Set();
            const processedContainers = new Set(); // 记录已处理的容器
            let stableIterations = 0;
            let lastCollected = 0;

            let iterations = 0;
            const maxIterations = 80;
            while (comments.length < maxComments) {
                const scrolled = await this.scrollCommentsSection();
                await this.delay(800);

                let commentContainers = Array.from(document.querySelectorAll('[data-e2e="comment-item"]'));
                if (commentContainers.length === 0) {
                    commentContainers = Array.from(document.querySelectorAll('[class*="DivCommentObjectWrapper"], [class*="DivCommentItemWrapper"]'));
                }

                for (const container of commentContainers) {
                    if (comments.length >= maxComments) break;

                    // 跳过已处理的容器
                    if (processedContainers.has(container)) continue;
                    processedContainers.add(container);

                    try {
                        // 先展开该容器的回复
                        await this.ensureRepliesExpanded(container);
                        
                        // 提取主评论
                        const mainComment = this.extractCommentFromElement(container, "0");
                        if (mainComment && !seenIds.has(mainComment.id)) {
                            seenIds.add(mainComment.id);
                            comments.push(mainComment);

                            // 提取回复
                            if (comments.length < maxComments) {
                                const remaining = maxComments - comments.length;
                                const replies = this.extractRepliesFromContainer(container, mainComment.id, seenIds, remaining);
                                if (replies.length) {
                                    comments.push(...replies);
                                }
                            }
                        }
                    } catch (error) {
                        Logger.warn('extractor-tiktok', 'Extract single comment failed', error);
                    }
                }

                Logger.debug('extractor-tiktok', 'Progress', { collected: comments.length, maxComments });

                // 检查是否无新增内容
                if (comments.length === lastCollected && !scrolled) {
                    stableIterations++;
                    if (stableIterations >= 5) {
                        Logger.info('extractor-tiktok', 'Stop by stability');
                        break;
                    }
                } else {
                    stableIterations = 0;
                }

                lastCollected = comments.length;

                iterations++;
                if (iterations >= maxIterations) {
                    Logger.info('extractor-tiktok', 'Stop by iteration cap', { maxIterations });
                    break;
                }
            }

            Logger.info('extractor-tiktok', 'Extraction done', { count: comments.length });

            if (comments.length === 0) {
                throw new Error('未能提取到任何有效评论内容');
            }

            return comments.slice(0, maxComments);

        } catch (error) {
            Logger.error('extractor-tiktok', 'Extract failed', error);
            throw new Error(`TikTok评论提取失败: ${error.message}`);
        }
    }

    async expandAllReplies() {
        try {
            let clickedAny = false;
            const maxRounds = 12;

            for (let round = 0; round < maxRounds; round++) {
                const toggles = this.findReplyToggleButtons();
                if (toggles.length === 0) break;

            Logger.debug('extractor-tiktok', 'Expand replies round', { round: round + 1, targets: toggles.length });

                for (const toggle of toggles) {
                    try {
                        this.robustClick(toggle);
                        clickedAny = true;
                    } catch (error) {
                        Logger.warn('extractor-tiktok', 'Expand replies click failed', error);
                    }
                }

                await this.delay(500 + Math.floor(Math.random() * 400));
            }

            return clickedAny;
        } catch (error) {
            Logger.warn('extractor-tiktok', 'Expand replies error', error);
            return false;
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
            const idString = `${parentId}_${author}_${text.substring(0, 80)}_${timestamp}`;
            const id = CommonUtils.generateStableId(idString);
            
            Logger.debug('extractor-tiktok', 'Comment extracted', { author, likes, parentId });

            return {
                id,
                parentId,
                author,
                text,
                timestamp,
                likes,
                platform: 'tiktok',
                url: window.location.href
            };
        } catch (error) {
            Logger.warn('extractor-tiktok', 'Extract comment failed', error);
            return null;
        }
    }

    findReplyToggleButtons() {
        const selectors = [
            '[data-e2e^="view-more"]',
            '[data-e2e="view-more-1"]',
            '[class*="DivViewMoreRepliesWrapper"]',
            '[class*="DivViewRepliesContainer"]',
            '[class*="ViewReplies"]',
            '[class*="ViewMore"]'
        ];

        const candidates = new Set();
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(node => candidates.add(node));
        });

        return Array.from(candidates).map(node => {
            if (!(node instanceof HTMLElement)) return null;
            const clickable = node.closest('button, [role="button"], .css-1ey35vz-5e6d46e3--DivViewRepliesContainer, .css-16mvqis-5e6d46e3--DivViewMoreRepliesWrapper');
            return (clickable instanceof HTMLElement) ? clickable : node;
        }).filter((node, index, arr) => {
            if (!(node instanceof HTMLElement)) return false;
            if (node.offsetParent === null) return false;
            // 检查是否在回复容器内（排除"隐藏"按钮通常不在DivViewMoreRepliesWrapper内）
            const isInReplyContext = node.closest('[class*="DivReplyContainer"], [class*="DivViewMoreRepliesWrapper"]');
            if (!isInReplyContext) return false;
            return arr.indexOf(node) === index;
        });
    }

    extractRepliesFromContainer(container, parentId, seenIds, remaining) {
        const replies = [];
        if (!parentId || parentId === "0" || remaining <= 0) {
            return replies;
        }

        const replyElements = this.getReplyElements(container);
        for (const replyElement of replyElements) {
            if (replies.length >= remaining) break;
            const reply = this.extractCommentFromElement(replyElement, parentId);
            if (!reply) continue;
            if (seenIds.has(reply.id)) continue;
            seenIds.add(reply.id);
            replies.push(reply);
        }

        return replies;
    }

    getReplyElements(container) {
        const selectors = [
            '[data-e2e="comment-reply-item"]',
            '[data-e2e="comment-reply"]',
            '[class*="DivReplyItem"]',
            '[class*="DivReplyContainer"] [data-e2e="comment-item"]'
        ];

        const elements = new Set();
        for (const selector of selectors) {
            container.querySelectorAll(selector).forEach(el => {
                if (el && el !== container) {
                    elements.add(el);
                }
            });
        }

        return Array.from(elements);
    }

    async scrollCommentsSection() {
        const scrollContainers = [
            '[class*="DivCommentWrapper"]',
            '[class*="DivCommentListContainer"]',
            '[data-e2e="comment-list"]',
            '[data-e2e="browse-comment-list"]'
        ];

        for (const selector of scrollContainers) {
            const container = document.querySelector(selector);
            if (container && container instanceof HTMLElement) {
                const previous = container.scrollTop;
                container.scrollTop = container.scrollHeight;
                await this.delay(20);
                return container.scrollTop !== previous;
            }
        }

        const prevY = window.scrollY;
        window.scrollBy(0, Math.max(window.innerHeight, 800));
        await this.delay(20);
        return window.scrollY !== prevY;
    }

    async ensureRepliesExpanded(container) {
        // 只展开一次，避免重复展开/折叠
        const selectors = [
            '[data-e2e^="view-more"]',
            '[class*="DivViewMoreRepliesWrapper"]'
        ];

        const toggles = [];
        selectors.forEach(selector => {
            container.querySelectorAll(selector).forEach(element => {
                if (element instanceof HTMLElement && element.offsetParent !== null) {
                    // 查找可点击的父元素
                    const clickable = element.closest('button, [role="button"], .css-1ey35vz-5e6d46e3--DivViewRepliesContainer, .css-16mvqis-5e6d46e3--DivViewMoreRepliesWrapper');
                    const target = (clickable instanceof HTMLElement) ? clickable : element;
                    
                    // 检查是否是"展开"按钮（通过DOM位置判断，第一个按钮是展开，第二个是隐藏）
                    const wrapper = target.closest('[class*="DivViewMoreRepliesWrapper"]');
                    if (wrapper) {
                        const allButtons = wrapper.querySelectorAll('.css-1ey35vz-5e6d46e3--DivViewRepliesContainer, [class*="DivViewRepliesContainer"]');
                        // 只点击第一个按钮（展开按钮）
                        if (allButtons.length > 0 && target.closest('.css-1ey35vz-5e6d46e3--DivViewRepliesContainer, [class*="DivViewRepliesContainer"]') === allButtons[0]) {
                            toggles.push(target);
                        }
                    }
                }
            });
        });

        if (toggles.length > 0) {
            for (const toggle of toggles) {
                try {
                    this.robustClick(toggle);
                    await this.delay(300);
                } catch (error) {
                    Logger.warn('extractor-tiktok', 'Expand reply failed', error);
                }
            }
            // 等待DOM更新
            await this.delay(500);
        }
    }

    robustClick(element) {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        events.forEach(eventName => {
            try {
                const event = new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window });
                element.dispatchEvent(event);
            } catch (error) {
                // 忽略
            }
        });
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.TikTokExtractor = TikTokExtractor;
}

