/**
 * 查看器主入口 - 统一管理所有视图
 */

class CommentInsightViewer {
    constructor() {
        this.currentView = 'comments';
        this.currentData = null;
        this.confirmCallback = null;
        
        // 初始化视图
        this.views = {
            comments: new CommentsView(this),
            analysis: new AnalysisView(this),
            history: new HistoryView(this)
        };
        
        this.initializeViewer();
    }

    async initializeViewer() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const viewType = urlParams.get('type') || 'comments';
            const dataKey = urlParams.get('key');

            this.currentView = viewType;

            this.initializeEventListeners();
            try {
                chrome.runtime.sendMessage({ action: 'getConfig' }, (resp) => {
                    if (resp && resp.success && resp.data) {
                        const logging = resp.data.logging || { enabled: true, level: 'info' };
                        Logger.enable(logging.enabled !== false);
                        Logger.setLevel(logging.level || 'info');
                    }
                });
            } catch (_) {}
            await this.loadData(dataKey);
            this.switchView(viewType);

        } catch (error) {
            Logger.error('viewer', 'Init viewer failed', error);
            this.showNotification('初始化失败: ' + error.message, 'error');
        }
    }

    initializeEventListeners() {
        document.getElementById('nav-comments').addEventListener('click', () => {
            this.switchView('comments');
        });

        document.getElementById('nav-analysis').addEventListener('click', () => {
            this.switchView('analysis');
        });

        document.getElementById('nav-history').addEventListener('click', () => {
            this.switchView('history');
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            window.close();
        });

        document.getElementById('export-current').addEventListener('click', () => {
            this.exportCurrentView();
        });

        document.getElementById('confirm-cancel').addEventListener('click', () => {
            this.hideConfirmDialog();
        });

        document.getElementById('confirm-ok').addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback();
            }
            this.hideConfirmDialog();
        });

        // 初始化各视图的事件监听
        this.views.comments.initializeEvents();
        this.views.history.initializeEvents();
    }

    async loadData(dataKey) {
        try {
            this.showLoading(true);

            if (this.currentView === 'history') {
                const response = await this.sendMessage({
                    action: 'loadData',
                    key: 'analysis_history'
                });

                this.currentData = { 
                    history: response.success ? (response.data || []) : [] 
                };
            } else if (dataKey) {
                Logger.debug('viewer', 'Load data', { dataKey });
                const response = await this.sendMessage({
                    action: 'loadData',
                    key: `comments_${dataKey}`
                });

                Logger.debug('viewer', 'Load response', { success: response.success });
                
                if (response.success && response.data) {
                    this.currentData = response.data;
                    Logger.info('viewer', 'Set currentData', { count: this.currentData.comments?.length || 0 });
                    this.views.comments.setComments(this.currentData.comments || []);
                    this.updateVideoTitle();
                } else {
                    Logger.warn('viewer', 'Load data failed or empty');
                    this.currentData = { comments: [], analysis: null };
                }
            }

        } catch (error) {
            Logger.error('viewer', 'Load data failed', error);
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

        document.getElementById(`nav-${viewType}`).className = 
            'nav-btn px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700';

        // 隐藏所有视图
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.add('hidden');
        });

        // 显示当前视图
        document.getElementById(`${viewType}-view`).classList.remove('hidden');

        this.currentView = viewType;

        // 特殊处理历史视图
        if (viewType === 'history') {
            this.loadHistoryData();
        } else {
            // 渲染其他视图
            this.views[viewType].render();
        }

        this.updateDataInfo();
    }

    async loadHistoryData() {
        try {
            this.showLoading(true);
            
            const response = await this.sendMessage({
                action: 'loadData',
                key: 'analysis_history'
            });

            if (!this.currentData) {
                this.currentData = {};
            }
            this.currentData.history = response.success ? (response.data || []) : [];
            
            this.views.history.render();
        } catch (error) {
            Logger.error('viewer', 'Load history failed', error);
            this.showNotification('加载历史数据失败: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateDataInfo() {
        const totalCountElement = document.getElementById('total-count');
        
        switch (this.currentView) {
            case 'comments':
                totalCountElement.textContent = this.views.comments.filteredComments.length;
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
                    await this.views.comments.exportComments();
                    break;
                case 'analysis':
                    await this.views.analysis.exportAnalysis();
                    break;
                case 'history':
                    await this.views.history.exportHistory();
                    break;
            }

        } catch (error) {
            Logger.error('viewer', 'Export failed', error);
            this.showNotification('导出失败: ' + error.message, 'error');
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

        notificationMessage.textContent = message;

        notification.className = 'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out';
        notification.classList.remove('translate-x-full', 'opacity-0');

        const iconHTML = {
            success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>',
            error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>',
            warning: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>',
            info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>'
        };

        const colors = {
            success: 'bg-green-100 border border-green-400 text-green-700',
            error: 'bg-red-100 border border-red-400 text-red-700',
            warning: 'bg-yellow-100 border border-yellow-400 text-yellow-700',
            info: 'bg-blue-100 border border-blue-400 text-blue-700'
        };

        notification.className += ` ${colors[type] || colors.info}`;
        notificationIcon.innerHTML = iconHTML[type] || iconHTML.info;

        notification.classList.remove('translate-x-full', 'opacity-0');

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
}

// 创建全局实例
window.viewer = new CommentInsightViewer();
Logger.info('viewer', 'CommentInsight Viewer initialized');

