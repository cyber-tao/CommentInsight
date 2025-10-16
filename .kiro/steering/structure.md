<<<<<<< HEAD
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
=======
# 项目结构与组织

## 根目录布局

```
CommentInsight/
├── manifest.json           # 扩展清单文件（入口点）
├── background.js           # Service worker（865行）
├── content.js             # 内容脚本（1312+行）
├── popup.html/js          # 主界面（400x600px弹窗）
├── options.html/js        # 设置页面
├── viewer.html/js         # 数据查看器页面
├── icons/                 # 扩展图标（16、48、128px）
├── .gitignore            # Git忽略规则
├── README.md             # 项目文档（中文）
└── .kiro/                # Kiro AI助手配置
```

## 代码组织模式

### 文件命名约定
- **Kebab-case**：本项目中未使用
- **camelCase**：JavaScript变量和函数
- **PascalCase**：类名（如`CommentInsightBackground`、`BilibiliExtractor`）
- **描述性名称**：文件按功能命名（`background.js`、`content.js`、`popup.js`）

### JavaScript架构

#### 基于类的组织
- **主要类**：每个文件一个类，职责明确
- **提取器模式**：平台特定提取器继承自`BaseExtractor`
- **消息传递**：组件间集中化通信

#### 平台提取器结构
```javascript
class BaseExtractor {
    // 通用功能：waitForElement、scrollToLoadMore、sanitizeText
}

class YouTubeExtractor extends BaseExtractor {
    // YouTube特定的DOM解析
}

class BilibiliExtractor extends BaseExtractor {
    // 哔哩哔哩的Shadow DOM处理
}
```

### HTML结构模式
- **Tailwind CSS**：全程使用实用优先样式
- **语义化HTML**：正确使用nav、main、section元素
- **可访问性**：ARIA标签和键盘导航支持
- **响应式设计**：使用grid/flexbox的移动友好布局

### 数据流架构

#### 消息传递模式
```
Popup ←→ Background ←→ Content Script
   ↓         ↓           ↓
Storage   AI APIs    DOM Parsing
```

#### 存储键约定
- `config`：全局扩展配置
- `comments_{pageKey}`：页面特定评论数据
- `analysis_history`：历史分析记录

## 目录约定

### 图标目录
- 标准Chrome扩展图标尺寸：16px、48px、128px
- 所有图标使用PNG格式
- 各尺寸间保持一致的视觉设计

### 配置文件
- `manifest.json`：权限和入口点的单一真实来源
- 无构建配置文件（直接文件服务）
- Chrome存储中的扩展特定配置

## 代码风格指南

### JavaScript约定
- **ES6+特性**：箭头函数、async/await、解构
- **错误处理**：带有意义错误消息的try-catch块
- **日志记录**：用于调试的Console.log，带描述性消息
- **注释**：业务逻辑使用中文注释，技术细节使用英文

### CSS/HTML约定
- **Tailwind类**：优先使用实用类而非自定义CSS
- **响应式设计**：移动优先方法，使用sm/md/lg断点
- **配色方案**：一致的蓝色主题，带平台特定强调色
- **排版**：清晰的层次结构，适当的字体粗细和大小

### 平台特定模式
- **DOM选择器**：为平台变化提供多个备用选择器
- **错误恢复**：选择器失败时的优雅降级
- **速率限制**：延迟和超时以遵守平台政策
- **Shadow DOM**：现代Web组件的特殊处理（哔哩哔哩）

## 扩展特定结构

### Manifest V3要求
- 使用service worker而非后台页面
- 清单中的声明式权限
- 内容脚本注入模式
- 支持平台的主机权限

### Chrome API使用模式
- **Storage API**：所有数据持久化的本地存储
- **Tabs API**：当前标签页检测和消息传递
- **Downloads API**：文件导出功能
- **Runtime API**：组件间消息传递
>>>>>>> 858e6c22808de3b4df7868e01656fa22e7b1615f
