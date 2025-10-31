/**
 * 诊断工具初始化脚本
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔍 初始化数据诊断工具...');
    
    // 绑定按钮事件
    document.getElementById('btn-refresh').addEventListener('click', () => {
        console.log('🔄 刷新所有数据');
        loadAllData();
    });
    
    document.getElementById('btn-current-page').addEventListener('click', () => {
        console.log('📄 查看当前页数据');
        showCurrentPageData();
    });
    
    document.getElementById('btn-export').addEventListener('click', () => {
        console.log('💾 导出数据概览');
        exportAllDataToCSV();
    });
    
    document.getElementById('btn-clean-orphaned').addEventListener('click', () => {
        console.log('🧹 清理孤立数据');
        cleanOrphanedData();
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => {
        console.log('🗑️ 清空所有数据');
        clearAllData();
    });
    
    console.log('✅ 诊断工具初始化完成');
});


