# 📊 评论洞察 (Comment Insight)

<p align="center">
  <img src="icons/icon128.png" alt="Comment Insight Logo" width="128" height="128">
</p>

<p align="center">
  <strong>一个功能强大的Chrome浏览器扩展，从主流社交媒体平台提取评论并通过AI进行深度分析</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3">
  <img src="https://img.shields.io/badge/chrome-88%2B-orange.svg" alt="Chrome 88+">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="License">
</p>

## 📝 项目简介

评论洞察是一款基于Chrome Manifest V3的浏览器扩展，专为内容创作者、市场分析师和社交媒体管理者设计。它能够从YouTube、TikTok、Instagram、Facebook、Twitter/X和哔哩哔哩等六大主流平台智能提取评论，并通过AI技术生成深度洞察报告，帮助用户快速理解用户反馈、把握舆论趋势、优化内容策略。

## ✨ 核心特性

### 🔍 **多平台评论提取**
- **YouTube**: 官方API提取，高效稳定
- **TikTok**: DOM解析，智能滚动加载
- **Instagram**: API + DOM混合模式
- **Facebook**: Graph API提取
- **Twitter/X**: API v2提取
- **哔哩哔哩**: 智能DOM穿透Shadow DOM

### 🤖 **AI智能分析**
- **情感分析**: 量化正面、中性、负面情感比例
- **主题识别**: 自动发现评论中反复出现的话题
- **趋势洞察**: 识别新兴的讨论模式和潜在热点
- **关键洞察**: 提炼用户讨论的核心观点和主要反馈
- **可操作建议**: 基于分析结果生成实用建议

### 📊 **数据导出**
- **多种格式**: CSV（评论数据）、Markdown（分析报告）、JSON（历史数据）
- **智能命名**: 自动生成`平台-标题-时间`格式文件名
- **灵活配置**: 可自定义导出格式和文件名模式

## 🚀 快速开始

### 📋 系统要求
- **浏览器**: Chrome 88+ 或基于Chromium的浏览器
- **操作系统**: Windows, macOS, Linux
- **网络**: 稳定的互联网连接（用于AI分析）

### 🔧 安装步骤

1. **获取源代码**
   ```bash
   git clone https://github.com/cyber-tao/CommentInsight.git
   cd CommentInsight
   ```

2. **打开Chrome扩展管理**
   - 地址栏输入：`chrome://extensions/`
   - 或通过：菜单 → 更多工具 → 扩展程序

3. **启用开发者模式**
   - 点击页面右上角的"开发者模式"开关

4. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择 `CommentInsight` 文件夹
   - 扩展图标将出现在工具栏中

### ⚙️ 初始配置

1. **配置AI服务**
   - 点击扩展图标 → 设置按钮
   - 选择AI服务提供商（OpenAI推荐）
   - 输入API密钥和端点
   - 测试连接确保配置正确

2. **配置平台API（可选）**
   - YouTube: 需要Google Cloud API密钥
   - Twitter/X: 需要开发者账户Bearer Token
   - 其他平台: 支持DOM提取，无需API

## 🎯 使用指南

### 基本工作流程

1. **打开社交媒体页面**（如YouTube视频页面）
2. **点击扩展图标**，确认平台检测成功
3. **点击"提取评论"**，等待评论收集完成
4. **点击"AI分析"**，获取智能洞察报告
5. **点击"查看分析"**，浏览详细结果并导出数据

## 🔒 隐私与安全

- **本地存储**: 所有数据存储在用户本地，不上传云端
- **加密保护**: 敏感配置（API密钥）采用加密存储
- **隐私保护**: AI分析时自动过滤个人身份信息
- **合规操作**: 严格遵守各平台服务条款和API政策

## 📄 许可证

本项目采用 **MIT 许可证**。

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个项目！

---

> 💫 **使用提示**: 使用本扩展时请遵守各平台的服务条款和API使用政策。尊重用户隐私，合理使用数据，只用于合法的分析目的。

<p align="center">
  <strong>🎆 感谢您使用评论洞察！如果觉得有用，请给我们一个⭐️！</strong>
</p>

**注意**: 使用本扩展时请遵守各平台的服务条款和API使用政策。 