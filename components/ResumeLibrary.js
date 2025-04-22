import { useState, useEffect } from 'react';
import BatchImportModal from './BatchImportModal';

export default function ResumeLibrary({ activeTab, resumes, isLoading, error, dataSource, refreshResumes }) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  
  // 处理批量导入成功
  const handleImportSuccess = async (importedResumes) => {
    try {
      // 这里可以调用API将导入的简历添加到数据库
      // 简化起见，仅显示成功消息
      setImportSuccess(`成功导入 ${importedResumes.length} 个简历`);
      
      // 刷新简历列表
      if (refreshResumes) {
        refreshResumes();
      }
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setImportSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('保存导入简历失败:', error);
    }
  };
  
  // 查看简历详情
  const handleViewResume = (resume) => {
    // 在实际应用中，可以打开模态框显示简历详情
    console.log('查看简历:', resume);
    alert(`查看简历: ${resume.name}`);
  };
  
  // 删除简历
  const handleDeleteResume = (resume) => {
    // 在实际应用中，可以调用API删除简历
    if (confirm(`确定要删除 ${resume.name} 的简历吗？`)) {
      console.log('删除简历:', resume);
      alert(`已删除: ${resume.name}`);
      
      // 刷新简历列表
      if (refreshResumes) {
        refreshResumes();
      }
    }
  };
  
  if (activeTab !== 'resumes') {
    return null;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          简历库
          {dataSource && (
            <span className="text-sm text-gray-500 ml-2">
              (数据源: {dataSource})
            </span>
          )}
        </h2>
        
        <div className="flex space-x-2">
          <button 
            className="text-sm px-3 py-1 border rounded text-gray-600 hover:bg-gray-50"
            onClick={refreshResumes}
            disabled={isLoading}
          >
            {isLoading ? '刷新中...' : '刷新'}
          </button>
          <button 
            className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={() => setIsImportModalOpen(true)}
          >
            批量导入PDF
          </button>
        </div>
      </div>
      
      {importSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {importSuccess}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : resumes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">姓名</th>
                <th className="px-4 py-2 text-left">技能</th>
                <th className="px-4 py-2 text-left">经验</th>
                <th className="px-4 py-2 text-left">来源</th>
                <th className="px-4 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {resumes.map((resume, index) => (
                <tr key={resume.id || index} className="border-t">
                  <td className="px-4 py-2">{resume.name || '未知'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {resume.skills && Array.isArray(resume.skills) ? 
                        resume.skills.slice(0, 3).map((skill, i) => (
                          <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {skill}
                          </span>
                        )) : 
                        <span className="text-gray-500">无技能信息</span>
                      }
                      {resume.skills && Array.isArray(resume.skills) && resume.skills.length > 3 && (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                          +{resume.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {resume.experience || '未知'}
                  </td>
                  <td className="px-4 py-2">
                    {resume.fileSource ? (
                      <span className="flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 5V1H7.97a2 2 0 00-2 2v18a2 2 0 002 2h9.06a2 2 0 002-2V8h-4a2 2 0 01-2-2zM9 17a1 1 0 110-2h6a1 1 0 110 2H9zm0-4a1 1 0 110-2h6a1 1 0 110 2H9z" />
                          <path d="M14 1v5a1 1 0 001 1h5l-6-6z" />
                        </svg>
                        PDF文件
                      </span>
                    ) : (
                      <span>手动输入</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button 
                      className="text-xs text-blue-500 hover:text-blue-700 mr-2"
                      onClick={() => handleViewResume(resume)}
                    >
                      查看
                    </button>
                    <button 
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteResume(resume)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded border">
          <p className="text-gray-500">暂无简历数据</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setIsImportModalOpen(true)}
          >
            批量导入PDF简历
          </button>
        </div>
      )}
      
      {/* 批量导入模态框 */}
      <BatchImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
