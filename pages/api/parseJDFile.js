import formidable from 'formidable';
import fs from 'fs';
import { fromPath } from 'pdf2pic';
import { getImageBase64, visionExtractTextFromImage } from '../../utils/openaiVision';

export const config = {
  api: {
    bodyParser: false,
  },
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: '只支持POST请求',
      data: null
    });
  }

  let tempFilePath = null;

  try {
    // 解析文件
    const form = formidable({ keepExtensions: true, maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });
    const fileRaw = files.jobFile;
    const file = Array.isArray(fileRaw) ? fileRaw[0] : fileRaw;
    if (!file) {
      return res.status(400).json({ success: false, error: '未找到上传的文件', data: null });
    }
    let fileType = file.mimetype;
    if (!fileType && file.originalFilename) {
      const ext = file.originalFilename.split('.').pop().toLowerCase();
      if (ext === 'pdf') fileType = 'application/pdf';
      if (['jpg','jpeg','png','webp','gif'].includes(ext)) fileType = 'image/' + ext;
    }
    tempFilePath = file.filepath;

    let extractedText = '';
    let visionRawResult = [];

    if (fileType === 'application/pdf') {
      // PDF转图片，每页都发给OpenAI Vision
      const pdf2pic = fromPath(tempFilePath, { density: 180, saveFilename: 'jd_page', savePath: '/tmp', format: 'jpeg', width: 1200, height: 1600 });
      const totalPages = await getPdfPageCount(tempFilePath);
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf2pic(i);
        const base64 = fs.readFileSync(page.path).toString('base64');
        const visionRes = await visionExtractTextFromImage(base64, OPENAI_API_KEY);
        visionRawResult.push(visionRes);
        // 尝试从visionRes中提取文本
        const text = extractTextFromVisionResponse(visionRes);
        extractedText += text + '\n';
        // 删除临时图片
        fs.unlinkSync(page.path);
      }
    } else if (fileType.startsWith('image/')) {
      // 图片直接发给OpenAI Vision
      const base64 = await getImageBase64(tempFilePath);
      const visionRes = await visionExtractTextFromImage(base64, OPENAI_API_KEY);
      visionRawResult.push(visionRes);
      extractedText = extractTextFromVisionResponse(visionRes);
    } else {
      return res.status(400).json({ success: false, error: '仅支持图片和PDF', data: null });
    }

    // 清理临时文件
    try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}

    // 再用OpenAI结构化分析
    let structuredData = {};
    if (extractedText.trim()) {
      const structureRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: `请将以下职位描述文本结构化为JSON，字段包括：岗位(jobTitle)、必备技能(requiredSkills,数组)、优先技能(preferredSkills,数组)、经验(yearsExperience)、学历(educationLevel)。只返回JSON，不要多余解释。\n\n${extractedText}` }
          ],
          max_tokens: 1024
        })
      });
      const structureJson = await structureRes.json();
      try {
        structuredData = JSON.parse(structureJson.choices[0].message.content);
      } catch {
        structuredData = {};
      }
    }

    // 返回前打印日志
    console.log('【JD结构化数据】structuredData:', structuredData);
    console.log('【OpenAI Vision原始返回】visionRawResult:', JSON.stringify(visionRawResult, null, 2));
    return res.status(200).json({
      success: true,
      error: null,
      data: {
        text: extractedText,
        structuredData,
        file: {
          name: file.originalFilename || file.name,
          size: file.size,
          type: fileType
        },
        visionRawResult
      }
    });
  } catch (error) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch {}
    }
    return res.status(500).json({ success: false, error: '文件处理失败: ' + error.message, data: null });
  }
}

// 获取PDF页数
function getPdfPageCount(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const text = buffer.toString('latin1');
  const match = text.match(/\/Type\s*\/Page[^s]/g);
  return match ? match.length : 1;
}

// 从OpenAI Vision响应中提取文本
function extractTextFromVisionResponse(visionRes) {
  try {
    const contentArr = visionRes.choices[0].message.content;
    if (typeof contentArr === 'string') return contentArr;
    if (Array.isArray(contentArr)) return contentArr.map(x => x.text || '').join('\n');
    return '';
  } catch {
    return '';
  }
} 