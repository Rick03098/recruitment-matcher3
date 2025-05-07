// pages/api/match.js

import { parseJobDescriptionWithOpenAI } from '../../utils/openaiService';
import OpenAI from 'openai'; // 或者从 openaiService 导入实例

// --- OpenAI 客户端初始化 (确保 openai 实例可用) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai;
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
    try {
        openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        console.log("[API /match - AI Report Mode] OpenAI 客户端初始化成功。");
    } catch (error) { /* ... error handling ... */ openai = null; }
} else { /* ... warning ... */ openai = null; }
// --- 初始化结束 ---


// --- 新的 Prompt 模板 ---
const AI_HR_REPORT_PROMPT_TEMPLATE = `
你是一名顶尖的技术招聘专家。请根据【职位描述】和【候选人简历】进行全面匹配评估，输出如下JSON：
{
  "overallFitScore": 0-100, // 综合所有维度的专业判断分数，90+极优，75-89优秀，60-74合格，40-59谨慎，<40不推荐
  "summary": "一句话总结分数理由，突出最关键的加分项和减分项",
  "keyStrengths": ["最重要的3-4个加分点，技能/经验/潜力/加分项等"],
  "keyConcerns": ["最重要的3-4个减分点，技能短板/经验不足/学历不符等"],
  "interviewFocusAreas": ["2-3个面试建议，针对性考察候选人潜在不足或亮点"]
}

要求：
- 分数要有区分度，不能都打高分
- summary要简明扼要说明分数理由
- keyStrengths/Concerns要具体，能让HR一眼看出优劣势
- 只输出JSON，不要多余解释

【职位描述 (JD)】：
{JD_TEXT}

【候选人简历信息】：
姓名: {RESUME_NAME}
总工作年限 (估算): {RESUME_TOTAL_YEARS_EXP} 年
核心技术技能:
{RESUME_CORE_SKILLS_FORMATTED_LIST}
过程/方法论技能:
{RESUME_PROCESS_SKILLS_FORMATTED_LIST}
掌握的工具:
{RESUME_TOOLS_FORMATTED_LIST}
软技能 (来自简历):
{RESUME_SOFT_SKILLS_FORMATTED_LIST}
教育背景:
- 学校: {RESUME_EDU_SCHOOL}
- 专业: {RESUME_EDU_MAJOR}
- 学位: {RESUME_EDU_DEGREE}
工作/项目经历详情 (按时间倒序):
{RESUME_EXPERIENCE_DETAILS_FORMATTED}
经验总结 (AI生成):
{RESUME_EXPERIENCE_SUMMARY}
`;


// --- 辅助函数：格式化简历信息以填充 Prompt ---
function formatResumeForPrompt(resume) {
    const formatList = (arr) => (arr && arr.length > 0 ? arr.map(item => `- ${item}`).join('\n') : '无列出');

    const formatExperience = (expArr) => {
        if (!expArr || expArr.length === 0) return '无';
        // 只显示最近的几份经历，避免 Prompt 过长
        const MAX_EXP_ITEMS = 3;
        return expArr.slice(0, MAX_EXP_ITEMS).map((exp, index) => `
--- 经历 ${index + 1} ---
公司: ${exp.company || 'N/A'}
职位: ${exp.title || 'N/A'}
时间: ${exp.startDate || '?'} - ${exp.endDate || '?'}
职责/描述: <span class="math-inline">\{exp\.description?\.substring\(0, 300\) \|\| 'N/A'\}</span>{exp.description?.length > 300 ? '...' : ''}
`).join('\n').trim();
    };

    return {
        RESUME_NAME: resume.name || '未知',
        RESUME_TOTAL_YEARS_EXP: resume.totalYearsExperience !== null ? String(resume.totalYearsExperience) : '未知',
        RESUME_CORE_SKILLS_FORMATTED_LIST: formatList(resume.coreSkills),
        RESUME_PROCESS_SKILLS_FORMATTED_LIST: formatList(resume.processSkills),
        RESUME_TOOLS_FORMATTED_LIST: formatList(resume.tools),
        RESUME_SOFT_SKILLS_FORMATTED_LIST: formatList(resume.softSkills),
        RESUME_EDU_SCHOOL: resume.educationDetails?.school || 'N/A',
        RESUME_EDU_MAJOR: resume.educationDetails?.major || 'N/A',
        RESUME_EDU_DEGREE: resume.educationDetails?.degree || 'N/A',
        RESUME_EXPERIENCE_DETAILS_FORMATTED: formatExperience(resume.experienceDetails), // 格式化经验
        RESUME_EXPERIENCE_SUMMARY: resume.experienceSummary || '无'
    };
}

