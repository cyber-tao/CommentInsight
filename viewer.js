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

        // 渲染内容
        switch (viewType) {
            case 'comments':
                this.renderComments();
                break;
            case 'analysis':
                this.renderAnalysis();
                break;
            case 'history':
                this.renderHistory();
                break;
        }

        // 更新数据统计
        this.updateDataInfo();
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

        // 渲染分页控件
        this.renderPagination();

        // 高亮搜索词
        if (this.searchTerm) {
            this.highlightSearchTerm();
        }
    }

    createCommentCard(comment) {
        const timestamp = new Date(comment.timestamp).toLocaleString('zh-CN');
        const likes = comment.likes || 0;
        const replies = comment.replies || 0;

        return `
            <div class="comment-card bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div class="flex items-start space-x-4">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <span class="text-sm font-medium text-gray-600">
                                ${comment.author.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="text-sm font-medium text-gray-900">${comment.author}</p>
                            <span class="text-xs text-gray-500">${timestamp}</span>
                        </div>
                        <p class="mt-2 text-gray-700 whitespace-pre-wrap">${comment.text}</p>
                        <div class="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                            ${likes > 0 ? `
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                    ${likes}
                                </span>
                            ` : ''}
                            ${replies > 0 ? `
                                <span class="flex items-center">
                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-2.724-.405l-5.055 1.259a1 1 0 01-1.274-1.274l1.259-5.055A8.955 8.955 0 014 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                                    </svg>
                                    ${replies} 回复
                                </span>
                            ` : ''}
                        </div>
                    </div>
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

        let paginationHTML = '<div class="flex items-center space-x-2">';

        // 上一页按钮
        const prevDisabled = this.currentPage === 1;
        paginationHTML += `
            <button class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${prevDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${prevDisabled ? 'disabled' : ''} onclick="viewer.goToPage(${this.currentPage - 1})">
                上一页
            </button>
        `;

        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick="viewer.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage;
            paginationHTML += `
                <button class="px-3 py-2 text-sm rounded-md ${isActive ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}" 
                        onclick="viewer.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHTML += `<span class="px-2 text-gray-500">...</span>`;
            }
            paginationHTML += `<button class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick="viewer.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }

        // 下一页按钮
        const nextDisabled = this.currentPage === this.totalPages;
        paginationHTML += `
            <button class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 ${nextDisabled ? 'opacity-50 cursor-not-allowed' : ''}" 
                    ${nextDisabled ? 'disabled' : ''} onclick="viewer.goToPage(${this.currentPage + 1})">
                下一页
            </button>
        `;

        paginationHTML += '</div>';
        container.innerHTML = paginationHTML;
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
            const regex = new RegExp(`(${this.searchTerm})`, 'gi');
            if (regex.test(content)) {
                const highlightedContent = content.replace(regex, '<span class="highlight">$1</span>');
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

        // 渲染分析内容
        contentElement.innerHTML = this.markdownToHtml(analysis.rawAnalysis || '暂无分析结果');

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
        // 简单的Markdown到HTML转换
        return markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[hlu])/gm, '<p>')
            .replace(/(?<![hlu]>)$/gm, '</p>')
            .replace(/<li>/g, '<ul><li>')
            .replace(/<\/li>/g, '</li></ul>')
            .replace(/<\/ul><ul>/g, '');
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
            twitter: '🐦'
        };

        return `
            <div class="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="text-lg">${platformIcons[item.platform] || '🌐'}</span>
                            <span class="text-sm font-medium text-gray-600 uppercase">${item.platform}</span>
                            ${item.hasAnalysis ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">已分析</span>' : ''}
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">${item.title}</h3>
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
            // 使用历史记录中存储的dataKey，如果没有则生成一个
            const key = item.dataKey || itemId;
            const url = chrome.runtime.getURL(`viewer.html?type=comments&key=${key}`);
            window.open(url, '_blank');
        }
    }

    async deleteHistoryItem(itemId) {
        this.showConfirmDialog(
            '删除历史记录',
            '您确定要删除这条历史记录吗？',
            async () => {
                try {
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
                    
                    this.showNotification('历史记录已删除', 'success');
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

            const timestamp = new Date().toISOString().split('T')[0];
            
            switch (this.currentView) {
                case 'comments':
                    await this.exportComments(timestamp);
                    break;
                case 'analysis':
                    await this.exportAnalysis(timestamp);
                    break;
                case 'history':
                    await this.exportHistory(timestamp);
                    break;
            }

        } catch (error) {
            console.error('导出失败:', error);
            this.showNotification('导出失败: ' + error.message, 'error');
        }
    }

    async exportComments(timestamp) {
        const data = {
            comments: this.filteredComments,
            platform: this.currentData.platform,
            title: this.currentData.title,
            timestamp: this.currentData.timestamp
        };

        const response = await this.sendMessage({
            action: 'exportData',
            data: data,
            format: 'csv',
            filename: `comments_${timestamp}.csv`
        });

        if (response.success) {
            this.showNotification('评论数据已导出', 'success');
        } else {
            this.showNotification('导出失败: ' + (response.error || '未知错误'), 'error');
        }
    }

    async exportAnalysis(timestamp) {
        if (!this.currentData.analysis) {
            this.showNotification('没有分析数据可导出', 'warning');
            return;
        }

        const data = {
            analysis: this.currentData.analysis,
            platform: this.currentData.platform,
            title: this.currentData.title,
            timestamp: this.currentData.timestamp
        };

        const response = await this.sendMessage({
            action: 'exportData',
            data: data,
            format: 'markdown',
            filename: `analysis_${timestamp}.md`
        });

        if (response.success) {
            this.showNotification('分析报告已导出', 'success');
        } else {
            this.showNotification('导出失败: ' + (response.error || '未知错误'), 'error');
        }
    }

    async exportHistory(timestamp) {
        const data = {
            history: this.currentData.history,
            exportTimestamp: new Date().toISOString()
        };

        const response = await this.sendMessage({
            action: 'exportData',
            data: data,
            format: 'json',
            filename: `history_${timestamp}.json`
        });

        if (response.success) {
            this.showNotification('历史记录已导出', 'success');
        } else {
            this.showNotification('导出失败: ' + (response.error || '未知错误'), 'error');
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showConfirmDialog(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-dialog').classList.remove('hidden');
        this.confirmCallback = callback;
    }

    hideConfirmDialog() {
        document.getElementById('confirm-dialog').classList.add('hidden');
        this.confirmCallback = null;
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notification-text');
        
        notificationText.textContent = message;
        
        // 设置样式
        notification.className = `fixed top-4 right-4 p-3 rounded-lg shadow-lg transform transition-transform duration-300 z-40`;
        
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-500', 'text-white');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-500', 'text-white');
                break;
            case 'error':
                notification.classList.add('bg-red-500', 'text-white');
                break;
            default:
                notification.classList.add('bg-blue-500', 'text-white');
        }
        
        // 显示通知
        notification.style.transform = 'translateX(0)';
        
        // 3秒后隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.className = notification.className.replace(/bg-\w+-500/g, '');
            }, 300);
        }, 3000);
    }

    async sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response || { success: false, error: 'No response' });
            });
        });
    }

    // 为历史记录按钮添加事件监听器
    attachHistoryButtonEvents() {
        // 为"查看"按钮添加事件监听器
        document.querySelectorAll('.view-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.openHistoryItem(itemId);
            });
        });

        // 为"删除"按钮添加事件监听器
        document.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.deleteHistoryItem(itemId);
            });
        });
    }
}

// 全局变量，便于在HTML中调用方法
let viewer;

// 当DOM加载完成时初始化查看器
document.addEventListener('DOMContentLoaded', () => {
    viewer = new CommentInsightViewer();
}); 