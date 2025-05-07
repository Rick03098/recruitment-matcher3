// components/ResumeDetailModal.js
import { Fragment } from 'react'; // 用于渲染列表

// 简单的标签组件 (可以从 ResumeLibrary 导入或在这里重新定义)
const SkillTag = ({ children, color = 'indigo' }) => (
  <span className={`inline-block bg-<span class="math-inline">\{color\}\-100 text\-</span>{color}-800 text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full`}>
    {children}
  </span>
);

// 格式化日期范围的辅助函数
function formatExperienceDate(startDate, endDate) {
    const start = startDate ? startDate : '?';
    const end = endDate ? (endDate.toLowerCase() === 'present' ? '至今' : endDate) : '?';
    return `${start} - ${end}`;
}


export default function ResumeDetailModal({ isOpen, onClose, resume }) {
  if (!isOpen || !resume) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* 模态框头部 */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-lg flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {resume.name || 'N/A'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{resume.title || '职位未知'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 模态框主体 */}
        <div className="p-6 space-y-8 overflow-y-auto flex-grow">
          {/* 基本信息卡片 */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">联系方式</h4>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center text-sm text-gray-900">
                      <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {resume.contact?.email || 'N/A'}
                    </div>
                    <div className="flex items-center text-sm text-gray-900">
                      <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {resume.contact?.phone || 'N/A'}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">工作经验</h4>
                  <p className="mt-2 text-sm text-gray-900">
                    {resume.totalYearsExperience !== null ? `${resume.totalYearsExperience} 年` : '未知'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">来源</h4>
                  <p className="mt-2 text-sm text-gray-900">{resume.source || 'N/A'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">上传时间</h4>
                  <p className="mt-2 text-sm text-gray-900">{resume.uploadDate || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 经验总结 */}
          {resume.experienceSummary && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">经验总结</h4>
              <p className="text-gray-600 whitespace-pre-wrap">{resume.experienceSummary}</p>
            </div>
          )}

          {/* 技能展示 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-6">技能与工具</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {resume.coreSkills && resume.coreSkills.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-3">核心技能</h5>
                  <div className="flex flex-wrap gap-2">
                    {resume.coreSkills.map((skill, i) => (
                      <SkillTag key={`core-${i}`} color="blue">{skill}</SkillTag>
                    ))}
                  </div>
                </div>
              )}
              {resume.softSkills && resume.softSkills.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-3">软技能</h5>
                  <div className="flex flex-wrap gap-2">
                    {resume.softSkills.map((skill, i) => (
                      <SkillTag key={`soft-${i}`} color="green">{skill}</SkillTag>
                    ))}
                  </div>
                </div>
              )}
              {resume.processSkills && resume.processSkills.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-3">过程技能</h5>
                  <div className="flex flex-wrap gap-2">
                    {resume.processSkills.map((skill, i) => (
                      <SkillTag key={`proc-${i}`} color="yellow">{skill}</SkillTag>
                    ))}
                  </div>
                </div>
              )}
              {resume.tools && resume.tools.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-500 mb-3">工具</h5>
                  <div className="flex flex-wrap gap-2">
                    {resume.tools.map((tool, i) => (
                      <SkillTag key={`tool-${i}`} color="purple">{tool}</SkillTag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 教育背景 */}
          {resume.educationDetails && (resume.educationDetails.school || resume.educationDetails.degree) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">教育背景</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-gray-900">{resume.educationDetails.school || 'N/A'}</span>
                </div>
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-gray-900">{resume.educationDetails.degree || 'N/A'}</span>
                </div>
                {resume.educationDetails.major && (
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-gray-900">{resume.educationDetails.major}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 工作经历 */}
          {resume.experienceDetails && resume.experienceDetails.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-6">工作经历</h4>
              <div className="space-y-6">
                {resume.experienceDetails.map((exp, index) => (
                  <div key={index} className="relative pl-8 pb-6 last:pb-0">
                    <div className="absolute left-0 top-0 w-4 h-4 bg-blue-100 rounded-full border-2 border-blue-500"></div>
                    <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-gray-200"></div>
                    <div>
                      <h5 className="text-lg font-medium text-gray-900">{exp.title || 'N/A'}</h5>
                      <p className="text-sm text-gray-500">{exp.company || 'N/A'}</p>
                      <p className="text-sm text-gray-500 mt-1">{formatExperienceDate(exp.startDate, exp.endDate)}</p>
                      <p className="mt-2 text-gray-600 whitespace-pre-wrap">{exp.description || '无详细描述'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 原始文本预览 */}
          {resume.rawTextPreview && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">原始文本预览</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {resume.rawTextPreview}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 模态框底部 */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}