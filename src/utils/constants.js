/**
 * 常量定义 - 统一管理项目中的常量值
 */

const Constants = {
    // 延迟时间常量（毫秒）
    DELAY: {
        // 基础延迟
        SHORT: 200,
        MEDIUM: 500,
        LONG: 1000,
        
        // 提取器延迟
        EXTRACTOR_INITIAL: 3000,
        EXTRACTOR_SCROLL: 1000,
        EXTRACTOR_BETWEEN_COMMENTS: 600,
        EXTRACTOR_BETWEEN_COMMENTS_RANDOM: 700, // 600-1300ms范围
        
        // Bilibili特殊延迟
        BILIBILI_INITIAL_WAIT: 3000,
        BILIBILI_SCROLL_WAIT: 1500,
        BILIBILI_BETWEEN_COMMENTS: 600,
        BILIBILI_BETWEEN_COMMENTS_RANDOM: 700,
        BILIBILI_REPLY_EXPAND_DELAY: 300,
        BILIBILI_REPLY_WAIT_FOR_LOAD: 4500,
        BILIBILI_BACKOFF_BASE: 800,
        BILIBILI_BACKOFF_RANDOM: 600,
        BILIBILI_BACKOFF_MAX: 4000,
        
        // TikTok延迟
        TIKTOK_INITIAL: 3000,
        TIKTOK_SCROLL: 800,
        TIKTOK_REPLY_EXPAND: 500,
        TIKTOK_REPLY_EXPAND_RANDOM: 400,
        
        // Twitter延迟
        TWITTER_INITIAL: 2000,
        TWITTER_SCROLL: 2000,
        
        // YouTube延迟
        YOUTUBE_NAVIGATE_NOTIFY: 500,
        
        // 通用等待
        ELEMENT_WAIT_DEFAULT: 30000,
        ELEMENT_WAIT_MIN: 1000,
        
        // 心跳检测
        HEARTBEAT_INTERVAL: 30000
    },
    
    // 重试配置
    RETRY: {
        MAX_ATTEMPTS: 3,
        BASE_DELAY: 1000,
        MAX_DELAY: 4000
    },
    
    // 分页和限制
    LIMITS: {
        MAX_COMMENTS_DEFAULT: 100,
        MAX_COMMENTS_MIN: 10,
        MAX_COMMENTS_MAX: 1000,
        HISTORY_MAX_ITEMS: 100,
        SCROLL_STABLE_COUNT: 3,
        NO_NEW_COMMENTS_COUNT: 3,
        NO_NEW_COMMENTS_COUNT_TIKTOK: 5
    },
    
    // 日志配置
    LOG: {
        DEFAULT_LEVEL: 'INFO',
        LEVELS: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
    }
};

// 导出
if (typeof window !== 'undefined') {
    window.Constants = Constants;
}

if (typeof self !== 'undefined' && typeof self.Constants === 'undefined') {
    self.Constants = Constants;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
}

