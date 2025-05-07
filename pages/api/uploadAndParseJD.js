// pages/api/uploadAndParseJD.js
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

// --- OpenAI Client Initialization ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
let openai;
if (OPENAI_API_KEY && OPENAI_API_KEY.startsWith('sk-')) {
  try {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log("[API /uploadAndParseJD] OpenAI client initialized successfully.");
  } catch (error) {
    console.error("[API /uploadAndParseJD] Error initializing OpenAI client:", error);
    openai = null;
  }
} else {
  console.warn("[API /uploadAndParseJD] OpenAI API Key not configured correctly in .env.local.");
  openai = null;
}
// --- Initialization End ---

// --- Formidable Configuration ---
export const config = {
  api: {
    bodyParser: false,
  },
};

const formidableOptions = {
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB limit
    filter: function ({ name, originalFilename, mimetype }) {
        const allowed = mimetype && mimetype.startsWith('image/');
        if (!allowed) {
            console.warn(`[API /uploadAndParseJD] 拒绝文件上传: ${originalFilename} (类型: ${mimetype}). 仅支持图片文件。`);
        }
        return allowed;
    },
    // uploadDir: '/tmp', // Vercel usually uses /tmp by default
};
// --- Configuration End ---

// --- API Handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `方法 ${req.method} 不允许。请使用 POST。` });
  }

  if (!openai) {
    return res.status(500).json({ success: false, message: "OpenAI 服务配置错误。" });
  }

  console.log('[API /uploadAndParseJD] 收到 POST 请求。开始处理...');

  await new Promise((resolve, reject) => {
    const form = formidable(formidableOptions);
    let fields = {};
    let files = {};
    let tempFilePath = null;

    form.on('field', (fieldName, value) => {
      console.log(`[API /uploadAndParseJD] 收到字段: ${fieldName}`);
      fields[fieldName] = value;
    });

    form.on('file', (fieldName, file) => {
      console.log(`[API /uploadAndParseJD] 收到文件: ${fieldName}, 原始名称: ${file.originalFilename}, 临时路径: ${file.filepath}`);
      if (fieldName === 'jobFile') {
        if (!files[fieldName]) {
          files[fieldName] = [];
        }
        files[fieldName].push(file);
        tempFilePath = file.filepath;
      } else {
        console.warn(`[API /uploadAndParseJD] 收到意外的文件字段: ${fieldName}`);
        fs.unlink(file.filepath).catch(err => console.error(`删除意外文件 ${file.filepath} 时出错:`, err));
      }
    });

    form.on('error', (err) => {
      console.error('[API /uploadAndParseJD] Formidable 解析错误:', err);
      if (tempFilePath) {
        fs.unlink(tempFilePath).catch(unlinkErr => console.error(`清理临时文件 ${tempFilePath} 时出错:`, unlinkErr));
      }
      reject({ statusCode: 500, message: `解析表单数据时出错: ${err.message}`, internalError: err });
    });

    form.on('end', async () => {
      console.log('[API /uploadAndParseJD] Formidable 解析完成。');
      try {
        const uploadedFile = files.jobFile?.[0];

        if (!uploadedFile) {
          console.error("[API /uploadAndParseJD] 未找到字段名为 'jobFile' 的文件。收到的文件:", files);
          return reject({ statusCode: 400, message: "未上传图片文件或使用了错误的字段名（应为 'jobFile'）。" });
        }

        const originalFilename = uploadedFile.originalFilename;
        const mimeType = uploadedFile.mimetype;
        let base64Image;

        try {
          const imageBuffer = await fs.readFile(tempFilePath);
          base64Image = imageBuffer.toString('base64');
          console.log(`[API /uploadAndParseJD] 图片文件已读取并转换为 Base64。`);
        } catch (readError) {
          console.error(`[API /uploadAndParseJD] 读取文件 ${tempFilePath} 时出错:`, readError);
          throw new Error('读取上传的图片文件时出错。');
        }

        let extractedText = '';
        let structuredData = null;

        try {
          console.log('[API /uploadAndParseJD] 正在使用改进的提示词发送图片到 OpenAI...');
          const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `分析以下职位描述图片。首先准确提取完整文本。然后，基于提取的文本，提供一个包含关键要求的 JSON 对象。JSON 对象必须包含以下精确的键：
- "jobTitle": string (广告中提到的具体职位，如"软件工程师"或"产品经理"。如果没有明确提到具体职位，返回 null。不要将"招贤纳仕"等招聘口号提取为职位名称。)
- "requiredSkills": string[] (提取所有在"技能要求"、"任职要求"、"Requirements"等标题下明确列出的项目。确保该特定部分中的每个编号或列表项都包含在数组中，尽量保持原始措辞。)
- "preferredSkills": string[] (列出任何明确提到为优先、可选、"加分项"或"nice to have"的技能。如果没有，返回空数组。)
- "yearsExperience": string (提取所需的工作经验年限，例如"3-5年"、"5+"，如果未提及则返回 null。)
- "educationLevel": string (提取最低学历要求，例如"本科"、"硕士"，如果未提及则返回 null。)

如果无法可靠地提取 JSON 结构，仅返回从图片中提取的完整文本。否则，仅返回有效的 JSON 对象。仅关注从图片中派生的内容。`
                  },
                  {
                    type: "image_url",
                    image_url: {
                      "url": `data:${mimeType};base64,${base64Image}`,
                      "detail": "high"
                    },
                  },
                ],
              },
            ],
            max_tokens: 2000,
            temperature: 0.1,
          });

          const messageContent = response.choices[0]?.message?.content;
          console.log('[API /uploadAndParseJD] 收到 OpenAI 响应。');

          if (!messageContent) {
            throw new Error("OpenAI 分析未返回内容。");
          }

          try {
            const trimmedContent = messageContent.trim();
            if (trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) {
              structuredData = JSON.parse(trimmedContent);
              extractedText = `职位名称: ${structuredData.jobTitle || '未指定'}\n必备技能: ${(structuredData.requiredSkills || []).join(', ')}\n... (从 JSON 提取)`;
              console.log('[API /uploadAndParseJD] 从 OpenAI 解析了结构化 JSON 数据。');
            } else {
              extractedText = messageContent;
              console.log('[API /uploadAndParseJD] 从 OpenAI 收到纯文本。');
            }
          } catch (parseError) {
            console.warn('[API /uploadAndParseJD] OpenAI 响应不是有效的 JSON，作为纯文本处理。错误:', parseError.message);
            extractedText = messageContent;
            structuredData = null;
          }

        } catch (openaiError) {
          console.error("[API /uploadAndParseJD] 调用 OpenAI API 时出错:", openaiError);
          throw new Error(`使用 OpenAI 分析图片失败: ${openaiError.message}`);
        }

        // 清理临时文件
        try {
          await fs.unlink(tempFilePath);
          console.log(`[API /uploadAndParseJD] 临时文件 ${tempFilePath} 已清理。`);
        } catch (unlinkError) {
          console.warn(`[API /uploadAndParseJD] 清理临时文件 ${tempFilePath} 时出错:`, unlinkError);
        }

        resolve({
          success: true,
          message: "职位描述图片处理成功。",
          extractedText: extractedText,
          structuredData: structuredData,
          fileName: originalFilename,
        });

      } catch (error) {
        console.error('[API /uploadAndParseJD] 处理过程中出错:', error);
        reject({
          statusCode: 500,
          message: `处理图片时出错: ${error.message}`,
          internalError: error
        });
      }
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error('[API /uploadAndParseJD] Formidable 解析错误:', err);
        reject({
          statusCode: 500,
          message: `解析表单数据时出错: ${err.message}`,
          internalError: err
        });
      }
    });
  }).then(result => {
    res.status(200).json(result);
  }).catch(error => {
    console.error('[API /uploadAndParseJD] 处理请求时出错:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '处理请求时发生未知错误',
      internalError: process.env.NODE_ENV === 'development' ? error.internalError : undefined
    });
  });
}