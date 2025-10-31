/**
 * Bilibili评论提取器 - 支持Shadow DOM穿透
 */

class BilibiliExtractor extends BaseExtractor {
    constructor() {
        super();
        this.__lastProgressPingAt = 0;
        // 自适应延迟策略
        this.adaptiveDelay = {
            baseDelay: 800,
            currentDelay: 800,
            minDelay: 500,
            maxDelay: 4000,
            successCount: 0,
            failureCount: 0
        };
    }

    /**
     * 自适应延迟 - 根据成功/失败自动调整延迟时间
     * @param {boolean} success - 操作是否成功
     * @returns {number} - 当前延迟时间
     */
    getAdaptiveDelay(success) {
        if (success) {
            this.adaptiveDelay.successCount++;
            this.adaptiveDelay.failureCount = 0;
            
            // 连续成功3次，减少延迟
            if (this.adaptiveDelay.successCount >= 3) {
                this.adaptiveDelay.currentDelay = Math.max(
                    this.adaptiveDelay.minDelay,
                    Math.floor(this.adaptiveDelay.currentDelay * 0.8)
                );
                this.adaptiveDelay.successCount = 0;
            }
        } else {
            this.adaptiveDelay.failureCount++;
            this.adaptiveDelay.successCount = 0;
            
            // 失败时增加延迟
            this.adaptiveDelay.currentDelay = Math.min(
                this.adaptiveDelay.maxDelay,
                Math.floor(this.adaptiveDelay.currentDelay * 1.5)
            );
        }
        
        return this.adaptiveDelay.currentDelay;
    }

    /**
     * 重置自适应延迟策略
     */
    resetAdaptiveDelay() {
        this.adaptiveDelay.currentDelay = this.adaptiveDelay.baseDelay;
        this.adaptiveDelay.successCount = 0;
        this.adaptiveDelay.failureCount = 0;
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

    async scrollToLoadMoreShadow() {
        console.log('开始滚动加载更多评论...');

        let lastCommentCount = 0;
        let stableIterations = 0;
        let scrollCount = 0;

        while (true) {
            window.scrollTo(0, document.documentElement.scrollHeight);
            await this.delay(1500);

            const currentCommentCount = this.getCurrentShadowCommentCount();
            scrollCount++;
            console.log(`第${scrollCount}次滚动，当前评论数: ${currentCommentCount}`);
            this.pingProgress('scroll', { scroll: scrollCount, current: currentCommentCount });

            // 检查是否有新评论加载
            if (currentCommentCount === lastCommentCount) {
                stableIterations++;
                if (stableIterations >= 3) {
                    console.log('连续3次滚动没有新评论加载，停止滚动');
                    break;
                }
            } else {
                stableIterations = 0;
                lastCommentCount = currentCommentCount;
            }
        }

        console.log(`滚动完成，共找到 ${lastCommentCount} 个评论线程`);
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
            if (!biliComments.shadowRoot) {
                console.log('bili-comments 没有 shadowRoot');
                return await this.fallbackExtractComments();
            }

            // 4. 从shadowRoot中获取所有评论线程
            const threads = biliComments.shadowRoot.querySelectorAll('bili-comment-thread-renderer');
            console.log(`找到 ${threads.length} 个评论线程`);

            // 5. 逐个处理评论线程
            for (const thread of threads) {
                const topComment = await this.extractTopLevelComment(thread);
                if (topComment) {
                    comments.push(topComment);
                    
                    // 展开回复后提取
                    await this.expandAllRepliesForThread(thread);
                    const replies = this.extractRepliesFromThread(thread, topComment.id, this.config?.platforms?.maxComments || 100);
                    comments.push(...replies);
                }
            }

            console.log(`从Shadow DOM成功提取 ${comments.length} 条评论`);
            return comments;

        } catch (error) {
            console.error('Shadow DOM提取失败，尝试使用fallback方法:', error);
            return await this.fallbackExtractComments();
        }
    }

