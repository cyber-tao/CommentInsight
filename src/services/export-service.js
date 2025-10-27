/**
 * 导出服务 - 处理数据导出功能
 */

class ExportService {
    /**
     * 导出数据
     * @param {Object} data - 要导出的数据
     * @param {string} format - 导出格式
     * @param {string} filename - 文件名
     * @returns {Promise<void>}
     */
    static async exportData(data, format, filename) {
        try {
            let content;
            let mimeType;

            switch (format) {
                case 'csv':
                    content = this.convertToCSV(data);
                    mimeType = 'text/csv;charset=utf-8';
                    break;
                case 'markdown':
                    content = this.convertToMarkdown(data);
                    mimeType = 'text/markdown;charset=utf-8';
                    break;
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json;charset=utf-8';
                    break;
                default:
                    throw new Error('不支持的导出格式');
            }

            if (this.isServiceWorkerEnvironment()) {
                await this.downloadWithDataURL(content, mimeType, filename);
            } else {
                await this.downloadWithObjectURL(content, mimeType, filename);
            }

        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }

    /**
     * 转换为CSV格式
     * @param {Object} data - 数据对象
     * @returns {string}
     */
    static convertToCSV(data) {
        if (!data.comments || !Array.isArray(data.comments)) {
            throw new Error('无效的评论数据');
        }

        const headers = ['作者', '内容', '时间戳', '点赞数', '回复对象'];
        const csvContent = [
            headers.join(','),
            ...data.comments.map(comment => {
                // 使用parentId字段，"0"表示主评论，否则是回复的父评论ID
                const parentId = comment.parentId || "0";
                
                return [
                    this.safeCsvCell(comment.author || ''),
                    this.safeCsvCell(comment.text || ''),
                    this.safeCsvCell(comment.timestamp || ''),
                    comment.likes || 0,
                    this.safeCsvCell(parentId)
                ].join(',');
            })
        ].join('\n');

        return '\uFEFF' + csvContent; // UTF-8 BOM
    }

    /**
     * 转换为Markdown格式
     * @param {Object} data - 数据对象
     * @returns {string}
     */
    static convertToMarkdown(data) {
        let markdown = `# 评论分析报告\n\n`;
        markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        markdown += `**评论数量**: ${data.comments?.length || data.commentCount || 0}\n`;
        markdown += `**平台**: ${data.platform || '未知'}\n\n`;

        if (data.analysis) {
            markdown += `## AI分析结果\n\n`;

            // 处理思考内容
            if (data.includeThinking && data.analysis.thinkingProcess) {
                markdown += `<details>\n<summary>AI思考过程</summary>\n\n`;
                markdown += `${this.escapeMarkdownText(data.analysis.thinkingProcess)}\n\n`;
                markdown += `</details>\n\n`;
            }

            let analysisContent = data.analysis.rawAnalysis || '暂无分析结果';

            if (data.includeThinking) {
                analysisContent = analysisContent.replace(
                    /<think>(.*?)<\/think>/gs,
                    '<details>\n<summary>AI思考过程</summary>\n\n$1\n\n</details>'
                );
            } else {
                analysisContent = analysisContent.replace(/<think>.*?<\/think>/gs, '');
            }

            markdown += analysisContent;
            markdown += `\n\n`;
        }

        // 评论详情
        if (data.includeComments && data.comments && data.comments.length > 0) {
            let sortedComments = [...data.comments];
            switch (data.sortMethod) {
                case 'timestamp-asc':
                    sortedComments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    break;
                case 'likes-desc':
                    sortedComments.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                    break;
                case 'likes-asc':
                    sortedComments.sort((a, b) => (a.likes || 0) - (b.likes || 0));
                    break;
                case 'timestamp-desc':
                default:
                    sortedComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    break;
            }

            markdown += `## 评论详情\n\n`;
            sortedComments.forEach((comment, index) => {
                markdown += `### 评论 ${index + 1}\n`;
                markdown += `**作者**: ${this.escapeMarkdownText(comment.author || '匿名')}\n`;
                markdown += `**时间**: ${this.escapeMarkdownText(comment.timestamp || '未知')}\n`;
                markdown += `**内容**: ${this.escapeMarkdownText(comment.text || '')}\n`;
                if (comment.likes > 0) markdown += `**点赞**: ${comment.likes}\n`;
                if (comment.replies > 0) markdown += `**回复**: ${comment.replies}\n`;
                markdown += `\n---\n\n`;
            });
        }

        return markdown;
    }

    /**
     * CSV单元格安全处理
     * @param {string} raw - 原始文本
     * @returns {string}
     */
    static safeCsvCell(raw) {
        let v = String(raw || '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(v)) {
            v = "'" + v;
        }
        v = v.replace(/\r?\n/g, ' ');
        return `"${v}"`;
    }

    /**
     * Markdown文本转义
     * @param {string} text - 文本
     * @returns {string}
     */
    static escapeMarkdownText(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_');
    }

    /**
     * 判断是否在Service Worker环境
     * @returns {boolean}
     */
    static isServiceWorkerEnvironment() {
        return typeof window === 'undefined' &&
            typeof importScripts === 'function' &&
            typeof chrome !== 'undefined' &&
            chrome.downloads;
    }

    /**
     * 使用Data URL下载
     * @param {string} content - 内容
     * @param {string} mimeType - MIME类型
     * @param {string} filename - 文件名
     * @returns {Promise<void>}
     */
    static async downloadWithDataURL(content, mimeType, filename) {
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        const dataURL = `data:${mimeType};base64,${base64Content}`;

        await chrome.downloads.download({
            url: dataURL,
            filename: filename,
            saveAs: true
        });
    }

    /**
     * 使用Object URL下载
     * @param {string} content - 内容
     * @param {string} mimeType - MIME类型
     * @param {string} filename - 文件名
     * @returns {Promise<void>}
     */
    static async downloadWithObjectURL(content, mimeType, filename) {
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
            await this.downloadWithDataURL(content, mimeType, filename);
            return;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        });

        setTimeout(() => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn('清理Object URL失败:', e);
            }
        }, 1000);
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.ExportService = ExportService;
}

if (typeof self !== 'undefined' && typeof self.ExportService === 'undefined') {
    self.ExportService = ExportService;
}

