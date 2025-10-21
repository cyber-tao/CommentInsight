// 查看器页面脚本 - 处理评论显示、分析结果显示和历史记录管理
class CommentInsightViewer {
    constructor() {
        this.currentView = 'comments';
        this.currentData = null;
        this.filteredComments = [];
        this.currentPage = 1;
        this.commentsPerPage = 25;
        this.totalPages = 1;
        this.searchTerm = '';
        this.sortBy = 'timestamp-desc';
        
        this.initializeViewer();
    }

    // 安全工具函数
    escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    escapeRegExp(s) {
        return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async initializeViewer() {
        try {
            // 获取URL参数
            const urlParams = new URLSearchParams(window.location.search);
            const viewType = urlParams.get('type') || 'comments';
            const dataKey = urlParams.get('key');

            this.currentView = viewType;

            // 初始化事件监听器
            this.initializeEventListeners();

            // 根据视图类型加载数据
            await this.loadData(dataKey);

            // 设置初始视图
            this.switchView(viewType);

        } catch (error) {
            console.error('初始化查看器失败:', error);
            this.showNotification('初始化失败: ' + error.message, 'error');
        }
    }

    initializeEventListeners() {
        // 导航按钮
        document.getElementById('nav-comments').addEventListener('click', () => {
            this.switchView('comments');
        });

        document.getElementById('nav-analysis').addEventListener('click', () => {
            this.switchView('analysis');
        });

        document.getElementById('nav-history').addEventListener('click', () => {
            this.switchView('history');
        });

        // 返回按钮
        document.getElementById('back-btn').addEventListener('click', () => {
            window.close();
        });

        // 导出按钮
        document.getElementById('export-current').addEventListener('click', () => {
            this.exportCurrentView();
        });

        // 评论搜索和排序
        document.getElementById('search-comments').addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.filterAndSortComments();
        });

