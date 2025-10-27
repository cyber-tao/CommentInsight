/**
 * AI分析服务 - 处理评论的AI分析
 */

class AIService {
    /**
     * 分析评论
     * @param {Array} comments - 评论数组
     * @param {Object} config - AI配置
     * @param {string} videoTitle - 视频标题
     * @param {string} videoDescription - 视频描述
     * @returns {Promise<Object>} 分析结果
     */
    static async analyzeComments(comments, config, videoTitle = '', videoDescription = '') {
        try {
            console.log('开始分析评论');

            const aiConfig = config.ai;
            if (!aiConfig.apiKey) {
                throw new Error('AI API密钥未配置');
            }

            const maxTokens = aiConfig.maxTokens || 8192;
            const charLimitPerChunk = Math.floor(maxTokens * 2 * 0.7);

            console.log(`模型最大令牌数: ${maxTokens}, 字符限制: ${charLimitPerChunk}`);

            const totalChars = comments.map(c => c.text || '').join('').length;
            const needsChunking = totalChars > charLimitPerChunk;

            if (needsChunking) {
                console.log(`触发分块分析 - 评论数: ${comments.length}, 总字符数: ${totalChars}`);
                const partials = await this.summarizeInChunks(comments, aiConfig, charLimitPerChunk, videoTitle, videoDescription);
                const final = await this.finalizeSummary(partials, aiConfig, comments.length, videoTitle, videoDescription);
                return {
                    rawAnalysis: final.text,
                    timestamp: new Date().toISOString(),
                    commentCount: comments.length,
                    model: aiConfig.model,
                    tokensUsed: final.tokensUsed || 0,
                    summary: this.extractSummaryFromAnalysis(final.text)
                };
            }

            const commentsText = comments.map(comment => {
                const likes = comment.likes || 0;
                const likesText = likes > 0 ? ` [👍 ${likes}]` : '';
                const isReply = comment.parentId && comment.parentId !== "0";
                
                // 根据是否为回复添加缩进和标识
                if (isReply) {
                    return `  ↳ 回复: ${comment.text}${likesText}`;
                } else {
                    return `- ${comment.text}${likesText}`;
                }
            }).join('\n');

            const prompt = this.buildAnalysisPrompt(commentsText, aiConfig.analysisTemplate, videoTitle, videoDescription);
            const data = await this.chatCompletion(aiConfig, [
                { role: 'user', content: prompt }
            ], aiConfig.maxTokens);

            if (!data.success) {
                throw new Error(data.error || 'AI分析请求失败');
            }

            return {
                rawAnalysis: data.text,
                timestamp: new Date().toISOString(),
                commentCount: comments.length,
                model: aiConfig.model,
                tokensUsed: data.tokensUsed || 0,
                summary: this.extractSummaryFromAnalysis(data.text)
            };

        } catch (error) {
            console.error('AI分析失败:', error);
            throw error;
        }
    }

