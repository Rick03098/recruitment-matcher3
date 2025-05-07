import { createRouter } from 'next-connect';
import multer from 'multer';
import { OpenAI } from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

// 配置 multer 存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  },
});

// 创建 OpenAI 实例
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 创建路由
const router = createRouter();

// 处理文件上传
router.use(upload.single('file'));

// 处理 POST 请求
router.post(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未找到文件' });
    }

    // 将文件内容转换为文本
    const fileContent = req.file.buffer.toString('utf-8');

    // 使用 OpenAI 解析 JD
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "你是一个专业的招聘专家，请从职位描述中提取关键信息。"
        },
        {
          role: "user",
          content: `请从以下职位描述中提取关键信息，包括：职位名称、所需技能、优先技能、工作经验要求、教育背景要求、工作职责等。以 JSON 格式返回。\n\n${fileContent}`
        }
      ],
      response_format: { type: "json_object" }
    });

    // 解析 AI 返回的 JSON
    const parsedData = JSON.parse(completion.choices[0].message.content);

    // 返回处理结果
    res.status(200).json({
      success: true,
      data: {
        fileInfo: {
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        },
        structuredData: parsedData
      }
    });
  } catch (error) {
    console.error('JD 处理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '处理文件时出错'
    });
  }
});

export default router.handler();

export const config = {
  api: {
    bodyParser: false,
  },
}; 