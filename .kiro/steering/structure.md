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