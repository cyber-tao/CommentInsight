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
                }
            },
            export: {
                csv: true,
                markdown: true,
                json: false,
                filenamePattern: '{platform}_{title}_{date}'
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
                    const comments = await this.extractComments(message.platform, message.url, message.config);
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
            'x.com': 'twitter'
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

    async extractComments(platform, url, config) {
        try {
            console.log(`开始提取${platform}平台的评论`);

            switch (platform) {
                case 'youtube':
                    return await this.extractYouTubeComments(url, config);
                case 'tiktok':
                    return await this.extractTikTokComments(url, config);
                case 'instagram':
                    return await this.extractInstagramComments(url, config);
                case 'facebook':
                    return await this.extractFacebookComments(url, config);
                case 'twitter':
                    return await this.extractTwitterComments(url, config);
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

        const maxResults = config.platforms.youtube.maxComments || 100;
        const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&key=${apiKey}`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'YouTube API请求失败');
            }

            return data.items.map(item => ({
                id: item.id,
                author: item.snippet.topLevelComment.snippet.authorDisplayName,
                text: item.snippet.topLevelComment.snippet.textDisplay,
                timestamp: item.snippet.topLevelComment.snippet.publishedAt,
                likes: item.snippet.topLevelComment.snippet.likeCount || 0,
                replies: item.snippet.totalReplyCount || 0
            }));
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

    async extractTikTokComments(url, config) {
        // TikTok评论提取需要通过content script进行DOM解析
        // 因为TikTok的API访问限制较多
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
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
                    reject(new Error('无法找到活动标签页'));
                }
            });
        });
    }

    async extractInstagramComments(url, config) {
        // Instagram评论提取同样需要通过content script
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
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
                    reject(new Error('无法找到活动标签页'));
                }
            });
        });
    }

    async extractFacebookComments(url, config) {
        // Facebook评论提取
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
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
                    reject(new Error('无法找到活动标签页'));
                }
            });
        });
    }

    async extractTwitterComments(url, config) {
        // Twitter评论提取
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
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
                    reject(new Error('无法找到活动标签页'));
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

            // 准备评论数据
            const commentsText = comments.map(comment => comment.text).join('\n\n');
            
            const prompt = `请分析以下社交媒体评论，生成结构化的分析报告：

评论数据：
${commentsText}

请按照以下格式生成分析报告：

## 关键洞察
[总结3-5个主要洞察点]

## 情感分析
- 正面情感: X%
- 中性情感: X% 
- 负面情感: X%

## 主要主题
1. [主题1]: [描述]
2. [主题2]: [描述]
3. [主题3]: [描述]

## 显著趋势
[描述观察到的趋势和模式]

## 建议
[基于分析提供的建议]`;

            const requestBody = {
                model: aiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: aiConfig.systemPrompt
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: aiConfig.temperature,
                max_tokens: aiConfig.maxTokens
            };

            const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiConfig.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'AI分析请求失败');
            }

            const analysisText = data.choices[0].message.content;

            // 解析分析结果
            return {
                rawAnalysis: analysisText,
                timestamp: new Date().toISOString(),
                commentCount: comments.length,
                model: aiConfig.model,
                // 可以添加更多结构化数据提取
                summary: this.extractSummaryFromAnalysis(analysisText)
            };

        } catch (error) {
            console.error('AI分析失败:', error);
            throw error;
        }
    }

    extractSummaryFromAnalysis(analysisText) {
        // 简单的文本解析来提取关键信息
        // 在实际应用中可以使用更复杂的解析逻辑
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
                    mimeType = 'text/csv';
                    break;
                case 'markdown':
                    content = this.convertToMarkdown(data);
                    mimeType = 'text/markdown';
                    break;
                case 'json':
                    content = JSON.stringify(data, null, 2);
                    mimeType = 'application/json';
                    break;
                default:
                    throw new Error('不支持的导出格式');
            }

            // 使用Chrome下载API
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);

            await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            });

            // 清理临时URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }

    convertToCSV(data) {
        if (!data.comments || !Array.isArray(data.comments)) {
            throw new Error('无效的评论数据');
        }

        const headers = ['作者', '内容', '时间戳', '点赞数', '回复数'];
        const csvContent = [
            headers.join(','),
            ...data.comments.map(comment => [
                `"${comment.author || ''}"`,
                `"${(comment.text || '').replace(/"/g, '""')}"`,
                `"${comment.timestamp || ''}"`,
                comment.likes || 0,
                comment.replies || 0
            ].join(','))
        ].join('\n');

        return csvContent;
    }

    convertToMarkdown(data) {
        let markdown = `# 评论分析报告\n\n`;
        markdown += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        markdown += `**评论数量**: ${data.comments?.length || 0}\n`;
        markdown += `**平台**: ${data.platform || '未知'}\n\n`;

        if (data.analysis) {
            markdown += `## AI分析结果\n\n`;
            markdown += data.analysis.rawAnalysis || '暂无分析结果';
            markdown += `\n\n`;
        }

        if (data.comments && data.comments.length > 0) {
            markdown += `## 评论详情\n\n`;
            data.comments.forEach((comment, index) => {
                markdown += `### 评论 ${index + 1}\n`;
                markdown += `**作者**: ${comment.author || '匿名'}\n`;
                markdown += `**时间**: ${comment.timestamp || '未知'}\n`;
                markdown += `**内容**: ${comment.text || ''}\n`;
                if (comment.likes > 0) markdown += `**点赞**: ${comment.likes}\n`;
                if (comment.replies > 0) markdown += `**回复**: ${comment.replies}\n`;
                markdown += `\n---\n\n`;
            });
        }

        return markdown;
    }
}

// 初始化后台服务
new CommentInsightBackground(); 