    async extractTopLevelComment(threadRoot) {
        try {
            // 首先检查threadRoot是否有shadowRoot
            if (!threadRoot.shadowRoot) {
                console.log('[Bili] threadRoot没有shadowRoot');
                return null;
            }

            const threadShadow = threadRoot.shadowRoot;
            
            // 尝试多种可能的选择器（在shadowRoot中查找）
            const possibleSelectors = [
                'bili-comment-renderer',
                '#comment',  // 根据源码，主评论有id="comment"
                'bili-comment',
                '[class*="comment-renderer"]'
            ];
            
            let mainRenderer = null;
            for (const selector of possibleSelectors) {
                mainRenderer = threadShadow.querySelector(selector);
                if (mainRenderer) {
                    console.log(`[Bili] 在threadRoot.shadowRoot中找到主评论元素: ${selector}`);
                    break;
                }
            }
            
            if (!mainRenderer) {
                console.log('[Bili] 在threadRoot.shadowRoot中未找到任何主评论元素');
                return null;
            }

            // 获取主评论的shadowRoot
            const commentShadow = mainRenderer.shadowRoot;
            if (!commentShadow) {
                console.log('[Bili] 主评论元素没有 shadowRoot，尝试直接提取');
                return this.extractFromElement(mainRenderer, "0");
            }

            // 从主评论的shadowRoot提取数据
            return this.extractFromShadowRoot(commentShadow, "0");

        } catch (error) {
            console.warn('[Bili] 提取主评论失败:', error);
            return null;
        }
    }

    /**
     * 从Shadow Root提取评论数据
     * @param {ShadowRoot} shadowRoot - Shadow Root
     * @param {string} parentId - 父评论ID
     * @returns {Object|null} - 评论对象
     */
    extractFromShadowRoot(shadowRoot, parentId) {
        try {
            // 从shadowRoot获取内容
            const main = shadowRoot.querySelector('#body #main') || 
                         shadowRoot.querySelector('#main') ||
                         shadowRoot.querySelector('[id*="main"]');
            
            if (!main) {
                console.log('[Bili] 未找到评论主体');
                return null;
            }

            return this.extractCommentData(main, parentId);
        } catch (error) {
            console.warn('[Bili] 从shadowRoot提取失败:', error);
            return null;
        }
    }

    /**
     * 从普通元素提取评论数据
     * @param {Element} element - 元素
     * @param {string} parentId - 父评论ID
     * @returns {Object|null} - 评论对象
     */
    extractFromElement(element, parentId) {
        try {
            // 尝试直接从元素提取
            return this.extractCommentData(element, parentId);
        } catch (error) {
            console.warn('[Bili] 从element提取失败:', error);
            return null;
        }
    }

    /**
     * 提取评论数据的通用方法
     * @param {Element} container - 包含评论数据的容器元素
     * @param {string} parentId - 父评论ID
     * @returns {Object|null} - 评论对象
     */
    extractCommentData(container, parentId) {
        try {
            // 提取作者信息
            let author = '匿名用户';
            const userInfoSelectors = [
                'bili-comment-user-info',
                '[class*="user-info"]',
                '[class*="user-name"]'
            ];
            
            for (const selector of userInfoSelectors) {
                const userInfo = container.querySelector(selector);
                if (userInfo) {
                    if (userInfo.shadowRoot) {
                        const nameA = userInfo.shadowRoot.querySelector('#user-name a') ||
                                     userInfo.shadowRoot.querySelector('a') ||
                                     userInfo.shadowRoot.querySelector('[class*="name"]');
                        if (nameA && nameA.textContent) {
                            author = nameA.textContent.trim();
                            break;
                        }
                    } else {
                        // 直接从元素提取
                        const nameEl = userInfo.querySelector('a') || userInfo;
                        if (nameEl && nameEl.textContent) {
                            author = nameEl.textContent.trim();
                            break;
                        }
                    }
                }
            }

            // 提取评论内容
            let content = '';
            const richTextSelectors = [
                'bili-rich-text',
                '[class*="rich-text"]',
                '[class*="comment-text"]',
                '[class*="text-con"]'
            ];
            
            for (const selector of richTextSelectors) {
                const richText = container.querySelector(selector);
                if (richText) {
                    if (richText.shadowRoot) {
                        const contents = richText.shadowRoot.querySelector('#contents') ||
                                        richText.shadowRoot.querySelector('[id*="content"]');
                        if (contents) {
                            const spans = contents.querySelectorAll('span');
                            if (spans.length > 0) {
                                content = Array.from(spans).map(s => s.textContent.trim()).join(' ');
                            } else {
                                content = (contents.textContent || '').trim();
                            }
                            break;
                        }
                    } else {
                        // 直接从元素提取
                        content = (richText.textContent || '').trim();
                        break;
                    }
                }
            }

            if (!content || content.length < 1) {
                console.log('[Bili] 评论内容为空');
                return null;
            }

            // 提取时间和点赞信息
            let timeText = '';
            let likesText = '';
            
            const actionSelectors = [
                'bili-comment-action-buttons-renderer',
                '[class*="action"]',
                '[class*="toolbar"]'
            ];
            
            for (const selector of actionSelectors) {
                const actionButtons = container.querySelector(selector);
                if (actionButtons) {
                    if (actionButtons.shadowRoot) {
                        const pubdate = actionButtons.shadowRoot.querySelector('#pubdate') ||
                                       actionButtons.shadowRoot.querySelector('[class*="time"]');
                        if (pubdate) {
                            timeText = pubdate.textContent.trim();
                        }
                        
                        const likeCount = actionButtons.shadowRoot.querySelector('#like #count') ||
                                         actionButtons.shadowRoot.querySelector('[class*="like"] [class*="count"]');
                        if (likeCount) {
                            likesText = likeCount.textContent.trim();
                        }
                        break;
                    } else {
                        // 直接从元素提取
                        const pubdate = actionButtons.querySelector('[class*="time"]');
                        if (pubdate) {
                            timeText = pubdate.textContent.trim();
                        }
                        
                        const likeCount = actionButtons.querySelector('[class*="like"]');
                        if (likeCount) {
                            likesText = likeCount.textContent.trim();
                        }
                        break;
                    }
                }
            }

            const timestamp = CommonUtils.parseTime(timeText);
            const likes = CommonUtils.parseNumber(likesText);
            const id = this.generateCommentId(author, content, timestamp);

            console.log(`[Bili] 成功提取评论: author=${author}, content=${content.substring(0, 30)}...`);

            return {
                id,
                parentId: parentId,
                author: this.sanitizeText(author),
                text: this.sanitizeText(content),
                timestamp,
                likes,
                platform: 'bilibili',
                url: window.location.href
            };

        } catch (error) {
            console.warn('[Bili] 提取评论数据失败:', error);
            return null;
        }
    }

