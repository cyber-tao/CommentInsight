/**
 * 数据诊断工具脚本
 */

// 获取所有存储的数据
async function loadAllData() {
    try {
        const data = await chrome.storage.local.get(null);
        displayData(data);
    } catch (error) {
        showError('加载数据失败: ' + error.message);
    }
}

// 显示数据
function displayData(data) {
    const keys = Object.keys(data);
    
    // 存储概览
    let overview = `<div class="status info">`;
    overview += `<strong>总键数:</strong> ${keys.length}<br>`;
    overview += `<strong>评论数据键:</strong> ${keys.filter(k => k.startsWith('comments_')).length}<br>`;
    overview += `<strong>历史记录:</strong> ${data.analysis_history ? data.analysis_history.length : 0} 条<br>`;
    
    // 计算评论总数
    let totalComments = 0;
    keys.filter(k => k.startsWith('comments_')).forEach(key => {
        if (data[key] && data[key].comments) {
            totalComments += data[key].comments.length;
        }
    });
    overview += `<strong>评论总数:</strong> ${totalComments} 条`;
    overview += `</div>`;
    
    document.getElementById('storage-overview').innerHTML = overview;

    // 所有键列表
    let keysList = '<table id="keys-table"><tr><th>键名</th><th>数据类型</th><th>大小</th><th>操作</th></tr>';
    keys.forEach(key => {
        const value = data[key];
        const type = Array.isArray(value) ? 'Array' : typeof value;
        const size = JSON.stringify(value).length;
        keysList += `<tr>
            <td>${key}</td>
            <td>${type}</td>
            <td>${(size / 1024).toFixed(2)} KB</td>
            <td>
                <button class="btn-view-key" data-key="${key}">查看</button>
                <button class="btn-delete-key danger" data-key="${key}">删除</button>
            </td>
        </tr>`;
    });
    keysList += '</table>';
    document.getElementById('all-keys').innerHTML = keysList;
    
    // 重新绑定事件（使用事件委托）
    attachKeyActions();

    // 原始数据
    document.getElementById('raw-data').textContent = JSON.stringify(data, null, 2);
}

// 显示当前页面的数据
async function showCurrentPageData() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const pageKey = generatePageKey(tab.url);
        const storageKey = `comments_${pageKey}`;
        
        console.log('当前标签页:', tab.url);
        console.log('生成的pageKey:', pageKey);
        console.log('存储键:', storageKey);
        
        const data = await chrome.storage.local.get(storageKey);
        
        if (data[storageKey]) {
            const pageData = data[storageKey];
            let html = `<div class="status success">`;
            html += `<strong>页面:</strong> ${pageData.title || '未知'}<br>`;
            html += `<strong>平台:</strong> ${pageData.platform || '未知'}<br>`;
            html += `<strong>URL:</strong> ${pageData.url}<br>`;
            html += `<strong>评论数:</strong> ${pageData.comments ? pageData.comments.length : 0}<br>`;
            html += `<strong>分析状态:</strong> ${pageData.analysis ? '已分析' : '未分析'}<br>`;
            html += `<strong>存储键:</strong> ${storageKey}<br>`;
            html += `<strong>时间戳:</strong> ${pageData.timestamp}`;
            html += `</div>`;
            
            if (pageData.comments && pageData.comments.length > 0) {
                html += `<h3>评论数据结构检查</h3>`;
                const firstComment = pageData.comments[0];
                const hasParentId = pageData.comments.every(c => 'parentId' in c);
                const hasId = pageData.comments.every(c => 'id' in c);
                
                // 统计不同的parentId值
                const parentIdCounts = {};
                pageData.comments.forEach(c => {
                    const pid = c.parentId === undefined ? 'undefined' : 
                                c.parentId === null ? 'null' : 
                                String(c.parentId);
                    parentIdCounts[pid] = (parentIdCounts[pid] || 0) + 1;
                });
                
                const mainComments = pageData.comments.filter(c => c.parentId === "0").length;
                const replies = pageData.comments.filter(c => c.parentId !== "0" && c.parentId).length;
                
                html += `<div class="status ${hasParentId && hasId ? 'success' : 'error'}">`;
                html += `<strong>是否有id字段:</strong> ${hasId ? '✅ 是' : '❌ 否'}<br>`;
                html += `<strong>是否有parentId字段:</strong> ${hasParentId ? '✅ 是' : '❌ 否'}<br>`;
                html += `<strong>主评论数 (parentId="0"):</strong> ${mainComments}<br>`;
                html += `<strong>回复数 (parentId!="0"):</strong> ${replies}<br>`;
                html += `<strong>⚠️ parentId值分布:</strong><br>`;
                html += `<pre style="max-height: 150px;">${JSON.stringify(parentIdCounts, null, 2)}</pre>`;
                html += `<strong>第一条评论示例:</strong><br>`;
                html += `<pre style="max-height: 200px;">${JSON.stringify(firstComment, null, 2)}</pre>`;
                html += `</div>`;
            }
            
            document.getElementById('current-page-data').innerHTML = html;
        } else {
            document.getElementById('current-page-data').innerHTML = 
                `<div class="status error">
                    当前页面没有保存的数据<br>
                    <strong>查找的键:</strong> ${storageKey}<br>
                    <strong>当前URL:</strong> ${tab.url}
                </div>`;
        }
    } catch (error) {
        showError('查看当前页数据失败: ' + error.message);
        console.error(error);
    }
}

