/**
 * 默认配置 - 项目唯一默认配置来源
 */

const DefaultConfig = {
    ai: {
        endpoint: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 8192,
        analysisTemplate: `请分析以下社交媒体评论，生成结构化的分析报告。评论后面的 [👍 数字] 表示该评论的点赞数，缩进的"↳ 回复:"表示这是对上方评论的回复。点赞数高的评论代表更多用户的共鸣，请结合视频的主题和内容，特别关注这些热门评论和评论-回复之间的互动关系：

{comments}

请按照以下格式输出：

## 结论总结
[几句话总结这个视频主要内容和用户反应，再给出一个结论]

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
[结合视频内容和评论反馈，提供可执行的建议]`
    },
    platforms: {
        youtube: {
            apiKey: '',
            maxComments: 100
        },
        tiktok: {
            mode: 'dom'
        },
        twitter: {
            mode: 'dom',
            bearerToken: '',
            apiVersion: 'v2'
        },
        bilibili: {
            mode: 'dom',
            delay: 1000
        },
        maxComments: 100,
        export: {
            includeComments: false,
            includeThinking: false,
            commentsSort: 'timestamp-desc'
        }
    }
};

// 导出到全局
if (typeof window !== 'undefined') {
    window.DefaultConfig = DefaultConfig;
}
if (typeof self !== 'undefined') {
    self.DefaultConfig = DefaultConfig;
}


