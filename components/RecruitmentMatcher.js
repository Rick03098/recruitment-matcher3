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
  const handleJobFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件大小
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过10MB');
      return;
    }

    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('不支持的文件类型，请上传PDF、TXT或图片文件');
      return;
    }

    setJobFile(file);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('jobFile', file);

      // 统一：无论图片还是PDF都只请求/api/parseJDFile
      const response = await fetch('/api/parseJDFile', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '文件上传失败');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '文件处理失败');
      }

      setJobDescription(data.data.text || '');
      if (data.data.structuredData) {
        setJobRequirements(data.data.structuredData);
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      setError(error.message || '文件处理失败');
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
    setShowAllMatches(false);

    console.log("RecruitmentMatcher: 开始匹配...");
    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resumes }),
      });
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('服务器返回了非预期格式（可能超时或出错），请稍后重试或联系管理员');
      }
      if (!response.ok) throw new Error(data?.error || data?.message || `匹配请求失败 (状态 ${response.status})`);

      console.log("RecruitmentMatcher: 匹配成功，结果:", data);
      setMatches(data.matches || []);
      setJobRequirements(data.jobRequirements || null);
      setActiveTab('results');
    } catch (error) {
      console.error('RecruitmentMatcher: 匹配过程出错:', error);
      setError('匹配过程出错: ' + error.message);
      setActiveTab('upload');
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
                    {isUploadingJD ? '处理中...' : '选择文件'}
                  </label>
                  <p className="mt-2 text-sm text-gray-500">
                    支持 PDF, TXT, DOC, DOCX, PNG, JPG, WEBP, GIF 格式
                  </p>
                </div>
              </div>

              {/* 文件预览和结构化数据展示 */}
              {jobFile && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <svg className="h-6 w-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{jobFile.name}</span>
                    </div>
                    <button
                      onClick={handleClearJobFile}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      清除
                    </button>
                  </div>
                </div>
              )}

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

              {/* 结构化数据展示 */}
              {jobRequirements && (
                <div className="mt-6 p-4 bg-white border rounded-lg shadow-sm">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">解析结果</h4>
                  <div className="space-y-4">
                    {jobRequirements.jobTitle && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">职位名称</h5>
                        <p className="mt-1 text-sm text-gray-900">{jobRequirements.jobTitle}</p>
                      </div>
                    )}
                    {jobRequirements.requiredSkills?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">必备技能</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-gray-900">
                          {jobRequirements.requiredSkills.map((skill, index) => (
                            <li key={index}>{skill}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {jobRequirements.preferredSkills?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">优先技能</h5>
                        <ul className="mt-1 list-disc list-inside text-sm text-gray-900">
                          {jobRequirements.preferredSkills.map((skill, index) => (
                            <li key={index}>{skill}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {jobRequirements.yearsExperience && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">工作经验要求</h5>
                        <p className="mt-1 text-sm text-gray-900">{jobRequirements.yearsExperience}</p>
                      </div>
                    )}
                    {jobRequirements.educationLevel && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700">学历要求</h5>
                        <p className="mt-1 text-sm text-gray-900">{jobRequirements.educationLevel}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

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
                // 只展示前6名
                const sortedMatches = [...matches].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
                const topMatches = sortedMatches.slice(0, 6);
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 justify-center">
                      {topMatches.map((match, index) => {
                        const matchLevel = getMatchLevel(match.matchScore);
                        const initials = match.name ? match.name[0].toUpperCase() : 'U';
                        return (
                          <div
                            key={index}
                            className="bg-white rounded-3xl shadow-xl p-8 flex flex-col h-full border border-gray-100 hover:shadow-2xl transition-all duration-200 ease-in-out hover:-translate-y-1 hover:scale-[1.025]"
                            style={{ fontFamily: '-apple-system,BlinkMacSystemFont,\'San Francisco\',\'PingFang SC\',\'Segoe UI\',Arial,sans-serif' }}
                          >
                            {/* 顶部信息区 */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-3xl font-bold text-blue-600 shadow-inner">
                                  {initials}
                                </div>
                                <div>
                                  <div className="text-xl font-semibold text-gray-900 tracking-tight">{match.name || 'N/A'}</div>
                                  <div className="text-base text-gray-500">{match.title || '职位未知'} · {match.totalYearsExperience ? `${match.totalYearsExperience}年经验` : '经验未知'}</div>
                                </div>
                              </div>
                              <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full ${matchLevel.bgColor} border-4 ${matchLevel.borderColor} shadow text-center`}>
                                <span className={`text-2xl font-bold ${matchLevel.color}`}>{match.matchScore}%</span>
                                <span className={`text-sm ${matchLevel.color}`}>{matchLevel.text}</span>
                              </div>
                            </div>

                            {/* AI一句话总结 */}
                            {match.matchDetails?.summary && (
                              <div className="text-base font-medium text-blue-900 mb-3 bg-blue-50 rounded-xl px-3 py-2 shadow-sm">{match.matchDetails.summary}</div>
                            )}

                            {/* 关键优势 */}
                            {match.matchDetails?.keyStrengths?.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-green-700 font-bold mb-1">关键优势</div>
                                <div className="flex flex-wrap gap-2">
                                  {match.matchDetails.keyStrengths.map((item, i) => (
                                    <span key={i} className="inline-block bg-green-50 text-green-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm">{item}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 关键劣势 */}
                            {match.matchDetails?.keyConcerns?.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-red-700 font-bold mb-1">关键劣势</div>
                                <div className="flex flex-wrap gap-2">
                                  {match.matchDetails.keyConcerns.map((item, i) => (
                                    <span key={i} className="inline-block bg-red-50 text-red-800 text-xs font-medium px-3 py-1 rounded-full shadow-sm">{item}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 面试建议 */}
                            {match.matchDetails?.interviewFocusAreas?.length > 0 && (
                              <div className="mt-4 border-t pt-4">
                                <div className="text-xs text-blue-700 font-bold mb-1">面试建议</div>
                                <ul className="list-disc list-inside text-blue-800 text-sm">
                                  {match.matchDetails.interviewFocusAreas.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 联系方式区 */}
                            <div className="flex items-center gap-4 text-sm text-gray-400 mt-6 mb-2">
                              {match.email && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                  {match.email}
                                </span>
                              )}
                              {match.phone && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                  {match.phone}
                                </span>
                              )}
                            </div>

                            {/* 操作区 */}
                            <div className="flex justify-end mt-auto">
                              <button
                                onClick={() => handleViewMatchDetail(match)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow transition-all duration-150"
                              >
                                查看详情
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })() : (
                <div className="text-center text-gray-400 py-12 text-lg">暂无匹配结果</div>
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