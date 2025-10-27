/**
 * 评论视图 - 处理评论展示和交互
 */

class CommentsView extends BaseView {
    constructor(viewer) {
        super(viewer);
        this.allComments = []; // 存储所有原始评论
        this.filteredComments = [];
        this.currentPage = 1;
        this.commentsPerPage = 25;
        this.totalPages = 1;
        this.searchTerm = '';
        this.sortBy = 'timestamp-desc';
    }

    /**
     * 初始化事件监听
     */
    initializeEvents() {
        document.getElementById('search-comments').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.filterAndSort();
        });

        document.getElementById('sort-comments').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndSort();
        });

        document.getElementById('comments-per-page').addEventListener('change', (e) => {
            this.commentsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.totalPages = Math.ceil(this.filteredComments.length / this.commentsPerPage);
            this.render();
        });
    }

    /**
     * 设置评论数据
     * @param {Array} comments - 评论数组（可能是嵌套结构或平级结构）
     */
    setComments(comments) {
        console.log('CommentsView.setComments 收到评论数量:', comments?.length || 0);
        
        // 检测数据结构类型
        const hasNestedReplies = comments && comments.length > 0 && 
                                 comments.some(c => c.replies && Array.isArray(c.replies) && c.replies.length > 0);
        
        if (hasNestedReplies) {
            console.log('🔄 检测到嵌套结构，正在展平...');
            // 将嵌套结构展平为平级结构，添加parentId字段
            this.allComments = this.flattenNestedComments(comments);
            console.log('✅ 展平后的评论数量:', this.allComments.length);
        } else {
            console.log('✅ 检测到平级结构，直接使用');
            this.allComments = comments || [];
        }
        
        this.filterAndSort();
    }
    
    /**
     * 将嵌套的评论结构展平为平级结构
     * @param {Array} comments - 嵌套的评论数组
     * @returns {Array} 平级的评论数组（带parentId字段）
     */
    flattenNestedComments(comments) {
        const flattened = [];
        
        comments.forEach(comment => {
            // 添加主评论（确保有parentId字段）
            const mainComment = { ...comment };
            if (!mainComment.parentId) {
                mainComment.parentId = "0";
            }
            // 移除replies和replyCount（这些是临时的）
            delete mainComment.replies;
            delete mainComment.replyCount;
            delete mainComment.isReply;
            
            flattened.push(mainComment);
            
            // 添加所有回复（设置parentId为主评论的id）
            if (comment.replies && Array.isArray(comment.replies)) {
                comment.replies.forEach(reply => {
                    const replyComment = { ...reply };
                    replyComment.parentId = comment.id; // 设置父评论ID
                    delete replyComment.isReply;
                    flattened.push(replyComment);
                });
            }
        });
        
        return flattened;
    }

    /**
     * 过滤和排序评论
     */
    filterAndSort() {
        const comments = this.allComments || [];
        
        console.log('CommentsView.filterAndSort 处理评论数量:', comments.length);
        
        // 调试：检查第一条评论的结构
        if (comments.length > 0) {
            console.log('第一条评论数据:', comments[0]);
            console.log('第一条评论的parentId:', comments[0].parentId);
            console.log('parentId类型:', typeof comments[0].parentId);
            console.log('parentId === "0":', comments[0].parentId === "0");
            
            // 统计所有parentId的值
            const parentIdCounts = {};
            comments.forEach(c => {
                const pid = c.parentId || 'undefined';
                parentIdCounts[pid] = (parentIdCounts[pid] || 0) + 1;
            });
            console.log('parentId值分布:', parentIdCounts);
        }
        
        // 步骤1: 根据parentId组织数据
        // 先分离主评论和回复（更宽容的判断）
        const mainComments = comments.filter(c => {
            // 处理多种可能的"主评论"标识
            return !c.parentId || c.parentId === "0" || c.parentId === 0 || c.parentId === "";
        });
        const replies = comments.filter(c => {
            // 有parentId且不是"0"或空的才是回复
            return c.parentId && c.parentId !== "0" && c.parentId !== 0 && c.parentId !== "";
        });
        
        console.log('主评论数量:', mainComments.length, '回复数量:', replies.length);
        
        // 为每个主评论添加其回复
        const organized = mainComments.map(mainComment => {
            const commentReplies = replies.filter(r => r.parentId === mainComment.id);
            return {
                ...mainComment,
                replies: commentReplies,
                replyCount: commentReplies.length
            };
        });
        
        // 步骤2: 搜索过滤
        let filtered = organized;
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = organized.filter(comment => {
                // 搜索主评论
                const mainMatch = comment.text.toLowerCase().includes(searchLower) ||
                                  comment.author.toLowerCase().includes(searchLower);
                
                // 搜索回复
                const replyMatch = comment.replies && comment.replies.length > 0 &&
                                   comment.replies.some(reply => 
                                       reply.text.toLowerCase().includes(searchLower) ||
                                       reply.author.toLowerCase().includes(searchLower)
                                   );
                
                return mainMatch || replyMatch;
            });
        }

        // 步骤3: 排序
        filtered.sort((a, b) => {
            switch (this.sortBy) {
                case 'timestamp-desc':
                    return new Date(b.timestamp) - new Date(a.timestamp);
                case 'timestamp-asc':
                    return new Date(a.timestamp) - new Date(b.timestamp);
                case 'likes-desc':
                    return (b.likes || 0) - (a.likes || 0);
                case 'likes-asc':
                    return (a.likes || 0) - (b.likes || 0);
                default:
                    return 0;
            }
        });

        this.filteredComments = filtered;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.filteredComments.length / this.commentsPerPage);
        this.render();
    }

    /**
     * 渲染评论列表
     */
    render() {
        const container = document.getElementById('comments-container');
        
        if (!this.filteredComments || this.filteredComments.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const startIndex = (this.currentPage - 1) * this.commentsPerPage;
        const endIndex = startIndex + this.commentsPerPage;
        const pageComments = this.filteredComments.slice(startIndex, endIndex);

        container.innerHTML = pageComments.map(comment => this.createCommentCard(comment)).join('');
        this.attachReplyToggleListeners();
        this.renderPagination();

        if (this.searchTerm) {
            this.highlightSearchTerm();
        }
    }

    /**
     * 渲染空状态
     * @returns {string}
     */
    renderEmptyState() {
        return `
            <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.724-.405l-5.055 1.259a1 1 0 01-1.274-1.274l1.259-5.055A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">暂无评论数据</h3>
                <p class="mt-1 text-sm text-gray-500">还没有提取到任何评论</p>
            </div>
        `;
    }

    /**
     * 创建评论卡片
     * @param {Object} comment - 评论对象
     * @returns {string}
     */
    createCommentCard(comment) {
        const timestamp = new Date(comment.timestamp).toLocaleString('zh-CN');
        const likes = comment.likes || 0;
        const replyCount = comment.replyCount || 0;
        const replies = comment.replies || [];
        const safeAuthor = this.escapeHtml(comment.author || '');
        const safeInitial = safeAuthor.charAt(0).toUpperCase();
        const safeText = this.escapeHtml(comment.text || '');
        const commentId = comment.id || Math.random().toString(36);

        const repliesHTML = replies.length > 0 ? `
            <div class="mt-4 border-t border-gray-200 pt-4">
                <button class="toggle-replies text-sm text-blue-600 hover:text-blue-800 flex items-center" data-comment-id="${commentId}">
                    <svg class="w-4 h-4 mr-1 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                    查看 ${replies.length} 条回复
                </button>
                <div class="replies-container hidden mt-3 space-y-3 pl-4 border-l-2 border-gray-200" data-comment-id="${commentId}">
                    ${replies.map(reply => this.createReplyCard(reply)).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="comment-card bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span class="text-sm font-medium text-gray-600">${safeInitial}</span>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-900">${safeAuthor}</p>
                            <span class="text-xs text-gray-500">${timestamp}</span>
                        </div>
                        <p class="mt-2 text-gray-700 whitespace-pre-wrap">${safeText}</p>
                        <div class="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                            ${likes > 0 ? `
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                    ${likes}
                                </span>
                            ` : ''}
                            ${replyCount > 0 && replies.length === 0 ? `
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.724-.405l-5.055 1.259a1 1 0 01-1.274-1.274l1.259-5.055A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                                    </svg>
                                    ${replyCount} 回复
                                </span>
                            ` : ''}
                        </div>
                        ${repliesHTML}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 创建回复卡片
     * @param {Object} reply - 回复对象
     * @returns {string}
     */
    createReplyCard(reply) {
        const timestamp = new Date(reply.timestamp).toLocaleString('zh-CN');
        const likes = reply.likes || 0;
        const safeAuthor = this.escapeHtml(reply.author || '');
        const safeInitial = safeAuthor.charAt(0).toUpperCase();
        const safeText = this.escapeHtml(reply.text || '');

        return `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span class="text-xs font-medium text-gray-600">${safeInitial}</span>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium text-gray-700">${safeAuthor}</p>
                        <span class="text-xs text-gray-400">${timestamp}</span>
                    </div>
                    <p class="mt-1 text-sm text-gray-600 whitespace-pre-wrap">${safeText}</p>
                    ${likes > 0 ? `
                        <div class="mt-2 flex items-center text-xs text-gray-500">
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            ${likes}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 附加回复切换监听器
     */
    attachReplyToggleListeners() {
        const toggleButtons = document.querySelectorAll('.toggle-replies');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const commentId = button.dataset.commentId;
                const repliesContainer = document.querySelector(`.replies-container[data-comment-id="${commentId}"]`);
                const svg = button.querySelector('svg');
                
                if (repliesContainer) {
                    repliesContainer.classList.toggle('hidden');
                    svg.classList.toggle('rotate-180');
                    
                    const isHidden = repliesContainer.classList.contains('hidden');
                    const replyCount = repliesContainer.querySelectorAll('.flex.items-start').length;
                    button.childNodes[1].textContent = isHidden ? ` 查看 ${replyCount} 条回复` : ` 隐藏回复`;
                }
            });
        });
    }

    /**
     * 渲染分页控件
     */
    renderPagination() {
        const container = document.getElementById('comments-pagination');
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="flex items-center space-x-2" id="pagination-buttons">';

        // 上一页
        const prevDisabled = this.currentPage === 1;
        html += `
            <button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${prevDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${prevDisabled ? 'disabled' : ''} data-page="${this.currentPage - 1}">
                上一页
            </button>
        `;

        // 页码
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            html += `<button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span class="px-2 text-gray-500">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            html += `
                <button class="pagination-btn px-3 py-2 text-sm rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                html += `<span class="px-2 text-gray-500">...</span>`;
            }
            html += `<button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }

        // 下一页
        const nextDisabled = this.currentPage === this.totalPages;
        html += `
            <button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${nextDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${nextDisabled ? 'disabled' : ''} data-page="${this.currentPage + 1}">
                下一页
            </button>
        `;

        html += '</div>';
        container.innerHTML = html;
        
        // 事件委托
        const paginationContainer = container.querySelector('#pagination-buttons');
        if (paginationContainer) {
            paginationContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('pagination-btn') && !e.target.disabled) {
                    const page = parseInt(e.target.dataset.page);
                    if (!isNaN(page)) {
                        this.goToPage(page);
                    }
                }
            });
        }
    }

    /**
     * 跳转到指定页
     * @param {number} page - 页码
     */
    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }
        
        this.currentPage = page;
        this.render();
        
        document.getElementById('comments-container').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 高亮搜索词
     */
    highlightSearchTerm() {
        if (!this.searchTerm) return;

        const container = document.getElementById('comments-container');
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        textNodes.forEach(textNode => {
            const content = textNode.textContent;
            const safeContent = this.escapeHtml(content);
            const regex = new RegExp(`(${this.escapeRegExp(this.searchTerm)})`, 'gi');
            if (regex.test(content)) {
                const highlightedContent = safeContent.replace(regex, '<span class="highlight">$1</span>');
                const wrapper = document.createElement('span');
                wrapper.innerHTML = highlightedContent;
                textNode.parentNode.replaceChild(wrapper, textNode);
            }
        });
    }

    /**
     * 将嵌套评论结构展平为平级结构
     * @param {Array} comments - 嵌套的评论数组
     * @returns {Array} 平级的评论数组
     */
    flattenCommentsForExport(comments) {
        // 将嵌套结构展平为平级结构，保留parentId
        const flatComments = [];
        
        comments.forEach(comment => {
            // 添加主评论（移除临时的replies和replyCount字段）
            const mainComment = { ...comment };
            delete mainComment.replies;
            delete mainComment.replyCount;
            flatComments.push(mainComment);
            
            // 添加所有回复（它们已经有正确的parentId）
            if (comment.replies && comment.replies.length > 0) {
                flatComments.push(...comment.replies);
            }
        });
        
        return flatComments;
    }

    /**
     * 导出评论
     * @returns {Promise<void>}
     */
    async exportComments() {
        // 将嵌套结构展平为平级结构，包含所有回复
        const flatComments = this.flattenCommentsForExport(this.filteredComments);
        
        console.log('导出评论数量:', flatComments.length);
        
        if (flatComments.length === 0) {
            this.showNotification('没有可导出的评论', 'warning');
            return;
        }
        
        const data = {
            comments: flatComments,
            platform: this.viewer.currentData?.platform || 'unknown',
            title: this.viewer.currentData?.title || '未知标题',
            timestamp: this.viewer.currentData?.timestamp || new Date().toISOString(),
            commentCount: flatComments.length
        };

        const filename = CommonUtils.generateFilename(
            data.platform,
            data.title,
            'csv'
        );

        const response = await this.sendMessage({
            action: 'exportComments',
            data: data,
            filename: filename
        });

        if (response.success) {
            this.showNotification('评论已导出（含回复）', 'success');
        } else {
            throw new Error(response.error || '导出失败');
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.CommentsView = CommentsView;
}

