<<<<<<< HEAD
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
=======
# 技术栈与构建系统

## 核心技术

- **Chrome扩展 Manifest V3**：现代扩展架构，使用service worker
- **原生JavaScript**：无框架，纯ES6+ JavaScript以获得最佳性能
- **Tailwind CSS**：通过CDN使用的实用优先CSS框架
- **Chrome APIs**：存储、标签页、运行时、下载、脚本权限

## 架构组件

### 后台脚本 (Service Worker)
- `background.js`：处理API调用、数据存储和消息传递
- 管理平台检测和评论提取协调
- 处理AI分析请求，对大数据集进行分块处理
- 处理多种格式的数据导出（CSV、Markdown、JSON）

### 内容脚本
- `content.js`：平台特定的DOM解析和评论提取
- 支持Shadow DOM穿透（哔哩哔哩）
- 实现动态内容加载的智能滚动
- 每个支持的社交媒体网站的平台特定提取器

### UI组件
- `popup.js/html`：主扩展界面（400x600px）
- `options.js/html`：API密钥和设置的配置页面
- `viewer.js/html`：带分页和搜索的全页数据查看器

## API集成

### 社交媒体APIs
- **YouTube Data API v3**：官方评论提取
- **Twitter API v2**：推文回复和提及
- **Instagram Basic Display API**：帖子评论
- **Facebook Graph API**：评论数据访问

### AI服务
- **OpenAI兼容APIs**：用于分析的GPT模型
- **支持的提供商**：OpenAI、OpenRouter、SiliconFlow、ChatGLM、DeepSeek、Kimi
- **自定义端点**：灵活的API端点配置

## 数据管理

### 存储策略
- **Chrome本地存储**：配置和缓存数据
- **基于页面的键**：基于URL哈希的数据组织
- **历史管理**：自动去重和100项限制
- **隐私优先**：所有数据本地存储，无云端上传

### 导出格式
- **CSV**：带UTF-8 BOM的评论数据，支持中文字符
- **Markdown**：结构化分析报告，可选思考过程
- **JSON**：带元数据的完整历史数据

## 开发命令

由于这是Chrome扩展，没有传统的构建命令。开发工作流程：

1. **加载扩展**：Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序
2. **重新加载扩展**：点击Chrome扩展页面中的重新加载按钮
3. **调试**：使用Chrome DevTools调试弹出窗口、后台和内容脚本
4. **测试**：在支持的社交媒体平台上进行手动测试

## 配置文件

- `manifest.json`：扩展权限和入口点
- 不需要package.json或构建配置
- 从扩展目录直接提供文件

## 浏览器兼容性

- **Chrome 88+**：Manifest V3支持的最低版本
- **基于Chromium的浏览器**：Edge、Brave、Opera（兼容）
- **跨平台**：Windows、macOS、Linux支持
>>>>>>> 858e6c22808de3b4df7868e01656fa22e7b1615f
