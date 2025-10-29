/**
 * Markdown工具类 - 处理Markdown到HTML的转换
 */

class MarkdownUtils {
    /**
     * 将Markdown转换为HTML
     * @param {string} markdown - Markdown文本
     * @returns {string} HTML文本
     */
    static toHtml(markdown) {
        let safe = CommonUtils.escapeHtml(markdown || '');
        
        // 处理<br>标签
        safe = safe.replace(/&lt;br&gt;/g, '<br>');
        safe = safe.replace(/&lt;br\/>/g, '<br>');
        
        // 处理表格
        safe = this.processMarkdownTables(safe);
        
        // 处理<think>标签（AI思考内容）
        safe = safe.replace(/&lt;think&gt;/g, '<details class="mb-4 border border-gray-200 rounded-lg"><summary class="cursor-pointer p-3 bg-gray-50 font-medium">AI思考过程</summary><div class="p-3 border-t border-gray-200">');
        safe = safe.replace(/&lt;\/think&gt;/g, '</div></details>');
        
        // 处理details标签
        safe = safe.replace(/<details>/g, '<details class="mb-4 border border-gray-200 rounded-lg">');
        safe = safe.replace(/<summary>(.*?)<\/summary>/g, '<summary class="cursor-pointer p-3 bg-gray-50 font-medium">$1</summary><div class="p-3 border-t border-gray-200">');
        safe = safe.replace(/<\/details>/g, '</div></details>');
        
        // 处理粗体（需要在斜体之前处理）
        safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 处理斜体
        safe = safe.replace(/\*(.*?)\*/g, '<em class="text-gray-600">$1</em>');
        
        // 处理标题
        safe = safe.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>');
        safe = safe.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4">$1</h2>');
        safe = safe.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-10 mb-5">$1</h1>');
        
        // 处理分隔符（必须在列表之前处理，避免被误认为列表）
        safe = safe.replace(/^---+$/gm, '<hr class="my-6 border-t-2 border-gray-300">');
        safe = safe.replace(/^\*\*\*+$/gm, '<hr class="my-6 border-t-2 border-gray-300">');
        safe = safe.replace(/^___+$/gm, '<hr class="my-6 border-t-2 border-gray-300">');
        
        // 处理列表
        safe = safe.replace(/^\* (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/^- (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/<li>/g, '<ul class="list-disc list-inside mb-2"><li>');
        safe = safe.replace(/<\/li>/g, '</li></ul>');
        safe = safe.replace(/<\/ul><ul class="list-disc list-inside mb-2">/g, '');
        
        // 处理段落
        safe = safe.replace(/\n\n/g, '</p><p class="mb-4">');
        safe = safe.replace(/^(?!<[hlu])/gm, '<p class="mb-4">');
        safe = safe.replace(/(?<![hlu]>)$/gm, '</p>');
        
        return safe;
    }

    /**
     * 处理Markdown表格
     * @param {string} text - 文本
     * @returns {string}
     */
    static processMarkdownTables(text) {
        const lines = text.split('\n');
        const processedLines = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            // 检查是否是表格开始
            if (line.startsWith('|') && line.endsWith('|') && (line.match(/\|/g) || []).length >= 3) {
                const tableLines = [];
                
                // 收集连续的表格行
                while (i < lines.length) {
                    const currentLine = lines[i].trim();
                    if (currentLine.startsWith('|') && currentLine.endsWith('|') && (currentLine.match(/\|/g) || []).length >= 3) {
                        tableLines.push(currentLine);
                        i++;
                    } else {
                        // 检查是否是分隔行
                        if (currentLine.startsWith('|') && currentLine.endsWith('|') && 
                            currentLine.substring(1, currentLine.length - 1).split('|').every(cell => 
                                cell.trim() === '' || /^[-: ]+$/.test(cell.trim()))) {
                            i++;
                            continue;
                        }
                        break;
                    }
                }
                
                // 转换表格
                if (tableLines.length >= 1) {
                    const tableHtml = this.convertMarkdownTableToHtml(tableLines);
                    processedLines.push(tableHtml);
                } else {
                    processedLines.push(lines[i]);
                    i++;
                }
            } else {
                processedLines.push(lines[i]);
                i++;
            }
        }
        
        return processedLines.join('\n');
    }

    /**
     * 将Markdown表格转换为HTML表格
     * @param {Array<string>} tableLines - 表格行数组
     * @returns {string}
     */
    static convertMarkdownTableToHtml(tableLines) {
        if (tableLines.length < 2) return tableLines.join('\n');
        
        let tableHtml = '<table class="markdown-content">';
        let hasHeader = false;
        
        for (let i = 0; i < tableLines.length; i++) {
            const line = tableLines[i].trim();
            if (!line.startsWith('|') || !line.endsWith('|')) continue;
            
            const cells = line.substring(1, line.length - 1).split('|').map(cell => cell.trim());
            
            // 跳过分隔行
            if (i === 1 && cells.every(cell => /^[-: ]*$/.test(cell))) {
                continue;
            }
            
            // 第一行作为表头
            if (!hasHeader) {
                tableHtml += '<thead><tr>';
                cells.forEach(cell => {
                    tableHtml += `<th>${cell}</th>`;
                });
                tableHtml += '</tr></thead><tbody>';
                hasHeader = true;
            } else {
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${cell}</td>`;
                });
                tableHtml += '</tr>';
            }
        }
        
        tableHtml += hasHeader ? '</tbody></table>' : '</table>';
        return tableHtml;
    }

    /**
     * Markdown转义
     * @param {string} text - 文本
     * @returns {string}
     */
    static escape(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/`/g, '\\`')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_');
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.MarkdownUtils = MarkdownUtils;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownUtils;
}

