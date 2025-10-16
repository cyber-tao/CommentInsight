# 项目结构

## 根目录文件

- **manifest.json**: Chrome扩展配置（Manifest V3）
- **background.js**: Service Worker，处理API调用、存储和消息处理
- **content.js**: 注入到社交媒体页面的内容脚本，用于DOM提取
- **popup.js**: 主弹窗UI逻辑
- **popup.html**: 扩展弹窗界面
- **options.js**: 设置页面逻辑
- **options.html**: 配置界面
- **viewer.js**: 数据查看器逻辑（评论、分析、历史记录）
- **viewer.html**: 全页面查看器界面

## 文件夹

- **icons/**: 扩展图标（16x16、48x48、128x128）
- **.kiro/**: Kiro AI助手配置和引导规则
- **.qoder/**: 额外的工具配置

## 代码组织

### 后台脚本 (background.js)
- `CommentInsightBackground` 类处理所有后端操作
- 各社交媒体平台的特定提取器
- 大数据集的AI分析与分块处理
- 多格式数据导出（CSV、Markdown、JSON）
- Chrome Storage管理

### 内容脚本 (content.js)
- `CommentExtractor` 主类，包含平台检测
- 平台特定的提取器类：
  - `YouTubeExtractor`
  - `TikTokExtractor`
  - `InstagramExtractor`
  - `FacebookExtractor`
  - `TwitterExtractor`
  - `BilibiliExtractor`
- `BaseExtractor` 基类，包含通用工具方法

### UI脚本
- **popup.js**: 主界面，评论提取触发器，分析启动
- **options.js**: 配置管理，API测试，导入/导出
- **viewer.js**: 显示评论、分析结果和历史记录，支持分页

## 关键模式

- **消息传递**: 后台、内容和UI脚本之间的Chrome运行时消息传递
- **基于类**: 每个主要组件都是一个类，包含初始化和事件处理
- **平台抽象**: 每个平台都有专用的提取器，使用统一接口
- **异步模式**: API调用和存储操作使用一致的Async/Await模式

## 数据流

1. 用户在弹窗中点击"提取评论"
2. 弹窗向后台脚本发送消息
3. 后台脚本委托给内容脚本（DOM提取）或直接调用API
4. 评论返回到后台，保存到Chrome Storage
5. 用户触发AI分析
6. 后台脚本将评论发送到AI端点
7. 分析结果保存并在查看器中显示

## 命名约定

- 类名: PascalCase（如 `CommentInsightPopup`）
- 方法名: camelCase（如 `extractComments`）
- 文件名: HTML使用kebab-case，JS使用camelCase
- CSS: HTML中内联的Tailwind工具类
