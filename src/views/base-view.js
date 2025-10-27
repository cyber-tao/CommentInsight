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
}

// 导出
if (typeof window !== 'undefined') {
    window.BaseView = BaseView;
}

