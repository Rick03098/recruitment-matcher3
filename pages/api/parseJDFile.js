import nextConnect from 'next-connect';
import multer from 'multer';
import fs from 'fs';
import { fileParser } from '../../utils/fileParser';
import { parseJobDescriptionWithOpenAI } from '../../utils/openaiService';

// 配置 multer
const upload = multer({
    storage: multer.diskStorage({
        destination: '/tmp',
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型。请上传 PDF、Word、TXT 或图片文件。'));
        }
    }
});

// 创建 API 路由
const apiRoute = nextConnect({
    onError(error, req, res) {
        console.error('[API /parseJDFile] 错误:', error);
        res.status(500).json({ 
            error: error.message || '文件处理失败',
            details: error.stack
        });
    },
    onNoMatch(req, res) {
        res.status(405).json({ error: `方法 ${req.method} 不允许` });
    }
});

// 使用 multer 中间件
apiRoute.use(upload.single('file'));

// 处理文件上传和解析
apiRoute.post(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '未找到上传的文件' });
    }

    const filePath = req.file.path;
    let extractedText = '';
    let structuredData = null;

    try {
        // 1. 提取文本
        extractedText = await fileParser.parse(filePath, req.file.mimetype);
        
        if (!extractedText.trim()) {
            throw new Error('无法从文件中提取文本内容');
        }

        // 2. 使用 OpenAI 解析文本
        try {
            structuredData = await parseJobDescriptionWithOpenAI(extractedText);
        } catch (aiError) {
            console.warn('[API /parseJDFile] OpenAI 解析失败:', aiError);
            structuredData = {
                jobTitle: '解析失败',
                requiredSkills: [],
                preferredSkills: [],
                yearsExperience: 'N/A',
                educationLevel: 'N/A',
                responsibilitiesKeywords: []
            };
        }

        // 3. 返回结果
        res.status(200).json({
            success: true,
            text: extractedText,
            structuredData,
            fileInfo: {
                name: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            }
        });

    } catch (error) {
        console.error('[API /parseJDFile] 处理文件时出错:', error);
        res.status(500).json({ 
            error: `文件处理失败: ${error.message}`,
            details: error.stack
        });
    } finally {
        // 清理临时文件
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupError) {
            console.warn('[API /parseJDFile] 清理临时文件失败:', cleanupError);
        }
    }
});

export default apiRoute;

// 禁用 body 解析，因为 multer 会处理它
export const config = {
    api: {
        bodyParser: false
    }
}; 