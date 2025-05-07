import nextConnect from 'next-connect';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import { parseJobDescriptionWithOpenAI } from '../../utils/openaiService';

const upload = multer({ dest: '/tmp' });

const apiRoute = nextConnect({
  onError(error, req, res) {
    console.error('API错误:', error);
    res.status(501).json({ success: false, message: `上传失败: ${error.message}` });
  },
  onNoMatch(req, res) {
    res.status(405).json({ success: false, message: `不支持的方法: ${req.method}` });
  },
});

// 只允许POST
apiRoute.use((req, res, next) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '仅支持POST方法' });
  }
  next();
});

// 捕获multer等中间件异常
apiRoute.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: '文件上传或解析失败: ' + err.message });
});

apiRoute.use(upload.single('jobFile'));

apiRoute.post(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未找到上传的文件' });
    }

    const file = req.file;
    let extractedText = '';
    let structuredData = null;

    // 根据文件类型处理
    if (file.mimetype === 'application/pdf') {
      try {
        console.log('开始读取PDF文件:', file.path);
        const dataBuffer = fs.readFileSync(file.path);
        console.log('PDF文件读取成功，开始解析...');
        
        const pdfData = await pdfParse(dataBuffer, {
          max: 0, // 不限制页数
          version: 'v2.0.550'
        });
        
        if (!pdfData || !pdfData.text) {
          throw new Error('PDF解析结果为空');
        }
        
        extractedText = pdfData.text;
        console.log('PDF解析成功，提取文本长度:', extractedText.length);
      } catch (pdfError) {
        console.error('PDF解析错误:', pdfError);
        return res.status(400).json({ 
          success: false, 
          message: `PDF文件解析失败: ${pdfError.message}`,
          details: process.env.NODE_ENV === 'development' ? pdfError.stack : undefined
        });
      }
    } else if (file.mimetype === 'text/plain') {
      try {
        extractedText = fs.readFileSync(file.path, 'utf8');
      } catch (textError) {
        console.error('文本文件读取错误:', textError);
        return res.status(400).json({ 
          success: false, 
          message: '文本文件读取失败' 
        });
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        message: '不支持的文件类型，仅支持PDF和TXT文件' 
      });
    }

    // 清理临时文件
    try {
      fs.unlinkSync(file.path);
      console.log('临时文件已清理:', file.path);
    } catch (unlinkError) {
      console.warn('临时文件清理失败:', unlinkError);
    }

    // 使用OpenAI解析文本
    try {
      console.log('开始使用OpenAI解析文本...');
      structuredData = await parseJobDescriptionWithOpenAI(extractedText);
      console.log('OpenAI解析完成');
    } catch (openaiError) {
      console.error('OpenAI解析错误:', openaiError);
      // 即使OpenAI解析失败，也返回提取的文本
      return res.status(200).json({
        success: true,
        message: '文件解析成功，但结构化分析失败',
        text: extractedText,
        structuredData: null,
        error: process.env.NODE_ENV === 'development' ? openaiError.message : undefined
      });
    }

    // 返回成功结果
    return res.status(200).json({
      success: true,
      message: '文件解析成功',
      text: extractedText,
      structuredData: structuredData,
      file: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      }
    });

  } catch (error) {
    console.error('处理文件时发生错误:', error);
    return res.status(500).json({
      success: false,
      message: '文件处理过程中发生错误: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false, // 让multer接管
  },
}; 