// --- 辅助函数：解析和验证 OpenAI 返回的报告 JSON ---
 function parseAndValidateReport(jsonString) {
    if (!jsonString) return null;
    try {
        const report = JSON.parse(jsonString);
        // 检查核心字段是否存在且类型基本正确
        if (typeof report.overallFitScore !== 'number' ||
            typeof report.summary !== 'string' ||
            typeof report.potentialRating !== 'string' ||
            typeof report.startupFitRating !== 'string' ||
            !Array.isArray(report.keyStrengths) ||
            !Array.isArray(report.keyConcerns) ||
            !Array.isArray(report.interviewFocusAreas)
        ) {
            console.warn("[parseAndValidateReport] AI 返回的报告 JSON 缺少必需字段或类型错误:", report);
            return null;
        }
        // 分数修正
        report.overallFitScore = Math.max(0, Math.min(100, Math.round(report.overallFitScore)));
        return report;
    } catch (error) {
        console.error("[parseAndValidateReport] 解析 AI 报告 JSON 失败:", error);
        console.error("[parseAndValidateReport] 原始字符串:", jsonString);
        return null;
    }
}

// --- 新增：传统打分函数 ---
function calcTraditionalScores(jd, resume) {
  // 技能分
  const jdSkills = (jd.requiredSkills || []).map(s => s.toLowerCase());
  const jdBonus = (jd.preferredSkills || []).map(s => s.toLowerCase());
  const resumeSkills = (resume.coreSkills || []).map(s => s.toLowerCase());
  // 技能匹配
  const matchedSkills = jdSkills.filter(skill => resumeSkills.includes(skill));
  const missingSkills = jdSkills.filter(skill => !resumeSkills.includes(skill));
  const skillScore = jdSkills.length > 0 ? Math.round((matchedSkills.length / jdSkills.length) * 100) : 0;
  // 加分项
  const matchedBonus = jdBonus.filter(skill => resumeSkills.includes(skill));
  const bonusScore = jdBonus.length > 0 ? Math.round((matchedBonus.length / jdBonus.length) * 100) : 0;
  // 经验分
  let experienceScore = 100;
  if (jd.yearsExperience && resume.totalYearsExperience) {
    const jdYear = parseInt(jd.yearsExperience);
    const resumeYear = parseInt(resume.totalYearsExperience);
    if (!isNaN(jdYear) && !isNaN(resumeYear)) {
      if (resumeYear >= jdYear) experienceScore = 100;
      else if (resumeYear >= jdYear - 1) experienceScore = 80;
      else if (resumeYear >= jdYear - 2) experienceScore = 60;
      else experienceScore = 30;
    }
  }
  // 学历分
  let educationScore = 100;
  if (jd.educationLevel && resume.educationDetails?.degree) {
    const eduMap = { '博士': 4, '硕士': 3, '本科': 2, '大专': 1 };
    const jdEdu = eduMap[jd.educationLevel] || 0;
    const resumeEdu = eduMap[resume.educationDetails.degree] || 0;
    if (resumeEdu >= jdEdu) educationScore = 100;
    else if (resumeEdu === jdEdu - 1) educationScore = 70;
    else educationScore = 40;
  }
  return { skillScore, bonusScore, experienceScore, educationScore, matchedSkills, missingSkills, matchedBonus };
}

// 添加重试机制
async function callOpenAIWithRetry(prompt, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // 使用更稳定的模型
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3,
                response_format: { type: "json_object" },
                max_tokens: 1000
            });
            return completion.choices[0]?.message?.content;
        } catch (error) {
            if (error.code === 'rate_limit_exceeded' && i < maxRetries - 1) {
                const retryAfter = parseInt(error.headers?.['retry-after'] || '1');
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            throw error;
        }
    }
}

// 优化评分验证函数
function validateAndNormalizeScore(score, resume, jd) {
    // 基础分数验证
    if (typeof score !== 'number' || isNaN(score)) {
        return 0;
    }
    
    // 确保分数在0-100范围内
    score = Math.max(0, Math.min(100, Math.round(score)));
    
    // 根据简历和JD的关键信息进行分数调整
    const adjustments = [];
    
    // 1. 技能匹配度调整
    const jdSkills = new Set((jd.requiredSkills || []).map(s => s.toLowerCase()));
    const resumeSkills = new Set((resume.coreSkills || []).map(s => s.toLowerCase()));
    const skillMatchRatio = [...jdSkills].filter(s => resumeSkills.has(s)).length / jdSkills.size;
    
    if (skillMatchRatio < 0.3) {
        adjustments.push(-20); // 严重技能不匹配
    } else if (skillMatchRatio < 0.5) {
        adjustments.push(-10); // 部分技能不匹配
    } else if (skillMatchRatio > 0.8) {
        adjustments.push(10); // 技能高度匹配
    }
    
    // 2. 经验年限调整
    if (jd.yearsExperience && resume.totalYearsExperience) {
        const expDiff = resume.totalYearsExperience - jd.yearsExperience;
        if (expDiff < -2) {
            adjustments.push(-15); // 经验严重不足
        } else if (expDiff > 2) {
            adjustments.push(5); // 经验丰富
        }
    }
    
    // 3. 教育背景调整
    if (jd.educationLevel && resume.educationDetails?.degree) {
        const eduMap = { '博士': 4, '硕士': 3, '本科': 2, '大专': 1 };
        const jdEdu = eduMap[jd.educationLevel] || 0;
        const resumeEdu = eduMap[resume.educationDetails.degree] || 0;
        
        if (resumeEdu < jdEdu) {
            adjustments.push(-10); // 学历不达标
        } else if (resumeEdu > jdEdu) {
            adjustments.push(5); // 学历超出要求
        }
    }
    
    // 应用调整
    const finalScore = Math.max(0, Math.min(100, score + adjustments.reduce((a, b) => a + b, 0)));
    
    return {
        score: finalScore,
        adjustments,
        originalScore: score
    };
}

