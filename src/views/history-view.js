/**
 * 历史视图 - 处理历史记录展示和管理
 */

class HistoryView extends BaseView {
    constructor(viewer) {
        super(viewer);
        // 分页配置
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 20,
            totalPages: 1,
            totalItems: 0
        };
        // 加载状态
        this.isLoading = false;
    }

    /**
     * 初始化事件监听
     */
    initializeEvents() {
        document.getElementById('search-history').addEventListener('input', () => {
            this.pagination.currentPage = 1;
            this.render();
        });

        document.getElementById('filter-platform').addEventListener('change', () => {
            this.pagination.currentPage = 1;
            this.render();
        });

        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });
    }

    /**
     * 渲染历史记录（支持分页）
     */
    async render() {
        const container = document.getElementById('history-container');
        
        if (!this.viewer.currentData || !this.viewer.currentData.history || this.viewer.currentData.history.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        if (this.isLoading) {
            return;
        }

        this.isLoading = true;

        try {
            const searchTerm = document.getElementById('search-history').value.toLowerCase();
            const platformFilter = document.getElementById('filter-platform').value;

            // 过滤历史记录
            let filteredHistory = this.viewer.currentData.history.filter(item => {
                const matchesSearch = !searchTerm || 
                    item.title.toLowerCase().includes(searchTerm) ||
                    item.platform.toLowerCase().includes(searchTerm);
                
                const matchesPlatform = !platformFilter || item.platform === platformFilter;
                
                return matchesSearch && matchesPlatform;
            });

            // 更新分页信息
            this.pagination.totalItems = filteredHistory.length;
            this.pagination.totalPages = Math.ceil(filteredHistory.length / this.pagination.itemsPerPage);
            
            // 确保当前页在有效范围内
            this.pagination.currentPage = Math.max(1, Math.min(this.pagination.currentPage, this.pagination.totalPages));

            // 计算当前页的数据范围
            const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
            const endIndex = startIndex + this.pagination.itemsPerPage;
            const pageData = filteredHistory.slice(startIndex, endIndex);

            // 渲染历史记录卡片
            container.innerHTML = pageData.map(item => this.createHistoryCard(item)).join('');
            
            // 渲染分页控件
            this.renderPagination();
            
            // 附加事件监听器
            this.attachHistoryButtonEvents();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 渲染分页控件
     */
    renderPagination() {
        const paginationContainer = document.getElementById('history-pagination');
        if (!paginationContainer) {
            // 如果分页容器不存在，创建一个
            const container = document.getElementById('history-container');
            const pagination = document.createElement('div');
            pagination.id = 'history-pagination';
            pagination.className = 'mt-6 flex items-center justify-between border-t border-gray-200 pt-6';
            container.parentElement.appendChild(pagination);
        }

        const { currentPage, totalPages, totalItems, itemsPerPage } = this.pagination;

        if (totalPages <= 1) {
            document.getElementById('history-pagination').innerHTML = '';
            return;
        }

        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        let paginationHTML = `
            <div class="flex-1 flex justify-between sm:hidden">
                <button
                    onclick="historyView.goToPage(${currentPage - 1})"
                    ${currentPage === 1 ? 'disabled' : ''}
                    class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    上一页
                </button>
                <button
                    onclick="historyView.goToPage(${currentPage + 1})"
                    ${currentPage === totalPages ? 'disabled' : ''}
                    class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    下一页
                </button>
            </div>
            <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700">
                        显示第 <span class="font-medium">${startItem}</span> 至 <span class="font-medium">${endItem}</span> 条，
                        共 <span class="font-medium">${totalItems}</span> 条记录
                    </p>
                </div>
                <div>
                    <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="分页">
        `;

        // 上一页按钮
        paginationHTML += `
            <button
                onclick="historyView.goToPage(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span class="sr-only">上一页</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
            </button>
        `;

        // 页码按钮
        const maxVisiblePages = 7;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += this.renderPageButton(1);
            if (startPage > 2) {
                paginationHTML += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += this.renderPageButton(i, i === currentPage);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
            }
            paginationHTML += this.renderPageButton(totalPages);
        }

        // 下一页按钮
        paginationHTML += `
            <button
                onclick="historyView.goToPage(${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span class="sr-only">下一页</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
            </button>
                    </nav>
                </div>
            </div>
        `;

        document.getElementById('history-pagination').innerHTML = paginationHTML;
    }

    /**
     * 渲染单个页码按钮
     * @param {number} pageNumber - 页码
     * @param {boolean} isActive - 是否为当前页
     * @returns {string}
     */
    renderPageButton(pageNumber, isActive = false) {
        const activeClass = isActive 
            ? 'z-10 bg-blue-600 border-blue-600 text-white' 
            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
        
        return `
            <button
                onclick="historyView.goToPage(${pageNumber})"
                class="relative inline-flex items-center px-4 py-2 border text-sm font-medium ${activeClass}"
            >
                ${pageNumber}
            </button>
        `;
    }

    /**
     * 跳转到指定页
     * @param {number} page - 页码
     */
    goToPage(page) {
        if (page < 1 || page > this.pagination.totalPages || page === this.pagination.currentPage) {
            return;
        }
        
        this.pagination.currentPage = page;
        this.render();
        
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * 渲染空状态
     * @returns {string}
     */
    renderEmptyState() {
        return `
            <div class="text-center py-12">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">暂无历史记录</h3>
                <p class="mt-1 text-sm text-gray-500">还没有分析历史记录</p>
            </div>
        `;
    }

    /**
     * 创建历史记录卡片
     * @param {Object} item - 历史记录项
     * @returns {string}
     */
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

    /**
     * 附加历史记录按钮事件
     */
    attachHistoryButtonEvents() {
        document.querySelectorAll('.view-history-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.openHistoryItem(itemId);
            });
        });

        document.querySelectorAll('.delete-history-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-item-id');
                this.deleteHistoryItem(itemId);
            });
        });
    }

    /**
     * 打开历史记录项
     * @param {string} itemId - 项ID
     */
    async openHistoryItem(itemId) {
        const item = this.viewer.currentData.history.find(h => h.id === itemId);
        if (item) {
            const key = item.storageKey || item.dataKey || itemId;
            const url = chrome.runtime.getURL(`viewer.html?type=comments&key=${key}`);
            window.open(url, '_blank');
        }
    }

    /**
     * 删除历史记录项
     * @param {string} itemId - 项ID
     */
    async deleteHistoryItem(itemId) {
        this.viewer.showConfirmDialog(
            '删除历史记录',
            '您确定要删除这条历史记录吗？这将同时删除相关的评论和分析数据。',
            async () => {
                try {
                    const itemToDelete = this.viewer.currentData.history.find(item => item.id === itemId);
                    
                    console.log('删除历史记录项:', itemToDelete);
                    
                    // 使用存储键删除对应数据
                    const targetKey = itemToDelete?.storageKey || itemToDelete?.dataKey;

                    if (targetKey) {
                        const keyName = `comments_${targetKey}`;
                        console.log('删除存储键:', keyName);
                        await chrome.storage.local.remove([keyName]);
                    } else {
                        console.warn('历史记录项缺少存储键:', itemToDelete);
                    }
                    
                    // 从历史记录数组中移除
                    this.viewer.currentData.history = this.viewer.currentData.history.filter(item => item.id !== itemId);
                    
                    // 保存更新后的历史记录
                    await this.sendMessage({
                        action: 'saveData',
                        data: { analysis_history: this.viewer.currentData.history }
                    });

                    this.render();
                    this.viewer.updateDataInfo();
                    
                    this.showNotification('历史记录及相关数据已删除', 'success');
                } catch (error) {
                    console.error('删除历史记录失败:', error);
                    this.showNotification('删除失败: ' + error.message, 'error');
                }
            }
        );
    }

    /**
     * 清空历史记录
     */
    async clearHistory() {
        this.viewer.showConfirmDialog(
            '清空所有历史记录',
            '您确定要清空所有历史记录吗？这将同时删除所有相关的评论和分析数据，此操作不可恢复！',
            async () => {
                try {
                    const history = this.viewer.currentData.history || [];
                    
                    // 删除所有相关的评论数据
                    const storageKeys = history
                        .map(item => item.storageKey || item.dataKey)
                        .filter(Boolean)
                        .map(key => `comments_${key}`);

                    console.log('清空历史记录，将删除的键:', storageKeys);
                    
                    if (storageKeys.length > 0) {
                        await chrome.storage.local.remove(storageKeys);
                    }
                    
                    // 清空历史记录数组
                    await this.sendMessage({
                        action: 'saveData',
                        data: { analysis_history: [] }
                    });

                    this.viewer.currentData.history = [];
                    this.render();
                    this.viewer.updateDataInfo();
                    
                    this.showNotification(`已清空 ${history.length} 条历史记录及相关数据`, 'success');
                } catch (error) {
                    console.error('清空历史记录失败:', error);
                    this.showNotification('清空失败: ' + error.message, 'error');
                }
            }
        );
    }

    /**
     * 显示确认对话框
     * @param {string} title - 标题
     * @param {string} message - 消息
     * @param {Function} callback - 回调函数
     */
    showConfirmDialog(title, message, callback) {
        this.viewer.showConfirmDialog(title, message, callback);
    }

    /**
     * 导出历史记录
     * @returns {Promise<void>}
     */
    async exportHistory() {
        if (!this.viewer.currentData || !this.viewer.currentData.history) {
            this.showNotification('没有可导出的历史数据', 'warning');
            return;
        }

        const filename = `历史记录-${new Date().toLocaleDateString('zh-CN').replace(/[^\d]/g, '-')}.json`;

        const response = await this.sendMessage({
            action: 'exportHistory',
            data: this.viewer.currentData.history,
            filename: filename
        });

        if (response.success) {
            this.showNotification('历史记录已导出', 'success');
        } else {
            throw new Error(response.error || '导出失败');
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.HistoryView = HistoryView;
}

