// components/ResumeLibrary.js
import { useState, Fragment } from 'react'; // Fragment 用于包裹多个元素
import BatchImportModal from './BatchimportModal'; // 批量导入功能
import ResumeDetailModal from './ResumeDetailModal'; // 我们将创建这个组件用于显示详情

// 简单的日期格式化函数 (可以替换为更强大的库如 date-fns)
function formatDate(dateString) 
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN'); // 格式如 2025/4/22
    } catch (e) {
        return dateString; // 格式化失败则返回原始字符串
    }
}

// 技能/工具标签组件
const SkillTag = ({ children }) => (
  <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full">
    {children}
  </span>
);

export default function ResumeLibrary({ activeTab, resumes, isLoading, error, dataSource, refreshResumes }) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null); // 批量导入成功消息

  // --- 新增：用于详情模态框的状态 ---
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  // --- 状态结束 ---

  // 处理批量导入成功的回调
  const handleImportSuccess = (importedResults) => {
    setImportSuccess(`成功导入 ${importedResults.length} 个简历`);
    refreshResumes(); // 刷新列表
    setTimeout(() => setImportSuccess(null), 3000); // 3秒后清除消息
  };

  // --- 新增：处理查看详情 ---
  const handleViewResume = (resume) => {
    setSelectedResume(resume); // 设置当前选中的简历
    setIsDetailModalOpen(true); // 打开模态框
  };

  // --- 新增：处理删除 (需要后端 API 支持) ---
  const handleDeleteResume = async (resume) => {
     if (window.confirm(`确定要删除 ${resume.name || '该'} 的简历吗？这个操作无法撤销。`)) {
         console.log('尝试删除简历:', resume.id);
         alert(`删除功能需要后端 API 支持。\n即将删除 ID: ${resume.id}`);
         // try {
         //   const response = await fetch(`/api/deleteResume?id=${resume.id}`, { method: 'DELETE' });
         //   if (!response.ok) {
         //     const errorData = await response.json();
         //     throw new Error(errorData.message || '删除失败');
         //   }
         //   alert('删除成功！');
         //   refreshResumes(); // 刷新列表
         // } catch (err) {
         //   console.error("删除简历失败:", err);
         //   alert(`删除失败: ${err.message}`);
         // }
     }
  };
   // --- 删除处理结束 ---

  // 如果当前 Tab 不是简历库，不渲染任何东西 (虽然父组件已经判断，但这里再确认一次)
  if (activeTab !== 'resumes') {
    return null;
  }

  return (
    <div className="p-1"> {/* 可以加一些内边距 */}
      {/* 标题和操作按钮 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <h2 className="text-xl font-semibold text-gray-800">
          简历库
          {dataSource && (
            <span className="text-sm text-gray-500 ml-2">
              (数据源: {dataSource} | 共 {resumes?.length || 0} 份)
            </span>
          )}
        </h2>
        <div className="flex space-x-2">
          <button
            className="text-sm px-4 py-2 border rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            onClick={refreshResumes}
            disabled={isLoading}
          >
            {isLoading ? '刷新中...' : '刷新列表'}
          </button>
          <button
            className="text-sm px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            onClick={() => setIsImportModalOpen(true)}
          >
            批量导入 PDF
          </button>
        </div>
      </div>

      {/* 导入成功提示 */}
      {importSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md shadow-sm">
          {importSuccess}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md shadow-sm">
          加载简历库时出错: {error}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500">正在加载简历库...</p>
        </div>
      )}

      {/* 简历表格 (非加载状态) */}
      {!isLoading && (
        <div className="overflow-x-auto shadow border-b border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* --- 更新表头 --- */}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前/最近职位</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总经验</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">核心技能 (部分)</th>
                {/* <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工具 (部分)</th> */}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上传日期</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resumes && resumes.length > 0 ? (
                resumes.map((resume) => (
                  <tr key={resume.id} className="hover:bg-gray-50 transition-colors duration-150">
                    {/* --- 更新表格数据列 --- */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{resume.name || 'N/A'}</div>
                       {/* 可以选择显示邮箱或电话 */}
                       <div className="text-xs text-gray-500">{resume.contact?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{resume.title || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {resume.totalYearsExperience !== null ? `${resume.totalYearsExperience} 年` : '未知'}
                    </td>
                    <td className="px-6 py-4">
                       {/* 使用 SkillTag 组件展示前 3 个核心技能 */}
                       <div className="flex flex-wrap">
                         {resume.coreSkills?.slice(0, 3).map((skill, i) => <SkillTag key={i}>{skill}</SkillTag>)}
                         {resume.coreSkills && resume.coreSkills.length > 3 && (
                           <span className="text-xs text-gray-400 self-center ml-1">+{resume.coreSkills.length - 3}</span>
                         )}
                         {(!resume.coreSkills || resume.coreSkills.length === 0) && <span className="text-xs text-gray-400 italic">无</span>}
                       </div>
                    </td>
                    {/*
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap">
                         {resume.tools?.slice(0, 3).map((tool, i) => <SkillTag key={i}>{tool}</SkillTag>)}
                         {resume.tools && resume.tools.length > 3 && (
                            <span className="text-xs text-gray-400 self-center ml-1">+{resume.tools.length - 3}</span>
                         )}
                         {(!resume.tools || resume.tools.length === 0) && <span className="text-xs text-gray-400 italic">无</span>}
                       </div>
                    </td>
                     */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{resume.source || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(resume.uploadDate)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                       {/* --- 操作按钮 --- */}
                       <button
                         onClick={() => handleViewResume(resume)}
                         className="text-indigo-600 hover:text-indigo-900 mr-3"
                       >
                         查看详情
                       </button>
                       <button
                         onClick={() => handleDeleteResume(resume)}
                         className="text-red-600 hover:text-red-900"
                       >
                         删除
                       </button>
                    </td>
                  </tr>
                ))
              ) : (
                // 空状态显示
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center">
                     <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                         <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                     </svg>
                     <h3 className="mt-2 text-sm font-medium text-gray-900">简历库当前为空</h3>
                     <p className="mt-1 text-sm text-gray-500">请先上传或批量导入简历。</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 批量导入模态框 */}
      <BatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* --- 新增：简历详情模态框 --- */}
      {selectedResume && (
          <ResumeDetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              resume={selectedResume}
          />
      )}
      {/* --- 模态框结束 --- */}

    </div>
  );
}