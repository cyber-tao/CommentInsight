/**
 * 评论提取服务 - 通过API或Content Script提取评论
 */

class CommentExtractorService {
    /**
     * 提取YouTube评论（通过API）
     * @param {string} url - YouTube URL
     * @param {Object} config - 配置
     * @returns {Promise<Array>}
     */
    static async extractYouTubeComments(url, config) {
        const videoId = PlatformDetector.extractYouTubeVideoId(url);
        if (!videoId) {
            throw new Error('无法从URL中提取YouTube视频ID');
        }

        const apiKey = config.platforms.youtube.apiKey;
        if (!apiKey) {
            throw new Error('YouTube API密钥未配置');
        }

        const targetCount = config.platforms.maxComments || 100;

        try {
            let pageToken = '';
            const all = [];
            let pages = 0;
            const maxPages = 20;
            
            while (all.length < targetCount && pages < maxPages) {
                const remaining = targetCount - all.length;
                const pageSize = Math.min(100, Math.max(1, remaining));
                const params = new URLSearchParams({
                    part: 'snippet,replies',
                    videoId: videoId,
                    maxResults: String(pageSize),
                    order: 'relevance',
                    key: apiKey
                });
                if (pageToken) params.set('pageToken', pageToken);

                const apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'YouTube API请求失败');
                }

                for (const item of data.items || []) {
                    const topComment = {
                        id: item.id,
                        parentId: "0",
                        author: item.snippet.topLevelComment.snippet.authorDisplayName,
                        text: item.snippet.topLevelComment.snippet.textOriginal,
                        timestamp: item.snippet.topLevelComment.snippet.publishedAt,
                        likes: item.snippet.topLevelComment.snippet.likeCount || 0,
                        replyCount: item.snippet.totalReplyCount || 0,
                        replies: [],
                        platform: 'youtube',
                        url: url
                    };

                    if (item.snippet.totalReplyCount > 0 && item.replies && item.replies.comments) {
                        topComment.replies = item.replies.comments.map(reply => ({
                            id: reply.id,
                            parentId: topComment.id,
                            author: reply.snippet.authorDisplayName,
                            text: reply.snippet.textOriginal,
                            timestamp: reply.snippet.publishedAt,
                            likes: reply.snippet.likeCount || 0,
                            isReply: true,
                            platform: 'youtube',
                            url: url
                        }));
                    }

                    all.push(topComment);
                }

                pageToken = data.nextPageToken || '';
                if (!pageToken) break;
                pages++;
            }

            return all.slice(0, targetCount);
        } catch (error) {
            throw new Error(`YouTube评论提取失败: ${error.message}`);
        }
    }

    /**
     * 通过Content Script提取评论
     * @param {number} tabId - 标签页ID
     * @param {string} action - 操作类型
     * @param {Object} config - 配置
     * @returns {Promise<Array>}
     */
    static async extractViaContentScript(tabId, action, config) {
        return new Promise((resolve, reject) => {
            if (!tabId) {
                reject(new Error('未提供有效的tabId'));
                return;
            }

            chrome.tabs.sendMessage(tabId, {
                action: action,
                config: config
            }, (response) => {
                if (chrome.runtime.lastError) {
                    Logger.error('extractor-service', 'Send message to tab failed', chrome.runtime.lastError);
                    reject(new Error('无法连接到页面脚本，请刷新页面后重试'));
                } else if (response && response.success) {
                    resolve(response.comments);
                } else {
                    Logger.warn('extractor-service', 'Content script extraction failed', response);
                    reject(new Error(response?.error || '评论提取失败'));
                }
            });
        });
    }

    /**
     * 提取Twitter评论（通过API）
     * @param {string} url - Twitter URL
     * @param {Object} config - 配置
     * @returns {Promise<Array>}
     */
    static async extractTwitterCommentsViaAPI(url, config) {
        const twitterConfig = config.platforms.twitter;
        const bearerToken = twitterConfig.bearerToken;

        if (!bearerToken) {
            throw new Error('Twitter API Bearer Token未配置');
        }

        const tweetId = PlatformDetector.extractTwitterTweetId(url);
        if (!tweetId) {
            throw new Error('无法从URL中提取Twitter推文ID');
        }

        const maxComments = config.platforms.maxComments || 100;
        const allComments = [];
        let nextToken = null;

        try {
            do {
                const query = encodeURIComponent(`conversation_id:${tweetId}`);
                let apiUrl = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=100&tweet.fields=created_at,public_metrics,author_id,conversation_id&expansions=author_id&user.fields=username,name`;

                if (nextToken) {
                    apiUrl += `&next_token=${nextToken}`;
                }

                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${bearerToken}`
                    }
                });

                const responseText = await response.text();
                let data;
                
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    Logger.warn('extractor-service', 'Twitter API response is not JSON');
                    throw new Error(`API响应不是有效的JSON: ${responseText.substring(0, 200)}`);
                }

                if (!response.ok) {
                    const errorMsg = data.errors?.[0]?.message || data.error?.message || 'Twitter API请求失败';
                    throw new Error(`${errorMsg} (状态码: ${response.status})`);
                }

                const tweets = data.data || [];
                const users = {};

                if (data.includes && data.includes.users) {
                    data.includes.users.forEach(user => {
                        users[user.id] = user;
                    });
                }

                tweets.forEach(tweet => {
                    if (tweet.id === tweetId) return;

                    const author = users[tweet.author_id];
                    const metrics = tweet.public_metrics || {};

                    allComments.push({
                        id: tweet.id,
                        parentId: "0",
                        author: author ? `@${author.username}` : '未知用户',
                        text: tweet.text,
                        timestamp: tweet.created_at,
                        likes: metrics.like_count || 0,
                        replies: metrics.reply_count || 0,
                        retweets: metrics.retweet_count || 0,
                        platform: 'twitter',
                        url: url
                    });
                });

                nextToken = data.meta?.next_token;

                if (allComments.length >= maxComments) {
                    break;
                }

            } while (nextToken && allComments.length < maxComments);

            return allComments.slice(0, maxComments);

        } catch (error) {
            Logger.error('extractor-service', 'Twitter API extract failed', error);
            throw new Error(`Twitter API提取失败: ${error.message}`);
        }
    }
}

// 导出
if (typeof self !== 'undefined' && typeof self.CommentExtractorService === 'undefined') {
    self.CommentExtractorService = CommentExtractorService;
}