    /**
     * 构建分析提示词
     * @param {string} commentsText - 评论文本
     * @param {string} template - 分析提示词模板（可选）
     * @param {string} videoTitle - 视频标题
     * @param {string} videoDescription - 视频描述
     * @returns {string}
     */
    static buildAnalysisPrompt(commentsText, template, videoTitle = '', videoDescription = '') {
        // 构建视频上下文信息
        let contextInfo = '';
        if (videoTitle) {
            contextInfo += `**视频标题**: ${videoTitle}\n\n`;
        }
        if (videoDescription && videoDescription.length > 0) {
            // 限制描述长度，避免过长
            const descLimit = 300;
            const trimmedDesc = videoDescription.length > descLimit 
                ? videoDescription.substring(0, descLimit) + '...' 
                : videoDescription;
            contextInfo += `**视频简介**: ${trimmedDesc}\n\n`;
        }
        
        // 如果没有提供模板，使用默认模板
        if (!template) {
            template = `${contextInfo}请分析以下社交媒体评论，生成结构化的分析报告。评论后面的 [👍 数字] 表示该评论的点赞数，缩进的"↳ 回复:"表示这是对上方评论的回复。点赞数高的评论代表更多用户的共鸣，请结合视频的主题和内容，特别关注这些热门评论和评论-回复之间的互动关系：

{comments}

请按照以下格式输出：

## 关键洞察
[结合视频主题，总结3-5个主要洞察点，特别关注高点赞评论反映的用户关注点]

## 情感分析
- 正面情感: X%
- 中性情感: X%
- 负面情感: X%

## 主要主题
1. [主题1]: [描述，标注是否为热门话题]
2. [主题2]: [描述，标注是否为热门话题]
3. [主题3]: [描述，标注是否为热门话题]

## 热门评论分析
[分析点赞数最高的评论，揭示用户最关心的内容]

## 显著趋势
[描述观察到的趋势和模式]

## 建议
[结合视频内容和评论反馈，提供可执行的建议]`;
        } else {
            // 如果有自定义模板，在前面添加上下文信息
            template = contextInfo + template;
        }
        
        // 替换模板中的{comments}占位符
        return template.replace('{comments}', commentsText);
    }

