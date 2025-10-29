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
            console.log('开始提取Bilibili评论（支持Shadow DOM）');

            const commentContainer = await this.waitForCommentContainer();
            if (!commentContainer) {
                throw new Error('找不到评论区域，该视频可能未开启评论功能');
            }

            await this.delay(3000);
            await this.scrollToLoadMoreShadow(config?.maxScrolls || 10);
            await this.delay(2000);

            const comments = await this.extractShadowComments();

            this.pingProgress('done', { count: comments.length });

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
            this.pingProgress('scroll', { scroll: i + 1, current: currentCommentCount });

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
                        this.pingProgress('top-comment', { index: i + 1, total: commentThreads.length, collected: comments.length });

                        // 展开并提取该评论的所有回复
                        const expanded = await this.expandAllRepliesForThread(threadRoot);
                        if (expanded) {
                            const replies = this.extractRepliesFromThread(threadRoot, comment.id);
                            if (Array.isArray(replies) && replies.length > 0) {
                                console.log(`  ↳ 获取到 ${replies.length} 条回复`);
                                comments.push(...replies);
                                this.pingProgress('replies', { index: i + 1, replies: replies.length, totalCollected: comments.length });
                            }
                        }
                        // 在每条主评之间加入轻量随机节流，避免触发风控
                        await this.delay(600 + Math.floor(Math.random() * 700));
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

    async expandAllRepliesForThread(threadRoot) {
		try {
			// replies 容器在 threadRoot 内，但“点击查看”在 bili-comment-replies-renderer 的 shadowRoot
			const repliesComponent = threadRoot.querySelector('bili-comment-replies-renderer');
			if (!repliesComponent || !repliesComponent.shadowRoot) {
				console.log('[Bili] 未找到 bili-comment-replies-renderer 或其 shadowRoot');
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
				// 额外兜底：replies 根下任意“点击查看/展开/更多回复/查看更多”按钮
				repRoot.querySelectorAll('button').forEach(b => {
					const t = (b.textContent || '').trim();
					if (/点击查看|展开|更多回复|查看更多/.test(t)) targets.add(b);
				});
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
			const waitForIncrease = async (prev, timeout = 4500) => {
				const start = Date.now();
				while (Date.now() - start < timeout) {
					const cur = getLoadedCount();
					if (cur > prev) return cur;
					await this.delay(200);
				}
				return getLoadedCount();
			};

			let totalClicks = 0;
			let backoff = 800;
			for (let attempt = 0; attempt < 20; attempt++) {
				const btns = getClickTargets();
				if (!btns.length) break;
				const b = btns[0];
				const label = (b.textContent || '').trim();
				const before = getLoadedCount();
				console.log(`[Bili] 展开回复(尝试${attempt + 1})：点击 “${label}”`);
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
			}

			const loadedAfter = getLoadedCount();
			console.log(`[Bili] 回复展开完成：预期=${expectedFromLabel ?? '未知'}，新增=${loadedAfter - loadedBefore}，当前已渲染=${loadedAfter}，点击次数=${totalClicks}`);

			return loadedAfter > loadedBefore;
		} catch (e) {
			console.warn('展开B站回复失败:', e);
			return false;
		}
    }

    extractRepliesFromThread(threadRoot, parentId) {
        const results = [];
        try {
            const repliesComponent = threadRoot.querySelector('bili-comment-replies-renderer');
            if (!repliesComponent || !repliesComponent.shadowRoot) return results;
            const repliesRoot = repliesComponent.shadowRoot;

            // 每条回复
            const replyItems = repliesRoot.querySelectorAll('bili-comment-reply-renderer');
            console.log(`[Bili] 解析到回复条目: ${replyItems.length}`);
            replyItems.forEach(reply => {
                const replyRoot = reply.shadowRoot || reply;
                const main = replyRoot.querySelector('#body #main') || replyRoot.querySelector('#main');
                if (!main) return;

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

                if (!content || content.length < 1) return;

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
            });
            console.log(`[Bili] 已组装回复: ${results.length}`);
        } catch (e) {
            console.warn('提取B站回复失败:', e);
        }
        return results;
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

