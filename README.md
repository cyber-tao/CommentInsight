# 评论洞察 (Comment Insight)

一个功能强大的Chrome浏览器扩展，能够从主流社交媒体平台提取评论并通过AI进行深度分析，生成结构化的洞察报告。

## 🌟 主要功能

### 📝 评论提取
- **YouTube**: 通过官方API提取视频评论
- **TikTok**: 通过DOM解析提取评论
- **Instagram**: 支持帖子评论提取
- **Facebook**: 支持帖子和视频评论
- **Twitter/X**: 支持推文回复提取

### 🤖 AI分析
- 使用OpenAI兼容的API进行智能分析
- 生成关键洞察和情感分析
- 识别主要主题和趋势
- 提供可操作的建议

### 📊 数据管理
- 多格式导出（CSV、Markdown、JSON）
- 分析历史记录管理
- 评论排序和搜索功能
- 分页显示大量数据

### ⚙️ 灵活配置
- 支持多种AI服务提供商
- 可自定义分析参数
- 平台特定配置选项
- 配置导入/导出功能

## 🚀 安装指南

### 方法一：开发者模式安装（推荐）

1. **下载源代码**
   ```bash
   git clone <repository-url>
   cd CommentInsight_Cursor
   ```

2. **打开Chrome扩展管理页面**
   - 在Chrome地址栏输入 `chrome://extensions/`
   - 或者点击菜单 → 更多工具 → 扩展程序

3. **启用开发者模式**
   - 点击右上角的"开发者模式"开关

4. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择项目文件夹
   - 扩展将自动安装并激活

### 方法二：打包安装

1. **打包扩展**
   - 在扩展管理页面点击"打包扩展程序"
   - 选择项目文件夹
   - 生成 `.crx` 文件

2. **安装打包文件**
   - 将 `.crx` 文件拖拽到扩展管理页面
   - 确认安装

## 🔧 配置指南

### AI服务配置

