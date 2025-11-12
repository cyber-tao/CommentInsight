/**
 * 历史视图 - 处理历史记录展示和管理
 */

class HistoryView extends BaseView {
    /**
     * 初始化事件监听
     */
    initializeEvents() {
        document.getElementById('search-history').addEventListener('input', () => {
            this.render();
        });

        document.getElementById('filter-platform').addEventListener('change', () => {
            this.render();
        });

        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });
    }

    /**
     * 渲染历史记录
     */
    async render() {
        const container = document.getElementById('history-container');
        
        if (!this.viewer.currentData || !this.viewer.currentData.history || this.viewer.currentData.history.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const searchTerm = document.getElementById('search-history').value.toLowerCase();
        const platformFilter = document.getElementById('filter-platform').value;

        let filteredHistory = this.viewer.currentData.history.filter(item => {
            const matchesSearch = !searchTerm || 
                item.title.toLowerCase().includes(searchTerm) ||
                item.platform.toLowerCase().includes(searchTerm);
            
            const matchesPlatform = !platformFilter || item.platform === platformFilter;
            
            return matchesSearch && matchesPlatform;
        });

        const fragment = document.createDocumentFragment();
        container.innerHTML = '';
        for (const item of filteredHistory) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = this.createHistoryCard(item);
            fragment.appendChild(wrapper.firstElementChild || wrapper);
        }
        container.appendChild(fragment);
        this.attachHistoryButtonEvents();
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
                    
                    Logger.info('history', 'Delete history item', { id: itemId });
                    
                    // 使用存储键删除对应数据
                    const targetKey = itemToDelete?.storageKey || itemToDelete?.dataKey;

                    if (targetKey) {
                        const keyName = `comments_${targetKey}`;
                        Logger.debug('history', 'Remove storage key', { keyName });
                        await chrome.storage.local.remove([keyName]);
                    } else {
                        Logger.warn('history', 'History item missing storage key');
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
                    Logger.error('history', 'Delete history failed', error);
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

                    Logger.info('history', 'Clear history keys', { keys: storageKeys.length });
                    
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
                    Logger.error('history', 'Clear history failed', error);
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
            throw new Error(this.mapError(response));
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.HistoryView = HistoryView;
}

