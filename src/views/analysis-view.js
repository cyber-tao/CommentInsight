/**
 * 分析视图 - 处理AI分析结果展示
 */

class AnalysisView extends BaseView {
    /**
     * 渲染分析结果
     */
    render() {
        const contentElement = document.getElementById('analysis-content');
        const metadataElement = document.getElementById('analysis-metadata');

        if (!this.viewer.currentData || !this.viewer.currentData.analysis) {
            contentElement.innerHTML = '<p class="text-gray-500 text-center py-8">暂无分析数据</p>';
            metadataElement.classList.add('hidden');
            return;
        }

        const analysis = this.viewer.currentData.analysis;
        
        // 使用MarkdownUtils渲染分析内容
        const analysisContent = MarkdownUtils.toHtml(analysis.rawAnalysis || '暂无分析结果');
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

    /**
     * 导出分析
     * @returns {Promise<void>}
     */
    async exportAnalysis() {
        if (!this.viewer.currentData || !this.viewer.currentData.analysis) {
            this.showNotification('没有可导出的分析数据', 'warning');
            return;
        }

        const configResponse = await this.sendMessage({
            action: 'getConfig'
        });
        
        const config = configResponse.success ? configResponse.data : {};
        const platformConfig = config.platforms || {};
        const exportConfig = platformConfig.export || {};

        const data = {
            analysis: this.viewer.currentData.analysis,
            platform: this.viewer.currentData.platform,
            title: this.viewer.currentData.title,
            timestamp: this.viewer.currentData.timestamp,
            includeComments: exportConfig.includeComments === true,
            includeThinking: exportConfig.includeThinking === true,
            sortMethod: exportConfig.commentsSort || 'timestamp-desc',
            comments: this.viewer.currentData.comments || []
        };

        const filename = CommonUtils.generateFilename(
            this.viewer.currentData.platform,
            this.viewer.currentData.title,
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
            throw new Error(this.mapError(response));
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.AnalysisView = AnalysisView;
}
