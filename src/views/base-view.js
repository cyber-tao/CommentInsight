/**
 * 基础视图类 - 所有视图的公共功能
 */

class BaseView {
    constructor(viewer) {
        this.viewer = viewer;
    }

    /**
     * 渲染视图（子类必须实现）
     */
    render() {
        throw new Error('子类必须实现render方法');
    }

    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示
     */
    showLoading(show) {
        this.viewer.showLoading(show);
    }

    /**
     * 显示通知
     * @param {string} message - 消息
     * @param {string} type - 类型
     */
    showNotification(message, type) {
        this.viewer.showNotification(message, type);
    }

    /**
     * 发送消息到后台
     * @param {Object} message - 消息对象
     * @returns {Promise<Object>}
     */
    async sendMessage(message) {
        return this.viewer.sendMessage(message);
    }

    /**
     * HTML转义
     * @param {string} str - 字符串
     * @returns {string}
     */
    escapeHtml(str) {
        return CommonUtils.escapeHtml(str);
    }

    /**
     * 正则转义
     * @param {string} str - 字符串
     * @returns {string}
     */
    escapeRegExp(str) {
        return CommonUtils.escapeRegExp(str);
    }

    mapError(resp) {
        const code = resp?.errorCode;
        if (!code) return resp?.error || '操作失败';
        const map = {
            UNKNOWN_ACTION: '未知的操作类型',
            HANDLE_MESSAGE_ERROR: '处理消息时发生错误',
            PLATFORM_MISMATCH: '当前页面不匹配目标平台',
            BILIBILI_EXTRACT_ERROR: 'B站评论提取失败',
            GET_PLATFORM_INFO_ERROR: '获取页面信息失败',
            AI_REQUEST_FAILED: 'AI 请求失败',
            NO_ACTIVE_TAB: '当前没有活动标签页',
            RUNTIME_ERROR: '浏览器运行时错误',
            NO_RESPONSE: '页面未响应'
        };
        return map[code] || (resp?.error || '操作失败');
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.BaseView = BaseView;
}