// 绑定键操作的事件（使用事件委托）
function attachKeyActions() {
    const allKeysDiv = document.getElementById('all-keys');
    
    // 移除旧的监听器（如果有）
    const oldTable = allKeysDiv.querySelector('#keys-table');
    if (oldTable) {
        oldTable.removeEventListener('click', handleKeyAction);
        oldTable.addEventListener('click', handleKeyAction);
    }
}

// 处理键操作的点击事件
function handleKeyAction(e) {
    const target = e.target;
    
    if (target.classList.contains('btn-view-key')) {
        const key = target.getAttribute('data-key');
        viewKey(key);
    } else if (target.classList.contains('btn-delete-key')) {
        const key = target.getAttribute('data-key');
        deleteKey(key);
    }
}

// 查看特定键的数据
async function viewKey(key) {
    const data = await chrome.storage.local.get(key);
    const jsonStr = JSON.stringify(data[key], null, 2);
    
    // 创建一个模态框显示数据
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex;
        align-items: center; justify-content: center; z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 20px; border-radius: 8px;
        max-width: 80%; max-height: 80%; overflow: auto;
    `;
    content.innerHTML = `
        <h3>键: ${key}</h3>
        <pre style="max-height: 500px; overflow: auto;">${jsonStr}</pre>
        <button id="modal-close-btn">关闭</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 绑定关闭按钮事件
    const closeBtn = content.querySelector('#modal-close-btn');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 删除特定键
async function deleteKey(key) {
    if (confirm(`确定要删除键 "${key}" 吗？`)) {
        await chrome.storage.local.remove(key);
        await loadAllData();
        alert('✅ 已删除');
    }
}

// 清空所有数据
async function clearAllData() {
    if (confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) {
        await chrome.storage.local.clear();
        await loadAllData();
        alert('✅ 所有数据已清空');
    }
}

// 生成页面键（与popup.js中的逻辑一致）
function generatePageKey(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 16);
}

// 显示错误
function showError(message) {
    document.getElementById('storage-overview').innerHTML = 
        `<div class="status error">${message}</div>`;
}

// 导出到CSV
async function exportAllDataToCSV() {
    try {
        const data = await chrome.storage.local.get(null);
        const keys = Object.keys(data).filter(k => k.startsWith('comments_'));
        
        if (keys.length === 0) {
            alert('没有可导出的评论数据');
            return;
        }
        
        let csv = '平台,标题,URL,评论数,时间戳,存储键\n';
        
        keys.forEach(key => {
            const item = data[key];
            if (item) {
                csv += `"${item.platform || ''}",`;
                csv += `"${(item.title || '').replace(/"/g, '""')}",`;
                csv += `"${item.url || ''}",`;
                csv += `${item.comments ? item.comments.length : 0},`;
                csv += `"${item.timestamp || ''}",`;
                csv += `"${key}"\n`;
            }
        });
        
        // 下载CSV
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `CommentInsight-数据概览-${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        
        alert('✅ 数据概览已导出');
    } catch (error) {
        alert('导出失败: ' + error.message);
    }
}

// 页面加载时自动刷新数据
window.addEventListener('load', () => {
    console.log('🔍 数据诊断工具已加载');
    loadAllData();
});

// 清理孤立的评论数据（不在历史记录中的）
async function cleanOrphanedData() {
    try {
        const data = await chrome.storage.local.get(null);
        const history = data.analysis_history || [];
        
        // 获取历史记录中的所有dataKey
        const historyKeys = new Set();
        history.forEach(item => {
            if (item.dataKey) {
                historyKeys.add(`comments_${item.dataKey}`);
            }
        });
        
        // 找出所有评论数据键
        const allCommentKeys = Object.keys(data).filter(k => k.startsWith('comments_'));
        
        // 找出孤立的键（存在于存储中但不在历史记录中）
        const orphanedKeys = allCommentKeys.filter(k => !historyKeys.has(k));
        
        if (orphanedKeys.length === 0) {
            alert('✅ 没有发现孤立的数据');
            return;
        }
        
        const message = `发现 ${orphanedKeys.length} 个孤立的数据键（不在历史记录中）：\n\n${orphanedKeys.join('\n')}\n\n是否删除这些数据？`;
        
        if (confirm(message)) {
            await chrome.storage.local.remove(orphanedKeys);
            await loadAllData();
            alert(`✅ 已删除 ${orphanedKeys.length} 个孤立的数据键`);
        }
    } catch (error) {
        alert('清理失败: ' + error.message);
        console.error(error);
    }
}

// 导出函数到全局作用域
window.loadAllData = loadAllData;
window.showCurrentPageData = showCurrentPageData;
window.viewKey = viewKey;
window.deleteKey = deleteKey;
window.clearAllData = clearAllData;
window.exportAllDataToCSV = exportAllDataToCSV;
window.cleanOrphanedData = cleanOrphanedData;


