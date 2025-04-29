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
# ROLE AND GOAL
你是 recrutiment-matcher 公司一位顶尖的技术招聘专家和资深猎头，专注于为高速成长的科技创业公司寻找高潜力人才。你的目标是识别出那些不仅技能匹配，并且具备快速学习能力、强烈 Ownership 和创业精神的候选人。你需要提供有洞察力、可行动的评估报告。

# TASK
你的任务是根据下方提供的【职位描述 (JD)】和【候选人简历信息】，进行全面、深入、客观的匹配度评估，并生成一份简洁的 JSON 格式评估报告。

# INPUTS

---
【职位描述 (JD)】:
{JD_TEXT}
---
【候选人简历信息】:
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
---

# EVALUATION CRITERIA (请综合考虑以下方面给出评分和理由)
1.  **硬技能与经验 (Hard Skills & Experience):** 与 JD 的相关性和深度。评估基础知识、技术栈匹配度（考虑相关性和潜力）、项目经验质量、成果量化指标、年限符合度。
2.  **学习能力与潜力 (Learning Ability & Potential):** 候选人是否展现出快速学习新知识、适应新技术栈的能力？从项目经历、技能广度、教育背景等方面评估其成长潜力。**对于初创公司，高潜力有时比现有经验更重要。**
3.  **创业公司契合度 (Startup Fit):** 寻找 Ownership、自驱力、执行力、解决问题能力、抗压能力、沟通协作效率的证据。候选人是否适合快节奏、高不确定性的创业环境？（例如：0->1 经验、跨领域经验、主动承担责任的描述）
4.  **加分项与风险点 (Bonus & Red Flags):** 是否具备 JD 加分项？是否存在明显的技术短板、经验断层或需要警惕的信号？

# OUTPUT REQUIREMENTS
请严格按照要求，**只输出一个格式完全正确的 JSON 对象**，不要包含任何 JSON 之外的文字、解释或 markdown 标记 (如 \`\`\`json ... \`\`\`)。

JSON 对象必须包含以下键 (Key)：
- **"overallFitScore"**: 整数 (0-100)。**基于以上所有维度的专业、整体评估**得出的最终匹配分数。请体现专业判断和区分度（例如：90+ = 顶尖匹配；75-89 = 优秀候选，强烈推荐；60-74 = 具备潜力，值得面试；40-59 = 部分相关，谨慎考虑；<40 = 基本不匹配）。
- **"summary"**: 字符串。**一句话核心摘要**，总结候选人最主要的优劣势及推荐等级。例如：“技术基础扎实，学习潜力高，但缺乏 Go 经验，值得面试考察。”
- **"potentialRating"**: 字符串。对候选人**成长潜力**的评级（例如："高", "中", "低"）。
- **"startupFitRating"**: 字符串。对候选人**创业公司契合度**的评级（例如："高", "中", "低"）。
- **"keyStrengths"**: 字符串数组。列出候选人**最关键的 3-4 个优势或匹配点**（结合技能、经验、潜力、契合度）。
- **"keyConcerns"**: 字符串数组。列出需要创始人关注的 **3-4 个主要差距、风险或面试中需考察的点**。
- **"interviewFocusAreas"**: 字符串数组。**给出 2-3 个具体的面试建议**，针对性地考察候选人的潜在不足或验证其亮点。例如：["深入了解其在 XX 项目中的具体贡献和技术选型思考", "通过场景题考察其快速学习和解决未知问题的能力", "评估其对创业公司快节奏工作的接受度"]。

# 请开始评估并输出 JSON 对象:
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

            let aiReport = null; // 用于存储 AI 返回的报告对象
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini", // 尝试更新的模型，可能效果更好或更快/更便宜
                    // model: "gpt-3.5-turbo-0125", // 备选
                    // model: "gpt-4-turbo-preview", // 效果可能最好，但成本最高
                    messages: [{ role: "user", content: finalPrompt }],
                    temperature: 0.3, // 稍微提高一点温度，允许一些灵活性，但仍保持一致性
                    response_format: { type: "json_object" },
                    // max_tokens: 700, // 限制输出 Token 数量
                });

                const responseContent = completion.choices[0]?.message?.content;
                aiReport = parseAndValidateReport(responseContent); // 解析并验证 JSON 结构

                if (!aiReport) {
                    console.error(`[API /match - AI Report Mode] 简历 ${resume.name} 的 AI 评估报告无效或解析失败。`);
                    // 创建默认错误报告
                     aiReport = {
                         overallFitScore: 0, summary: "AI评估失败", potentialRating: "未知",
                         startupFitRating: "未知", keyStrengths: [], keyConcerns: ["AI评估返回无效"],
                         interviewFocusAreas: ["检查AI评估失败原因"]
                     };
                } else {
                     console.log(`[API /match - AI Report Mode] 简历 ${resume.name} 评估成功, Score: ${aiReport.overallFitScore}`);
                }

            } catch (error) {
                console.error(`[API /match - AI Report Mode] 调用 OpenAI 评估简历 ${resume.name} 时出错:`, error);
                // 创建默认错误报告
                aiReport = {
                    overallFitScore: 0, summary: `AI评估失败: ${error.message}`, potentialRating: "未知",
                    startupFitRating: "未知", keyStrengths: [], keyConcerns: ["AI评估API调用失败"],
                    interviewFocusAreas: ["检查API错误日志"]
                };
            }

            // --- 组合最终结果 ---
            // 将 AI 报告的主要字段放入 matchDetails
            return {
                ...resume, // 保留原始简历信息
                matchScore: aiReport.overallFitScore, // 使用 AI 给出的总分
                matchDetails: {
                    // 直接使用 AI 报告的字段
                    summary: aiReport.summary,
                    potentialRating: aiReport.potentialRating,
                    startupFitRating: aiReport.startupFitRating,
                    keyStrengths: aiReport.keyStrengths,
                    keyConcerns: aiReport.keyConcerns,
                    interviewFocusAreas: aiReport.interviewFocusAreas,
                    // 保留旧字段的引用（值现在来自AI报告）
                    reasoning: aiReport.summary, // 或可以用更详细的 reasoning (如果prompt要求)
                    analysis: aiReport.summary, // 让 analysis 等于 AI 的 summary
                    // 以下字段意义不大，但为了兼容前端可能暂时保留或设为空
                    matchedSkills: aiReport.keyStrengths.filter(s => s.toLowerCase().includes('skill') || s.toLowerCase().includes('技能')),
                    missingRequiredSkills: aiReport.keyConcerns.filter(w => w.toLowerCase().includes('skill') || w.toLowerCase().includes('技能') || w.toLowerCase().includes('经验')),
                    skillScore: null, // 不再单独计算
                    experienceScore: null,
                    educationScore: null,
                    bonusScore: 0,
                }
            };
        });

        const calculatedMatches = await Promise.all(matchesPromises);

        // --- 3. 排序结果 ---
        const sortedMatches = calculatedMatches.sort((a, b) => b.matchScore - a.matchScore);
        console.log(`[API /match - AI Report Mode] AI 报告生成完成，生成 ${sortedMatches.length} 条结果。`);

        // --- 4. 返回响应 ---
        console.log('[API /match - AI Report Mode] 步骤 2: 返回成功响应。');
        return res.status(200).json({
          matches: sortedMatches,
          jobRequirements: parsedJobRequirements // 仍然返回解析的 JD 用于前端显示
        });

    } catch (error) {
        console.error('[API /match - AI Report Mode] 匹配过程中发生顶层错误:', error);
        return res.status(500).json({ error: `匹配过程出错: ${error.message}` });
    }
}