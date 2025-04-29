// components/RecruitmentMatcher.js

import { useState, useEffect, useRef } from 'react';
import ResumeLibrary from './ResumeLibrary'; // 导入简历库组件
import ResumeDetailModal from './ResumeDetailModal'; // <--- 导入详情模态框

// 辅助函数：获取匹配度等级和颜色
const getMatchLevel = (score) => {
    score = Number(score) || 0; // 确保是数字
    if (score >= 80) return { text: '极高', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-500' };
    if (score >= 60) return { text: '良好', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-500' };
    if (score >= 40) return { text: '一般', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500' };
    return { text: '较低', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-500' };
};

// 技能/工具标签组件 (如果在多个地方用，可以抽离到单独文件)
const SkillTag = ({ children, type = 'match' }) => {
    let colors = 'bg-green-100 text-green-800'; // 默认匹配技能
    if (type === 'missing') {
        colors = 'bg-red-100 text-red-800';
    } else if (type === 'jd') {
        colors = 'bg-indigo-100 text-indigo-800';
    }
    return (
        <span className={`inline-block ${colors} text-xs font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full`}>
          {children}
        </span>
    );
};


export default function RecruitmentMatcher() {
  // --- 状态管理 ---
  const [jobDescription, setJobDescription] = useState(''); // JD 文本
  const [activeTab, setActiveTab] = useState('upload');     // 当前激活的 Tab ('upload', 'resumes', 'results')
  const [resumes, setResumes] = useState([]);              // 简历库数据
  const [matches, setMatches] = useState([]);              // 匹配结果数据
  const [jobRequirements, setJobRequirements] = useState(null); // 解析后的 JD 要求
  const [isLoadingResumes, setIsLoadingResumes] = useState(false); // 加载简历库状态
  const [isMatching, setIsMatching] = useState(false);       // 匹配进行中状态
  const [error, setError] = useState(null);                // 通用错误信息
  const [dataSource, setDataSource] = useState('');        // 简历库来源信息
  const [jobFile, setJobFile] = useState(null);            // 上传的 JD 文件对象
  const [isUploadingJD, setIsUploadingJD] = useState(false); // 上传 JD 文件状态

  // 简历上传相关状态
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResumeError, setUploadResumeError] = useState(null);
  const [uploadResumeSuccess, setUploadResumeSuccess] = useState(null);
  const resumeFileInputRef = useRef(null); // 简历文件输入框引用

  // --- 新增 State ---
  const [showAllMatches, setShowAllMatches] = useState(false); // 控制是否显示所有匹配结果
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); // 详情模态框是否打开
  const [selectedMatchForDetail, setSelectedMatchForDetail] = useState(null); // 当前要在模态框中显示的简历数据
  // --- 新增 State 结束 ---


  // --- 数据获取 ---
  const fetchResumes = async () => {
    setIsLoadingResumes(true);
    setError(null); // 清除旧错误
    setUploadResumeError(null); // 清除简历上传错误
    setUploadResumeSuccess(null); // 清除简历上传成功信息
    console.log("RecruitmentMatcher: 调用 fetchResumes 获取简历...");
    try {
      const response = await fetch('/api/fetchResumes');
      const data = await response.json();
       console.log("RecruitmentMatcher: fetchResumes 响应数据:", data);
      if (!response.ok) {
        throw new Error(data.error || data.message || `获取简历失败 (状态 ${response.status})`);
      }
      setResumes(data.resumes || []);
      setDataSource(data.source || (data.resumes?.length > 0 ? '未知' : '无数据'));
      if (data.error) {
          console.warn("RecruitmentMatcher: 获取简历 API 返回了错误信息:", data.error);
          // 可以选择性地设置错误状态
          // setError(`加载简历时遇到问题: ${data.error}`);
      }
    } catch (err) {
      console.error('RecruitmentMatcher: 获取简历失败:', err);
      setError(`无法加载简历库: ${err.message}`);
      setResumes([]);
      setDataSource('错误');
    } finally {
      setIsLoadingResumes(false);
    }
  };

  // 首次加载或切换到简历库时获取数据
  useEffect(() => {
    // 首次加载时就获取一次简历数据，以便“职位与匹配”Tab可以直接进行匹配
    fetchResumes();
  }, []); // 空依赖数组表示只在组件首次挂载时运行

  // --- 事件处理函数 ---

  // 处理 JD 文件选择
  const handleJobFileChange = (e) => {
     const file = e.target.files[0];
     if (!file) return;
     setError(null); // 清除错误

     // 文件类型和大小检查 (简化版，可根据需要增强)
     if (file.size > 10 * 1024 * 1024) {
        setError('职位描述文件大小不能超过 10MB');
        setJobFile(null); e.target.value = ''; return;
     }
     if (!['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
         setError('职位描述文件仅支持 PDF, TXT, DOC, DOCX');
         setJobFile(null); e.target.value = ''; return;
     }

     setJobFile(file);
     setIsUploadingJD(true); // 开始处理（这里只是前端状态，实际解析可能需要 API）

     // 尝试读取 TXT 内容；其他类型提示用户或调用 API 解析
     if (file.type === 'text/plain') {
         const reader = new FileReader();
         reader.onload = (event) => {
             setJobDescription(event.target.result);
             console.log(`从 TXT 文件 "${file.name}" 加载了职位描述。`);
             setIsUploadingJD(false);
         };
         reader.onerror = () => { setError(`读取文件 "${file.name}" 失败`); setIsUploadingJD(false); };
         reader.readAsText(file);
     } else {
         setJobDescription(`(请根据文件 "${file.name}" 的内容手动粘贴或编辑职位描述，或实现后端文件解析)`);
         console.warn("非 TXT 文件需要后端解析支持。");
         setIsUploadingJD(false);
     }
  };

  // 清除已选的 JD 文件
  const handleClearJobFile = () => {
    setJobFile(null);
    // setJobDescription(''); // 可选：是否清空文本框
    const jobFileInput = document.getElementById('job-file');
    if (jobFileInput) jobFileInput.value = '';
  };

  // 处理简历文件选择 (调用 API 上传)
  const handleResumeFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingResume(true);
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
    setError(null);

    // 文件类型和大小检查
    if (!['application/pdf', 'text/plain'].includes(file.type)) {
        setUploadResumeError('简历文件仅支持 PDF 和 TXT 格式');
        setIsUploadingResume(false);
        if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
        return;
     }
     if (file.size > 10 * 1024 * 1024) {
        setUploadResumeError('简历文件大小不能超过 10MB');
        setIsUploadingResume(false);
        if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
        return;
     }

    console.log("RecruitmentMatcher: 准备上传简历:", file.name);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/uploadAndSaveResume', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `上传失败 (状态 ${response.status})`);
      console.log("RecruitmentMatcher: 简历上传成功:", result);
      setUploadResumeSuccess(`简历 "${result.file?.name || file.name}" 上传并保存成功！`);
      fetchResumes(); // 上传成功后自动刷新简历列表
    } catch (err) {
      console.error("RecruitmentMatcher: 简历上传失败:", err);
      setUploadResumeError(`上传失败: ${err.message}`);
    } finally {
      setIsUploadingResume(false);
      if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
    }
  };

  // 触发简历文件选择
  const triggerResumeUpload = () => {
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
    if (resumeFileInputRef.current) resumeFileInputRef.current.click();
  };

  // 执行匹配
  const matchResumes = async () => {
    if (!jobDescription.trim()) { setError('请先输入或上传职位描述！'); return; }
    if (resumes.length === 0) { setError('简历库为空，无法进行匹配。请先上传简历。'); return; } // 增加简历库空检查

    setIsMatching(true);
    setError(null);
    setMatches([]);
    setJobRequirements(null);
    setShowAllMatches(false); // 重置展开状态

    console.log("RecruitmentMatcher: 开始匹配...");
    try {
      if (resumes.length === 0) {
           console.warn("RecruitmentMatcher: 尝试匹配时简历列表为空。");
           throw new Error("简历库为空，无法匹配。");
      }

      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumes }), // 将 JD 和当前简历列表发送给 API
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || `匹配请求失败 (状态 ${response.status})`);

      console.log("RecruitmentMatcher: 匹配成功，结果:", data);
      setMatches(data.matches || []);
      setJobRequirements(data.jobRequirements || null);
      setActiveTab('results'); // 成功后切换到结果页
    } catch (error) {
      console.error('RecruitmentMatcher: 匹配过程出错:', error);
      setError('匹配过程出错: ' + error.message);
      setActiveTab('upload'); // 出错时留在当前页
    } finally {
      setIsMatching(false);
    }
  };

  // --- 新增：打开详情模态框的处理函数 ---
  const handleViewMatchDetail = (matchData) => {
      // 假设 matchData 对象本身就包含了 ResumeDetailModal 所需的完整简历信息
      // 如果不是，你可能需要根据 matchData.id 或其他标识符从 resumes 状态中查找完整的简历对象
      // 例如: const fullResume = resumes.find(r => r.id === matchData.id);
      // 然后传递 fullResume 给 setSelectedMatchForDetail
      console.log("Opening detail for:", matchData.name || matchData.id);
      setSelectedMatchForDetail(matchData); // 设置要显示的简历数据 (确保此对象包含模态框所需的所有字段)
      setIsDetailModalOpen(true);
  };
  // --- 新增处理函数结束 ---


  // --- JSX 渲染 ---
  return (
    <div className="p-4 bg-gray-100 min-h-screen"> {/* 添加背景色和最小高度 */}
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden"> {/* 增加最大宽度 */}
        <div className="p-6 md:p-8"> {/* 增加内边距 */}
          {/* 标题和上传简历按钮 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 sm:mb-0">智能招聘匹配系统</h1>
            <div>
              <input
                type="file"
                ref={resumeFileInputRef}
                onChange={handleResumeFileChange}
                className="hidden"
                accept=".pdf,.txt"
              />
              <button
                onClick={triggerResumeUpload}
                className="bg-green-600 text-white font-semibold py-2 px-5 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 transition duration-150 ease-in-out"
                disabled={isUploadingResume}
              >
                {isUploadingResume ? '上传中...' : '上传简历'}
              </button>
            </div>
          </div>

          {/* 全局/通用错误显示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md shadow-sm">
              错误: {error}
            </div>
          )}
          {/* 简历上传状态显示 */}
           {uploadResumeError && (
             <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded-md shadow-sm">
               简历上传错误: {uploadResumeError}
             </div>
           )}
           {uploadResumeSuccess && (
             <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-200 rounded-md shadow-sm">
               {uploadResumeSuccess}
             </div>
           )}

          {/* Tab 导航 */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`py-3 px-5 text-sm font-medium transition-colors duration-150 ${activeTab === 'upload' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'}`}
              onClick={() => setActiveTab('upload')}
            >
              职位与匹配
            </button>
            <button
              className={`py-3 px-5 text-sm font-medium transition-colors duration-150 ${activeTab === 'resumes' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'}`}
              onClick={() => setActiveTab('resumes')}
            >
              简历库 ({resumes?.length || 0})
            </button>
            {matches.length > 0 && ( // 只有在有匹配结果时才显示结果Tab
                <button
                  className={`py-3 px-5 text-sm font-medium transition-colors duration-150 ${activeTab === 'results' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent'}`}
                  onClick={() => setActiveTab('results')}
                >
                  匹配结果 ({matches.length})
                </button>
            )}
          </div>

          {/* --- Tab 内容区域 --- */}
          <div className="mt-4">
            {/* 职位与匹配 Tab */}
            {activeTab === 'upload' && (
              <div className="space-y-6">
                {/* JD 输入 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="job-description-textarea">
                    职位描述 (JD)
                  </label>
                  <textarea
                    id="job-description-textarea"
                    className="w-full p-3 border border-gray-300 rounded-md h-48 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 shadow-sm"
                    placeholder="在此粘贴职位描述..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>

                {/* JD 文件上传 */}
                <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                     <label className="block text-sm font-semibold text-gray-700">
                       或上传 JD 文件
                     </label>
                     <span className="text-xs text-gray-500">支持: PDF, TXT, DOC, DOCX (最大 10MB)</span>
                   </div>
                   {!jobFile ? (
                     <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors duration-150">
                        <input type="file" id="job-file" accept=".pdf,.txt,.doc,.docx" onChange={handleJobFileChange} className="hidden" disabled={isUploadingJD} />
                        <label htmlFor="job-file" className={`cursor-pointer ${isUploadingJD ? 'cursor-not-allowed' : ''}`}>
                          <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                          <p className="mt-1 text-sm text-gray-600">
                             {isUploadingJD ? '处理中...' : <><span className="font-medium text-indigo-600 hover:text-indigo-500">点击选择文件</span> 或拖放到此处</>}
                          </p>
                        </label>
                     </div>
                   ) : (
                     <div className="flex items-center justify-between p-3 bg-indigo-50 rounded border border-indigo-200">
                       <div className="flex items-center space-x-2">
                          <svg className="h-6 w-6 text-indigo-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                          <div className="text-sm"><p className="font-medium text-gray-800">{jobFile.name}</p><p className="text-xs text-gray-500">{Math.round(jobFile.size / 1024)} KB</p></div>
                       </div>
                       <button type="button" className="text-gray-400 hover:text-red-600 focus:outline-none" onClick={handleClearJobFile} title="清除文件">
                         <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                       </button>
                     </div>
                   )}
                </div>

                {/* 匹配按钮 */}
                <div>
                  <button
                    className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition duration-150 ease-in-out"
                    onClick={matchResumes}
                    disabled={isMatching || !jobDescription.trim() || resumes.length === 0} // 匹配中、JD为空或简历库为空时禁用
                  >
                    {isMatching ? (
                       <div className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          匹配计算中...
                       </div>
                    ) : '开始智能匹配'}
                  </button>
                   {resumes.length === 0 && !isLoadingResumes && (
                       <p className="text-xs text-center text-red-600 mt-2">提示：简历库为空，请先“上传简历”。</p>
                   )}
                </div>
              </div>
            )}

            {/* 简历库 Tab */}
            {activeTab === 'resumes' && (
              <ResumeLibrary
                activeTab={activeTab}
                resumes={resumes}
                isLoading={isLoadingResumes}
                error={error} // 可以传递通用错误或简历库特定错误
                dataSource={dataSource}
                refreshResumes={fetchResumes}
              />
            )}

           {/* --- 匹配结果 Tab - 更新版 --- */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                 <h2 className="text-xl font-semibold text-gray-800 mb-1">匹配结果</h2>

                 {/* JD 要求回顾 (保持不变) */}
                 {jobRequirements && (
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm">
                      <h3 className="font-semibold text-lg mb-3 text-indigo-800">职位要求概览</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div className="col-span-1"><dt className="font-medium text-gray-600">目标职位:</dt><dd className="text-gray-900 mt-1">{jobRequirements.jobTitle || 'N/A'}</dd></div>
                        <div className="col-span-1"><dt className="font-medium text-gray-600">经验要求:</dt><dd className="text-gray-900 mt-1">{jobRequirements.yearsExperience || 'N/A'}</dd></div>
                        <div className="col-span-1"><dt className="font-medium text-gray-600">学历要求:</dt><dd className="text-gray-900 mt-1">{jobRequirements.educationLevel || 'N/A'}</dd></div>
                        <div className="col-span-1 md:col-span-2"><dt className="font-medium text-gray-600">必需技能:</dt>
                           <dd className="text-gray-900 mt-1 flex flex-wrap gap-1">
                             {jobRequirements.skills?.length > 0 ? jobRequirements.skills.map((s, i) => <SkillTag key={`jd-req-${i}`} type="jd">{s}</SkillTag>) : <span className="italic text-gray-500">无特定要求</span>}
                           </dd>
                        </div>
                         <div className="col-span-1 md:col-span-2"><dt className="font-medium text-gray-600">加分技能:</dt>
                           <dd className="text-gray-900 mt-1 flex flex-wrap gap-1">
                             {jobRequirements.preferredSkills?.length > 0 ? jobRequirements.preferredSkills.map((s, i) => <SkillTag key={`jd-pref-${i}`} type="jd">{s}</SkillTag>) : <span className="italic text-gray-500">无</span>}
                           </dd>
                        </div>
                      </dl>
                    </div>
                 )}

                 {/* 匹配结果列表 */}
                 {matches.length > 0 ? (
                   <>
                     {/* --- 根据状态决定显示前 5 个还是全部 --- */}
                     {(showAllMatches ? matches : matches.slice(0, 5)).map((match, index) => {
                       const matchLevel = getMatchLevel(match.matchScore);
                       return (
                         <div key={match.id || index} className={`border rounded-lg overflow-hidden shadow-sm transition-shadow duration-200 hover:shadow-lg border-l-4 ${matchLevel.borderColor}`}>
                           {/* 结果头部 (保持不变) */}
                           <div className={`flex items-center justify-between p-4 ${matchLevel.bgColor}`}>
                                <div className="flex items-center space-x-3">
                                   <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${matchLevel.color.replace('text-', 'bg-').replace('-600', '-100')} ring-2 ${matchLevel.color.replace('text-', 'ring-')}`}>
                                     <span className={`font-bold ${matchLevel.color}`}>{index + 1}</span>
                                   </span>
                                   <div>
                                       <h3 className="text-lg font-semibold text-gray-900">{match.name || '未知姓名'}</h3>
                                       <p className="text-sm text-gray-600">{match.title || '职位未知'}</p>
                                   </div>
                                </div>
                                <div className="text-right flex-shrink-0 pl-4">
                                  <div className={`text-2xl font-bold ${matchLevel.color}`}>{match.matchScore}%</div>
                                  <div className={`text-sm font-medium ${matchLevel.color}`}>{matchLevel.text}匹配</div>
                                </div>
                           </div>

                           {/* 结果详情 - AI 报告模式 */}
                           <div className="p-4 bg-white space-y-4">
                               {/* AI 核心摘要 */}
                               <div>
                                   <h4 className="font-semibold text-sm text-indigo-700 mb-1">AI 核心摘要:</h4>
                                   <p className="text-sm text-gray-800 font-medium">{match.matchDetails?.summary || 'N/A'}</p>
                               </div>
                               {/* 潜力与契合度评级 */}
                               <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                   <span>潜力评估: <strong className="font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{match.matchDetails?.potentialRating || 'N/A'}</strong></span>
                                   <span>创业公司契合度: <strong className="font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">{match.matchDetails?.startupFitRating || 'N/A'}</strong></span>
                               </div>
                               {/* 关键优势 */}
                               <div>
                                   <h4 className="font-semibold text-sm text-green-700 mb-2">关键优势 / 匹配点:</h4>
                                   {match.matchDetails?.keyStrengths && match.matchDetails.keyStrengths.length > 0 ? (
                                       <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.keyStrengths.map((strength, idx) => ( <li key={`s-${idx}`} className="text-sm text-gray-700"><span className="text-green-600 mr-1">✓</span>{strength}</li> ))}
                                       </ul>
                                   ) : (<p className="text-sm text-gray-500 italic">AI 未明确列出关键优势</p>)}
                               </div>
                               {/* 主要差距/风险点 */}
                               <div>
                                   <h4 className="font-semibold text-sm text-yellow-700 mb-2">主要差距 / 风险点:</h4>
                                   {match.matchDetails?.keyConcerns && match.matchDetails.keyConcerns.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.keyConcerns.map((concern, idx) => ( <li key={`c-${idx}`} className="text-sm text-gray-700"><span className="text-yellow-600 mr-1">⚠️</span>{concern}</li> ))}
                                       </ul>
                                   ) : (<p className="text-sm text-gray-500 italic">AI 未明确列出主要差距</p>)}
                               </div>
                               {/* 面试建议 */}
                               <div>
                                   <h4 className="font-semibold text-sm text-blue-700 mb-2">面试建议 / 考察方向:</h4>
                                    {match.matchDetails?.interviewFocusAreas && match.matchDetails.interviewFocusAreas.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.interviewFocusAreas.map((focus, idx) => ( <li key={`f-${idx}`} className="text-sm text-gray-700"><span className="text-blue-600 mr-1">→</span>{focus}</li> ))}
                                       </ul>
                                   ) : (<p className="text-sm text-gray-500 italic">AI 未提供具体面试建议</p>)}
                               </div>

                               {/* --- 新增：查看完整信息按钮 --- */}
                               <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end">
                                   <button
                                       onClick={() => handleViewMatchDetail(match)} // 点击时调用处理函数
                                       className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                   >
                                       查看完整信息 &rarr;
                                   </button>
                               </div>
                               {/* --- 新增按钮结束 --- */}

                               {/* 简历来源信息 */}
                               {match.Source && (
                                   <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                       来源: {match.Source} (ID: {match.id})
                                   </div>
                               )}
                           </div>
                         </div>
                       );
                     })}

                     {/* --- 添加展开/收起按钮 --- */}
                     {matches.length > 5 && (
                         <div className="text-center mt-6">
                             <button
                                 onClick={() => setShowAllMatches(!showAllMatches)}
                                 className="text-sm font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none"
                             >
                                 {showAllMatches ? '收起，仅显示前 5 个' : `展开查看全部 ${matches.length} 个结果...`}
                             </button>
                         </div>
                     )}
                     {/* --- 展开/收起按钮结束 --- */}
                   </>
                 ) : (
                    // 无匹配结果时的提示 (保持不变)
                    <div className="text-center py-10 border rounded-lg bg-gray-50">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">无匹配结果</h3>
                        <p className="mt-1 text-sm text-gray-500">请检查职位描述或尝试其他简历。</p>
                    </div>
                 )}
              </div>
            )}
           {/* --- 匹配结果 Tab 结束 --- */}

          </div> {/* End Tab 内容区域 */}

          {/* --- 添加简历详情模态框实例 --- */}
          {selectedMatchForDetail && (
              <ResumeDetailModal
                  isOpen={isDetailModalOpen}
                  onClose={() => setIsDetailModalOpen(false)}
                  // 将整个 match 对象传递给 modal，modal 内部需要能从中提取或访问 resume 的字段
                  // 确保 'selectedMatchForDetail' 包含 ResumeDetailModal 需要的所有简历信息
                  resume={selectedMatchForDetail}
              />
          )}
          {/* --- 模态框添加结束 --- */}

        </div> {/* End p-6 md:p-8 */}
      </div> {/* End max-w-5xl */}
    </div> // End p-4 bg-gray-100
  );
}