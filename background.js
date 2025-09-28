// 后台服务工作脚本 - 处理API调用、数据存储和消息传递
class CommentInsightBackground {
    constructor() {
        this.initializeBackground();
    }

    initializeBackground() {
        // 监听扩展安装事件
        chrome.runtime.onInstalled.addListener((details) => {
            this.onInstalled(details);
        });

        // 监听来自content script和popup的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // 保持消息通道开放用于异步响应
        });

        // 监听标签页更新事件
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.onTabUpdated(tabId, changeInfo, tab);
        });
    }

    async onInstalled(details) {
        console.log('评论洞察扩展已安装/更新', details);

        // 设置默认配置
        const defaultConfig = {
            ai: {
                endpoint: 'https://api.openai.com/v1',
                apiKey: '',
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                maxTokens: 2000,
                systemPrompt: '你是一个专业的社交媒体评论分析师。请分析提供的评论数据，生成包含关键洞察、情感分析、主要主题和趋势的结构化摘要。'
            },
            platforms: {
                youtube: {
                    apiKey: '',
                    maxComments: 100
                },
                tiktok: {
                    mode: 'dom',
                    delay: 1000
                },
                instagram: {
                    token: '',
                    appId: ''
                },
                facebook: {
                    appId: '',
                    appSecret: ''
                },
                twitter: {
                    bearerToken: '',
                    apiVersion: 'v2'
                },
                bilibili: {
                    mode: 'dom',
                    delay: 1000,
                    maxScrolls: 20
                },
                // 公共配置
                maxComments: 100,
                export: {
                    includeComments: false,
                    commentsSort: 'timestamp-desc'
                }
            }
        };

        // 只在首次安装时设置默认配置
        if (details.reason === 'install') {
            await chrome.storage.local.set({ config: defaultConfig });
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('收到消息:', message);

            switch (message.action) {
                case 'detectPlatform':
                    const platform = await this.detectPlatform(message.url);
                    sendResponse({ success: true, platform });
                    break;

                case 'extractComments':
                    const comments = await this.extractComments(message.platform, message.url, message.config, message.tabId);
                    sendResponse({ success: true, comments });
                    break;

                case 'analyzeComments':
                    const analysis = await this.analyzeComments(message.comments, message.config);
                    sendResponse({ success: true, analysis });
                    break;

                case 'saveData':
                    await this.saveData(message.data);
                    sendResponse({ success: true });
                    break;

                case 'loadData':
                    const data = await this.loadData(message.key);
                    sendResponse({ success: true, data });
                    break;

                case 'testAIConnection':
                    const testResult = await this.testAIConnection(message.config);
                    sendResponse({ success: true, result: testResult });
                    break;

                case 'getAIModels':
                    const models = await this.getAIModels(message.config);
                    sendResponse({ success: true, models });
                    break;

                case 'exportData':
                    try {
                        await this.exportData(message.data, message.format, message.filename);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'exportAnalysis':
                    try {
                        await this.exportData(message.data, 'markdown', message.filename);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'exportComments':
                    try {
                        await this.exportData(message.data, 'csv', message.filename);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'exportHistory':
                    try {
                        await this.exportData(message.data, 'json', message.filename);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                case 'getConfig':
                    try {
                        const config = await this.loadData('config');
                        sendResponse({ success: true, data: config });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                    break;

                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('处理消息时出错:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async onTabUpdated(tabId, changeInfo, tab) {
        // 当标签页URL变化时，检测新的平台
        if (changeInfo.url) {
            const platform = await this.detectPlatform(changeInfo.url);
            // 可以在这里发送消息给popup更新界面
        }
    }

    async detectPlatform(url) {
        const platforms = {
            'youtube.com': 'youtube',
            'youtu.be': 'youtube',
            'tiktok.com': 'tiktok',
            'instagram.com': 'instagram',
            'facebook.com': 'facebook',
            'fb.com': 'facebook',
            'twitter.com': 'twitter',
            'x.com': 'twitter',
            'bilibili.com': 'bilibili',
            'b23.tv': 'bilibili'
        };

        for (const [domain, platform] of Object.entries(platforms)) {
            if (url.includes(domain)) {
                return {
                    name: platform,
                    domain: domain,
                    supported: true
                };
            }
        }

        return {
            name: 'unknown',
            domain: new URL(url).hostname,
            supported: false
        };
    }

    async extractComments(platform, url, config, tabId) {
        try {
            console.log(`开始提取${platform}平台的评论`);

            switch (platform) {
                case 'youtube':
                    return await this.extractYouTubeComments(url, config);
                case 'tiktok':
                    return await this.extractTikTokComments(url, config, tabId);
                case 'instagram':
                    return await this.extractInstagramComments(url, config, tabId);
                case 'facebook':
                    return await this.extractFacebookComments(url, config, tabId);
                case 'twitter':
                    return await this.extractTwitterComments(url, config, tabId);
                case 'bilibili':
                    return await this.extractBilibiliComments(url, config, tabId);
                default:
                    throw new Error(`不支持的平台: ${platform}`);
            }
        } catch (error) {
            console.error('提取评论失败:', error);
            throw error;
        }
    }

    async extractYouTubeComments(url, config) {
        const videoId = this.extractYouTubeVideoId(url);
        if (!videoId) {
            throw new Error('无法从URL中提取YouTube视频ID');
        }

        const apiKey = config.platforms.youtube.apiKey;
        if (!apiKey) {
            throw new Error('YouTube API密钥未配置');
        }

        // 使用公共配置的最大评论数
        const targetCount = config.platforms.maxComments || 100;

        try {
            let pageToken = '';
            const all = [];
            while (all.length < targetCount) {
                const remaining = targetCount - all.length;
                const pageSize = Math.min(100, Math.max(1, remaining));
                const params = new URLSearchParams({
                    part: 'snippet',
                    videoId: videoId,
                    maxResults: String(pageSize),
                    key: apiKey
                });
                if (pageToken) params.set('pageToken', pageToken);

                const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'YouTube API请求失败');
                }

                const mapped = (data.items || []).map(item => ({
                    id: item.id,
                    author: item.snippet.topLevelComment.snippet.authorDisplayName,
                    text: item.snippet.topLevelComment.snippet.textOriginal,
                    timestamp: item.snippet.topLevelComment.snippet.publishedAt,
                    likes: item.snippet.topLevelComment.snippet.likeCount || 0,
                    replies: item.snippet.totalReplyCount || 0
                }));
                all.push(...mapped);

                pageToken = data.nextPageToken || '';
                if (!pageToken) break;
            }

            return all.slice(0, targetCount);
        } catch (error) {
            throw new Error(`YouTube评论提取失败: ${error.message}`);
        }
    }

    extractYouTubeVideoId(url) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    async extractTikTokComments(url, config, tabId) {
        return new Promise((resolve, reject) => {
            const sendTo = tabId;
            if (sendTo) {
                chrome.tabs.sendMessage(sendTo, {
                    action: 'extractTikTokComments',
                    config: config
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response.comments);
                    } else {
                        reject(new Error(response?.error || 'TikTok评论提取失败'));
                    }
                });
            } else {
                reject(new Error('未提供有效的tabId'));
            }
        });
    }

    async extractInstagramComments(url, config, tabId) {
        return new Promise((resolve, reject) => {
            const sendTo = tabId;
            if (sendTo) {
                chrome.tabs.sendMessage(sendTo, {
                    action: 'extractInstagramComments',
                    config: config
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response.comments);
                    } else {
                        reject(new Error(response?.error || 'Instagram评论提取失败'));
                    }
                });
            } else {
                reject(new Error('未提供有效的tabId'));
            }
        });
    }

    async extractFacebookComments(url, config, tabId) {
        return new Promise((resolve, reject) => {
            const sendTo = tabId;
            if (sendTo) {
                chrome.tabs.sendMessage(sendTo, {
                    action: 'extractFacebookComments',
                    config: config
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response.comments);
                    } else {
                        reject(new Error(response?.error || 'Facebook评论提取失败'));
                    }
                });
            } else {
                reject(new Error('未提供有效的tabId'));
            }
        });
    }

    async extractTwitterComments(url, config, tabId) {
        return new Promise((resolve, reject) => {
            const sendTo = tabId;
            if (sendTo) {
                chrome.tabs.sendMessage(sendTo, {
                    action: 'extractTwitterComments',
                    config: config
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (response && response.success) {
                        resolve(response.comments);
                    } else {
                        reject(new Error(response?.error || 'Twitter评论提取失败'));
                    }
                });
            } else {
                reject(new Error('未提供有效的tabId'));
            }
        });
    }

    async extractBilibiliComments(url, config, tabId) {
        return new Promise((resolve, reject) => {
            if (!tabId) {
                reject(new Error('未提供有效的tabId'));
                return;
            }

            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error('Bilibili评论提取超时，请刷新页面后重试'));
            }, 30000); // 30秒超时

            chrome.tabs.sendMessage(tabId, {
                action: 'extractBilibiliComments',
                config: config
            }, (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                    console.error('Chrome消息传递错误:', chrome.runtime.lastError);
                    reject(new Error('无法连接到页面脚本，请刷新页面后重试'));
                } else if (response && response.success) {
                    resolve(response.comments);
                } else {
                    reject(new Error(response?.error || 'Bilibili评论提取失败'));
                }
            });
        });
    }

    async analyzeComments(comments, config) {
        try {
            console.log('开始AI分析评论');

            const aiConfig = config.ai;
            if (!aiConfig.apiKey) {
                throw new Error('AI API密钥未配置');
            }

            const large = comments.length > 200 || comments.map(c => c.text || '').join('').length > 8000;
            if (large) {
                const partials = await this.summarizeInChunks(comments, aiConfig);
                const final = await this.finalizeSummary(partials, aiConfig);
                return {
                    rawAnalysis: final,
                    timestamp: new Date().toISOString(),
                    commentCount: comments.length,
                    model: aiConfig.model,
                    summary: this.extractSummaryFromAnalysis(final)
                };
            }

            const commentsText = comments.map(comment => `- ${comment.text}`).join('\n');
            const prompt = '请分析以下社交媒体评论，生成结构化的分析报告：\n\n' +
                commentsText +
                '\n\n请按照以下格式输出：\n\n' +
                '## 关键洞察\n[总结3-5个主要洞察点]\n\n' +
                '## 情感分析\n- 正面情感: X%\n- 中性情感: X%\n- 负面情感: X%\n\n' +
                '## 主要主题\n1. [主题1]: [描述]\n2. [主题2]: [描述]\n3. [主题3]: [描述]\n\n' +
                '## 显著趋势\n[描述观察到的趋势和模式]\n\n' +
                '## 建议\n[基于分析提供的建议]';

            const data = await this.chatCompletion(aiConfig, [
                { role: 'system', content: aiConfig.systemPrompt },
                { role: 'user', content: prompt }
            ], aiConfig.maxTokens);

            if (!data.success) {
                throw new Error(data.error || 'AI分析请求失败');
            }

            const analysisText = data.text;
            return {
                rawAnalysis: analysisText,
                timestamp: new Date().toISOString(),
                commentCount: comments.length,
                model: aiConfig.model,
                summary: this.extractSummaryFromAnalysis(analysisText)
            };

        } catch (error) {
            console.error('AI分析失败:', error);
            throw error;
        }
    }

    async summarizeInChunks(comments, aiConfig) {
        const chunks = [];
        let buffer = [];
        let charCount = 0;
        const LIMIT = 8000;
        for (const c of comments) {
            const t = String(c.text || '');
            if (charCount + t.length > LIMIT && buffer.length > 0) {
                chunks.push(buffer);
                buffer = [];
                charCount = 0;
            }
            buffer.push(c);
            charCount += t.length;
        }
        if (buffer.length > 0) chunks.push(buffer);

        const results = [];
        for (const chunk of chunks) {
            const chunkText = chunk.map(c => `- ${c.text}`).join('\n');
            const prompt = '以下是部分评论，请提炼要点，输出小结（要点、情感比例、主题与显著现象）：\n\n' + chunkText;
            const data = await this.chatCompletion(aiConfig, [
                { role: 'system', content: aiConfig.systemPrompt },
                { role: 'user', content: prompt }
            ], Math.max(512, Math.min(2048, aiConfig.maxTokens || 2000)));
            if (!data.success) throw new Error(data.error || '分批总结失败');
            results.push(data.text);
        }
        return results;
    }

    async finalizeSummary(partials, aiConfig) {
        const prompt = [
            '将以下分批小结合并为一份完整的分析报告，避免重复，提供最终可执行建议：',
            '',
            partials.map((t, i) => `【小结${i + 1}】\n${t}`).join('\n\n'),
            '',
            '请按照以下结构输出：',
            '',
            '## 关键洞察',
            '...',
            '',
            '## 情感分析',
            '- 正面情感: X%',
            '- 中性情感: X%',
            '- 负面情感: X%',
            '',
            '## 主要主题',
            '1. ...',
            '2. ...',
            '3. ...',
            '',
            '## 显著趋势',
            '...',
            '',
            '## 建议',
            '...'
        ].join('\n');

        const data = await this.chatCompletion(aiConfig, [
            { role: 'system', content: aiConfig.systemPrompt },
            { role: 'user', content: prompt }
        ], aiConfig.maxTokens);
        if (!data.success) throw new Error(data.error || '汇总失败');
        return data.text;
    }

    async chatCompletion(aiConfig, messages, maxTokens) {
        try {
            const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages,
                    temperature: aiConfig.temperature,
                    max_tokens: maxTokens
                })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, error: data.error?.message || '请求失败' };
            }
            return { success: true, text: data.choices?.[0]?.message?.content || '' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    extractSummaryFromAnalysis(analysisText) {
        return {
            insights: [],
            sentiment: {
                positive: 0,
                neutral: 0,
                negative: 0
            },
            topics: [],
            trends: []
        };
    }

    async testAIConnection(config) {
        try {
            const testPrompt = '请回复"连接成功"来确认API连接正常。';

            const requestBody = {
                model: config.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'user',
                        content: testPrompt
                    }
                ],
                max_tokens: 50
            };

            const response = await fetch(`${config.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    message: '连接成功',
                    model: data.model,
                    response: data.choices[0].message.content
                };
            } else {
                return {
                    success: false,
                    message: data.error?.message || '连接失败'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    async getAIModels(config) {
        try {
            const response = await fetch(`${config.endpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                return data.data.map(model => ({
                    id: model.id,
                    name: model.id,
                    created: model.created
                }));
            } else {
                throw new Error(data.error?.message || '获取模型列表失败');
            }
        } catch (error) {
            console.error('获取AI模型失败:', error);
            throw error;
        }
    }

    async saveData(data) {
        try {
            await chrome.storage.local.set(data);
            console.log('数据保存成功');
        } catch (error) {
            console.error('数据保存失败:', error);
            throw error;
        }
    }

    async loadData(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key];
        } catch (error) {
            console.error('数据加载失败:', error);
            throw error;
        }
    }

    async exportData(data, format, filename) {
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

    isServiceWorkerEnvironment() {
        return typeof window === 'undefined' &&
            typeof importScripts === 'function' &&
            typeof chrome !== 'undefined' &&
            chrome.downloads;
    }

    async downloadWithDataURL(content, mimeType, filename) {
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        const dataURL = `data:${mimeType};base64,${base64Content}`;

        await chrome.downloads.download({
            url: dataURL,
            filename: filename,
            saveAs: true
        });
    }

    async downloadWithObjectURL(content, mimeType, filename) {
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

    convertToCSV(data) {
        if (!data.comments || !Array.isArray(data.comments)) {
            throw new Error('无效的评论数据');
        }

        const headers = ['作者', '内容', '时间戳', '点赞数', '回复数'];
        const csvContent = [
            headers.join(','),
            ...data.comments.map(comment => [
                this.safeCsvCell(comment.author || ''),
                this.safeCsvCell(comment.text || ''),
                this.safeCsvCell(comment.timestamp || ''),
                comment.likes || 0,
                comment.replies || 0
            ].join(','))
        ].join('\n');

        // 添加UTF-8 BOM标识符以解决中文乱码问题
        return '\uFEFF' + csvContent;
    }

    safeCsvCell(raw) {
        let v = String(raw || '').replace(/"/g, '""');
        if (/^[=+\-@]/.test(v)) {
            v = "'" + v;
        }
        v = v.replace(/\r?\n/g, ' ');
        return `"${v}"`;
    }

    convertToMarkdown(data) {
        let markdown = `# 评论分析报告\n\n`;
        markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        
        // 修复评论数量获取逻辑
        const commentCount = data.comments?.length || data.commentCount || 0;
        markdown += `**评论数量**: ${commentCount}\n`;
        
        markdown += `**平台**: ${data.platform || '未知'}\n\n`;

        if (data.analysis) {
            markdown += `## AI分析结果\n\n`;
            markdown += data.analysis.rawAnalysis || '暂无分析结果';
            markdown += `\n\n`;
        }

        // 检查是否需要包含评论以及如何排序
        if (data.includeComments && data.comments && data.comments.length > 0) {
            // 对评论进行排序
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

    escapeMarkdownText(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_');
    }
}

// 初始化后台服务
new CommentInsightBackground();