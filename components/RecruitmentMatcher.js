// components/RecruitmentMatcher.js

import { useState, useEffect, useRef } from 'react'; // 确保导入 useRef
// Link 可能不再需要直接用于“上传简历”，但可能用于其他地方，先保留 import
import Link from 'next/link';
// 导入 ResumeLibrary 和 BatchImportModal (如果它们在本文件使用的话，根据原文件结构决定)
// 注意：原文件中 ResumeLibrary 组件似乎未在此处直接使用，而是通过 activeTab 控制显示不同内容
// import ResumeLibrary from './ResumeLibrary';
// import BatchImportModal from './BatchImportModal';

export default function RecruitmentMatcher() {
  // --- 现有状态 ---
  const [jobDescription, setJobDescription] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 默认显示上传 JD 界面
  const [resumes, setResumes] = useState([]);
  const [matches, setMatches] = useState([]);
  const [jobRequirements, setJobRequirements] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // 用于加载简历库
  const [isMatchLoading, setIsMatchLoading] = useState(false); // 用于匹配过程
  const [error, setError] = useState(null); // 通用错误状态
  const [dataSource, setDataSource] = useState('');
  const [jobFile, setJobFile] = useState(null); // 用于上传 JD 文件
  const [isPdfUploading, setIsPdfUploading] = useState(false); // 用于 JD 文件上传状态

  // --- 新增：简历上传相关状态 ---
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResumeError, setUploadResumeError] = useState(null);
  const [uploadResumeSuccess, setUploadResumeSuccess] = useState(null);
  const resumeFileInputRef = useRef(null); // 用于触发简历文件选择

  // --- 获取简历数据逻辑 (基本不变) ---
  const fetchResumes = async () => {
    // if (activeTab !== 'resumes') return; // 在匹配时也需要获取最新简历，所以注释掉此判断或调整逻辑

    try {
      setIsLoading(true);
      setError(null); // 清除之前的错误

      console.log("尝试从 /api/fetchResumes 获取简历...");
      const response = await fetch('/api/fetchResumes');
      const data = await response.json();
      console.log("获取简历结果:", data);

      if (!response.ok) {
        // 如果响应状态不是 2xx，也视为错误
         throw new Error(data.error || data.message || `获取简历失败 (状态 ${response.status})`);
      }

      if (data.resumes) {
        setResumes(data.resumes);
        setDataSource(data.source || '未知');
      } else {
        // 如果成功响应但没有 resumes 字段，也设置为空数组
        setResumes([]);
        setDataSource(data.source || '无数据');
      }

      // 如果 API 在成功响应中也返回错误信息 (之前代码是这样处理的)
      if (data.error) {
         console.warn("获取简历 API 返回了错误信息:", data.error);
         // 可以选择在这里设置错误状态，或者仅记录日志
         // setError(`加载简历时遇到问题: ${data.error}`);
      }
    } catch (err) {
      console.error('获取简历失败:', err);
      setError(`无法加载简历库: ${err.message}`);
      setResumes([]); // 出错时清空简历
      setDataSource('错误');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件加载时或者切换到简历库 Tab 时获取简历
  useEffect(() => {
    if (activeTab === 'resumes') {
      fetchResumes();
    }
    // 考虑在页面加载时就获取一次简历数据，以便匹配时使用
    // fetchResumes(); // 如果希望一开始就加载
  }, [activeTab]);


  // --- 处理 JD 文件上传逻辑 (基本不变) ---
  const handleJobFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null); // 清除通用错误

    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
      setError('职位描述文件仅支持 PDF, DOC, DOCX 和 TXT 格式');
      setJobFile(null); // 清除无效文件
      e.target.value = ''; // 清空 input
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('职位描述文件大小不能超过 10MB');
      setJobFile(null);
      e.target.value = '';
      return;
    }

    setJobFile(file);
    setIsPdfUploading(true); // 可以重命名这个状态或保持不变

    // TODO: 这里可以添加将 JD 文件内容提取到 jobDescription state 的逻辑
    // 例如调用一个新的 API /api/parseJobDescriptionFile
    // 或者，简单地读取文本内容（如果是 txt）
    if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (event) => {
            setJobDescription(event.target.result);
            console.log(`从 TXT 文件 "${file.name}" 加载了职位描述。`);
            setIsPdfUploading(false);
        };
        reader.onerror = () => {
            setError(`读取文件 "${file.name}" 失败`);
            setIsPdfUploading(false);
        };
        reader.readAsText(file);
    } else {
        // 对于 PDF/Word，需要后端解析，暂时先只显示文件名
        setJobDescription(`(请根据文件 "${file.name}" 的内容手动粘贴或编辑职位描述)`);
        // 实际应用中，这里应该调用后端API来解析文件内容
        console.warn("PDF/DOCX 文件预览需要后端解析支持，当前仅显示文件名。");
        setIsPdfUploading(false); // 假设后端解析会很快或异步完成
    }
  };

  // --- 新增：处理简历文件上传 ---
  const handleResumeFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 重置简历上传相关的状态
    setIsUploadingResume(true);
    setUploadResumeError(null);
    setUploadResumeSuccess(null);
    setError(null); // 同时清除通用错误

     // 文件类型和大小检查
     if (!['application/pdf', 'text/plain'].includes(file.type)) {
        setUploadResumeError('简历文件仅支持 PDF 和 TXT 格式');
        setIsUploadingResume(false);
        if (resumeFileInputRef.current) resumeFileInputRef.current.value = ''; // 清空选择
        return;
     }
     if (file.size > 10 * 1024 * 1024) { // 10MB Limit
        setUploadResumeError('简历文件大小不能超过 10MB');
        setIsUploadingResume(false);
        if (resumeFileInputRef.current) resumeFileInputRef.current.value = '';
        return;
     }

    console.log("准备上传简历:", file.name);
    const formData = new FormData();
    formData.append('file', file); // 后端 API /api/uploadAndSaveResume 期待的字段名是 'file'

    try {
      // 调用后端 API
      const response = await fetch('/api/uploadAndSaveResume', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // 抛出错误，包含从后端获取的消息
        throw new Error(result.message || `上传失败 (状态 ${response.status})`);
      }

      console.log("简历上传并处理成功:", result);
      setUploadResumeSuccess(`简历 "${result.file?.name || file.name}" 上传并保存成功！`);

      // 上传成功后，自动刷新简历库列表
      // 注意：如果此时不在 'resumes' tab，用户可能看不到更新，但数据已在后端
       fetchResumes(); // 调用获取简历函数刷新列表

    } catch (err) {
      console.error("简历上传失败:", err);
      setUploadResumeError(`上传失败: ${err.message}`);
    } finally {
      setIsUploadingResume(false);
      // 清空<input>的值，以便用户可以再次上传同一个文件
      if (resumeFileInputRef.current) {
          resumeFileInputRef.current.value = '';
      }
    }
  };

  // 新增：触发隐藏的文件选择框
  const triggerResumeUpload = () => {
    setUploadResumeError(null); // 清除之前的上传错误
    setUploadResumeSuccess(null);
    if (resumeFileInputRef.current) {
      resumeFileInputRef.current.click();
    }
  };


  // --- 匹配简历逻辑 (基本不变, 但确保匹配前获取最新简历) ---
  const matchResumes = async () => {
    if (!jobDescription.trim()) {
      setError('请先输入或上传职位描述！');
      return;
    }

    setIsMatchLoading(true);
    setError(null); // 清除通用错误
    setMatches([]); // 清空旧的匹配结果
    setJobRequirements(null);

    try {
      // 1. 确保我们有最新的简历数据用于匹配
      console.log("开始匹配前，先获取最新简历列表...");
      await fetchResumes(); // 调用获取简历函数

      // 检查 fetchResumes 后 resumes state 是否有数据
      // 注意: setState 是异步的，直接检查 resumes 可能不是最新状态
      // 更好的做法是在 fetchResumes 内部处理无简历的情况或返回获取到的简历
      // 这里我们暂时假设 fetchResumes 会更新 resumes state
      // 在实际调用 API 前检查 state
      if (resumes.length === 0) {
          // 需要稍等 state 更新或直接使用 fetchResumes 返回值
          // 简单的延迟，或者更健壮的方式是让 fetchResumes 返回数据
          await new Promise(resolve => setTimeout(resolve, 100)); // 短暂等待 state 更新
          if (resumes.length === 0) {
            throw new Error('简历库为空或加载失败，无法进行匹配');
          }
      }
       console.log(`将使用 ${resumes.length} 份简历进行匹配...`);

      // 2. 调用匹配 API
      console.log("调用 /api/match 进行匹配...");
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobDescription,
          resumes: resumes // 使用当前 state 中的简历数据
        }),
      });

      const data = await response.json();
      console.log("匹配 API 响应:", data);

      if (!response.ok) {
        throw new Error(data.error || data.message || `匹配请求失败 (状态 ${response.status})`);
      }

      setMatches(data.matches || []);
      setJobRequirements(data.jobRequirements || null);
      setActiveTab('results'); // 成功后自动切换到结果页

    } catch (error) {
      console.error('匹配过程出错:', error);
      setError('匹配过程出错: ' + error.message);
       setActiveTab('upload'); // 出错时停留在上传页面
    } finally {
      setIsMatchLoading(false);
    }
  };

  // --- 其他辅助函数 (基本不变) ---
  const getMatchLevel = (score) => {
    if (score >= 80) return { text: '极高', color: 'text-green-600' };
    if (score >= 60) return { text: '良好', color: 'text-blue-600' };
    if (score >= 40) return { text: '一般', color: 'text-yellow-600' };
    return { text: '较低', color: 'text-red-600' };
  };

  const handleClearJobFile = () => {
    setJobFile(null);
    // 清除文件时也清空 JD 输入框可能不是好主意，除非 JD 是从文件中提取的
    // setJobDescription(''); // 根据需要决定是否清空
    if (document.getElementById('job-file')) {
        document.getElementById('job-file').value = ''; // 清空文件输入框
    }
  };


  // --- JSX 渲染 ---
  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          {/* 标题和上传简历按钮 */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">智能招聘匹配系统</h1>
            {/* --- 修改后的上传简历按钮 --- */}
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
                className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
                disabled={isUploadingResume}
              >
                {isUploadingResume ? '上传中...' : '上传简历'}
              </button>
            </div>
            {/* --- 修改结束 --- */}
          </div>

          {/* 通用错误显示区域 */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              错误: {error}
            </div>
          )}
          {/* 简历上传状态显示区域 */}
           {uploadResumeError && (
             <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
               简历上传错误: {uploadResumeError}
             </div>
           )}
           {uploadResumeSuccess && (
             <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
               {uploadResumeSuccess}
             </div>
           )}

          {/* 标签导航 */}
          <div className="flex border-b mb-6">
            <button
              className={`py-2 px-4 ${activeTab === 'upload' ? 'font-bold text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('upload')}
            >
              职位与匹配
            </button>
            <button
              className={`py-2 px-4 ${activeTab === 'resumes' ? 'font-bold text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('resumes')}
            >
              简历库
            </button>
             {/* 结果 Tab 只在有结果时显示 */}
             {matches.length > 0 && (
                <button
                  className={`py-2 px-4 ${activeTab === 'results' ? 'font-bold text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setActiveTab('results')}
                >
                  匹配结果 ({matches.length})
                </button>
              )}
          </div>

          {/* --- 上传职位描述与匹配界面 --- */}
          {activeTab === 'upload' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2" htmlFor="job-description-textarea">
                  职位描述 (JD)
                </label>
                <textarea
                  id="job-description-textarea"
                  className="w-full p-2 border rounded h-40 focus:ring-2 focus:ring-blue-300 focus:border-blue-500"
                  placeholder="请粘贴职位描述，例如：寻找有经验的前端开发工程师，熟悉JavaScript、React等技术..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>

              {/* JD 文件上传区域 */}
              <div className="mb-4 p-4 border rounded bg-gray-50">
                 <div className="flex items-center justify-between mb-2">
                   <label className="block text-sm font-bold">
                     或上传职位描述文件
                   </label>
                   <span className="text-xs text-gray-500">支持: PDF, DOC, DOCX, TXT (最大 10MB)</span>
                 </div>

                 {!jobFile ? (
                   <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400">
                     <input
                       type="file"
                       id="job-file" // ID 用于 label 的 htmlFor
                       accept=".pdf,.doc,.docx,.txt"
                       onChange={handleJobFileChange}
                       className="hidden" // 隐藏默认输入框
                       disabled={isPdfUploading}
                     />
                     <label htmlFor="job-file" className={`cursor-pointer ${isPdfUploading ? 'cursor-not-allowed' : ''}`}>
                       {/* SVG Icon */}
                       <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                       <p className="mt-1 text-sm text-gray-600">
                         {isPdfUploading ? '处理中...' : (
                           <>
                             <span className="font-medium text-blue-600 hover:text-blue-500">点击选择文件</span> 或拖放到此处
                           </>
                         )}
                       </p>
                     </label>
                   </div>
                 ) : (
                   // 文件选中后的预览
                   <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                     <div className="flex items-center space-x-2">
                       {/* File Icon */}
                        <svg className="h-6 w-6 text-blue-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                       <div className="text-sm">
                         <p className="font-medium text-gray-800">{jobFile.name}</p>
                         <p className="text-xs text-gray-500">{Math.round(jobFile.size / 1024)} KB</p>
                       </div>
                     </div>
                     <button
                       type="button"
                       className="text-gray-400 hover:text-red-600 focus:outline-none"
                       onClick={handleClearJobFile}
                       title="清除文件"
                     >
                       <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                     </button>
                   </div>
                 )}
              </div>

              {/* 匹配按钮 */}
              <div>
                <button
                  className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  onClick={matchResumes}
                  disabled={isMatchLoading || !jobDescription.trim()} // 匹配中或JD为空时禁用
                >
                  {isMatchLoading ? (
                     <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        匹配中...
                     </div>
                  ) : '开始匹配'}
                </button>
              </div>
            </div>
          )}

          {/* --- 简历库界面 --- */}
          {activeTab === 'resumes' && (
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
                 <button
                    className="text-sm px-3 py-1 border rounded text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    onClick={fetchResumes} // 添加刷新按钮
                    disabled={isLoading}
                  >
                    {isLoading ? '刷新中...' : '刷新'}
                  </button>
               </div>

              {isLoading ? (
                 <div className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-gray-500">正在加载简历库...</p>
                 </div>
              ) : resumes.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                     <thead className="bg-gray-50">
                       <tr>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">主要技能 (前3)</th>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Airtable ID</th>
                       </tr>
                     </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {resumes.map((resume) => ( // 确保 key 是唯一的 resume.id
                        <tr key={resume.id || resume.name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{resume.name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                             {resume.skills && Array.isArray(resume.skills) ?
                               resume.skills.slice(0, 3).map((skill, index) => (
                                 <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                                   {skill}
                                 </span>
                               ))
                               : (resume.skills || '无技能信息') // 如果 skills 是字符串也显示
                             }
                             {resume.skills && Array.isArray(resume.skills) && resume.skills.length > 3 && (
                                <span className="inline-block bg-gray-100 text-gray-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                                  +{resume.skills.length - 3} 更多
                                </span>
                             )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{resume.Source || '未知'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 font-mono">{resume.id || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                 <div className="text-center py-10 border rounded-lg bg-gray-50">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                       <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">简历库为空</h3>
                    <p className="mt-1 text-sm text-gray-500">请先使用“上传简历”按钮添加简历。</p>
                 </div>
              )}
            </div>
          )}

          {/* --- 匹配结果界面 --- */}
          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">匹配结果</h2>

              {/* JD 要求分析 */}
              {jobRequirements && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-lg mb-3 text-gray-800">职位要求分析</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-600 mb-1">目标职位</h4>
                      <p className="text-gray-900">{jobRequirements.jobTitle || '未指定'}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-600 mb-1">关键技能</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {jobRequirements.skills && jobRequirements.skills.length > 0 ? jobRequirements.skills.map((skill, idx) => (
                          <span key={idx} className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            {skill}
                          </span>
                        )) : <span className="text-sm text-gray-500">未提取到</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 匹配结果列表 */}
              {matches.length > 0 ? (
                <div className="space-y-6">
                  {matches.map((match, index) => {
                    const matchLevel = getMatchLevel(match.matchScore);
                    return (
                      <div key={match.id || index} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                        {/* 结果头部 */}
                        <div className={`flex items-center justify-between p-4 border-l-4 ${match.matchScore >= 80 ? 'border-green-500 bg-green-50' : match.matchScore >= 60 ? 'border-blue-500 bg-blue-50' : match.matchScore >= 40 ? 'border-yellow-500 bg-yellow-50' : 'border-red-500 bg-red-50'}`}>
                          <div className="flex items-center space-x-3">
                             <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${matchLevel.color.replace('text-', 'bg-').replace('-600', '-100')} ring-2 ${matchLevel.color.replace('text-', 'ring-')}`}>
                                <span className={`font-medium ${matchLevel.color}`}>{index + 1}</span>
                             </span>
                             <h3 className="text-lg font-semibold text-gray-900">{match.name || '未知姓名'}</h3>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold ${matchLevel.color}`}>{match.matchScore}%</div>
                            <div className={`text-sm font-medium ${matchLevel.color}`}>匹配度: {matchLevel.text}</div>
                          </div>
                        </div>

                        {/* 结果详情 */}
                        <div className="p-4 bg-white">
                          <div className="mb-4">
                            <h4 className="font-medium text-sm text-gray-700 mb-1">匹配分析摘要</h4>
                            <p className="text-sm text-gray-600">{match.matchDetails?.analysis || '无匹配分析'}</p>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-1">匹配技能</h4>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {match.matchDetails?.matchedSkills && match.matchDetails.matchedSkills.length > 0 ? (
                                  match.matchDetails.matchedSkills.map((skill, idx) => (
                                    <span key={idx} className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                      {skill}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-500 italic">无特别匹配的技能</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium text-sm text-gray-700 mb-1">可能缺失/未提及技能</h4>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {match.matchDetails?.missingSkills && match.matchDetails.missingSkills.length > 0 ? (
                                  match.matchDetails.missingSkills.map((skill, idx) => (
                                    <span key={idx} className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                                      {skill}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-500 italic">JD要求的技能都已覆盖</span>
                                )}
                              </div>
                            </div>
                          </div>

                           {/* 简历来源信息 (如果需要) */}
                           {match.Source && (
                             <div className="text-xs text-gray-400 mt-3">
                               来源: {match.Source} (ID: {match.id})
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                 // 没有匹配结果时的提示
                 <div className="text-center py-10 border rounded-lg bg-gray-50">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">无匹配结果</h3>
                    <p className="mt-1 text-sm text-gray-500">请检查职位描述或尝试匹配不同的简历库。</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}