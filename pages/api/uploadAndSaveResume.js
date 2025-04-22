// pages/api/uploadAndSaveResume.js

// 导入必要的工具函数
import {
  handleFileUploadInMemory,
  extractTextFromMemoryPdf,
  readTextFileFromMemory,
} from '../../utils/fileUploadHandler'; // 处理文件上传和文本提取
import { extractNameFromFilename } from '../../utils/resumeParser'; // 从文件名提取姓名
import { parseResumeWithOpenAI } from '../../utils/openaiService'; // 使用 OpenAI 解析简历
import { saveToAirtable } from '../../utils/airtableService'; // 保存到 Airtable

// Next.js API Route 配置：禁用 bodyParser，让 formidable 处理
export const config = {
  api: {
    bodyParser: false,
  },
};

// API 路由处理函数
export default async function handler(req, res) {
  // --- 1. 检查请求方法 ---
  if (req.method !== 'POST') {
    console.log(`[API /uploadAndSaveResume] 收到非 POST 请求 (${req.method})`);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: `方法 ${req.method} 不允许，请使用 POST。` });
  }

  console.log('[API /uploadAndSaveResume] 收到 POST 请求，开始处理...');

  try {
    // --- 2. 处理文件上传 ---
    console.log('[API /uploadAndSaveResume] 步骤 1: 使用 handleFileUploadInMemory 处理上传...');
    const { fields, files } = await handleFileUploadInMemory(req);

    // --- 调试日志：检查 formidable 的解析结果 ---
    console.log('[API /uploadAndSaveResume] formidable - fields:', fields);
    console.log('[API /uploadAndSaveResume] formidable - files:', JSON.stringify(files, null, 2));
    // --- 日志结束 ---

    // --- 修改后的文件获取逻辑 (处理 files.file 是对象或数组的情况) ---
    let theFile = null; // 初始化为 null

    if (files?.file) { // 检查 files 对象和 files.file 是否存在
        if (Array.isArray(files.file)) {
            // 情况一：files.file 是一个数组
            if (files.file.length > 0) {
                theFile = files.file[0]; // 取数组的第一个元素
                console.log("[API /uploadAndSaveResume] 检测到 'files.file' 是数组，使用第一个文件对象。");
            } else {
                // 如果是空数组
                console.error("[API /uploadAndSaveResume] 错误: 'files.file' 是一个空数组，没有文件。");
            }
        } else if (typeof files.file === 'object' && files.file !== null) {
            // 情况二：files.file 是一个对象 (根据上次日志，这是实际情况)
            theFile = files.file; // 直接使用这个对象
            console.log("[API /uploadAndSaveResume] 检测到 'files.file' 是单个对象，直接使用。");
        } else {
             // files.file 存在但既不是数组也不是有效对象
             console.error("[API /uploadAndSaveResume] 错误: 'files.file' 的值类型未知或无效。", files.file);
        }
    } else {
        // files 对象里根本没有 'file' 键
        console.error("[API /uploadAndSaveResume] 错误: formidable 返回的 'files' 对象中不包含 'file' 键。", files);
    }

    // --- 最终检查 theFile 是否成功获取且有效 ---
    if (!theFile || typeof theFile !== 'object' || !theFile.mimetype || !theFile.size) {
        // 如果经过上面的逻辑，theFile 仍然是 null 或无效对象
        console.error("[API /uploadAndSaveResume] 错误: 未能从 formidable 的解析结果中获取到有效的文件对象。", theFile); // 打印一下获取到的 a a null 或无效对象
        // 返回错误响应给前端
        return res.status(400).json({ success: false, message: "未能获取有效的上传文件数据。" });
    }
    // --- 检查结束 ---

    // 如果代码执行到这里，说明 theFile 已经是一个有效的文件对象了
    const fileType = theFile.mimetype;
    const originalFilename = theFile.originalFilename || 'unknown_file';
    const fileSize = theFile.size;
    console.log(`[API /uploadAndSaveResume] 成功获取文件对象: name='${originalFilename}', type='${fileType}', size=${fileSize} bytes`);
    // --- 文件获取逻辑结束 ---


    // --- 3. 提取文件文本内容 ---
    console.log('[API /uploadAndSaveResume] 步骤 2: 提取文件文本内容...');
    let resumeText = '';
    if (fileType === 'application/pdf') {
      console.log(`[API /uploadAndSaveResume] 正在解析 PDF 文件: ${originalFilename}`);
      resumeText = await extractTextFromMemoryPdf(theFile);
    } else if (fileType === 'text/plain') {
      console.log(`[API /uploadAndSaveResume] 正在读取 TXT 文件: ${originalFilename}`);
      resumeText = readTextFileFromMemory(theFile);
    } else {
      console.warn(`[API /uploadAndSaveResume] 收到不支持的文件类型: ${fileType}`);
      return res.status(400).json({ success: false, message: `不支持的文件类型 '${fileType}'，仅接受 PDF 和 TXT。` });
    }
    console.log(`[API /uploadAndSaveResume] 文本提取完成，共 ${resumeText?.length || 0} 字符。`);

    if (!resumeText || resumeText.trim().length < 50) {
        console.warn("[API /uploadAndSaveResume] 警告: 提取到的简历文本为空或过短，可能影响解析质量。");
    }

    // --- 4. 使用 OpenAI 解析文本 ---
    console.log('[API /uploadAndSaveResume] 步骤 3: 调用 OpenAI 解析简历...');
    let parsedData = null;
    try {
      parsedData = await parseResumeWithOpenAI(resumeText);
      if (!parsedData) {
        console.error("[API /uploadAndSaveResume] 错误: OpenAI 解析服务未能返回有效的结构化数据。");
        throw new Error('OpenAI 解析服务未能返回有效数据');
      }
      console.log('[API /uploadAndSaveResume] OpenAI 解析成功。');
    } catch (openaiError) {
      console.error("[API /uploadAndSaveResume] OpenAI 解析过程中出错:", openaiError);
      return res.status(500).json({ success: false, message: `调用 OpenAI 解析失败: ${openaiError.message}` });
    }

    // --- 5. 补充/后处理解析数据 ---
    console.log('[API /uploadAndSaveResume] 步骤 4: 后处理解析数据...');
    const possibleName = extractNameFromFilename(originalFilename);
    if (!parsedData.name && possibleName) {
      console.log(`[API /uploadAndSaveResume] OpenAI 未提取姓名，使用文件名中的 '${possibleName}'。`);
      parsedData.name = possibleName;
    } else if (!parsedData.name) {
      parsedData.name = '姓名未检测';
      console.warn("[API /uploadAndSaveResume] 警告: 未能检测到候选人姓名。");
    }
    parsedData.rawTextPreview = resumeText.substring(0, 500) + (resumeText.length > 500 ? '...' : '');

    // --- 6. 保存到 Airtable ---
    console.log('[API /uploadAndSaveResume] 步骤 5: 保存数据到 Airtable...');
    let airtableRecord = null;
    try {
      airtableRecord = await saveToAirtable(parsedData, originalFilename);
      console.log(`[API /uploadAndSaveResume] 数据成功保存到 Airtable, 记录 ID: ${airtableRecord?.id}`);
    } catch (airtableError) {
      console.error("[API /uploadAndSaveResume] 保存到 Airtable 时出错:", airtableError);
      return res.status(500).json({
        success: false,
        message: `保存到 Airtable 失败: ${airtableError.message}`,
        parsedData: parsedData,
        errorDetails: 'AirtableSaveError'
      });
    }

    // --- 7. 返回最终成功响应 ---
    console.log('[API /uploadAndSaveResume] 步骤 6: 所有步骤成功完成，返回响应。');
    return res.status(200).json({
      success: true,
      message: '简历已通过 OpenAI 解析并成功保存到 Airtable',
      file: { name: originalFilename, size: fileSize, type: fileType },
      parsedData: parsedData,
      airtableRecord: airtableRecord
    });

  } catch (error) {
    // --- 捕获流程中未被特定 catch 块处理的其它错误 ---
    console.error('[API /uploadAndSaveResume] 处理请求时发生意外错误:', error);
    return res.status(500).json({
      success: false,
      message: `服务器处理请求时发生错误: ${error.message}`
    });
  }
}
