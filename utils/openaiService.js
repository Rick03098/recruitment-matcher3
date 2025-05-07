// utils/openaiService.js
import OpenAI from 'openai';

// --- OpenAI 客户端初始化 ---
// 从环境变量读取 OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai; // 将 openai 客户端实例存储在模块作用域
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
  try {
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    console.log("OpenAI 客户端已使用环境变量中的 API Key 初始化。");
  } catch (error) {
      console.error("初始化 OpenAI 客户端时出错:", error);
      openai = null;
  }
} else {
  console.warn("OpenAI API Key 未在 .env.local 文件中正确配置 (应以 'sk-' 开头)，相关功能将不可用。");
  openai = null;
}
// --- 初始化结束 ---

// 辅助函数：确保返回有效的JSON
const ensureValidJSON = (text) => {
  try {
    // 尝试直接解析
    return JSON.parse(text);
  } catch (e) {
    try {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e2) {
      console.error('JSON提取失败:', e2);
    }
    throw new Error('无法解析JSON响应');
  }
};

/**
 * 调用 OpenAI 解析简历文本，提取更丰富的结构化信息
 * @param {string} resumeText - 简历的纯文本内容
 * @returns {Promise<object|null>} 解析后的结构化数据 (JSON 对象) 或 null
 * @throws {Error} 如果 OpenAI 调用失败或返回无效数据
 */
export async function parseResumeWithOpenAI(resumeText) {
  if (!openai) {
    console.error("[parseResumeWithOpenAI] OpenAI 服务未初始化。");
    throw new Error("OpenAI 服务未初始化，请检查 API Key 配置。");
  }
  if (!resumeText || resumeText.trim().length < 50) {
    console.log(`[parseResumeWithOpenAI] 简历文本为空或过短，跳过 OpenAI 解析。`);
    // 返回包含所有预期键的空结构，以便 saveToAirtable 处理
    return {
        name: null, contact: null, educationDetails: null, experienceDetails: [],
        totalYearsExperience: null, coreSkills: [], softSkills: [], processSkills: [],
        tools: [], experienceSummary: null
    };
  }

  // --- 更新后的 Prompt ---
  const prompt = `
    Analyze the following resume text thoroughly and extract key information.
    Respond ONLY with a valid JSON object. Do NOT include any introductory text or markdown formatting.

    The JSON object must have these exact keys:
    - "name": string (Candidate's full name)
    - "contact": object (with "phone": string or null, and "email": string or null)
    - "educationDetails": object (Highest education level found, with "school": string or null, "major": string or null, "degree": string or null)
    - "experienceDetails": array of objects (List all work experiences. Each object must have "company": string, "title": string, "startDate": string (YYYY-MM or year), "endDate": string (YYYY-MM, year, or 'Present'), "description": string summarizing responsibilities/achievements)
    - "totalYearsExperience": number (Estimate total years of professional work experience based on dates. Return null if cannot estimate reliably.)
    - "coreSkills": array of strings (List primary technical skills, programming languages, frameworks, e.g., ["JavaScript", "React", "Node.js", "SQL"])
    - "softSkills": array of strings (List mentioned or inferred soft skills, e.g., ["沟通能力", "团队合作", "自驱力", "学习能力"])
    - "processSkills": array of strings (List process-related skills, e.g., ["用户调研", "数据分析", "项目管理", "产品迭代"])
    - "tools": array of strings (List specific software tools, platforms, etc., e.g., ["Figma", "Excel", "Jira", "AWS", "Notion"])
    - "experienceSummary": string (Generate a concise 2-3 sentence summary highlighting key roles and accomplishments. Return null if not applicable.)

    If a piece of information for a specific key is not found or cannot be determined, use null for string/object/number fields or an empty array [] for array fields.
    Prioritize accuracy based *only* on the provided text. Extract dates as written or in YYYY-MM format if possible.

    Resume Text:
    ---
    ${resumeText.substring(0, 15000)}
    ---

    JSON Output:
  `; // 限制文本长度

  try {
    console.log(`[parseResumeWithOpenAI] 调用 OpenAI Chat Completion API (模型: gpt-3.5-turbo-0125) - 提取增强信息...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (responseContent) {
      try {
         const parsedJson = JSON.parse(responseContent);
         console.log("[parseResumeWithOpenAI] 成功解析 OpenAI 返回的增强 JSON 数据。");
         return parsedJson;
      } catch (jsonError) {
         console.error("[parseResumeWithOpenAI] 解析 OpenAI 返回的 JSON 失败:", jsonError);
         console.error("[parseResumeWithOpenAI] 原始响应内容:", responseContent);
         throw new Error(`无法解析 OpenAI 返回的 JSON: ${jsonError.message}`);
      }
    } else {
      console.error("[parseResumeWithOpenAI] OpenAI API 返回了空的响应内容。");
      throw new Error("OpenAI API 返回了空的响应内容。");
    }
  } catch (error) {
    console.error("[parseResumeWithOpenAI] 调用 OpenAI API 时发生错误:", error);
     if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error (${error.status}): ${error.message}`);
    }
    throw new Error(`调用 OpenAI API (增强解析) 失败: ${error.message}`);
  }
}

