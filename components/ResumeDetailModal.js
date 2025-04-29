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
    return null; // 如果模态框未打开或没有简历数据，不渲染
  }

  return (
    // 使用 fixed 定位和 z-index 来创建模态框覆盖效果
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      {/* 模态框内容 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">

         {/* 模态框头部 */}
         <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-lg flex justify-between items-center">
           <h3 className="text-lg font-semibold text-gray-900">
             简历详情 - {resume.name || 'N/A'}
           </h3>
           <button
             onClick={onClose}
             className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
           >
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
           </button>
         </div>

         {/* 模态框主体 (可滚动) */}
         <div className="p-6 space-y-6 overflow-y-auto flex-grow">

           {/* 基本信息 */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div><strong className="font-medium text-gray-700">姓名:</strong> {resume.name || 'N/A'}</div>
             <div><strong className="font-medium text-gray-700">最近职位:</strong> {resume.title || 'N/A'}</div>
             <div><strong className="font-medium text-gray-700">联系电话:</strong> {resume.contact?.phone || 'N/A'}</div>
             <div><strong className="font-medium text-gray-700">邮箱:</strong> {resume.contact?.email || 'N/A'}</div>
             <div><strong className="font-medium text-gray-700">总经验:</strong> {resume.totalYearsExperience !== null ? `${resume.totalYearsExperience} 年` : '未知'}</div>
             <div><strong className="font-medium text-gray-700">来源:</strong> {resume.source || 'N/A'}</div>
           </div>

            {/* 经验总结 */}
           {resume.experienceSummary && (
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-2 border-b pb-1">经验总结</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{resume.experienceSummary}</p>
                </div>
           )}

           {/* 分类技能展示 */}
            <div className="space-y-3">
               <h4 className="text-base font-semibold text-gray-800 mb-2 border-b pb-1">技能与工具</h4>
               {resume.coreSkills && resume.coreSkills.length > 0 && (
                  <div>
                     <h5 className="font-medium text-sm text-gray-600 mb-1">核心技能:</h5>
                     <div className="flex flex-wrap">
                       {resume.coreSkills.map((skill, i) => <SkillTag key={`core-${i}`} color="blue">{skill}</SkillTag>)}
                     </div>
                  </div>
               )}
                {resume.softSkills && resume.softSkills.length > 0 && (
                  <div>
                     <h5 className="font-medium text-sm text-gray-600 mb-1">软技能:</h5>
                     <div className="flex flex-wrap">
                       {resume.softSkills.map((skill, i) => <SkillTag key={`soft-${i}`} color="green">{skill}</SkillTag>)}
                     </div>
                  </div>
               )}
               {resume.processSkills && resume.processSkills.length > 0 && (
                  <div>
                     <h5 className="font-medium text-sm text-gray-600 mb-1">过程技能:</h5>
                     <div className="flex flex-wrap">
                       {resume.processSkills.map((skill, i) => <SkillTag key={`proc-${i}`} color="yellow">{skill}</SkillTag>)}
                     </div>
                  </div>
               )}
                {resume.tools && resume.tools.length > 0 && (
                  <div>
                     <h5 className="font-medium text-sm text-gray-600 mb-1">工具:</h5>
                     <div className="flex flex-wrap">
                       {resume.tools.map((tool, i) => <SkillTag key={`tool-${i}`} color="purple">{tool}</SkillTag>)}
                     </div>
                  </div>
               )}
            </div>


           {/* 教育背景 */}
            {resume.educationDetails && (resume.educationDetails.school || resume.educationDetails.degree) && (
                <div>
                    <h4 className="text-base font-semibold text-gray-800 mb-2 border-b pb-1">教育背景</h4>
                    <div className="text-sm text-gray-700">
                      <p><strong>学校:</strong> {resume.educationDetails.school || 'N/A'}</p>
                      <p><strong>专业:</strong> {resume.educationDetails.major || 'N/A'}</p>
                      <p><strong>学位:</strong> {resume.educationDetails.degree || 'N/A'}</p>
                    </div>
                </div>
            )}

           {/* 工作经历 */}
           {resume.experienceDetails && resume.experienceDetails.length > 0 && (
             <div>
               <h4 className="text-base font-semibold text-gray-800 mb-3 border-b pb-1">工作经历</h4>
               <div className="space-y-4">
                 {resume.experienceDetails.map((exp, index) => (
                   <div key={index} className="text-sm border-l-2 border-gray-200 pl-3">
                     <p className="font-semibold text-gray-800">{exp.title || 'N/A'} @ {exp.company || 'N/A'}</p>
                     <p className="text-xs text-gray-500 mb-1">{formatExperienceDate(exp.startDate, exp.endDate)}</p>
                     <p className="text-gray-600 whitespace-pre-wrap">{exp.description || '无详细描述'}</p>
                   </div>
                 ))}
               </div>
             </div>
           )}

            {/* 原始文本预览 */}
            {resume.rawTextPreview && (
                <div>
                    <h4 className="text-base font-semibold text-gray-800 mb-2 border-b pb-1">原始文本预览</h4>
                    <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-40 overflow-y-auto whitespace-pre-wrap">{resume.rawTextPreview}</p>
                </div>
            )}

         </div>

         {/* 模态框底部 (可选，可以放操作按钮) */}
         <div className="sticky bottom-0 bg-gray-50 px-6 py-3 border-t border-gray-200 rounded-b-lg flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              关闭
            </button>
         </div>

      </div>
    </div>
  );
}