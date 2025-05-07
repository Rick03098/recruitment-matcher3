// components/RecruitmentMatcher.js

import { useState, useEffect, useRef } from 'react';
import ResumeLibrary from './ResumeLibrary'; // 导入简历库组件
import ResumeDetailModal from './ResumeDetailModal'; // 导入详情模态框
import BlueWaveLogoLoader from './BlueWaveLogoLoader';

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
  const [isParsingJD, setIsParsingJD] = useState(false); // 新增：JD解析中
  // 新增：用于强制刷新input的key
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // 简历上传相关状态
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [uploadResumeError, setUploadResumeError] = useState(null);
  const [uploadResumeSuccess, setUploadResumeSuccess] = useState(null);
  const resumeFileInputRef = useRef(null); // 简历文件输入框引用

  // --- 详情模态框状态 ---
  const [showAllMatches, setShowAllMatches] = useState(false); // 控制是否显示所有匹配结果
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false); // 详情模态框是否打开
  const [selectedMatchForDetail, setSelectedMatchForDetail] = useState(null); // 当前要在模态框中显示的简历数据

  // 1. 新增：解析结果可编辑状态
  const [isEditingJD, setIsEditingJD] = useState(false);
  const [editableJobRequirements, setEditableJobRequirements] = useState(null);

  // 2. 切换编辑模式
  useEffect(() => {
    setEditableJobRequirements(jobRequirements);
  }, [jobRequirements]);

  const handleJDFieldChange = (field, value) => {
    setEditableJobRequirements(prev => ({ ...prev, [field]: value }));
  };

  const handleJDArrayFieldChange = (field, index, value) => {
    setEditableJobRequirements(prev => {
      const arr = Array.isArray(prev[field]) ? [...prev[field]] : [];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  const handleAddJDArrayField = (field) => {
    setEditableJobRequirements(prev => {
      const arr = Array.isArray(prev[field]) ? [...prev[field]] : [];
      arr.push('');
      return { ...prev, [field]: arr };
    });
  };

  const handleRemoveJDArrayField = (field, index) => {
    setEditableJobRequirements(prev => {
      const arr = Array.isArray(prev[field]) ? [...prev[field]] : [];
      arr.splice(index, 1);
      return { ...prev, [field]: arr };
    });
  };

  const handleSaveJD = () => {
    setJobRequirements(editableJobRequirements);
    setIsEditingJD(false);
  };

  // --- 数据获取 ---
  // 防止多次并发调用的锁
  const isFetchingRef = useRef(false);
  const fetchResumes = async () => {
    if (isFetchingRef.current) {
      console.warn('fetchResumes: 已有请求进行中，跳过本次调用');
      return;
    }
    isFetchingRef.current = true;
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
      isFetchingRef.current = false;
    }
  };

  // 监听 activeTab 或 resumes 变化时自动加载（仅当简历库为空且未加载过）
  useEffect(() => {
    if (resumes.length === 0 && !isLoadingResumes) {
      fetchResumes();
    }
  }, [activeTab]);

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
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      setError('不支持的文件类型，请上传PDF、TXT或图片文件');
      return;
    }

    setJobFile(file);
    setError(null);
    setIsParsingJD(true); // 开始解析，显示进度
    setMatches([]); // 上传新JD时自动清空上一次匹配结果
    try {
      const formData = new FormData();
      formData.append('file', file);

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
      // 兼容后端直接返回结构化 JD 对象
      if (data.error) {
        throw new Error(data.error || '文件处理失败');
      }
      setJobDescription(data.jobTitle || '');
      setJobRequirements(data);
      // 上传成功后重置input key，允许再次上传
      setFileInputKey(Date.now());
      // 清空input value
      const jobFileInput = document.getElementById('jobFileInput');
      if (jobFileInput) jobFileInput.value = '';
    } catch (error) {
      console.error('文件处理错误:', error);
      setError(error.message || '文件处理失败');
    } finally {
      setIsParsingJD(false); // 解析结束，隐藏进度
    }
  };

  // --- UPDATED: Clear Job File ---
  const handleClearJobFile = () => {
    setJobFile(null);
    setJobDescription(''); // Clear the text area as well
    setJobRequirements(null); // Clear structured requirements
    setError(null); // Clear errors
    // 重置input key
    setFileInputKey(Date.now());
    // 清空input value
    const jobFileInput = document.getElementById('jobFileInput');
    if (jobFileInput) jobFileInput.value = '';
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

  // 新增：评分权重状态
  const [scoreWeights, setScoreWeights] = useState({
    technicalSkills: 30,
    projectExperience: 25,
    industryBackground: 15,
    softSkills: 10,
    education: 10,
    careerProgression: 10
  });

  // 终极权重调整函数，确保总权重严格等于100%
  const handleWeightChange = (dimension, value) => {
    const newValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    const otherDimensions = Object.keys(scoreWeights).filter(key => key !== dimension);
    const newWeights = { ...scoreWeights, [dimension]: newValue };

    // 计算剩余权重
    let remaining = 100 - newValue;
    let temp = {};
    let sum = 0;
    const otherTotal = otherDimensions.reduce((s, k) => s + scoreWeights[k], 0) || 1;

    otherDimensions.forEach((key, idx) => {
      if (idx === otherDimensions.length - 1) {
        temp[key] = remaining - sum;
      } else {
        temp[key] = Math.floor(remaining * scoreWeights[key] / otherTotal);
        sum += temp[key];
      }
    });

    otherDimensions.forEach(key => {
      newWeights[key] = Math.max(0, Math.min(100, temp[key]));
    });

    // 再次校正，确保总和为100
    let total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    // 微调，优先调整非当前项
    const adjustKeys = otherDimensions.concat([dimension]);
    let i = 0;
    while (total !== 100 && i < 20) { // 最多调整20次，防止死循环
      for (let key of adjustKeys) {
        if (total === 100) break;
        if (total > 100 && newWeights[key] > 0) {
          newWeights[key] -= 1;
          total -= 1;
        } else if (total < 100 && newWeights[key] < 100) {
          newWeights[key] += 1;
          total += 1;
        }
      }
      i++;
    }

    setScoreWeights(newWeights);
  };

  // 修改匹配函数，加入权重计算
  const matchResumes = async () => {
    const jdInput = jobRequirements ? jobRequirements : jobDescription;
    if (!jdInput || (typeof jdInput === 'string' && !jdInput.trim())) {
      setError('请先输入或上传有效的职位描述！');
      return;
    }
    if (resumes.length === 0) { setError('简历库为空，无法进行匹配。请先上传简历。'); return; }

    setIsMatching(true);
    setError(null);
    setMatches([]);
    setShowAllMatches(false);

    try {
      const response = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobDescription: jdInput, 
          resumes,
          scoreWeights // 添加权重信息
        }),
      });
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('服务器返回了非预期格式（可能超时或出错），请稍后重试或联系管理员');
      }
      
      if (!response.ok) throw new Error(data?.error || data?.message || `匹配请求失败 (状态 ${response.status})`);

      // 应用权重计算最终分数
      const weightedMatches = data.matches.map(match => {
        if (match.matchDetails?.detailedScores) {
          const scores = match.matchDetails.detailedScores;
          const weightedScore = Object.keys(scores).reduce((total, dimension) => {
            return total + (scores[dimension] * scoreWeights[dimension] / 100);
          }, 0);
          return {
            ...match,
            matchScore: Math.round(weightedScore)
          };
        }
        return match;
      });

      setMatches(weightedMatches);
      setJobRequirements(data.jobRequirements || null);
      setActiveTab('results');
      setJobDescription('');
      setJobFile(null);
      setJobRequirements(null);
      setFileInputKey(Date.now());
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

  // 新增：文本JD结构化分析中状态
  const [isParsingJDText, setIsParsingJDText] = useState(false);

  // 自动分析JD文本：当jobDescription变化且不为空时，自动结构化分析
  useEffect(() => {
    if (jobDescription && jobDescription.trim() && !jobFile) {
      setIsParsingJDText(true);
      const handler = setTimeout(async () => {
        try {
          const response = await fetch('/api/parseJDText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: jobDescription })
          });
          const data = await response.json();
          if (!response.ok || data.error) {
            setJobRequirements(null);
            setError(data.error || 'JD结构化分析失败');
          } else {
            setJobRequirements(data);
            setError(null);
          }
        } catch (err) {
          setJobRequirements(null);
          setError('JD结构化分析失败');
        } finally {
          setIsParsingJDText(false);
        }
      }, 600);
      return () => {
        clearTimeout(handler);
        setIsParsingJDText(false);
      };
    }
  }, [jobDescription, jobFile]);

  // --- JSX 渲染 ---
  // Determine if the match button should be enabled
  const canMatch = !isParsingJDText && !error && jobRequirements && resumes.length > 0 && !isMatching;

  // 编辑态和展示态美化样式
  const sectionCard = "bg-white rounded-xl shadow p-6 mb-6 border border-gray-100";
  const sectionTitle = "text-base font-semibold text-gray-900 mb-2 flex items-center gap-2";
  const fieldLabel = "text-sm font-medium text-gray-700 mb-1";
  const inputBase = "w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm mb-2";
  const tag = "inline-block bg-blue-50 text-blue-700 text-xs font-medium mr-2 mb-1 px-3 py-1 rounded-full";
  const addBtn = "text-blue-600 hover:text-blue-800 text-xs font-semibold cursor-pointer ml-1";
  const delBtn = "text-red-500 hover:text-red-700 text-xs ml-2 cursor-pointer";
  const saveBtn = "inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold mr-2";
  const cancelBtn = "inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg shadow hover:bg-gray-300 focus:outline-none font-semibold";
  const emptyTip = "text-gray-400 italic text-sm";

  // 删除按钮SVG（Google风格X）
  const deleteIcon = (
    <svg className="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="#f3f4f6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6m0-6l-6 6" />
    </svg>
  );

  // 切换Tab时自动清理相关状态
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'upload') {
      // 只清空上传区内容，不清空matches
      setJobDescription('');
      setJobFile(null);
      setJobRequirements(null);
      setFileInputKey(Date.now());
      setError(null);
      // 可选：setShowAllMatches(false);
    }
  };

  // 修改generateWeightsFromJD函数
  const generateWeightsFromJD = (jd) => {
    const weights = {
      technicalSkills: 30,
      projectExperience: 25,
      industryBackground: 15,
      softSkills: 10,
      education: 10,
      careerProgression: 10
    };

    // 岗位类型关键词列表
    const contentKeywords = [
      '内容', '文案', '短视频', '小红书', '抖音', '创意', '热点', '梗', '脚本', '运营', '新媒体', '自媒体', '社交媒体', '爆款', '策划', '编辑', '写作', '传播', '互动', '粉丝', '账号', '矩阵'
    ];
    const techKeywords = [
      '技术', '开发', '编程', '算法', '架构', '后端', '前端', '全栈', '数据', 'AI', '机器学习', '深度学习', '系统', '软件', '硬件', '测试', '运维', '安全', '网络', '数据库', '云计算', '区块链'
    ];
    const managementKeywords = [
      '管理', '领导', '团队', '战略', '规划', '决策', '协调', '沟通', '组织', '执行', '监督', '评估', '优化', '变革', '创新', '风险', '资源', '预算', '绩效', '文化', '愿景', '使命', '价值观'
    ];

    const jdText = [
      jd.jobTitle,
      ...(jd.requiredSkills || []),
      ...(jd.preferredSkills || []),
      ...(jd.responsibilities || []),
      ...(jd.bonusSkills || []),
      ...(jd.hiddenRequirements || []),
      jd.educationLevel
    ].filter(Boolean).join(' ');

    const isContentRole = contentKeywords.some(kw => jdText.includes(kw));
    const isTechRole = techKeywords.some(kw => jdText.includes(kw));
    const isManagementRole = managementKeywords.some(kw => jdText.includes(kw));

    if (isContentRole) {
      // 内容型岗位权重模板
      weights.technicalSkills = 5; // 技术技能极低
      weights.projectExperience = 30;
      weights.industryBackground = 15;
      weights.softSkills = 30; // 软技能极高
      weights.education = 10;
      weights.careerProgression = 10;
    } else if (isTechRole) {
      // 技术型岗位权重模板
      weights.technicalSkills = 40;
      weights.projectExperience = 30;
      weights.industryBackground = 10;
      weights.softSkills = 10;
      weights.education = 5;
      weights.careerProgression = 5;
    } else if (isManagementRole) {
      // 管理型岗位权重模板
      weights.technicalSkills = 10;
      weights.projectExperience = 20;
      weights.industryBackground = 10;
      weights.softSkills = 40;
      weights.education = 10;
      weights.careerProgression = 10;
    }

    // 根据职位描述中的关键词进一步微调权重（保留原有逻辑）
    if (jd.requiredSkills?.length > 0) {
      weights.technicalSkills = Math.min(40, weights.technicalSkills + jd.requiredSkills.length * 2);
    }
    if (jd.responsibilities?.length > 0) {
      weights.projectExperience = Math.min(35, weights.projectExperience + jd.responsibilities.length * 2);
    }
    if (jd.industryBackground) {
      weights.industryBackground = 20;
    }
    if (jd.softSkills?.length > 0) {
      weights.softSkills = Math.min(20, weights.softSkills + jd.softSkills.length * 2);
    }
    if (jd.educationLevel) {
      weights.education = 15;
    }

    // 归一化权重，确保总和为100%
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let keys = Object.keys(weights);
    let normalized = {};
    let sum = 0;
    keys.forEach((key, idx) => {
      if (idx === keys.length - 1) {
        normalized[key] = 100 - sum;
      } else {
        normalized[key] = Math.floor(weights[key] * 100 / total);
        sum += normalized[key];
      }
    });
    return normalized;
  };

  // 权重调整面板智能初始化
  useEffect(() => {
    if (jobRequirements) {
      setScoreWeights(generateWeightsFromJD(jobRequirements));
    }
    // 只在jobRequirements变化时自动调整
    // eslint-disable-next-line
  }, [jobRequirements]);

  // 匹配结果排序和分页
  const sortedMatches = [...matches].sort((a, b) => b.matchScore - a.matchScore);
  const matchesToShow = showAllMatches ? sortedMatches : sortedMatches.slice(0, 6);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              {/* SVG LOGO + 品牌文字 */}
              <svg width="130" height="60" viewBox="0 0 130 60" fill="none" xmlns="http://www.w3.org/2000/svg" style={{height: '40px', width: 'auto'}}>
                <rect x="0"   y="0"  width="10" height="60" fill="#1680FF"/>
                <rect x="15"  y="10" width="10" height="50" fill="#1680FF"/>
                <rect x="30"  y="20" width="10" height="40" fill="#1680FF"/>
                <rect x="45"  y="28" width="10" height="32" fill="#1680FF"/>
                <rect x="60"  y="36" width="10" height="24" fill="#1680FF"/>
                <rect x="75"  y="28" width="10" height="32" fill="#1680FF"/>
                <rect x="90"  y="20" width="10" height="40" fill="#1680FF"/>
                <rect x="105" y="10" width="10" height="50" fill="#1680FF"/>
                <rect x="120" y="0"  width="10" height="60" fill="#1680FF"/>
              </svg>
              <span className="ml-3 text-xl font-bold text-gray-900 tracking-tight" style={{fontFamily: 'PingFang SC, Microsoft YaHei, Arial, sans-serif'}}>
                奇绩校友招聘
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => handleTabChange('upload')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'upload'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                上传职位描述
              </button>
              <button
                onClick={() => handleTabChange('resumes')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'resumes'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                简历库
              </button>
              <button
                onClick={() => handleTabChange('results')}
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
                    key={fileInputKey}
                    type="file"
                    onChange={handleJobFileChange}
                    className="hidden"
                    id="jobFileInput"
                    accept=".txt,.png,.jpg,.jpeg,.webp"
                  />
                  <label
                    htmlFor="jobFileInput"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {isParsingJD ? '处理中...' : '选择文件'}
                  </label>
                  <p className="mt-2 text-sm text-gray-500">
                    支持 TXT, PNG, JPG, WEBP 格式
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

              {/* 解析结果区：更名、可编辑、全面展示 */}
              {isEditingJD && (
                <div className={sectionCard}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900">职位描述智能解析</h4>
                    <div className="flex gap-2">
                      <button onClick={handleSaveJD} className={saveBtn}>保存</button>
                      <button onClick={() => setIsEditingJD(false)} className={cancelBtn}>取消</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 职位名称 */}
                    <div>
                      <div className={fieldLabel}>职位名称</div>
                      <input type="text" className={inputBase} value={editableJobRequirements.jobTitle || ''} onChange={e => handleJDFieldChange('jobTitle', e.target.value)} />
                    </div>
                    {/* 必备技能 */}
                    <div>
                      <div className={fieldLabel}>必备技能</div>
                      {(editableJobRequirements.requiredSkills || []).map((skill, i) => (
                        <div key={i} className="flex items-center mb-1">
                          <input type="text" className={inputBase + ' flex-1 mb-0'} value={skill} onChange={e => handleJDArrayFieldChange('requiredSkills', i, e.target.value)} />
                          <button onClick={() => handleRemoveJDArrayField('requiredSkills', i)} className="ml-2 p-1 rounded hover:bg-gray-100">{deleteIcon}</button>
                        </div>
                      ))}
                      <button onClick={() => handleAddJDArrayField('requiredSkills')} className={addBtn}>+ 添加技能</button>
                    </div>
                    {/* 优先技能 */}
                    <div>
                      <div className={fieldLabel}>优先技能</div>
                      {(editableJobRequirements.preferredSkills || []).map((skill, i) => (
                        <div key={i} className="flex items-center mb-1">
                          <input type="text" className={inputBase + ' flex-1 mb-0'} value={skill} onChange={e => handleJDArrayFieldChange('preferredSkills', i, e.target.value)} />
                          <button onClick={() => handleRemoveJDArrayField('preferredSkills', i)} className="ml-2 p-1 rounded hover:bg-gray-100">{deleteIcon}</button>
                        </div>
                      ))}
                      <button onClick={() => handleAddJDArrayField('preferredSkills')} className={addBtn}>+ 添加技能</button>
                    </div>
                    {/* 主要职责 */}
                    <div>
                      <div className={fieldLabel}>主要职责</div>
                      {(editableJobRequirements.responsibilities || []).map((item, i) => (
                        <div key={i} className="flex items-center mb-1">
                          <input type="text" className={inputBase + ' flex-1 mb-0'} value={item} onChange={e => handleJDArrayFieldChange('responsibilities', i, e.target.value)} />
                          <button onClick={() => handleRemoveJDArrayField('responsibilities', i)} className="ml-2 p-1 rounded hover:bg-gray-100">{deleteIcon}</button>
                        </div>
                      ))}
                      <button onClick={() => handleAddJDArrayField('responsibilities')} className={addBtn}>+ 添加职责</button>
                    </div>
                    {/* 加分项 */}
                    <div>
                      <div className={fieldLabel}>加分项</div>
                      {(editableJobRequirements.bonusSkills || []).map((item, i) => (
                        <div key={i} className="flex items-center mb-1">
                          <input type="text" className={inputBase + ' flex-1 mb-0'} value={item} onChange={e => handleJDArrayFieldChange('bonusSkills', i, e.target.value)} />
                          <button onClick={() => handleRemoveJDArrayField('bonusSkills', i)} className="ml-2 p-1 rounded hover:bg-gray-100">{deleteIcon}</button>
                        </div>
                      ))}
                      <button onClick={() => handleAddJDArrayField('bonusSkills')} className={addBtn}>+ 添加加分项</button>
                    </div>
                    {/* 隐含要求 */}
                    <div>
                      <div className={fieldLabel}>隐含要求</div>
                      {(editableJobRequirements.hiddenRequirements || []).map((item, i) => (
                        <div key={i} className="flex items-center mb-1">
                          <input type="text" className={inputBase + ' flex-1 mb-0'} value={item} onChange={e => handleJDArrayFieldChange('hiddenRequirements', i, e.target.value)} />
                          <button onClick={() => handleRemoveJDArrayField('hiddenRequirements', i)} className="ml-2 p-1 rounded hover:bg-gray-100">{deleteIcon}</button>
                        </div>
                      ))}
                      <button onClick={() => handleAddJDArrayField('hiddenRequirements')} className={addBtn}>+ 添加隐含要求</button>
                    </div>
                    {/* 工作经验要求 */}
                    <div>
                      <div className={fieldLabel}>工作经验要求</div>
                      <input type="text" className={inputBase} value={editableJobRequirements.yearsExperience || ''} onChange={e => handleJDFieldChange('yearsExperience', e.target.value)} />
                    </div>
                    {/* 学历要求 */}
                    <div>
                      <div className={fieldLabel}>学历要求</div>
                      <input type="text" className={inputBase} value={editableJobRequirements.educationLevel || ''} onChange={e => handleJDFieldChange('educationLevel', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
              {!isEditingJD && jobRequirements && (
                <div className={sectionCard}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900">职位描述智能解析</h4>
                    <button onClick={() => setIsEditingJD(true)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-semibold">编辑</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 职位名称 */}
                    <div>
                      <div className={fieldLabel}>职位名称</div>
                      <div className="text-gray-900 text-base font-medium mb-2">{jobRequirements.jobTitle || '未填写'}</div>
                    </div>
                    {/* 必备技能 */}
                    <div>
                      <div className={fieldLabel}>必备技能</div>
                      {(jobRequirements.requiredSkills && jobRequirements.requiredSkills.length > 0) ? (
                        <div className="flex flex-wrap gap-2">
                          {jobRequirements.requiredSkills.map((skill, i) => <span key={i} className={tag}>{skill}</span>)}
                        </div>
                      ) : <span className={emptyTip}>无</span>}
                    </div>
                    {/* 优先技能 */}
                    <div>
                      <div className={fieldLabel}>优先技能</div>
                      {(jobRequirements.preferredSkills && jobRequirements.preferredSkills.length > 0) ? (
                        <div className="flex flex-wrap gap-2">
                          {jobRequirements.preferredSkills.map((skill, i) => <span key={i} className={tag}>{skill}</span>)}
                        </div>
                      ) : <span className={emptyTip}>无</span>}
                    </div>
                    {/* 主要职责 */}
                    <div>
                      <div className={fieldLabel}>主要职责</div>
                      {(jobRequirements.responsibilities && jobRequirements.responsibilities.length > 0) ? (
                        <ul className="list-disc list-inside text-gray-900 text-sm space-y-1">
                          {jobRequirements.responsibilities.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      ) : <span className={emptyTip}>无</span>}
                    </div>
                    {/* 加分项 */}
                    <div>
                      <div className={fieldLabel}>加分项</div>
                      {(jobRequirements.bonusSkills && jobRequirements.bonusSkills.length > 0
                        ? jobRequirements.bonusSkills
                        : jobRequirements.bonusItem && jobRequirements.bonusItem.length > 0
                          ? jobRequirements.bonusItem
                          : []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(jobRequirements.bonusSkills && jobRequirements.bonusSkills.length > 0
                            ? jobRequirements.bonusSkills
                            : jobRequirements.bonusItem || []).map((item, i) => <span key={i} className={tag}>{item}</span>)}
                        </div>
                      ) : <span className={emptyTip}>无</span>}
                    </div>
                    {/* 隐含要求 */}
                    <div>
                      <div className={fieldLabel}>隐含要求</div>
                      {(jobRequirements.hiddenRequirements && jobRequirements.hiddenRequirements.length > 0
                        ? jobRequirements.hiddenRequirements
                        : jobRequirements.hiddenReqs && jobRequirements.hiddenReqs.length > 0
                          ? jobRequirements.hiddenReqs
                          : []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(jobRequirements.hiddenRequirements && jobRequirements.hiddenRequirements.length > 0
                            ? jobRequirements.hiddenRequirements
                            : jobRequirements.hiddenReqs || []).map((item, i) => <span key={i} className={tag}>{item}</span>)}
                        </div>
                      ) : <span className={emptyTip}>无</span>}
                    </div>
                    {/* 工作经验要求 */}
                    <div>
                      <div className={fieldLabel}>工作经验要求</div>
                      <div className="text-gray-900 text-sm">{jobRequirements.yearsExperience || jobRequirements.yearsOfExperience || <span className={emptyTip}>未填写</span>}</div>
                    </div>
                    {/* 学历要求 */}
                    <div>
                      <div className={fieldLabel}>学历要求</div>
                      <div className="text-gray-900 text-sm">{jobRequirements.educationLevel || <span className={emptyTip}>未填写</span>}</div>
                    </div>
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

              {/* 权重调整面板 - 只在职位描述解析完成后显示 */}
              {jobRequirements && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">评分权重调整</h3>
                      <p className="text-sm text-gray-500 mt-1">根据职位需求调整各维度的评分权重，总权重需保持100%</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full">
                        <span className="text-sm text-blue-700">总权重</span>
                        <span className="text-sm font-medium text-blue-900">{Object.values(scoreWeights).reduce((sum, weight) => sum + weight, 0)}%</span>
                      </div>
                      <button
                        onClick={() => {
                          const weights = generateWeightsFromJD(jobRequirements);
                          setScoreWeights(weights);
                        }}
                        className="inline-flex items-center px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        智能调整
                      </button>
                      <button
                        onClick={() => setScoreWeights({
                          technicalSkills: 30,
                          projectExperience: 25,
                          industryBackground: 15,
                          softSkills: 10,
                          education: 10,
                          careerProgression: 10
                        })}
                        className="inline-flex items-center px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重置默认
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(scoreWeights).map(([dimension, weight]) => {
                      const dimensionLabels = {
                        technicalSkills: '技术技能',
                        projectExperience: '项目经验',
                        industryBackground: '行业背景',
                        softSkills: '软技能',
                        education: '教育背景',
                        careerProgression: '职业发展'
                      };
                      return (
                        <div key={dimension} className="flex items-center gap-3 py-2 border-b last:border-b-0 border-gray-100">
                          <span className="w-20 text-sm text-gray-700 font-medium">{dimensionLabels[dimension]}</span>
                          <button
                            onClick={() => handleWeightChange(dimension, weight - 5)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition"
                            disabled={weight <= 0}
                            tabIndex={-1}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                          </button>
                          <button
                            onClick={() => handleWeightChange(dimension, weight + 5)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600 transition"
                            disabled={Object.values(scoreWeights).reduce((sum, w) => sum + w, 0) >= 100}
                            tabIndex={-1}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={weight}
                            onChange={(e) => handleWeightChange(dimension, e.target.value)}
                            className="w-16 text-center border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mx-2"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          />
                          <span className="text-gray-400 text-sm">%</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={weight}
                            onChange={(e) => handleWeightChange(dimension, e.target.value)}
                            className="flex-1 accent-blue-500 mx-4"
                            style={{ minWidth: 80 }}
                          />
                          <span className="text-gray-500 font-medium w-10 text-right">{weight}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-700">
                        <p className="font-medium mb-1">权重调整说明</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-600">
                          <li>每个维度的权重范围为0-100%</li>
                          <li>总权重不能超过100%</li>
                          <li>可以通过拖动滑块、输入数值或点击 +/- 按钮调整权重</li>
                          <li>点击"智能调整"可根据职位描述自动生成权重</li>
                          <li>点击"重置默认"可恢复默认权重设置</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 开始匹配按钮 */}
              <div className="flex justify-end">
                <button
                  onClick={matchResumes}
                  disabled={!canMatch}
                  className={`inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
                    ${!canMatch ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isParsingJDText ? '职位描述解析中...' : isMatching ? '匹配中...' : '开始匹配'}
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
                if (jobDescription.trim()) {
                  matchResumes();
                }
              }}
            />
          )}

          {activeTab === 'results' && (
            <div className="space-y-6">
              <div className="mb-6 text-lg font-medium text-gray-800">
                共匹配到 {sortedMatches.length} 位候选人
              </div>
              <div className="grid grid-cols-1 gap-6">
                {matchesToShow.length > 0 ? matchesToShow.map((match, index) => {
                  // 检查硬性短板，强制降档
                  const hasCriticalGap = match.matchDetails?.keyConcerns?.some(concern => 
                    concern.includes('缺乏内容创作能力') || 
                    concern.includes('缺乏新媒体运营经验') ||
                    concern.includes('缺乏核心技术技能') ||
                    concern.includes('缺乏管理经验')
                  );
                  if (hasCriticalGap) {
                    match.matchScore = 59; // 强制降档
                  }

                  const getLevelLabel = (score) => {
                    if (score >= 85) return '顶尖匹配';
                    if (score >= 81) return '优秀候选';
                    if (score >= 75) return '值得考虑';
                    if (score >= 60) return '可尝试';
                    return '不太匹配';
                  };
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-2xl shadow p-8 flex flex-col gap-6 border border-gray-200 max-w-4xl w-full mx-auto transition hover:shadow-lg hover:scale-[1.01] duration-200"
                      style={{ fontFamily: '-apple-system,BlinkMacSystemFont,\'San Francisco\',\'PingFang SC\',\'Segoe UI\',Arial,sans-serif' }}
                    >
                      {/* 概览区 */}
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-900 shadow-inner">
                          {match.matchScore}
                        </div>
                        <div className="flex-1">
                          <div className="text-2xl font-bold text-gray-900">{match.name}</div>
                          <div className="text-base text-gray-500 mt-1">{match.title} · {match.totalYearsExperience}年 · {match.education || '学历未知'}</div>
                        </div>
                        <div>
                          <span className="px-4 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-900 border border-gray-200">
                            {getLevelLabel(match.matchScore)}
                          </span>
                        </div>
                      </div>
                      {/* 分隔线 */}
                      <div className="border-t border-gray-100" />
                      {/* AI摘要 */}
                      {match.matchDetails?.summary && (
                        <div className="flex items-center bg-gray-50 rounded px-4 py-3 text-base font-medium text-gray-900">
                          <span className="font-semibold mr-2">AI摘要</span>
                          <span>{match.matchDetails.summary}</span>
                        </div>
                      )}
                      {/* 分隔线 */}
                      <div className="border-t border-gray-100" />
                      {/* 标签区：只展示亮点 */}
                      <div className="flex flex-wrap gap-3">
                        {match.matchDetails?.keyStrengths?.map((s, i) => (
                          <span key={i} className="bg-gray-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">{s}</span>
                        ))}
                      </div>
                      {/* 详细区（可折叠，展示缺点） */}
                      <details className="bg-gray-50 rounded p-4">
                        <summary className="cursor-pointer text-base font-semibold text-gray-900">详细评估</summary>
                        <div className="mt-3 space-y-4">
                          <div>
                            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                              <span>关键优势</span>
                            </div>
                            <ul className="list-disc list-inside text-base text-gray-900 pl-4">
                              {match.matchDetails?.keyStrengths?.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                              <span>主要风险</span>
                            </div>
                            <ul className="list-disc list-inside text-base text-gray-900 pl-4">
                              {match.matchDetails?.keyConcerns?.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                              <span>面试建议</span>
                            </div>
                            <ul className="list-disc list-inside text-base text-gray-900 pl-4">
                              {match.matchDetails?.interviewFocusAreas?.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        </div>
                      </details>
                      {/* 操作区 */}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleViewMatchDetail(match)}
                          className="border border-blue-600 text-blue-700 bg-white hover:bg-blue-600 hover:text-white rounded-lg px-6 py-2 text-base font-semibold transition"
                        >
                          查看完整简历
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center text-gray-400 py-12 text-lg">暂无匹配结果</div>
                )}
              </div>
              {/* 查看更多按钮 */}
              {!showAllMatches && sortedMatches.length > 6 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setShowAllMatches(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                  >
                    查看更多候选人
                  </button>
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

      {isParsingJD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="flex flex-col items-center">
            <BlueWaveLogoLoader size={96} />
            <div className="text-lg text-white font-semibold drop-shadow mt-6">正在解析职位描述，请稍候...</div>
          </div>
        </div>
      )}

      {/* 只在简历库Tab显示加载动画 */}
      {activeTab === 'resumes' && isLoadingResumes && !isParsingJD && (
        <div className="flex flex-col items-center justify-center py-12">
          <BlueWaveLogoLoader size={72} />
          <p className="mt-4 text-sm text-gray-500">正在加载简历库...</p>
        </div>
      )}

      {/* 在匹配中状态显示全屏遮罩 */}
      {isMatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="flex flex-col items-center">
            <BlueWaveLogoLoader size={96} />
            <div className="text-lg text-white font-semibold drop-shadow mt-6">正在智能匹配，请稍候...</div>
          </div>
        </div>
      )}
    </div>
  );
}