        document.getElementById('sort-comments').addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndSortComments();
        });

        document.getElementById('comments-per-page').addEventListener('change', (e) => {
            this.commentsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            // 重新计算总页数
            this.totalPages = Math.ceil(this.filteredComments.length / this.commentsPerPage);
            this.renderComments();
        });

        // 历史记录搜索和过滤
        document.getElementById('search-history').addEventListener('input', () => {
            this.renderHistory();
        });

        document.getElementById('filter-platform').addEventListener('change', () => {
            this.renderHistory();
        });

        // 清空历史按钮
        document.getElementById('clear-history').addEventListener('click', () => {
            this.showConfirmDialog(
                '清空历史记录',
                '您确定要清空所有历史记录吗？此操作不可撤销。',
                () => this.clearHistory()
            );
        });

        // 确认对话框
        document.getElementById('confirm-cancel').addEventListener('click', () => {
            this.hideConfirmDialog();
        });

        document.getElementById('confirm-ok').addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback();
            }
            this.hideConfirmDialog();
        });
    }

    async loadData(dataKey) {
        try {
            this.showLoading(true);

            if (this.currentView === 'history') {
                // 加载历史记录
                const response = await this.sendMessage({
                    action: 'loadData',
                    key: 'analysis_history'
                });

                if (response.success) {
                    this.currentData = { history: response.data || [] };
                } else {
                    this.currentData = { history: [] };
                }
            } else if (dataKey) {
                // 加载特定页面的数据
                const response = await this.sendMessage({
                    action: 'loadData',
                    key: `comments_${dataKey}`
                });

                if (response.success && response.data) {
                    this.currentData = response.data;
                    this.filteredComments = [...(this.currentData.comments || [])];
                    this.filterAndSortComments();
                    
                    // 显示视频标题链接
                    this.updateVideoTitle();
                } else {
                    this.currentData = { comments: [], analysis: null };
                    this.filteredComments = [];
                }
            }

        } catch (error) {
            console.error('加载数据失败:', error);
            this.showNotification('加载数据失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateVideoTitle() {
        const titleSection = document.getElementById('video-title-section');
        const titleLink = document.getElementById('video-title-link');
        
        if (this.currentData && this.currentData.title && this.currentData.url) {
            titleLink.textContent = this.currentData.title;
            titleLink.href = this.currentData.url;
            titleSection.classList.remove('hidden');
        } else {
            titleSection.classList.add('hidden');
        }
    }

    switchView(viewType) {
        // 更新导航状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.className = 'nav-btn px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700';
        });

        document.getElementById(`nav-${viewType}`).className = 'nav-btn px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700';

        // 隐藏所有视图
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('hidden');
        });

        // 显示当前视图
        document.getElementById(`${viewType}-view`).classList.remove('hidden');

        this.currentView = viewType;

        // 特殊处理历史视图：动态加载历史数据
        if (viewType === 'history') {
            this.loadHistoryData();
        } else {
            // 渲染其他内容
            switch (viewType) {
                case 'comments':
                    this.renderComments();
                    break;
                case 'analysis':
                    this.renderAnalysis();
                    break;
            }
        }

        // 更新数据统计
        this.updateDataInfo();
    }

    // 单独加载历史数据的方法
    async loadHistoryData() {
        try {
            this.showLoading(true);
            
            const response = await this.sendMessage({
                action: 'loadData',
                key: 'analysis_history'
            });

            if (response.success) {
                // 保持原有数据，只更新历史部分
                if (!this.currentData) {
                    this.currentData = {};
                }
                this.currentData.history = response.data || [];
            } else {
                if (!this.currentData) {
                    this.currentData = {};
                }
                this.currentData.history = [];
            }
            
            this.renderHistory();
        } catch (error) {
            console.error('加载历史数据失败:', error);
            this.showNotification('加载历史数据失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    filterAndSortComments() {
        if (!this.currentData || !this.currentData.comments) {
            this.filteredComments = [];
            return;
        }

        let comments = [...this.currentData.comments];

        // 搜索过滤
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            comments = comments.filter(comment => 
                comment.text.toLowerCase().includes(searchLower) ||
                comment.author.toLowerCase().includes(searchLower)
            );
        }

        // 排序
        comments.sort((a, b) => {
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

        this.filteredComments = comments;
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.filteredComments.length / this.commentsPerPage);
        
        if (this.currentView === 'comments') {
            this.renderComments();
        }
    }

    renderComments() {
        const container = document.getElementById('comments-container');
        
        if (!this.filteredComments || this.filteredComments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.724-.405l-5.055 1.259a1 1 0 01-1.274-1.274l1.259-5.055A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">暂无评论数据</h3>
                    <p class="mt-1 text-sm text-gray-500">还没有提取到任何评论</p>
                </div>
            `;
            return;
        }

        // 计算分页
        const startIndex = (this.currentPage - 1) * this.commentsPerPage;
        const endIndex = startIndex + this.commentsPerPage;
        const pageComments = this.filteredComments.slice(startIndex, endIndex);

        // 渲染评论卡片
        container.innerHTML = pageComments.map(comment => this.createCommentCard(comment)).join('');

        // 添加回复折叠/展开事件
        this.attachReplyToggleListeners();

        // 渲染分页控件
        this.renderPagination();

        // 高亮搜索词
        if (this.searchTerm) {
            this.highlightSearchTerm();
        }
    }

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
                    
                    // 更新按钮文本
                    const isHidden = repliesContainer.classList.contains('hidden');
                    const replyCount = repliesContainer.querySelectorAll('.flex.items-start').length;
                    button.childNodes[1].textContent = isHidden ? ` 查看 ${replyCount} 条回复` : ` 隐藏回复`;
                }
            });
        });
    }

    createCommentCard(comment) {
        const timestamp = new Date(comment.timestamp).toLocaleString('zh-CN');
        const likes = comment.likes || 0;
        const replyCount = comment.replyCount || 0;
        const replies = comment.replies || [];
        const safeAuthor = this.escapeHtml(comment.author || '');
        const safeInitial = safeAuthor.charAt(0).toUpperCase();
        const safeText = this.escapeHtml(comment.text || '');
        const commentId = comment.id || Math.random().toString(36);

        // 生成回复HTML
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
                            <span class="text-sm font-medium text-gray-600">
                                ${safeInitial}
                            </span>
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
                                    ${replies} 回复
                                </span>
                            ` : ''}
                        </div>
                        ${repliesHTML}
                    </div>
                </div>
            </div>
        `;
    }

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

    renderPagination() {
        const container = document.getElementById('comments-pagination');
        
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '<div class="flex items-center space-x-2" id="pagination-buttons">';

        // 上一页按钮
        const prevDisabled = this.currentPage === 1;
        paginationHTML += `
            <button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${prevDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${prevDisabled ? 'disabled' : ''} data-page="${this.currentPage - 1}">
                上一页
            </button>
        `;

        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            paginationHTML += `
                <button class="pagination-btn px-3 py-2 text-sm rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }

        // 下一页按钮
        const nextDisabled = this.currentPage === this.totalPages;
        paginationHTML += `
            <button class="pagination-btn px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${nextDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${nextDisabled ? 'disabled' : ''} data-page="${this.currentPage + 1}">
                下一页
            </button>
        `;

        paginationHTML += '</div>';
        container.innerHTML = paginationHTML;
        
        // 使用事件委托处理分页按钮点击
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

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }
        
        this.currentPage = page;
        this.renderComments();
        
        // 滚动到顶部
        document.getElementById('comments-container').scrollIntoView({ behavior: 'smooth' });
    }

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

    renderAnalysis() {
        const contentElement = document.getElementById('analysis-content');
        const metadataElement = document.getElementById('analysis-metadata');

        if (!this.currentData || !this.currentData.analysis) {
            contentElement.innerHTML = '<p class="text-gray-500 text-center py-8">暂无分析数据</p>';
            metadataElement.classList.add('hidden');
            return;
        }

        const analysis = this.currentData.analysis;
        
        // 直接渲染分析结果，让markdownToHtml处理思考内容
        const analysisContent = this.markdownToHtml(analysis.rawAnalysis || '暂无分析结果');

        // 渲染分析内容
        contentElement.innerHTML = analysisContent;

        // 渲染元数据
        document.getElementById('analysis-timestamp').textContent = 
            new Date(analysis.timestamp).toLocaleString('zh-CN');
        document.getElementById('analysis-comment-count').textContent = 
            analysis.commentCount || 0;
        document.getElementById('analysis-model').textContent = 
            analysis.model || '未知';

        metadataElement.classList.remove('hidden');
    }

    markdownToHtml(markdown) {
        // 先转义以避免XSS，再进行有限Markdown转换
        let safe = this.escapeHtml(markdown || '');
        
        // 处理<br>标签 - 先替换为临时标记，避免被转义
        safe = safe.replace(/&lt;br&gt;/g, '<br>');
        safe = safe.replace(/&lt;br\/&gt;/g, '<br>');
        
        // 处理表格 - 查找以 | 开头的行并转换为表格
        // 使用更稳健的方法处理表格
        const lines = safe.split('\n');
        const processedLines = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            // 检查是否是表格开始 (以 | 开头和结尾，且包含至少3个 |)
            if (line.startsWith('|') && line.endsWith('|') && (line.match(/\|/g) || []).length >= 3) {
                const tableLines = [];
                
                // 收集连续的表格行
                while (i < lines.length) {
                    const currentLine = lines[i].trim();
                    if (currentLine.startsWith('|') && currentLine.endsWith('|') && (currentLine.match(/\|/g) || []).length >= 3) {
                        tableLines.push(currentLine);
                        i++;
                    } else {
                        // 检查是否是分隔行 (由 - 和 : 组成)
                        if (currentLine.startsWith('|') && currentLine.endsWith('|') && 
                            currentLine.substring(1, currentLine.length - 1).split('|').every(cell => 
                                cell.trim() === '' || /^[-: ]+$/.test(cell.trim()))) {
                            // 这是分隔行，跳过
                            i++;
                            continue;
                        }
                        break;
                    }
                }
                
                // 转换表格行
                if (tableLines.length >= 1) {
                    const tableHtml = this.convertMarkdownTableToHtml(tableLines);
                    processedLines.push(tableHtml);
                } else {
                    // 如果不是有效表格，按普通行处理
                    processedLines.push(lines[i]);
                    i++;
                }
            } else {
                // 普通行
                processedLines.push(lines[i]);
                i++;
            }
        }
        
        safe = processedLines.join('\n');
        
        // 处理<think>标签（AI思考内容）- 在查看页面显示为可折叠内容
        safe = safe.replace(/&lt;think&gt;/g, '<details class="mb-4 border border-gray-200 rounded-lg"><summary class="cursor-pointer p-3 bg-gray-50 font-medium">AI思考过程</summary><div class="p-3 border-t border-gray-200">');
        safe = safe.replace(/&lt;\/think&gt;/g, '</p></div></details>');
        
        // 处理details标签（用于折叠思考内容）
        safe = safe.replace(/<details>/g, '<details class="mb-4 border border-gray-200 rounded-lg">');
        safe = safe.replace(/<summary>(.*?)<\/summary>/g, '<summary class="cursor-pointer p-3 bg-gray-50 font-medium">$1</summary><div class="p-3 border-t border-gray-200">');
        safe = safe.replace(/<\/details>/g, '</div></details>');
        
        // 处理斜体（思考内容）
        safe = safe.replace(/\*(.*?)\*/g, '<em class="text-gray-600">$1</em>');
        
        // 处理粗体
        safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 处理标题
        safe = safe.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
        safe = safe.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
        safe = safe.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-10 mb-5">$1</h1>');
        
        // 处理列表
        safe = safe.replace(/^\* (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/^- (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/<li>/g, '<ul class="list-disc list-inside mb-2"><li>');
        safe = safe.replace(/<\/li>/g, '</li></ul>');
        safe = safe.replace(/<\/ul><ul class="list-disc list-inside mb-2">/g, '');
        
        // 处理分隔符
        safe = safe.replace(/^-{3,}$/gm, '<hr class="my-6 border-gray-300">');
        
        // 处理段落
        safe = safe.replace(/\n\n/g, '</p><p class="mb-4">');
        safe = safe.replace(/^(?!<[hlu])/gm, '<p class="mb-4">');
        safe = safe.replace(/(?<![hlu]>)$/gm, '</p>');
        
        return safe;
    }

    // 辅助函数：将Markdown表格转换为HTML表格
    convertMarkdownTableToHtml(tableLines) {
        if (tableLines.length < 2) return tableLines.join('\n');
        
        let tableHtml = '<table class="markdown-content">';
        let hasHeader = false;
        
        for (let i = 0; i < tableLines.length; i++) {
            const line = tableLines[i].trim();
            if (!line.startsWith('|') || !line.endsWith('|')) continue;
            
            // 分割单元格并去除首尾空格
            const cells = line.substring(1, line.length - 1).split('|').map(cell => cell.trim());
            
            // 跳过分隔行（通常是第二行，由 - 和 : 组成）
            if (i === 1 && cells.every(cell => /^[-: ]*$/.test(cell))) {
                continue;
            }
            
            // 第一行作为表头
            if (!hasHeader) {
                tableHtml += '<thead><tr>';
                cells.forEach(cell => {
                    tableHtml += `<th>${cell}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';
                hasHeader = true;
            } else {
                // 普通数据行
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${cell}</td>`;
                });
                tableHtml += '</tr>';
            }
        }
        
        tableHtml += hasHeader ? '</tbody></table>' : '</table>';
        return tableHtml;
    }

    async renderHistory() {
        const container = document.getElementById('history-container');
        
        if (!this.currentData || !this.currentData.history || this.currentData.history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">暂无历史记录</h3>
                    <p class="mt-1 text-sm text-gray-500">还没有分析历史记录</p>
                </div>
            `;
            return;
        }

        // 获取过滤条件
        const searchTerm = document.getElementById('search-history').value.toLowerCase();
        const platformFilter = document.getElementById('filter-platform').value;

        // 过滤历史记录
        let filteredHistory = this.currentData.history.filter(item => {
            const matchesSearch = !searchTerm || 
                item.title.toLowerCase().includes(searchTerm) ||
                item.platform.toLowerCase().includes(searchTerm);
            
            const matchesPlatform = !platformFilter || item.platform === platformFilter;
            
            return matchesSearch && matchesPlatform;
        });

        // 渲染历史记录卡片
        container.innerHTML = filteredHistory.map(item => this.createHistoryCard(item)).join('');
        
        // 添加事件监听器到新创建的按钮
        this.attachHistoryButtonEvents();
    }

    createHistoryCard(item) {
        const timestamp = new Date(item.timestamp).toLocaleString('zh-CN');
        const platformIcons = {
            youtube: '📺',
            tiktok: '🎵',
            instagram: '📷',
            facebook: '👥',
            twitter: '🐦',
            bilibili: '🌸'
        };
        const safeTitle = this.escapeHtml(item.title || '');

        return `
            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="text-lg">${platformIcons[item.platform] || '🌐'}</span>
                            <span class="text-sm font-medium text-gray-600 uppercase">${item.platform}</span>
                            ${item.hasAnalysis ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">已分析</span>' : ''}
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">${safeTitle}</h3>
                        <div class="flex items-center space-x-4 text-sm text-gray-500">
                            <span>📝 ${item.commentCount} 条评论</span>
                            <span>🕒 ${timestamp}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button class="text-blue-600 hover:text-blue-800 text-sm view-history-btn" data-item-id="${item.id}">
                            查看
                        </button>
                        <button class="text-red-600 hover:text-red-800 text-sm delete-history-btn" data-item-id="${item.id}">
                            删除
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async openHistoryItem(itemId) {
        // 根据历史记录ID打开相应的查看页面
        const item = this.currentData.history.find(h => h.id === itemId);
        if (item) {
            // 优先使用历史记录中存储的dataKey，如果没有则使用ID
            const key = item.dataKey || itemId;
            
            // 检查数据是否存在
            const dataResponse = await this.sendMessage({
                action: 'loadData',
                key: `comments_${key}`
            });
            
            if (dataResponse.success && dataResponse.data) {
                // 数据存在，打开查看页面
                const url = chrome.runtime.getURL(`viewer.html?type=comments&key=${key}`);
                window.open(url, '_blank');
            } else {
                // 数据不存在，显示错误信息
                this.showNotification('数据已不存在，可能已被清理', 'warning');
                
                // 提供选项删除这条历史记录
                this.showConfirmDialog(
                    '数据不存在',
                    '该历史记录对应的数据已不存在，是否删除这条历史记录？',
                    () => this.deleteHistoryItem(itemId)
                );
            }
        } else {
            this.showNotification('找不到指定的历史记录', 'error');
        }
    }

    async deleteHistoryItem(itemId) {
        this.showConfirmDialog(
            '删除历史记录',
            '您确定要删除这条历史记录吗？这将同时删除相关的评论和分析数据。',
            async () => {
                try {
                    // 找到要删除的项
                    const itemToDelete = this.currentData.history.find(item => item.id === itemId);
                    
                    if (itemToDelete && itemToDelete.pageKey) {
                        // 删除对应的评论和分析数据
                        await chrome.storage.local.remove([
                            `comments_${itemToDelete.pageKey}`,
                            `analysis_${itemToDelete.pageKey}`
                        ]);
                    }
                    
                    // 从历史记录中移除该项
                    this.currentData.history = this.currentData.history.filter(item => item.id !== itemId);
                    
                    // 保存更新后的历史记录
                    await this.sendMessage({
                        action: 'saveData',
                        data: { analysis_history: this.currentData.history }
                    });

                    // 重新渲染历史记录
                    this.renderHistory();
                    this.updateDataInfo();
                    
                    this.showNotification('历史记录及相关数据已删除', 'success');
                } catch (error) {
                    console.error('删除历史记录失败:', error);
                    this.showNotification('删除失败: ' + error.message, 'error');
                }
            }
        );
    }

    async clearHistory() {
        try {
            await this.sendMessage({
                action: 'saveData',
                data: { analysis_history: [] }
            });

            this.currentData.history = [];
            this.renderHistory();
            this.updateDataInfo();
            
            this.showNotification('历史记录已清空', 'success');
        } catch (error) {
            console.error('清空历史记录失败:', error);
            this.showNotification('清空失败: ' + error.message, 'error');
        }
    }

    updateDataInfo() {
        const totalCountElement = document.getElementById('total-count');
        
        switch (this.currentView) {
            case 'comments':
                totalCountElement.textContent = this.filteredComments.length;
                break;
            case 'analysis':
                totalCountElement.textContent = this.currentData && this.currentData.analysis ? 1 : 0;
                break;
            case 'history':
                totalCountElement.textContent = this.currentData && this.currentData.history ? this.currentData.history.length : 0;
                break;
        }
    }

    async exportCurrentView() {
        try {
            if (!this.currentData) {
                this.showNotification('没有可导出的数据', 'warning');
                return;
            }

            switch (this.currentView) {
                case 'comments':
                    await this.exportComments();
                    break;
                case 'analysis':
                    await this.exportAnalysis();
                    break;
                case 'history':
                    await this.exportHistory();
                    break;
            }

        } catch (error) {
            console.error('导出失败:', error);
            this.showNotification('导出失败: ' + error.message, 'error');
        }
    }

    // 生成符合新规范的文件名：{platform}-{title}-{date_time}
    generateFilename(platform, title, extension) {
        const now = new Date();
        const dateTime = now.toLocaleDateString('zh-CN').replace(/[^\d]/g, '-') + '_' + 
                        now.toLocaleTimeString('zh-CN', { hour12: false }).replace(/:/g, '-');
        
        // 清理标题，移除特殊字符并限制长度
        const cleanTitle = this.sanitizeTitle(title || '未知标题');
        
        // 中文平台名映射
        const platformMap = {
            'youtube': 'youtube',
            'tiktok': 'tiktok', 
            'instagram': 'instagram',
            'facebook': 'facebook',
            'twitter': 'twitter',
            'bilibili': 'bilibili'
        };
        
        const platformName = platformMap[platform] || platform;
        
        return `${platformName}-${cleanTitle}-${dateTime}.${extension}`;
    }

    // 清理标题中的特殊字符
    sanitizeTitle(title) {
        return title
            .replace(/[<>:"/\\|?*]/g, '_')  // 替换不允许的文件名字符
            .replace(/\s+/g, ' ')           // 合并多个空格
            .trim()                        // 去除首尾空格
            .substring(0, 50);             // 限制长度为50字符
    }

    async exportComments() {
        const data = {
            comments: this.filteredComments,
            platform: this.currentData.platform,
            title: this.currentData.title,
            timestamp: this.currentData.timestamp,
            commentCount: this.filteredComments.length  // 显式添加评论数量
        };

        const filename = this.generateFilename(
            this.currentData.platform,
            this.currentData.title,
            'csv'
        );

        const response = await this.sendMessage({
            action: 'exportComments',
            data: data,
            filename: filename
        });

        if (response.success) {
            this.showNotification('评论已导出', 'success');
        } else {
            throw new Error(response.error || '导出失败');
        }
    }

    async exportAnalysis() {
        if (!this.currentData || !this.currentData.analysis) {
            this.showNotification('没有可导出的分析数据', 'warning');
            return;
        }

        // 获取导出配置
        const configResponse = await this.sendMessage({
            action: 'getConfig'
        });
        
        const config = configResponse.success ? configResponse.data : {};
        const platformConfig = config.platforms || {};
        const exportConfig = platformConfig.export || {};

        const data = {
            analysis: this.currentData.analysis,
            platform: this.currentData.platform,
            title: this.currentData.title,
            timestamp: this.currentData.timestamp,
            // 根据配置决定是否包含评论详情和思考过程
            includeComments: exportConfig.includeComments === true, // 明确检查是否为true
            includeThinking: exportConfig.includeThinking === true, // 明确检查是否为true
            sortMethod: exportConfig.commentsSort || 'timestamp-desc', // 默认按时间倒序
            comments: this.currentData.comments || []
        };

        const filename = this.generateFilename(
            this.currentData.platform,
            this.currentData.title,
            'md'
        );

        const response = await this.sendMessage({
            action: 'exportAnalysis',
            data: data,
            filename: filename
        });

        if (response.success) {
            this.showNotification('分析结果已导出', 'success');
        } else {
            throw new Error(response.error || '导出失败');
        }
    }

    async exportHistory() {
        if (!this.currentData || !this.currentData.history) {
            this.showNotification('没有可导出的历史数据', 'warning');
            return;
        }

        const filename = `历史记录-${new Date().toLocaleDateString('zh-CN').replace(/[^\d]/g, '-')}.json`;

        const response = await this.sendMessage({
            action: 'exportHistory',
            data: this.currentData.history,
            filename: filename
        });

        if (response.success) {
            this.showNotification('历史记录已导出', 'success');
        } else {
            throw new Error(response.error || '导出失败');
        }
    }

    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    showLoading(show) {
        const loader = document.getElementById('loading-spinner');
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationMessage = document.getElementById('notification-message');
        const notificationIcon = document.getElementById('notification-icon');

        if (!notification || !notificationMessage || !notificationIcon) return;

        // 设置消息内容
        notificationMessage.textContent = message;

        // 设置图标和样式
        notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out';
        notification.classList.remove('translate-x-full', 'opacity-0');

        switch (type) {
            case 'success':
                notification.className += ' bg-green-100 border border-green-400 text-green-700';
                notificationIcon.innerHTML = `
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                `;
                break;
            case 'error':
                notification.className += ' bg-red-100 border border-red-400 text-red-700';
                notificationIcon.innerHTML = `
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                `;
                break;
            case 'warning':
                notification.className += ' bg-yellow-100 border border-yellow-400 text-yellow-700';
                notificationIcon.innerHTML = `
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                `;
                break;
            default:
                notification.className += ' bg-blue-100 border border-blue-400 text-blue-700';
                notificationIcon.innerHTML = `
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>
                `;
        }

        // 显示通知
        notification.classList.remove('translate-x-full', 'opacity-0');

        // 3秒后自动隐藏
        setTimeout(() => {
            notification.classList.add('translate-x-full', 'opacity-0');
        }, 3000);
    }

    showConfirmDialog(title, message, callback) {
        const dialog = document.getElementById('confirm-dialog');
        const dialogTitle = document.getElementById('confirm-title');
        const dialogMessage = document.getElementById('confirm-message');

        if (!dialog || !dialogTitle || !dialogMessage) return;

        dialogTitle.textContent = title;
        dialogMessage.textContent = message;

        this.confirmCallback = callback;

        dialog.classList.remove('hidden');
    }

    hideConfirmDialog() {
        const dialog = document.getElementById('confirm-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
        this.confirmCallback = null;
    }

    attachHistoryButtonEvents() {
        // 为查看按钮添加事件监听器
        document.querySelectorAll('.view-history-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.openHistoryItem(itemId);
            });
        });

        // 为删除按钮添加事件监听器
        document.querySelectorAll('.delete-history-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.deleteHistoryItem(itemId);
            });
        });
    }
}

// 创建全局实例
const viewer = new CommentInsightViewer();

// 将 goToPage 方法添加到全局作用域，以便在 HTML 中调用
window.viewer = viewer;
window.goToPage = function(page) {
    viewer.goToPage(page);
};
