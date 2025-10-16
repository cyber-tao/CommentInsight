# 技术栈

## 架构

Chrome扩展（Manifest V3）包含三个主要组件：
- **background.js**: Service Worker，处理API调用、数据存储和消息传递
- **content.js**: 内容脚本，用于DOM解析和各平台的评论提取
- **popup.js / options.js / viewer.js**: UI层，处理用户交互

## 技术选型

- **运行时**: Chrome Extension Manifest V3
- **语言**: 原生JavaScript (ES6+)
- **存储**: Chrome Storage API (本地存储)
- **UI**: HTML + Tailwind CSS (内联样式)
- **APIs**: 
  - 平台APIs（YouTube Data API、Twitter API v2等）
  - AI APIs（OpenAI兼容端点）

## 平台特定提取方式

- **YouTube**: 官方API，支持分页
- **TikTok**: DOM解析，滚动加载
- **Instagram**: API + DOM混合方式
- **Facebook**: Graph API提取
- **Twitter/X**: API v2提取
- **Bilibili**: Shadow DOM遍历，智能滚动

## 构建与开发

无需构建系统 - 纯JavaScript扩展：
1. 在Chrome中加载未打包的扩展（`chrome://extensions/`）
2. 启用开发者模式
3. 指向项目目录
4. 修改后重新加载扩展

## 测试

浏览器中手动测试：
1. 导航到支持的平台
2. 点击扩展图标
3. 测试提取和分析功能

## 配置

所有配置存储在Chrome Storage中：
- AI端点和API密钥
- 平台特定的API凭证
- 导出偏好设置
- 分析历史记录
