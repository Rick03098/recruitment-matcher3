import nextConnect from 'next-connect';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import { parseJobDescriptionWithOpenAI } from '../../utils/openaiService';

// 配置multer
const upload = multer({
  dest: '/tmp',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持PDF和TXT文件'));
    }
  }
});

// 创建API路由
const apiRoute = nextConnect({
  onError(error, req, res) {
    console.error('API错误:', error);
    res.status(501).json({
      success: false,
      error: `上传失败: ${error.message}`,
      data: null
    });
  },
  onNoMatch(req, res) {
    res.status(405).json({
      success: false,
      error: `不支持的方法: ${req.method}`,
      data: null
    });
  },
});

// 使用multer中间件
apiRoute.use(upload.single('jobFile'));

// 处理POST请求
apiRoute.post(async (req, res) => {
  let tempFilePath = null;

  try {
    // 验证文件
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '未找到上传的文件',
        data: null
      });
    }

    tempFilePath = req.file.path;
    let extractedText = '';

    // 根据文件类型处理
    if (req.file.mimetype === 'application/pdf') {
      try {
        const dataBuffer = fs.readFileSync(tempFilePath);
        const pdfData = await pdfParse(dataBuffer, {
          max: 0,
          version: 'v2.0.550'
        });
        
        if (!pdfData || !pdfData.text) {
          throw new Error('PDF解析结果为空');
        }
        
        extractedText = pdfData.text;
      } catch (pdfError) {
        console.error('PDF解析错误:', pdfError);
        return res.status(400).json({
          success: false,
          error: `PDF文件解析失败: ${pdfError.message}`,
          data: null
        });
      }
    } else if (req.file.mimetype === 'text/plain') {
      try {
        extractedText = fs.readFileSync(tempFilePath, 'utf8');
      } catch (textError) {
        console.error('文本文件读取错误:', textError);
        return res.status(400).json({
          success: false,
          error: '文本文件读取失败',
          data: null
        });
      }
    }

    // 清理临时文件
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (unlinkError) {
      console.warn('临时文件清理失败:', unlinkError);
    }

    // 使用OpenAI解析文本
    const parseResult = await parseJobDescriptionWithOpenAI(extractedText);
    
    // 返回结果
    return res.status(200).json({
      success: true,
      error: null,
      data: {
        text: extractedText,
        structuredData: parseResult.success ? parseResult.data : null,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype
        }
      }
    });

  } catch (error) {
    // 确保清理临时文件
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.warn('清理临时文件失败:', unlinkError);
      }
    }

    console.error('处理文件时发生错误:', error);
    return res.status(500).json({
      success: false,
      error: '文件处理过程中发生错误: ' + error.message,
      data: null
    });
  }
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false,
  },
}; 