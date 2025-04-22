// pages/api/uploadPdf.js
import { handleFileUploadInMemory, extractTextFromMemoryPdf, readTextFileFromMemory } from '../../utils/fileUploadHandler';
import { parseResumeContent } from '../../utils/resumeParser';

// 禁用默认的bodyParser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只支持POST请求' });
  }

  try {
    // 使用内存处理文件上传
    const { fields, files } = await handleFileUploadInMemory(req);
    
    const uploadedFile = files.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: '没有找到上传的文件' });
    }
    
    // 根据文件类型处理
    let resumeText = '';
    const fileType = uploadedFile.mimetype;
    
    if (fileType === 'application/pdf') {
      // 解析内存中的PDF数据
      resumeText = await extractTextFromMemoryPdf(uploadedFile);
    } else if (fileType === 'text/plain') {
      // 从内存读取文本文件
      resumeText = readTextFileFromMemory(uploadedFile);
    } else {
      // 对于其他文件类型，返回错误
      return res.status(400).json({ success: false, message: '不支持的文件类型，仅支持PDF和TXT文件' });
    }
    
    // 解析简历内容
    const parsedData = parseResumeContent(resumeText);
    
    // 返回解析结果
    return res.status(200).json({
      success: true,
      message: '文件上传并解析成功',
      file: {
        name: uploadedFile.originalFilename,
        size: uploadedFile.size,
        type: fileType
      },
      parsedData
    });
  } catch (error) {
    console.error('处理上传文件错误:', error);
    return res.status(500).json({
      success: false,
      message: '文件处理失败: ' + error.message
    });
  }
}
