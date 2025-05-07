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
    } else if (file.type === 'application/pdf') {
        // 新增PDF自动提取
        const formData = new FormData();
        formData.append('jobFile', file);
        try {
            const response = await fetch('/api/parseJDFile', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || `PDF解析失败 (状态 ${response.status})`);
            }
            setJobDescription(result.text || '');
        } catch (err) {
            setError(`PDF解析失败: ${err.message}`);
            setJobFile(null);
            e.target.value = '';
        } finally {
            setIsUploadingJD(false);
        }
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
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">简历匹配系统</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'upload'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                上传JD
              </button>
              <button
                onClick={() => setActiveTab('resumes')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'resumes'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                简历库
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'results'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                匹配结果
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* 原有的内容 */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* JD上传部分 */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">上传职位描述</h3>
                  <input
                    type="file"
                    onChange={handleJobFileChange}
                    className="hidden"
                    id="jobFileInput"
                    accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif"
                  />
                  <label
                    htmlFor="jobFileInput"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                  >
                    选择文件
                  </label>
                  <p className="mt-2 text-sm text-gray-500">
                    支持 PDF, TXT, DOC, DOCX, PNG, JPG, WEBP, GIF 格式
                  </p>
                </div>
              </div>

              {/* 文本输入区域 */}
              <div className="mt-6">
                <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  职位描述文本
                </label>
                <textarea
                  id="jobDescription"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="在此输入或粘贴职位描述..."
                />
              </div>

              {/* 开始匹配按钮 */}
              <div className="flex justify-end">
                <button
                  onClick={matchResumes}
                  disabled={!jobDescription.trim() || resumes.length === 0 || isMatching}
                  className={`inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
                    ${(!jobDescription.trim() || resumes.length === 0 || isMatching)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isMatching ? '匹配中...' : '开始匹配'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'resumes' && (
            <ResumeLibrary
              resumes={resumes}
              isLoading={isLoadingResumes}
              error={error}
              onRefresh={fetchResumes}
              onStartMatching={() => {
                setActiveTab('upload');
                // 如果已经有职位描述，自动开始匹配
                if (jobDescription.trim()) {
                  matchResumes();
                }
              }}
            />
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              {/* 匹配结果展示 */}
              {matches.length > 0 ? (() => {
                // 按分数降序排序
                const sortedMatches = [...matches].sort((a, b) => (b.score || 0) - (a.score || 0));
                const topMatches = sortedMatches.slice(0, 5);
                const restMatches = sortedMatches.slice(5);
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {topMatches.map((match, index) => {
                        const matchLevel = getMatchLevel(match.score);
                        const initials = match.name ? match.name[0].toUpperCase() : 'U';
                        return (
                          <div
                            key={index}
                            className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col h-full p-6 hover:shadow-2xl transition-shadow"
                          >
                            {/* 顶部信息区 */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                                  {initials}
                                </div>
                                <div>
                                  <div className="text-lg font-semibold text-gray-900">{match.name || 'N/A'}</div>
                                  <div className="text-sm text-gray-500">{match.title || '职位未知'} · {match.totalYearsExperience ? `${match.totalYearsExperience}年经验` : '经验未知'}</div>
                                </div>
                              </div>
                              <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full ${matchLevel.bgColor} border-4 ${matchLevel.borderColor} shadow text-center`}>
                                <span className={`text-xl font-bold ${matchLevel.color}`}>{match.score}%</span>
                                <span className={`text-xs ${matchLevel.color}`}>{matchLevel.text}</span>
                              </div>
                            </div>

                            {/* 技能区 */}
                            <div className="mb-4">
                              <div className="mb-1 text-xs text-gray-500 font-medium">匹配技能</div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {match.matchingSkills && match.matchingSkills.length > 0 ? (
                                  match.matchingSkills.map((skill, i) => (
                                    <SkillTag key={i} type="match">{skill}</SkillTag>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400 italic">无</span>
                                )}
                              </div>
                              <div className="mb-1 text-xs text-gray-500 font-medium">缺失技能</div>
                              <div className="flex flex-wrap gap-2">
                                {match.missingSkills && match.missingSkills.length > 0 ? (
                                  match.missingSkills.map((skill, i) => (
                                    <SkillTag key={i} type="missing">{skill}</SkillTag>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400 italic">无</span>
                                )}
                              </div>
                            </div>

                            {/* 联系方式区 */}
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                              {match.email && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                  {match.email}
                                </span>
                              )}
                              {match.phone && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                  {match.phone}
                                </span>
                              )}
                            </div>

                            {/* 操作区 */}
                            <div className="flex justify-end mt-auto">
                              <button
                                onClick={() => handleViewMatchDetail(match)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow"
                              >
                                查看详情
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* 查看更多按钮 */}
                    {!showAllMatches && restMatches.length > 0 && (
                      <div className="flex justify-center mt-6">
                        <button
                          onClick={() => setShowAllMatches(true)}
                          className="px-6 py-2 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          查看更多（{restMatches.length}）
                        </button>
                      </div>
                    )}
                    {/* 展开后显示剩余候选人 */}
                    {showAllMatches && restMatches.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {restMatches.map((match, index) => {
                          const matchLevel = getMatchLevel(match.score);
                          const initials = match.name ? match.name[0].toUpperCase() : 'U';
                          return (
                            <div
                              key={index}
                              className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col h-full p-6 hover:shadow-2xl transition-shadow"
                            >
                              {/* 顶部信息区 */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="text-lg font-semibold text-gray-900">{match.name || 'N/A'}</div>
                                    <div className="text-sm text-gray-500">{match.title || '职位未知'} · {match.totalYearsExperience ? `${match.totalYearsExperience}年经验` : '经验未知'}</div>
                                  </div>
                                </div>
                                <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full ${matchLevel.bgColor} border-4 ${matchLevel.borderColor} shadow text-center`}>
                                  <span className={`text-xl font-bold ${matchLevel.color}`}>{match.score}%</span>
                                  <span className={`text-xs ${matchLevel.color}`}>{matchLevel.text}</span>
                                </div>
                              </div>

                              {/* 技能区 */}
                              <div className="mb-4">
                                <div className="mb-1 text-xs text-gray-500 font-medium">匹配技能</div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {match.matchingSkills && match.matchingSkills.length > 0 ? (
                                    match.matchingSkills.map((skill, i) => (
                                      <SkillTag key={i} type="match">{skill}</SkillTag>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">无</span>
                                  )}
                                </div>
                                <div className="mb-1 text-xs text-gray-500 font-medium">缺失技能</div>
                                <div className="flex flex-wrap gap-2">
                                  {match.missingSkills && match.missingSkills.length > 0 ? (
                                    match.missingSkills.map((skill, i) => (
                                      <SkillTag key={i} type="missing">{skill}</SkillTag>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">无</span>
                                  )}
                                </div>
                              </div>

                              {/* 联系方式区 */}
                              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                {match.email && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    {match.email}
                                  </span>
                                )}
                                {match.phone && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    {match.phone}
                                  </span>
                                )}
                              </div>

                              {/* 操作区 */}
                              <div className="flex justify-end mt-auto">
                                <button
                                  onClick={() => handleViewMatchDetail(match)}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow"
                                >
                                  查看详情
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })() : (
                <div className="text-center py-12">
                  <p className="text-gray-500">暂无匹配结果</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 简历详情模态框 */}
      {selectedMatchForDetail && (
          <ResumeDetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              resume={selectedMatchForDetail}
          />
      )}
    </div>
  );
}