    /**
     * 分块总结
     * @param {Array} comments - 评论数组
     * @param {Object} aiConfig - AI配置
     * @param {number} charLimit - 字符限制
     * @param {string} videoTitle - 视频标题
     * @param {string} videoDescription - 视频描述
     * @returns {Promise<Object>} 返回{results: Array, tokensUsed: number}
     */
    static async summarizeInChunks(comments, aiConfig, charLimit, videoTitle = '', videoDescription = '') {
        const chunks = [];
        let buffer = [];
        let charCount = 0;

        for (const c of comments) {
            const t = String(c.text || '');
            if (charCount + t.length > charLimit && buffer.length > 0) {
                chunks.push(buffer);
                buffer = [];
                charCount = 0;
            }
            buffer.push(c);
            charCount += t.length;
        }
        if (buffer.length > 0) chunks.push(buffer);

        console.log(`分块分析：总共 ${comments.length} 条评论，分为 ${chunks.length} 个批次`);

        const results = [];
        let totalTokens = 0;
        const chunkMaxTokens = Math.floor(aiConfig.maxTokens * 0.4);
        
        // 构建上下文信息
        let contextPrefix = '';
        if (videoTitle) {
            contextPrefix += `**视频标题**: ${videoTitle}\n\n`;
        }
        if (videoDescription && videoDescription.length > 0) {
            const descLimit = 200;
            const trimmedDesc = videoDescription.length > descLimit 
                ? videoDescription.substring(0, descLimit) + '...' 
                : videoDescription;
            contextPrefix += `**视频简介**: ${trimmedDesc}\n\n`;
        }

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkText = chunk.map(c => {
                const likes = c.likes || 0;
                const likesText = likes > 0 ? ` [👍 ${likes}]` : '';
                const isReply = c.parentId && c.parentId !== "0";
                
                // 根据是否为回复添加缩进和标识
                if (isReply) {
                    return `  ↳ 回复: ${c.text}${likesText}`;
                } else {
                    return `- ${c.text}${likesText}`;
                }
            }).join('\n');
            
            const prompt = `${contextPrefix}以下是第 ${i + 1}/${chunks.length} 批评论（共 ${chunk.length} 条），评论后面的 [👍 数字] 表示点赞数，缩进的"↳ 回复:"表示这是对上方评论的回复。请结合视频主题，特别关注高点赞评论，并分析评论和回复之间的互动关系。请提炼要点，输出小结（要点、情感比例、主题、热门评论与显著现象）：\n\n${chunkText}`;
            
            const data = await this.chatCompletion(aiConfig, [
                { role: 'user', content: prompt }
            ], chunkMaxTokens);
            
            if (!data.success) throw new Error(data.error || '分批总结失败');
            results.push(data.text);
            totalTokens += data.tokensUsed || 0;
            console.log(`完成第 ${i + 1}/${chunks.length} 批次分析, Tokens: ${data.tokensUsed}`);
        }
        return { results, tokensUsed: totalTokens };
    }

    /**
     * 最终汇总
     * @param {Object} partialsResult - {results: Array, tokensUsed: number}
     * @param {Object} aiConfig - AI配置
     * @param {number} totalComments - 总评论数
     * @param {string} videoTitle - 视频标题
     * @param {string} videoDescription - 视频描述
     * @returns {Promise<Object>} 返回{text: string, tokensUsed: number}
     */
    static async finalizeSummary(partialsResult, aiConfig, totalComments, videoTitle = '', videoDescription = '') {
        const partials = partialsResult.results;
        let contextInfo = '';
        if (videoTitle) {
            contextInfo += `**视频标题**: ${videoTitle}\n\n`;
        }
        
        const prompt = [
            contextInfo,
            `将以下分批小结合并为一份完整的分析报告，结合视频主题，避免重复，提供最终可执行建议。`,
            ``,
            `**重要提示：本次分析共处理了 ${totalComments} 条评论，分为 ${partials.length} 个批次进行分析。**`,
            ``,
            partials.map((t, i) => `【小结${i + 1}】\n${t}`).join('\n\n'),
            '',
            '请按照以下结构输出：',
            '',
            '## 关键洞察',
            '[结合视频主题总结要点]',
            '',
            '## 情感分析',
            '- 正面情感: X%',
            '- 中性情感: X%',
            '- 负面情感: X%',
            '',
            '## 主要主题',
            '1. [主题1]: [描述，标注是否为热门话题]',
            '2. [主题2]: [描述，标注是否为热门话题]',
            '3. [主题3]: [描述，标注是否为热门话题]',
            '',
            '## 热门评论分析',
            '[分析点赞数最高的评论，揭示用户最关心的内容]',
            '',
            '## 显著趋势',
            '[描述观察到的趋势和模式]',
            '',
            '## 建议',
            '[结合视频内容和评论反馈，提供可执行的建议]'
        ].join('\n');

        const data = await this.chatCompletion(aiConfig, [
            { role: 'user', content: prompt }
        ], aiConfig.maxTokens);
        
        if (!data.success) throw new Error(data.error || '汇总失败');
        
        const totalTokens = partialsResult.tokensUsed + (data.tokensUsed || 0);
        return { text: data.text, tokensUsed: totalTokens };
    }

    /**
     * 调用Chat Completion API
     * @param {Object} aiConfig - AI配置
     * @param {Array} messages - 消息数组
     * @param {number} maxTokens - 最大令牌数
     * @returns {Promise<Object>}
     */
    static async chatCompletion(aiConfig, messages, maxTokens) {
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
            
            // 提取tokens使用情况
            const tokensUsed = data.usage?.total_tokens || 0;
            
            return { 
                success: true, 
                text: data.choices?.[0]?.message?.content || '',
                tokensUsed: tokensUsed
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * 测试AI连接
     * @param {Object} config - AI配置
     * @returns {Promise<Object>}
     */
    static async testConnection(config) {
        try {
            const testPrompt = '请回复"连接成功"来确认API连接正常。';

            const response = await fetch(`${config.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: testPrompt }],
                    max_tokens: 50
                })
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

    /**
     * 获取AI模型列表
     * @param {Object} config - AI配置
     * @returns {Promise<Array>}
     */
    static async getModels(config) {
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

    /**
     * 从分析文本中提取摘要
     * @param {string} analysisText - 分析文本
     * @returns {Object}
     */
    static extractSummaryFromAnalysis(analysisText) {
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
}

// 导出
if (typeof window !== 'undefined') {
    window.AIService = AIService;
}

if (typeof self !== 'undefined' && typeof self.AIService === 'undefined') {
    self.AIService = AIService;
}

