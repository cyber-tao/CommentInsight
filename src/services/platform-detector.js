/**
 * 平台检测服务
 */

class PlatformDetector {
    /**
     * 检测URL对应的平台
     * @param {string} url - URL字符串
     * @returns {Object} 平台信息
     */
    static detectPlatform(url) {
        if (!url || typeof url !== 'string') {
            return {
                name: 'unknown',
                domain: 'unknown',
                supported: false
            };
        }

        const platforms = {
            'youtube.com': 'youtube',
            'youtu.be': 'youtube',
            'tiktok.com': 'tiktok',
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

        try {
            const urlObj = new URL(url);
            return {
                name: 'unknown',
                domain: urlObj.hostname,
                supported: false
            };
        } catch (e) {
            return {
                name: 'unknown',
                domain: 'unknown',
                supported: false
            };
        }
    }

    /**
     * 提取YouTube视频ID
     * @param {string} url - YouTube URL
     * @returns {string|null}
     */
    static extractYouTubeVideoId(url) {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^&\n?#]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * 提取Twitter推文ID
     * @param {string} url - Twitter URL
     * @returns {string|null}
     */
    static extractTwitterTweetId(url) {
        const patterns = [
            /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
            /(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.PlatformDetector = PlatformDetector;
}

if (typeof self !== 'undefined' && typeof self.PlatformDetector === 'undefined') {
    self.PlatformDetector = PlatformDetector;
}