#### OpenAI
```json
{
  "endpoint": "https://api.openai.com/v1",
  "apiKey": "sk-your-api-key-here",
  "model": "gpt-3.5-turbo",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

#### Azure OpenAI
```json
{
  "endpoint": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
  "apiKey": "your-azure-api-key",
  "model": "gpt-35-turbo",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

#### 其他兼容服务
```json
{
  "endpoint": "https://your-compatible-api.com/v1",
  "apiKey": "your-api-key",
  "model": "your-model-name",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

### 平台API配置

#### YouTube Data API v3
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "YouTube Data API v3"
4. 创建API密钥
5. 在扩展配置中输入API密钥

```json
{
  "youtube": {
    "apiKey": "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX",
    "maxComments": 100
  }
}
```

#### Instagram Basic Display API
1. 访问 [Facebook Developers](https://developers.facebook.com/)
2. 创建应用程序
3. 配置Instagram Basic Display
4. 获取访问令牌

```json
{
  "instagram": {
    "token": "IGQVJYXXXXXXXXXXXXXXXXXXXXXXXX",
    "appId": "your-app-id"
  }
}
```

#### Facebook Graph API
```json
{
  "facebook": {
    "appId": "your-facebook-app-id",
    "appSecret": "your-app-secret"
  }
}
```

#### Twitter API v2
1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)
2. 创建开发者账户
3. 创建应用程序
4. 获取Bearer Token

```json
{
  "twitter": {
    "bearerToken": "AAAAAAAAAAAAAAAAAAAAAXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "apiVersion": "v2"
  }
}
```

## 📖 使用指南

### 基本使用流程

1. **打开支持的社交媒体平台**
   - 导航到包含评论的页面（视频、帖子等）

2. **点击扩展图标**
   - 扩展会自动检测当前平台
   - 显示平台信息和页面标题

3. **提取评论**
   - 点击"提取评论"按钮
   - 等待评论提取完成
   - 查看提取到的评论数量

4. **AI分析**
   - 点击"AI分析"按钮
   - 等待AI分析完成
   - 查看生成的洞察报告

5. **查看和导出**
   - 点击"查看评论"浏览所有评论
   - 点击"查看分析"查看AI分析结果
   - 点击"导出数据"保存分析结果

### 高级功能

#### 评论搜索和排序
- **搜索**: 在评论查看页面使用搜索框查找特定内容
- **排序**: 按时间、点赞数排序评论
- **分页**: 处理大量评论数据的分页显示

#### 历史记录管理
- 查看所有历史分析记录
- 按平台筛选历史记录
- 删除单个或清空所有历史记录

#### 配置管理
- 导出当前配置为JSON文件
- 导入之前保存的配置
- 测试AI连接状态
- 自动获取可用模型列表

## 🎯 最佳实践

### API使用建议

1. **合理设置请求限制**
   - YouTube: 建议最大评论数不超过1000
   - TikTok: 设置适当的延迟避免被限制
   - 其他平台: 根据API限制调整参数

2. **成本控制**
   - 选择合适的AI模型（GPT-3.5-turbo vs GPT-4）
   - 合理设置最大令牌数
   - 避免重复分析相同内容

3. **数据隐私**
   - 定期清理历史记录
   - 谨慎处理敏感评论内容
   - 遵守平台服务条款

### 分析质量优化

1. **提示词优化**
   - 根据分析目标调整系统提示词
   - 包含具体的分析要求
   - 指定输出格式

2. **参数调优**
   - **温度值**: 0.3-0.7适合分析任务
   - **最大令牌数**: 根据评论数量调整
   - **模型选择**: 复杂分析使用更先进的模型

## 🛠️ 故障排除

### 常见问题

#### 扩展无法加载
- 检查Chrome版本（需要88+）
- 确认开发者模式已启用
- 重新加载扩展

#### 评论提取失败
- **YouTube**: 检查API密钥和配额
- **TikTok**: 确认页面已完全加载
- **Instagram**: 验证访问令牌有效性
- **Facebook**: 检查应用权限设置
- **Twitter**: 确认Bearer Token正确

#### AI分析失败
- 验证API端点和密钥
- 检查网络连接
- 确认模型可用性
- 检查请求频率限制

#### 数据导出问题
- 检查浏览器下载权限
- 确认有足够的存储空间
- 验证数据格式完整性

### 错误代码说明

| 错误代码 | 描述 | 解决方案 |
|---------|------|----------|
| AUTH_001 | API密钥无效 | 检查并更新API密钥 |
| RATE_001 | 请求频率超限 | 等待后重试或调整请求间隔 |
| DATA_001 | 数据格式错误 | 检查平台页面格式 |
| NETWORK_001 | 网络连接失败 | 检查网络连接 |

## 🔒 隐私与安全

### 数据处理
- 所有数据本地存储在Chrome扩展存储中
- 不会上传评论内容到第三方服务器
- AI分析仅发送必要的文本内容

### API安全
- API密钥加密存储
- 支持安全的API端点（HTTPS）
- 遵循最小权限原则

### 权限说明
- `storage`: 保存配置和数据
- `activeTab`: 访问当前标签页内容
- `scripting`: 注入内容脚本
- `tabs`: 管理标签页

## 📊 支持的数据格式

### 导出格式

#### CSV格式（评论数据）
```csv
作者,内容,时间戳,点赞数,回复数
用户1,"这是一条评论",2024-01-01T10:00:00Z,5,2
用户2,"另一条评论",2024-01-01T11:00:00Z,3,0
```

#### Markdown格式（分析报告）
```markdown
# 评论分析报告

**生成时间**: 2024-01-01 10:00:00
**评论数量**: 100
**平台**: YouTube

## AI分析结果

### 关键洞察
1. 用户普遍对内容表示满意
2. 主要关注点集中在产品质量
3. 有较多技术相关讨论

### 情感分析
- 正面情感: 65%
- 中性情感: 25%
- 负面情感: 10%
```

#### JSON格式（完整数据）
```json
{
  "comments": [...],
  "analysis": {...},
  "platform": "youtube",
  "timestamp": "2024-01-01T10:00:00Z",
  "metadata": {...}
}
```

## 🤝 贡献指南

### 开发环境
1. Node.js 16+ (可选，用于开发工具)
2. Chrome 88+
3. 支持的操作系统：Windows, macOS, Linux

### 代码结构
```
CommentInsight_Cursor/
├── manifest.json          # 扩展配置文件
├── background.js          # 后台脚本
├── content.js            # 内容脚本
├── popup.html/js         # 弹出窗口
├── options.html/js       # 配置页面
├── viewer.html/js        # 查看器页面
├── icons/               # 图标文件
└── README.md           # 项目文档
```

### 提交规范
- 使用清晰的提交信息
- 遵循现有代码风格
- 添加适当的注释
- 测试新功能

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🆘 支持

如果您遇到问题或有建议，请：

1. 查阅本文档的故障排除部分
2. 搜索已知问题列表
3. 创建新的Issue描述问题
4. 提供详细的错误信息和复现步骤

## 🚀 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持5个主流社交媒体平台
- AI分析功能
- 多格式数据导出
- 配置管理系统

---

**注意**: 使用本扩展时请遵守各平台的服务条款和API使用政策。 