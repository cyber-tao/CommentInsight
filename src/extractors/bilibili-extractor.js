/**
 * Bilibili评论提取器 - 支持Shadow DOM穿透
 */

class BilibiliExtractor extends BaseExtractor {
    constructor() {
        super();
        this.__lastProgressPingAt = 0;
    }

    pingProgress(stage, payload = {}) {
        try {
            const now = Date.now();
            // 节流：2.5s内最多一次，避免刷屏
            if (now - this.__lastProgressPingAt < 2500) return;
            this.__lastProgressPingAt = now;
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'extractProgress',
                    platform: 'bilibili',
                    stage,
                    payload,
                    ts: now
                }, () => {});
            }
        } catch (e) {
            // 忽略心跳发送错误
        }
    }
    async extract(config) {
        try {
            Logger.info('extractor-bilibili', 'Start extracting Bilibili comments (Shadow DOM)');
            
            // 保存配置供其他方法使用
            this.config = config;

            const commentContainer = await this.waitForCommentContainer();
            if (!commentContainer) {
                throw new Error('找不到评论区域，该视频可能未开启评论功能');
            }

            await this.delay(3000);
            // 不再限制滚动次数，持续滚动直到没有新内容
            await this.scrollToLoadMoreShadow();
            await this.delay(2000);

            const comments = await this.extractShadowComments();

            this.pingProgress('done', { count: comments.length });
            Logger.info('extractor-bilibili', 'Bilibili comments extracted', { count: comments.length });
            return comments;

        } catch (error) {
            Logger.error('extractor-bilibili', 'Failed to extract Bilibili comments', error);
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
                    Logger.info('extractor-bilibili', 'Found comment container', { selector });
                    return element;
                }
            } catch (e) {
                Logger.debug('extractor-bilibili', 'Container not found for selector', { selector });
                continue;
            }
        }

        return null;
    }

    async scrollToLoadMoreShadow() {
        Logger.info('extractor-bilibili', 'Start scrolling to load more comments');

        let lastCommentCount = 0;
        let stableIterations = 0;
        let scrollCount = 0;

        let iterations = 0;
        const maxIterations = 60;
        while (true) {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await this.delay(1500);

            const currentCommentCount = this.getCurrentShadowCommentCount();
            scrollCount++;
            Logger.debug('extractor-bilibili', 'Scroll iteration', { scroll: scrollCount, current: currentCommentCount });
            this.pingProgress('scroll', { scroll: scrollCount, current: currentCommentCount });

            // 检查是否有新评论加载
            if (currentCommentCount === lastCommentCount) {
                stableIterations++;
                if (stableIterations >= 3) {
                    Logger.info('extractor-bilibili', 'Stop scrolling by stability');
                    break;
                }
            } else {
                stableIterations = 0;
                lastCommentCount = currentCommentCount;
            }
        }

        Logger.info('extractor-bilibili', 'Scroll completed', { threads: lastCommentCount });
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
        Logger.info('extractor-bilibili', 'Start Shadow DOM extraction');

        try {
            // 1. 找到主评论应用容器
            const commentApp = document.querySelector('#commentapp');
            if (!commentApp) {
                Logger.debug('extractor-bilibili', 'No #commentapp container');
                return await this.fallbackExtractComments();
            }

            // 2. 找到 bili-comments 组件
            const biliComments = commentApp.querySelector('bili-comments');
            if (!biliComments) {
                Logger.debug('extractor-bilibili', 'No bili-comments');
                return await this.fallbackExtractComments();
            }

            // 3. 检查 bili-comments 的 shadowRoot
            const biliCommentsRoot = biliComments.shadowRoot;
            if (!biliCommentsRoot) {
                Logger.debug('extractor-bilibili', 'bili-comments has no shadowRoot');
                return await this.fallbackExtractComments();
            }

            Logger.info('extractor-bilibili', 'Found bili-comments shadowRoot');

            // 4. 查找所有评论线程
            const commentThreads = biliCommentsRoot.querySelectorAll('bili-comment-thread-renderer');
            Logger.info('extractor-bilibili', 'Found comment threads', { count: commentThreads.length });

            if (commentThreads.length === 0) {
                Logger.info('extractor-bilibili', 'No threads found, fallback');
                return await this.fallbackExtractComments();
            }

            // 获取最大评论数限制
            const maxComments = this.config?.platforms?.maxComments || 100;

            // 5. 从上到下遍历每个评论线程，提取主评论和回复
            for (let i = 0; i < commentThreads.length; i++) {
                if (comments.length >= maxComments) {
                    Logger.info('extractor-bilibili', 'Reached max comments, stop', { maxComments });
                    break;
                }

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

                    // 提取主评论
                    const comment = this.extractFromMainElement(mainElement, i);
                    if (comment) {
                        comments.push(comment);
                        Logger.debug('extractor-bilibili', 'Top comment extracted', { collected: comments.length, max: maxComments });
                        this.pingProgress('top-comment', { index: i + 1, total: commentThreads.length, collected: comments.length });

                        // 如果还有配额，展开并提取该评论的回复
                        if (comments.length < maxComments) {
                            const expanded = await this.expandAllRepliesForThread(threadRoot);
                            if (expanded) {
                                const remaining = maxComments - comments.length;
                                const replies = this.extractRepliesFromThread(threadRoot, comment.id, remaining);
                                if (Array.isArray(replies) && replies.length > 0) {
                                    Logger.debug('extractor-bilibili', 'Replies extracted', { replies: replies.length });
                                    comments.push(...replies);
                                    this.pingProgress('replies', { index: i + 1, replies: replies.length, totalCollected: comments.length });
                                }
                            }
                        }
                        
                        // 在每条主评之间加入轻量随机节流，避免触发风控
                        await this.delay(600 + Math.floor(Math.random() * 700));
                    }
                } catch (error) {
                    Logger.warn('extractor-bilibili', 'Failed extracting comment', { index: i + 1, message: error.message });
                }
            }

        } catch (error) {
            Logger.error('extractor-bilibili', 'Shadow extraction failed', error);
            return await this.fallbackExtractComments();
        }

        Logger.info('extractor-bilibili', 'Shadow extraction completed', { count: comments.length });
        return comments;
    }

    async expandAllRepliesForThread(threadRoot) {
		try {
			// replies 容器在 threadRoot 内，但“点击查看”在 bili-comment-replies-renderer 的 shadowRoot
			const repliesComponent = threadRoot.querySelector('bili-comment-replies-renderer');
			if (!repliesComponent || !repliesComponent.shadowRoot) {
                Logger.debug('extractor-bilibili', 'Replies renderer not found');
				return false;
			}
			const repRoot = repliesComponent.shadowRoot;

			// 统计初始已渲染的回复条数
			const getLoadedCount = () => repRoot.querySelectorAll('bili-comment-reply-renderer').length;
			let loadedBefore = getLoadedCount();

			// 尝试解析期望回复数（如果仍有“共X条回复”提示）
			let expectedFromLabel = null;
			const viewMoreAtStart = repRoot.querySelector('#view-more');
			if (viewMoreAtStart) {
				const m = /共\s*(\d+)\s*条回复/.exec((viewMoreAtStart.textContent || '').trim());
				if (m) expectedFromLabel = parseInt(m[1], 10);
			}

			const getClickTargets = () => {
				const targets = new Set();
				// 仅根据DOM结构和ID查找
				const vm = repRoot.querySelector('#view-more');
				if (vm) {
					// 优先 bili-text-button 内部按钮
					const host = vm.querySelector('bili-text-button');
					if (host && host.shadowRoot) {
						const inner = host.shadowRoot.querySelector('button');
						if (inner) targets.add(inner);
					}
					// 兜底：普通 button
					vm.querySelectorAll('button').forEach(b => targets.add(b));
				}
				return Array.from(targets);
			};

			const robustClick = (el) => {
				try { el.scrollIntoView({ block: 'center' }); } catch {}
				try { el.click(); } catch {}
				try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true })); } catch {}
				try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); } catch {}
				try { el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true })); } catch {}
				try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true })); } catch {}
				try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); } catch {}
			};

			// 逐个点击 + 等待加载完成 + 指数退避，降低触发 412 风控概率
			const waitForIncrease = async (prev, maxWaitTime = 4500) => {
				const start = Date.now();
				while (Date.now() - start < maxWaitTime) {
					const cur = getLoadedCount();
					if (cur > prev) return cur;
					await this.delay(200);
				}
				return getLoadedCount();
			};

			let totalClicks = 0;
			let backoff = 800;
			let attempt = 0;
			while (true) {
				const btns = getClickTargets();
				if (!btns.length) break;
				const b = btns[0];
				const label = (b.textContent || '').trim();
				const before = getLoadedCount();
                Logger.debug('extractor-bilibili', 'Expand replies click', { attempt: attempt + 1, label });
				robustClick(b);
				const after = await waitForIncrease(before, 4500);
				if (after > before) {
					totalClicks++;
					backoff = 800; // 成功后重置退避
				} else {
					// 未增加，指数退避并重试
					await this.delay(backoff + Math.floor(Math.random() * 600));
					backoff = Math.min(Math.floor(backoff * 1.5), 4000);
				}

				// 如果已达到期望数量则提前结束
				if (expectedFromLabel && after >= expectedFromLabel) break;
				
				attempt++;
			}

			const loadedAfter = getLoadedCount();
            Logger.info('extractor-bilibili', 'Replies expansion done', { expected: expectedFromLabel ?? 'unknown', added: loadedAfter - loadedBefore, loaded: loadedAfter, clicks: totalClicks });

			return loadedAfter > loadedBefore;
		} catch (e) {
            Logger.warn('extractor-bilibili', 'Expand replies failed', e);
			return false;
		}
    }

    extractRepliesFromThread(threadRoot, parentId, maxCount = Infinity) {
        const results = [];
        try {
            const repliesComponent = threadRoot.querySelector('bili-comment-replies-renderer');
            if (!repliesComponent || !repliesComponent.shadowRoot) return results;
            const repliesRoot = repliesComponent.shadowRoot;

            // 每条回复
            const replyItems = repliesRoot.querySelectorAll('bili-comment-reply-renderer');
            Logger.debug('extractor-bilibili', 'Reply items parsed', { items: replyItems.length, maxCount });
            
            for (let i = 0; i < replyItems.length && results.length < maxCount; i++) {
                const reply = replyItems[i];
                const replyRoot = reply.shadowRoot || reply;
                const main = replyRoot.querySelector('#body #main') || replyRoot.querySelector('#main');
                if (!main) continue;

                // 作者
                let author = '匿名用户';
                const userInfo = main.querySelector('bili-comment-user-info');
                if (userInfo && userInfo.shadowRoot) {
                    const nameA = userInfo.shadowRoot.querySelector('#user-name a');
                    if (nameA && nameA.textContent) author = nameA.textContent.trim();
                }

                // 内容
                let content = '';
                const rich = main.querySelector('bili-rich-text');
                if (rich && rich.shadowRoot) {
                    const contents = rich.shadowRoot.querySelector('#contents');
                    if (contents) {
                        const spans = contents.querySelectorAll('span');
                        content = spans.length > 0
                            ? Array.from(spans).map(s => s.textContent.trim()).join(' ')
                            : (contents.textContent || '').trim();
                    }
                }

                if (!content || content.length < 1) continue;

                // 时间
                let timeText = '';
                const action = replyRoot.querySelector('bili-comment-action-buttons-renderer');
                if (action && action.shadowRoot) {
                    const pub = action.shadowRoot.querySelector('#pubdate');
                    if (pub) timeText = pub.textContent.trim();
                }

                // 点赞
                let likesText = '';
                if (action && action.shadowRoot) {
                    const likeCount = action.shadowRoot.querySelector('#like #count');
                    if (likeCount) likesText = likeCount.textContent.trim();
                }

                const timestamp = CommonUtils.parseTime(timeText);
                const likes = CommonUtils.parseNumber(likesText);
                const id = this.generateCommentId(author, content, timestamp);
                results.push({
                    id,
                    parentId: parentId,
                    author: this.sanitizeText(author),
                    text: this.sanitizeText(content),
                    timestamp,
                    likes,
                    platform: 'bilibili',
                    url: window.location.href
                });
            }
            Logger.debug('extractor-bilibili', 'Replies assembled', { count: results.length });
        } catch (e) {
            Logger.warn('extractor-bilibili', 'Extract replies failed', e);
        }
        return results;
    }
    extractFromMainElement(mainElement, index) {
        try {
            Logger.debug('extractor-bilibili', 'Extract from #main', { index: index + 1 });

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

            // 过滤明显过短的内容（通常是UI元素文本）
            // 不再依赖文字关键词，而是基于长度判断
            if (content.length < 2) {
                return null;
            }
            
            // 过滤纯数字时间格式（如"30秒"、"5分钟"）
            if (/^\d+[秒分钟小时天周月年]$/.test(content.trim())) {
                return null;
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
            Logger.error('extractor-bilibili', 'Extract from #main failed', error);
            return null;
        }
    }

    async fallbackExtractComments() {
        Logger.info('extractor-bilibili', 'Fallback to traditional extraction');
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
                    Logger.info('extractor-bilibili', 'Fallback selector used', { selector, count: commentElements.length });
                    usedSelector = selector;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (commentElements.length === 0) {
            Logger.warn('extractor-bilibili', 'Fallback found no comment elements');
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
                Logger.warn('extractor-bilibili', 'Fallback comment extract failed', { index: i + 1, message: error.message });
            }
        }

        Logger.info('extractor-bilibili', 'Fallback extraction completed', { count: comments.length });
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