    /**
     * 获取预期回复数量（从UI标签解析）
     * @param {Element} threadRoot - 评论线程根元素
     * @returns {number|null} - 预期回复数，无法获取时返回null
     */
    getExpectedReplyCount(threadRoot) {
        try {
            // 先获取threadRoot的shadowRoot
            if (!threadRoot.shadowRoot) return null;
            const threadShadow = threadRoot.shadowRoot;
            
            // 在shadowRoot中查找replies容器
            const repliesDiv = threadShadow.querySelector('#replies') || 
                              threadShadow.querySelector('[id*="repli"]');
            if (!repliesDiv) return null;
            
            const repComp = repliesDiv.querySelector('bili-comment-replies-renderer');
            if (!repComp || !repComp.shadowRoot) return null;
            
            const repRoot = repComp.shadowRoot;
            const vm = repRoot.querySelector('#view-more');
            if (!vm) return null;
            
            const label = vm.textContent || '';
            const match = label.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * 获取当前已加载的回复数量
     * @param {Element} threadRoot - 评论线程根元素
     * @returns {number} - 已加载回复数
     */
    getLoadedReplyCount(threadRoot) {
        try {
            // 先获取threadRoot的shadowRoot
            if (!threadRoot.shadowRoot) return 0;
            const threadShadow = threadRoot.shadowRoot;
            
            // 在shadowRoot中查找replies容器
            const repliesDiv = threadShadow.querySelector('#replies') || 
                              threadShadow.querySelector('[id*="repli"]');
            if (!repliesDiv) return 0;
            
            const repComp = repliesDiv.querySelector('bili-comment-replies-renderer');
            if (!repComp || !repComp.shadowRoot) return 0;
            
            const replies = repComp.shadowRoot.querySelectorAll('bili-comment-reply-renderer');
            return replies.length;
        } catch (e) {
            return 0;
        }
    }

    /**
     * 查找"查看更多回复"按钮
     * @param {Element} threadRoot - 评论线程根元素
     * @returns {Element[]} - 可点击的按钮元素数组
     */
    findViewMoreButtons(threadRoot) {
        const targets = new Set();
        try {
            // 先获取threadRoot的shadowRoot
            if (!threadRoot.shadowRoot) return [];
            const threadShadow = threadRoot.shadowRoot;
            
            // 在shadowRoot中查找replies容器
            const repliesDiv = threadShadow.querySelector('#replies') || 
                              threadShadow.querySelector('[id*="repli"]');
            if (!repliesDiv) return [];
            
            const repComp = repliesDiv.querySelector('bili-comment-replies-renderer');
            if (!repComp || !repComp.shadowRoot) return [];
            
            const repRoot = repComp.shadowRoot;
            const vm = repRoot.querySelector('#view-more');
            if (!vm) return [];
            
            // 优先查找 bili-text-button 内部按钮
            const host = vm.querySelector('bili-text-button');
            if (host && host.shadowRoot) {
                const inner = host.shadowRoot.querySelector('button');
                if (inner) targets.add(inner);
            }
            
            // 兜底：查找普通 button
            vm.querySelectorAll('button').forEach(b => targets.add(b));
        } catch (e) {
            console.warn('[Bili] 查找查看更多按钮失败:', e);
        }
        return Array.from(targets);
    }

    /**
     * 强制点击元素（尝试多种事件触发方式）
     * @param {Element} element - 要点击的元素
     */
    robustClickElement(element) {
        try { element.scrollIntoView({ block: 'center' }); } catch {}
        try { element.click(); } catch {}
        try { element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true })); } catch {}
        try { element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); } catch {}
        try { element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true })); } catch {}
        try { element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true })); } catch {}
        try { element.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true })); } catch {}
    }

    /**
     * 等待回复数量增加
     * @param {Element} threadRoot - 评论线程根元素
     * @param {number} previousCount - 之前的回复数
     * @param {number} maxWaitTime - 最大等待时间（毫秒）
     * @returns {Promise<number>} - 新的回复数
     */
    async waitForReplyIncrease(threadRoot, previousCount, maxWaitTime = 4500) {
        const start = Date.now();
        while (Date.now() - start < maxWaitTime) {
            const currentCount = this.getLoadedReplyCount(threadRoot);
            if (currentCount > previousCount) {
                return currentCount;
            }
            await this.delay(200);
        }
        return this.getLoadedReplyCount(threadRoot);
    }

    /**
     * 展开评论的所有回复（重构后的主方法，使用自适应延迟）
     * @param {Element} threadRoot - 评论线程根元素
     * @returns {Promise<boolean>} - 是否成功展开了新回复
     */
    async expandAllRepliesForThread(threadRoot) {
        try {
            const expectedCount = this.getExpectedReplyCount(threadRoot);
            const loadedBefore = this.getLoadedReplyCount(threadRoot);
            
            console.log(`[Bili] 开始展开回复：预期=${expectedCount ?? '未知'}，当前已渲染=${loadedBefore}`);
            
            if (loadedBefore === 0) {
                console.log('[Bili] 没有回复可展开');
                return false;
            }

            // 重置自适应延迟策略
            this.resetAdaptiveDelay();
            
            let totalClicks = 0;
            let attempt = 0;
            let currentCount = loadedBefore;

            // 循环点击"查看更多"按钮直到没有更多按钮
            while (true) {
                const buttons = this.findViewMoreButtons(threadRoot);
                if (!buttons.length) {
                    console.log('[Bili] 没有更多"查看更多"按钮');
                    break;
                }
                
                const button = buttons[0];
                const buttonLabel = (button.textContent || '').trim();
                const beforeClick = currentCount;
                
                console.log(`[Bili] 展开回复(尝试${attempt + 1})：点击 "${buttonLabel}"，当前延迟=${this.adaptiveDelay.currentDelay}ms`);
                this.robustClickElement(button);
                
                const afterClick = await this.waitForReplyIncrease(threadRoot, beforeClick, 4500);
                
                if (afterClick > beforeClick) {
                    // 成功加载新回复
                    totalClicks++;
                    currentCount = afterClick;
                    const delay = this.getAdaptiveDelay(true);
                    console.log(`[Bili] 成功加载新回复：${afterClick - beforeClick}条，当前总数：${currentCount}，下次延迟：${delay}ms`);
                } else {
                    // 未检测到新回复，增加延迟
                    const delay = this.getAdaptiveDelay(false);
                    console.log(`[Bili] 未检测到新回复，增加延迟到 ${delay}ms`);
                    // 添加随机抖动避免被检测
                    await this.delay(delay + Math.floor(Math.random() * 600));
                }

                // 如果已达到预期数量则提前结束
                if (expectedCount && currentCount >= expectedCount) {
                    console.log(`[Bili] 已达到预期回复数量：${expectedCount}`);
                    break;
                }
                
                attempt++;
                
                // 防止无限循环
                if (attempt > 50) {
                    console.log('[Bili] 达到最大尝试次数，停止展开');
                    break;
                }
            }

            const loadedAfter = this.getLoadedReplyCount(threadRoot);
            const newReplies = loadedAfter - loadedBefore;
            
            console.log(`[Bili] 回复展开完成：预期=${expectedCount ?? '未知'}，新增=${newReplies}，当前已渲染=${loadedAfter}，点击次数=${totalClicks}`);

            return newReplies > 0;
        } catch (e) {
            console.warn('[Bili] 展开回复失败:', e);
            return false;
        }
    }

    extractRepliesFromThread(threadRoot, parentId, maxCount = Infinity) {
        const results = [];
        try {
            // 先获取threadRoot的shadowRoot
            if (!threadRoot.shadowRoot) {
                console.log('[Bili] threadRoot没有shadowRoot，无法提取回复');
                return results;
            }
            const threadShadow = threadRoot.shadowRoot;
            
            // 在shadowRoot中查找replies容器
            const repliesDiv = threadShadow.querySelector('#replies') || 
                              threadShadow.querySelector('[id*="repli"]');
            if (!repliesDiv) {
                console.log('[Bili] 未找到replies容器');
                return results;
            }
            
            const repliesComponent = repliesDiv.querySelector('bili-comment-replies-renderer');
            if (!repliesComponent || !repliesComponent.shadowRoot) {
                console.log('[Bili] 未找到bili-comment-replies-renderer或其shadowRoot');
                return results;
            }
            
            const repliesRoot = repliesComponent.shadowRoot;

            // 每条回复
            const replyItems = repliesRoot.querySelectorAll('bili-comment-reply-renderer');
            console.log(`[Bili] 解析到回复条目: ${replyItems.length}，最多提取: ${maxCount}`);
            
            for (let i = 0; i < replyItems.length && results.length < maxCount; i++) {
                const reply = replyItems[i];
                const replyRoot = reply.shadowRoot;
                
                if (!replyRoot) {
                    console.log(`[Bili] 回复${i}没有shadowRoot`);
                    continue;
                }
                
                const main = replyRoot.querySelector('#body #main') || 
                            replyRoot.querySelector('#main') ||
                            replyRoot.querySelector('#body');
                            
                if (!main) {
                    console.log(`[Bili] 回复${i}未找到main容器`);
                    continue;
                }

                // 使用通用的extractCommentData方法提取回复数据
                const replyData = this.extractCommentData(main, parentId);
                if (replyData) {
                    results.push(replyData);
                }
            }
            
            console.log(`[Bili] 已组装回复: ${results.length}`);
        } catch (e) {
            console.warn('[Bili] 提取回复失败:', e);
        }
        return results;
    }

    async fallbackExtractComments() {
        console.log('使用fallback方法提取Bilibili评论（限制50条）');
        const comments = [];
        const maxComments = 50;

        try {
            // 尝试从DOM提取评论（不依赖Shadow DOM）
            const commentItems = document.querySelectorAll('.reply-item, .comment-item, [class*="comment"]');
            
            for (const item of commentItems) {
                if (comments.length >= maxComments) break;

                const author = item.querySelector('.user-name, [class*="user-name"]')?.textContent?.trim() || '匿名用户';
                const content = item.querySelector('.text-con, [class*="text-con"]')?.textContent?.trim() || '';
                const timeText = item.querySelector('.time, [class*="time"]')?.textContent?.trim() || '';
                const likesText = item.querySelector('.like, [class*="like"]')?.textContent?.trim() || '0';

                if (content && content.length > 0) {
                    const timestamp = CommonUtils.parseTime(timeText);
                    const likes = CommonUtils.parseNumber(likesText);
                    const id = this.generateCommentId(author, content, timestamp);

                    comments.push({
                        id,
                        parentId: "0",
                        author: this.sanitizeText(author),
                        text: this.sanitizeText(content),
                        timestamp,
                        likes,
                        platform: 'bilibili',
                        url: window.location.href
                    });
                }
            }
        } catch (error) {
            console.error('fallback提取失败:', error);
        }

        console.log(`fallback方法提取了 ${comments.length} 条评论`);
        return comments;
    }
}
