import { OpenAI } from 'openai';
import formidable from 'formidable';
import fs from 'fs';
import { FILE_CONFIG } from '../../utils/config';
import { ocrImageByBaidu, ocrPdfByBaidu } from '../../utils/baiduOcr';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    let file = files.file;
    if (Array.isArray(file)) {
      file = file[0];
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // 打印文件信息，便于调试
    console.log('后端收到文件信息:', file);
    console.log('file.mimetype:', file.mimetype);
    console.log('file.originalFilename:', file.originalFilename);
    console.log('file.newFilename:', file.newFilename);
    console.log('file.name:', file.name);

    // 健壮提取文件名和扩展名
    const filename = file.originalFilename || file.newFilename || file.name || '';
    const ext = filename ? filename.split('.').pop().toLowerCase() : '';
    const allowedTypes = FILE_CONFIG.JD.allowedTypes;
    const allowedExtensions = FILE_CONFIG.JD.allowedExtensions || ['.pdf', '.txt', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileTypeOk = allowedTypes.includes(file.mimetype);
    const extOk = allowedExtensions.some(e => ext && ('.' + ext) === e);
    if (!fileTypeOk && !extOk) {
      return res.status(400).json({ error: '不支持的文件类型' });
    }

    if (file.size > FILE_CONFIG.JD.maxSize) {
      return res.status(400).json({ error: '文件大小超出限制' });
    }

    // 读取文件内容
    let fileContent = '';
    if (file.mimetype === 'application/pdf') {
      // PDF型JD，使用百度OCR PDF接口
      const pdfBase64 = fs.readFileSync(file.filepath, { encoding: 'base64' });
      fileContent = await ocrPdfByBaidu(pdfBase64);
      console.log('百度OCR PDF识别结果:', fileContent);
      if (!fileContent || !fileContent.trim()) {
        return res.status(200).json({
          error: '未能从PDF中识别到有效文本，请上传包含清晰文字的JD PDF或图片。'
        });
      }
    } else if (file.mimetype && file.mimetype.startsWith('image/')) {
      // 图片型JD，使用百度OCR
      const imageBase64 = fs.readFileSync(file.filepath, { encoding: 'base64' });
      fileContent = await ocrImageByBaidu(imageBase64);
      if (!fileContent || !fileContent.trim()) {
        return res.status(200).json({
          error: '未能从图片中识别到有效文本，请上传包含清晰文字的JD图片。'
        });
      }
    } else {
      fileContent = fs.readFileSync(file.filepath, 'utf-8');
    }
    if (fileContent.length > 4000) {
      fileContent = fileContent.slice(0, 4000);
    }

    // 使用 OpenAI 解析内容
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "你是一个专业的招聘顾问，请从职位描述中提取关键信息。"
        },
        {
          role: "user",
          content: `请从以下职位描述中提取关键信息，包括：\n1. 职位名称\n2. 所需技能\n3. 优先技能\n4. 工作经验要求\n5. 学历要求\n6. 主要职责\n\n职位描述内容：\n${fileContent}`
        }
      ],
      temperature: 0.3,
    });

    const parsedContent = completion.choices[0].message.content;
    console.log('OpenAI 返回内容:', parsedContent);

    // 解析返回的内容
    const result = {
      jobTitle: '',
      requiredSkills: [],
      preferredSkills: [],
      yearsOfExperience: '',
      educationLevel: '',
      responsibilities: []
    };

    if (!parsedContent || !parsedContent.trim()) {
      return res.status(200).json({
        error: 'AI未能从文件中提取出有效的职位描述信息，请上传更清晰、结构化的JD文本。'
      });
    }

    const lines = parsedContent.split('\n');
    let currentSection = '';

    for (const line of lines) {
      if (line.includes('职位名称')) {
        currentSection = 'jobTitle';
        result.jobTitle = line.split('：')[1]?.trim() || '';
      } else if (line.includes('所需技能')) {
        currentSection = 'requiredSkills';
      } else if (line.includes('优先技能')) {
        currentSection = 'preferredSkills';
      } else if (line.includes('工作经验要求')) {
        currentSection = 'yearsOfExperience';
        result.yearsOfExperience = line.split('：')[1]?.trim() || '';
      } else if (line.includes('学历要求')) {
        currentSection = 'educationLevel';
        result.educationLevel = line.split('：')[1]?.trim() || '';
      } else if (line.includes('主要职责')) {
        currentSection = 'responsibilities';
      } else if (line.trim() && currentSection) {
        if (currentSection === 'requiredSkills') {
          result.requiredSkills.push(line.trim());
        } else if (currentSection === 'preferredSkills') {
          result.preferredSkills.push(line.trim());
        } else if (currentSection === 'responsibilities') {
          result.responsibilities.push(line.trim());
        }
      }
    }

    // 清理临时文件
    fs.unlinkSync(file.filepath);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing file:', error);
    return res.status(500).json({ error: '文件处理失败' });
  }
} 