/**
 * 调用 OpenAI 解析职位描述 (JD) 文本
 * @param {string} jobDescriptionText - JD 的纯文本内容
 * @returns {Promise<object|null>} 解析后的结构化职位要求 (JSON 对象) 或 null
 * @throws {Error} 如果 OpenAI 调用失败或返回无效数据
 */
export async function parseJobDescriptionWithOpenAI(text) {
  try {
    if (!text || typeof text !== 'string') {
      return {
        success: false,
        error: '无效的输入文本',
        data: null
      };
    }

    const prompt = `请从以下职位描述中提取关键信息，并以JSON格式返回。如果某项信息不存在，请将对应字段设为null：

职位名称（jobTitle）：
必需技能（requiredSkills）：数组格式
优先技能（preferredSkills）：数组格式
工作经验要求（yearsOfExperience）：数字
学历要求（educationLevel）：字符串

职位描述：
${text}

请确保返回的是有效的JSON格式，包含上述所有字段。`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一个专业的招聘顾问，擅长从职位描述中提取结构化信息。请确保返回的数据格式正确且完整。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('OpenAI响应格式无效');
    }

    const content = response.choices[0].message.content;
    
    try {
      const parsedData = JSON.parse(content);
      
      // 验证返回的数据结构
      const requiredFields = ['jobTitle', 'requiredSkills', 'preferredSkills', 'yearsOfExperience', 'educationLevel'];
      const missingFields = requiredFields.filter(field => !(field in parsedData));
      
      if (missingFields.length > 0) {
        return {
          success: false,
          error: `返回数据缺少必要字段: ${missingFields.join(', ')}`,
          data: parsedData
        };
      }

      return {
        success: true,
        error: null,
        data: parsedData
      };
    } catch (parseError) {
      console.error('JSON解析错误:', parseError);
      return {
        success: false,
        error: '无法解析OpenAI返回的数据',
        data: null
      };
    }
  } catch (error) {
    console.error('OpenAI API调用错误:', error);
    return {
      success: false,
      error: `OpenAI服务调用失败: ${error.message}`,
      data: null
    };
  }
}

export async function matchResumeWithJob(resume, jobDescription) {
  if (!resume || !jobDescription) {
    return {
      success: false,
      error: '简历或职位描述为空',
      data: null
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "你是一个专业的招聘顾问。请分析简历与职位描述的匹配度。必须以JSON格式返回，格式如下：{\"score\":85,\"matchingSkills\":[\"技能1\",\"技能2\"],\"missingSkills\":[\"技能1\",\"技能2\"],\"analysis\":\"详细分析\"}"
        },
        {
          role: "user",
          content: `职位描述：${jobDescription}\n\n简历内容：${JSON.stringify(resume)}`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI返回空响应');
    }

    const parsedData = ensureValidJSON(content);
    
    return {
      success: true,
      data: {
        score: Number(parsedData.score) || 0,
        matchingSkills: Array.isArray(parsedData.matchingSkills) ? parsedData.matchingSkills : [],
        missingSkills: Array.isArray(parsedData.missingSkills) ? parsedData.missingSkills : [],
        analysis: parsedData.analysis || '无分析结果'
      }
    };
  } catch (error) {
    console.error('简历匹配错误:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}