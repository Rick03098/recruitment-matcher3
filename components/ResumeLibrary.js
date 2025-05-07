// components/ResumeLibrary.js
import { useState, Fragment, useMemo } from 'react'; // Fragment 用于包裹多个元素
import BatchImportModal from './BatchimportModal'; // 批量导入功能 (确保文件名大小写正确)
import ResumeDetailModal from './ResumeDetailModal'; // 我们将创建这个组件用于显示详情
import BlueWaveLogoLoader from './BlueWaveLogoLoader'; // 导入 BlueWaveLogoLoader 组件

// 简单的日期格式化函数 (可以替换为更强大的库如 date-fns)
function formatDate(dateString) { // <--- 添加了缺失的 {
    if (!dateString) {          // <--- 为 if 语句添加了 { }
        return 'N/A';
    }
    try {
        const date = new Date(dateString);
        // 检查日期是否有效
        if (isNaN(date.getTime())) {
             console.warn(`[formatDate] Received invalid date string: ${dateString}`);
             return '日期无效'; // 或者返回原始字符串，或 'N/A'
        }
        return date.toLocaleDateString('zh-CN'); // 格式如 2025/4/22
    } catch (e) {
        console.error(`[formatDate] Error formatting date string "${dateString}":`, e);
        return dateString; // 格式化失败则返回原始字符串
    }
} // <--- 函数的结尾 }

// 技能/工具标签组件
const SkillTag = ({ children }) => (
  <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full">
    {children}
  </span>
);

export default function ResumeLibrary({ resumes, isLoading, error, onRefresh, onStartMatching }) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedResume, setSelectedResume] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 搜索过滤逻辑
  const filteredResumes = useMemo(() => {
    if (!searchQuery.trim()) return resumes;
    
    const query = searchQuery.toLowerCase().trim();
    return resumes?.filter(resume => {
      // 搜索姓名
      if (resume.name?.toLowerCase().includes(query)) return true;
      // 搜索邮箱
      if (resume.contact?.email?.toLowerCase().includes(query)) return true;
      // 搜索职位
      if (resume.title?.toLowerCase().includes(query)) return true;
      // 搜索技能
      if (Array.isArray(resume.coreSkills)) {
        if (resume.coreSkills.some(skill => skill.toLowerCase().includes(query))) return true;
      }
      // 搜索教育背景
      if (resume.education?.some(edu => 
        edu.school?.toLowerCase().includes(query) || 
        edu.major?.toLowerCase().includes(query)
      )) return true;
      // 搜索工作经验
      if (resume.experience?.some(exp => 
        exp.company?.toLowerCase().includes(query) || 
        exp.position?.toLowerCase().includes(query)
      )) return true;
      
      return false;
    }) || [];
  }, [resumes, searchQuery]);

  const handleImportSuccess = (importedResults) => {
    setImportSuccess(`成功导入 ${importedResults.length} 个简历`);
    onRefresh();
    setTimeout(() => setImportSuccess(null), 3000);
  };

  const handleViewResume = (resume) => {
    setSelectedResume(resume);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">简历库</h2>
          <p className="mt-1 text-sm text-gray-500">
            共 {filteredResumes?.length || 0} 份简历
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? '刷新中...' : '刷新列表'}
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            批量导入
          </button>
          {resumes && resumes.length > 0 && (
            <button
              onClick={onStartMatching}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              开始匹配
            </button>
          )}
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索姓名、技能、公司、学校..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* 状态提示 */}
      {importSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{importSuccess}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">加载简历库时出错: {error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {/* 已移除内部加载动画，由父组件统一控制 */}
      
      {/* 简历列表 */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredResumes && filteredResumes.length > 0 ? (
            filteredResumes.map((resume) => (
              <div
                key={resume?.id || JSON.stringify(resume)}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{resume.name || 'N/A'}</h3>
                      <p className="text-sm text-gray-500">{resume.contact?.email || ''}</p>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {resume.totalYearsExperience ? `${resume.totalYearsExperience} 年经验` : '经验未知'}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-900">{resume.title || '职位未知'}</p>
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">核心技能</h4>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.isArray(resume.coreSkills) && resume.coreSkills.slice(0, 3).map((skill, i) => (
                          <SkillTag key={i}>{skill}</SkillTag>
                        ))}
                        {Array.isArray(resume.coreSkills) && resume.coreSkills.length > 3 && (
                          <span className="text-xs text-gray-400">+{resume.coreSkills.length - 3}</span>
                        )}
                        {(!Array.isArray(resume.coreSkills) || resume.coreSkills.length === 0) && (
                          <span className="text-xs text-gray-400 italic">无</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {formatDate(resume.uploadDate)}
                    </div>
                    <button
                      onClick={() => handleViewResume(resume)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchQuery ? '没有找到匹配的简历' : '暂无简历'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery ? '尝试使用其他关键词搜索' : '开始上传简历以建立您的简历库。'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 模态框 */}
      <BatchImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {selectedResume && (
        <ResumeDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          resume={selectedResume}
        />
      )}
    </div>
  );
}