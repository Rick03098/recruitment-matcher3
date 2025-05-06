// components/RecruitmentMatcher.js

import { useState, useEffect, useRef } from 'react';
import ResumeLibrary from './ResumeLibrary'; // 导入简历库组件
import ResumeDetailModal from './ResumeDetailModal'; // 导入详情模态框

// 辅助函数：获取匹配度等级和颜色
const getMatchLevel = (score) => {
    score = Number(score) || 0; // 确保是数字
    if (score >= 80) return { text: '极高', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-500' };
    if (score >= 60) return { text: '良好', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-500' };
    if (score >= 40) return { text: '一般', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500' };
    return { text: '较低', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-500' };
};

// 技能/工具标签组件
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
  const [jobDescription, setJobDescription] = useState(''); // JD 文本 (来自输入或图片解析)
  const [activeTab, setActiveTab] = useState('upload');     // 当前激活的 Tab ('upload', 'resumes', 'results')
  const [resumes, setResumes] = useState([]);              // 简历库数据
  const [matches, setMatches] = useState([]);              // 匹配结果数据
  const [jobRequirements, setJobRequirements] = useState(null); // 解析后的 JD 要求 (来自文本或图片解析)
  const [isLoadingResumes, setIsLoadingResumes] = useState(false); // 加载简历库状态
  const [isMatching, setIsMatching] = useState(false);       // 匹配进行中状态
  const [error, setError] = useState(null);                // 通用错误信息 (包括 JD 上传错误)
  const [dataSource, setDataSource] = useState('');        // 简历库来源信息
  const [jobFile, setJobFile] = useState(null);            // 上传的 JD 文件对象
  const [isUploadingJD, setIsUploadingJD] = useState(false); // 上传 JD 文件状态 (包括图片)

  // 简历上传相关状态
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResumeError, setUploadResumeError] = useState(null);
  const [uploadResumeSuccess, setUploadResumeSuccess] = useState(null);
  const resumeFileInputRef = useRef(null); // 简历文件输入框引用

  // --- 详情模态框状态 ---
  const [showAllMatches, setShowAllMatches] = useState(false); // 控制是否显示所有匹配结果
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); // 详情模态框是否打开
  const [selectedMatchForDetail, setSelectedMatchForDetail] = useState(null); // 当前要在模态框中显示的简历数据


  // --- 数据获取 ---
  const fetchResumes = async () => {
    setIsLoadingResumes(true);
    setError(null); // 清除通用错误
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
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
      }
    } catch (err) {
      console.error('RecruitmentMatcher: 获取简历失败:', err);
      setError(`无法加载简历库: ${err.message}`); // 设置通用错误
      setResumes([]);
      setDataSource('错误');
    } finally {
      setIsLoadingResumes(false);
    }
  };

  // 首次加载获取简历
  useEffect(() => {
    fetchResumes();
  }, []);

  // --- 事件处理函数 ---

  // --- UPDATED: Handle JD File Change ---
  const handleJobFileChange = async (e) => { // Make the handler async
     const file = e.target.files[0];
     if (!file) return;
     setError(null); // Clear previous errors
     setJobFile(null); // Clear previous file state first
     setJobDescription(''); // Clear text area when a new file is selected
     setJobRequirements(null); // Clear previous structured requirements


     // --- Basic File Validation (Client-Side) ---
     if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('职位描述文件大小不能超过 10MB');
        e.target.value = ''; // Reset file input
        return;
     }

    const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif', // Added GIF just in case
    ];
    if (!allowedTypes.includes(file.type)) {
        setError('文件仅支持 PDF, TXT, DOC, DOCX, PNG, JPG, WEBP, GIF');
        e.target.value = ''; // Reset file input
        return;
    }
     // --- Validation End ---

    setJobFile(file); // Set the file state for UI feedback
    setIsUploadingJD(true); // Set loading state

    // --- Handle based on file type ---
    if (file.type === 'text/plain') {
        // Read TXT file directly in the browser
        const reader = new FileReader();
        reader.onload = (event) => {
            setJobDescription(event.target.result);
            console.log(`加载了 TXT 文件 "${file.name}" 的内容。`);
            setIsUploadingJD(false);
        };
        reader.onerror = () => {
            setError(`读取文件 "${file.name}" 失败`);
            setIsUploadingJD(false);
            setJobFile(null); // Clear file on error
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);

    } else if (file.type.startsWith('image/')) {
        // --- Handle Image Upload ---
        console.log(`准备上传并解析图片文件: ${file.name}`);
        const formData = new FormData();
        formData.append('jobFile', file); // Use 'jobFile' as the key expected by the backend API

        try {
            const response = await fetch('/api/uploadAndParseJD', { // Call the correct API endpoint
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || `图片处理失败 (状态 ${response.status})`);
            }

            console.log("图片处理成功:", result);
            // Update state with the results
            if (result.structuredData) {
                 setJobDescription(result.extractedText || ''); // Put derived/extracted text in text area for review
                 setJobRequirements(result.structuredData); // Store structured data
                 console.log("用从图片解析的结构化数据更新了 Job Requirements");
            } else {
                 setJobDescription(result.extractedText || '未能从图片中提取文本'); // Fallback to extracted text
                 setJobRequirements(null); // No structured data available
                 console.log("用从图片提取的纯文本更新了 Job Description");
            }
            // Optionally show a success message to the user here

        } catch (err) {
            console.error("处理图片文件时出错:", err);
            setError(`处理图片失败: ${err.message}`); // Set the general error state
            setJobFile(null); // Clear file on error
            e.target.value = ''; // Reset input
        } finally {
            setIsUploadingJD(false); // Reset loading state
        }
        // --- Image Handling End ---

    } else {
        // Handle PDF, DOC, DOCX (Currently not implemented on backend for JD)
        console.warn(`后端目前不支持解析 ${file.type} 类型的 JD 文件。`);
        // Provide feedback, but don't set an error that prevents manual input
        setJobDescription(`(文件 "${file.name}" 已选择。请手动粘贴内容或实现 ${file.type} 的后端解析)`);
        setIsUploadingJD(false); // Stop loading indicator for these types
        // Optionally set a *different* kind of non-blocking message if needed
    }
  };

  // --- UPDATED: Clear Job File ---
  const handleClearJobFile = () => {
    setJobFile(null);
    setJobDescription(''); // Clear the text area as well
    setJobRequirements(null); // Clear structured requirements
    setError(null); // Clear errors
    const jobFileInput = document.getElementById('job-file');
    if (jobFileInput) jobFileInput.value = ''; // Reset the file input element
  };

  // 处理简历文件选择 (调用 API 上传) - No changes needed here
  const handleResumeFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingResume(true);
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
    setError(null); // Clear general error

    // File type and size check for resumes
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
      fetchResumes(); // Refresh resume list
    } catch (err) {
      console.error("RecruitmentMatcher: 简历上传失败:", err);
      setUploadResumeError(`上传失败: ${err.message}`);
    } finally {
      setIsUploadingResume(false);
      if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
    }
  };

  // 触发简历文件选择 - No changes needed
  const triggerResumeUpload = () => {
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
    if (resumeFileInputRef.current) resumeFileInputRef.current.click();
  };

  // 执行匹配 - No changes needed in basic logic, but uses updated state
  const matchResumes = async () => {
    // Use jobDescription (text) as primary input for matching API
    if (!jobDescription.trim()) {
        setError('请先输入或上传有效的职位描述！'); // More general error
        return;
    }
    if (resumes.length === 0) { setError('简历库为空，无法进行匹配。请先上传简历。'); return; }

    setIsMatching(true);
    setError(null);
    setMatches([]);
    // We might already have jobRequirements from image upload, but the matching API
    // often re-parses the jobDescription text for consistency.
    // Let the /api/match endpoint handle JD parsing based on the text.
    // setJobRequirements(null); // Optionally clear here or let API response overwrite
    setShowAllMatches(false);

    console.log("RecruitmentMatcher: 开始匹配...");
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumes }), // Send current text JD and resumes
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || `匹配请求失败 (状态 ${response.status})`);

      console.log("RecruitmentMatcher: 匹配成功，结果:", data);
      setMatches(data.matches || []);
      // Update jobRequirements based on the matching API's parsing,
      // this ensures consistency if the text was edited after image upload.
      setJobRequirements(data.jobRequirements || null);
      setActiveTab('results'); // Switch to results
    } catch (error) {
      console.error('RecruitmentMatcher: 匹配过程出错:', error);
      setError('匹配过程出错: ' + error.message); // Set general error
      setActiveTab('upload'); // Stay on upload tab on error
    } finally {
      setIsMatching(false);
    }
  };

  // 打开详情模态框 - No changes needed
  const handleViewMatchDetail = (matchData) => {
      console.log("Opening detail for:", matchData.name || matchData.id);
      setSelectedMatchForDetail(matchData);
      setIsDetailModalOpen(true);
  };


  // --- JSX 渲染 ---
  // Determine if the match button should be enabled
  const canMatch = !isMatching && (!!jobDescription.trim() || !!jobRequirements) && resumes.length > 0;

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 md:p-8">
          {/* 标题和上传简历按钮 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 sm:mb-0">智能招聘匹配系统</h1>
            <div>
              <input
                type="file"
                ref={resumeFileInputRef}
                onChange={handleResumeFileChange}
                className="hidden"
                accept=".pdf,.txt" // Accept only PDF/TXT for resumes
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

          {/* 全局/通用错误显示 (Now includes JD upload errors) */}
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
            {matches.length > 0 && ( // Show results tab only if matches exist
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
                    placeholder="在此粘贴职位描述，或上传文件..."
                    value={jobDescription}
                    onChange={(e) => {
                        setJobDescription(e.target.value);
                        // If user types manually, clear any requirements derived from a previous file upload
                        if (jobFile || jobRequirements) {
                             setJobRequirements(null);
                             // Optionally clear jobFile as well, or leave it to show which file was last used
                             // setJobFile(null);
                        }
                    }}
                  />
                </div>

                {/* JD 文件上传 */}
                <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                     <label className="block text-sm font-semibold text-gray-700">
                       或上传 JD 文件
                     </label>
                     <span className="text-xs text-gray-500">支持: PDF, TXT, DOC(X), 图片 (最大 10MB)</span>
                   </div>

                   {/* File Input and Dropzone Area */}
                   <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors duration-150">
                      <input
                          type="file"
                          id="job-file" // Ensure this ID matches getElementById in handleClearJobFile
                          // UPDATED accept attribute
                          accept=".pdf,.txt,.doc,.docx,image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleJobFileChange}
                          className="hidden"
                          disabled={isUploadingJD} // Use the specific loading state
                      />
                      <label htmlFor="job-file" className={`cursor-pointer ${isUploadingJD ? 'cursor-not-allowed opacity-50' : ''}`}>
                          <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                          {/* UPDATED loading text */}
                          <p className="mt-1 text-sm text-gray-600">
                              {isUploadingJD ? '上传和处理中...' : <><span className="font-medium text-indigo-600 hover:text-indigo-500">点击选择文件</span> 或拖放到此处</>}
                          </p>
                      </label>
                   </div>

                   {/* UPDATED File Preview and Clear Button - Conditional Rendering */}
                   {jobFile && (
                       <div className="flex items-center justify-between p-3 bg-indigo-50 rounded border border-indigo-200 mt-4">
                           <div className="flex items-center space-x-2">
                               {/* Simple File Icon */}
                               <svg className="h-6 w-6 text-indigo-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                               <div className="text-sm">
                                   <p className="font-medium text-gray-800">{jobFile.name}</p>
                                   <p className="text-xs text-gray-500">{Math.round(jobFile.size / 1024)} KB</p>
                               </div>
                           </div>
                           {/* UPDATED Clear Button */}
                           <button type="button" className="text-gray-400 hover:text-red-600 focus:outline-none" onClick={handleClearJobFile} title="清除文件" disabled={isUploadingJD}>
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
                    // UPDATED disabled condition
                    disabled={!canMatch}
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
                   {/* Hint if matching is disabled due to missing JD */}
                   {!jobDescription.trim() && !jobRequirements && !isUploadingJD && (
                       <p className="text-xs text-center text-yellow-600 mt-2">提示：请输入或上传职位描述以启用匹配。</p>
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
                error={error} // Pass general error here as well
                dataSource={dataSource}
                refreshResumes={fetchResumes}
              />
            )}

           {/* 匹配结果 Tab */}
            {activeTab === 'results' && (
              <div className="space-y-6">
                 <h2 className="text-xl font-semibold text-gray-800 mb-1">匹配结果</h2>

                 {/* JD 要求回顾 */}
                 {jobRequirements && ( // Show this section if jobRequirements is populated (from text or image)
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 shadow-sm">
                      <h3 className="font-semibold text-lg mb-3 text-indigo-800">职位要求概览</h3>
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        {/* Adapt these fields based on the structure returned by your /api/match or /api/uploadAndParseJD */}
                        <div className="col-span-1"><dt className="font-medium text-gray-600">目标职位:</dt><dd className="text-gray-900 mt-1">{jobRequirements.jobTitle || 'N/A'}</dd></div>
                        <div className="col-span-1"><dt className="font-medium text-gray-600">经验要求:</dt><dd className="text-gray-900 mt-1">{jobRequirements.yearsExperience || 'N/A'}</dd></div>
                        <div className="col-span-1"><dt className="font-medium text-gray-600">学历要求:</dt><dd className="text-gray-900 mt-1">{jobRequirements.educationLevel || 'N/A'}</dd></div>
                        <div className="col-span-1 md:col-span-2"><dt className="font-medium text-gray-600">必需技能:</dt>
                           <dd className="text-gray-900 mt-1 flex flex-wrap gap-1">
                             {/* Use requiredSkills OR skills depending on API response */}
                             {(jobRequirements.requiredSkills || jobRequirements.skills)?.length > 0
                                ? (jobRequirements.requiredSkills || jobRequirements.skills).map((s, i) => <SkillTag key={`jd-req-${i}`} type="jd">{s}</SkillTag>)
                                : <span className="italic text-gray-500">无特定要求</span>}
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
                     {(showAllMatches ? matches : matches.slice(0, 5)).map((match, index) => {
                       const matchLevel = getMatchLevel(match.matchScore);
                       return (
                         <div key={match.id || index} className={`border rounded-lg overflow-hidden shadow-sm transition-shadow duration-200 hover:shadow-lg border-l-4 ${matchLevel.borderColor}`}>
                           {/* 结果头部 */}
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
                               {match.matchDetails?.summary && (
                                   <div>
                                       <h4 className="font-semibold text-sm text-indigo-700 mb-1">AI 核心摘要:</h4>
                                       <p className="text-sm text-gray-800 font-medium">{match.matchDetails.summary}</p>
                                   </div>
                               )}
                               <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                   {match.matchDetails?.potentialRating && <span>潜力评估: <strong className="font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">{match.matchDetails.potentialRating}</strong></span>}
                                   {match.matchDetails?.startupFitRating && <span>创业公司契合度: <strong className="font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">{match.matchDetails.startupFitRating}</strong></span>}
                               </div>
                               {match.matchDetails?.keyStrengths && match.matchDetails.keyStrengths.length > 0 && (
                                   <div>
                                       <h4 className="font-semibold text-sm text-green-700 mb-2">关键优势 / 匹配点:</h4>
                                       <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.keyStrengths.map((strength, idx) => ( <li key={`s-${idx}`} className="text-sm text-gray-700"><span className="text-green-600 mr-1">✓</span>{strength}</li> ))}
                                       </ul>
                                   </div>
                               )}
                               {match.matchDetails?.keyConcerns && match.matchDetails.keyConcerns.length > 0 && (
                                   <div>
                                       <h4 className="font-semibold text-sm text-yellow-700 mb-2">主要差距 / 风险点:</h4>
                                       <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.keyConcerns.map((concern, idx) => ( <li key={`c-${idx}`} className="text-sm text-gray-700"><span className="text-yellow-600 mr-1">⚠️</span>{concern}</li> ))}
                                       </ul>
                                   </div>
                               )}
                               {match.matchDetails?.interviewFocusAreas && match.matchDetails.interviewFocusAreas.length > 0 && (
                                   <div>
                                       <h4 className="font-semibold text-sm text-blue-700 mb-2">面试建议 / 考察方向:</h4>
                                        <ul className="list-disc list-inside space-y-1">
                                           {match.matchDetails.interviewFocusAreas.map((focus, idx) => ( <li key={`f-${idx}`} className="text-sm text-gray-700"><span className="text-blue-600 mr-1">→</span>{focus}</li> ))}
                                       </ul>
                                   </div>
                               )}

                               {/* 查看完整信息按钮 */}
                               <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end">
                                   <button
                                       onClick={() => handleViewMatchDetail(match)}
                                       className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                   >
                                       查看完整信息 &rarr;
                                   </button>
                               </div>

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

                     {/* 展开/收起按钮 */}
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
                   </>
                 ) : (
                    // 无匹配结果时的提示
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

          {/* 简历详情模态框 */}
          {selectedMatchForDetail && (
              <ResumeDetailModal
                  isOpen={isDetailModalOpen}
                  onClose={() => setIsDetailModalOpen(false)}
                  resume={selectedMatchForDetail}
              />
          )}

        </div> {/* End p-6 md:p-8 */}
      </div> {/* End max-w-5xl */}
    </div> // End p-4 bg-gray-100
  );
}