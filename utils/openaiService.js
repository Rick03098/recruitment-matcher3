// utils/openaiService.js
import OpenAI from 'openai';

// 从环境变量读取 OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai;
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

/**
 * 调用 OpenAI 解析简历文本
 * @param {string} resumeText - 简历的纯文本内容
 * @returns {Promise<object|null>} 解析后的结构化数据 (JSON 对象) 或 null
 */
export async function parseResumeWithOpenAI(resumeText) {
  if (!openai) {
    // 提供更明确的错误信息给调用者
    console.error("OpenAI 服务未初始化，请检查 .env.local 文件中的 OPENAI_API_KEY。");
    throw new Error("OpenAI 服务未初始化，请检查 API Key 配置。");
  }
  if (!resumeText || resumeText.trim().length < 50) { // 增加文本长度检查
    console.log(`简历文本过短 (长度 ${resumeText?.length || 0})，可能无法有效解析，跳过 OpenAI 调用。`);
    // 返回一个可识别的空结果或特定错误信号可能比返回 null 更好
    // 例如返回一个空对象，让调用者知道尝试过但无有效输入
     return { name: null, contact: null, education: null, experience: [], skills: [] };
    // 或者抛出错误： throw new Error("简历文本过短，无法解析");
  }

  // 优化后的 Prompt
   const prompt = `
    Analyze the following resume text and extract key information.
    Respond ONLY with a valid JSON object containing the extracted data.
    Do NOT include any introductory text, explanations, apologies, or markdown formatting like \`\`\`json.

    The JSON object should have these exact keys:
    - "name": string (Candidate's full name)
    - "contact": object (with "phone": string and "email": string)
    - "education": object (highest level found, with "school": string, "major": string, "degree": string)
    - "experience": array of objects (each with "company": string, "title": string, "startDate": string (YYYY-MM or year), "endDate": string (YYYY-MM, year, or 'Present'), "description": string)
    - "skills": array of strings (list of technical skills, tools, programming languages)

    If a piece of information is not found, use null for string/object fields or an empty array [] for array fields.

    Resume Text:
    ---
    ${resumeText.substring(0, 15000)}
    ---

    JSON Output:
  `; // 限制文本长度防止超出 token 限制，例如 15000 字符

  try {
    console.log(`调用 OpenAI Chat Completion API (模型: gpt-3.5-turbo-0125)...`);
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125", // 推荐使用支持 JSON Mode 的模型
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (responseContent) {
      // console.log("OpenAI 原始响应:", responseContent); // 调试时可以取消注释
      try {
         const parsedJson = JSON.parse(responseContent);
         console.log("成功解析 OpenAI 返回的 JSON 数据。");
         // 可选：在此处添加更多的数据验证逻辑
         if (typeof parsedJson.name !== 'string' && parsedJson.name !== null) console.warn("解析结果中 name 字段类型不符合预期");
         if (!Array.isArray(parsedJson.skills)) console.warn("解析结果中 skills 字段不是数组");
         // ... 其他验证
         return parsedJson;
      } catch (jsonError) {
         console.error("解析 OpenAI 返回的 JSON 失败:", jsonError);
         console.error("原始响应内容:", responseContent);
         throw new Error(`无法解析 OpenAI 返回的 JSON: ${jsonError.message}`);
      }
    } else {
      console.error("OpenAI API 返回了空的响应内容。");
      throw new Error("OpenAI API 返回了空的响应内容。");
    }
  } catch (error) {
    console.error("调用 OpenAI API 时发生错误:", error);
     if (error instanceof OpenAI.APIError) {
        console.error(`OpenAI API Error (${error.status}): ${error.message} (Code: ${error.code}, Type: ${error.type})`);
         // 针对特定错误给出提示
         if (error.code === 'invalid_api_key') {
            console.error("错误详情：OpenAI API Key 无效。请检查 .env.local 文件中的 OPENAI_API_KEY。");
         } else if (error.code === 'context_length_exceeded') {
            console.error("错误详情：输入的简历文本可能太长，超出了模型的处理限制。");
         } else if (error.status === 429) {
            console.error("错误详情：触发了 OpenAI API 的速率限制，请稍后再试或检查账户用量。");
         }
    }
    // 重新抛出错误，让上层调用知道操作失败
    throw new Error(`调用 OpenAI API 失败: ${error.message}`);
  }
}