// --- API 主处理函数 ---
export default async function handler(req, res) {
    if (req.method !== 'POST') { /* ... 方法检查 ... */ }
    if (!openai) { /* ... OpenAI 客户端检查 ... */ }

    const { jobDescription, resumes = [] } = req.body;
    if (!jobDescription || jobDescription.trim().length < 20) { /* ... JD 检查 ... */ }
    if (!Array.isArray(resumes) || resumes.length === 0) { /* ... 简历检查 ... */ }

    console.log(`[API /match - AI Report Mode] 收到请求，JD 长度: ${jobDescription.length}, 简历数量: ${resumes.length}`);

    try {
        // --- 1. (可选) 解析 JD 用于前端展示 ---
        let parsedJobRequirements = null;
        try {
             parsedJobRequirements = await parseJobDescriptionWithOpenAI(jobDescription);
             console.log('[API /match - AI Report Mode] OpenAI 解析 JD 成功 (用于前端展示)。');
        } catch (jdParseError) { /* ... 记录警告 ... */
            console.warn('[API /match - AI Report Mode] 解析 JD 时出错 (非阻塞):', jdParseError.message);
            parsedJobRequirements = { jobTitle: '解析失败', requiredSkills: [], preferredSkills: [], yearsExperience: 'N/A', educationLevel: 'N/A', responsibilitiesKeywords: [] };
        }


        // --- 2. 为每份简历调用 OpenAI 生成评估报告 ---
        console.log('[API /match - AI Report Mode] 步骤 1: 开始为每份简历生成 AI 评估报告...');
        const matchesPromises = resumes.map(async (resume) => {
            console.log(`[API /match - AI Report Mode] 正在处理简历: ${resume.name} (ID: ${resume.id})`);
            const resumePlaceholders = formatResumeForPrompt(resume);
            let finalPrompt = AI_HR_REPORT_PROMPT_TEMPLATE;
            finalPrompt = finalPrompt.replace('{JD_TEXT}', jobDescription);
            for (const key in resumePlaceholders) {
                finalPrompt = finalPrompt.replace(`{${key}}`, resumePlaceholders[key] || 'N/A');
            }

            let aiReport = null;
            try {
                const responseContent = await callOpenAIWithRetry(finalPrompt);
                aiReport = parseAndValidateReport(responseContent);
                
                if (aiReport) {
                    // 应用分数验证和调整
                    const scoreResult = validateAndNormalizeScore(
                        aiReport.overallFitScore,
                        resume,
                        parsedJobRequirements
                    );
                    
                    aiReport.overallFitScore = scoreResult.score;
                    aiReport.scoreDetails = {
                        originalScore: scoreResult.originalScore,
                        adjustments: scoreResult.adjustments
                    };
                }
            } catch (error) {
                console.error(`[API /match] 处理简历 ${resume.name} 时出错:`, error);
                aiReport = {
                    overallFitScore: 0,
                    summary: `评估失败: ${error.message}`,
                    keyStrengths: [],
                    keyConcerns: ["AI评估失败"],
                    interviewFocusAreas: ["需要人工评估"]
                };
            }

            return {
                ...resume,
                matchScore: aiReport.overallFitScore,
                matchDetails: aiReport
            };
        });

        const calculatedMatches = await Promise.all(matchesPromises);
        
        // 优化排序逻辑
        const sortedMatches = calculatedMatches
            .sort((a, b) => {
                // 首先按分数排序
                const scoreDiff = b.matchScore - a.matchScore;
                if (Math.abs(scoreDiff) > 5) return scoreDiff;
                
                // 分数接近时，考虑其他因素
                const aHasKeySkills = a.matchDetails?.keyStrengths?.some(s => 
                    jd.requiredSkills?.some(req => s.toLowerCase().includes(req.toLowerCase()))
                );
                const bHasKeySkills = b.matchDetails?.keyStrengths?.some(s => 
                    jd.requiredSkills?.some(req => s.toLowerCase().includes(req.toLowerCase()))
                );
                
                if (aHasKeySkills && !bHasKeySkills) return -1;
                if (!aHasKeySkills && bHasKeySkills) return 1;
                
                return 0;
            })
            .slice(0, 6);

        return res.status(200).json({
            matches: sortedMatches,
            jobRequirements: parsedJobRequirements
        });
    } catch (error) {
        console.error('[API /match] 匹配过程中发生错误:', error);
        return res.status(500).json({ 
            error: `匹配过程出错: ${error.message}`,
            details: error.stack
        });
    }
}