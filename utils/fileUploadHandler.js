// utils/fileUploadHandler.js

import formidable from 'formidable'; // 用于解析表单数据，特别是文件上传
import { Writable } from 'stream'; // Node.js 内置的流模块，用于创建自定义写入流
import pdfParse from 'pdf-parse'; // 用于从 PDF 文件 Buffer 中提取文本

/**
 * 创建一个将数据块收集到内存数组中的 Writable 流处理器。
 * @returns {Writable & { chunks: Buffer[] }} 返回一个 Writable 流实例，附加了 chunks 数组
 */
function createMemoryWriteStream() {
  const chunks = []; // 用于存储接收到的数据块 (Buffer)
  const writable = new Writable({
    // 实现 _write 方法，这是 Writable 流的核心
    write(chunk, encoding, callback) {
      // 将接收到的数据块添加到 chunks 数组中
      chunks.push(chunk);
      // 调用回调函数，表示这个数据块处理完成
      callback();
    },
  });
  // 将 chunks 数组附加到流对象上，方便后续访问
  writable.chunks = chunks;
  return writable;
}

/**
 * 使用 formidable 处理文件上传，并将文件内容存储在内存中。
 * @param {import('http').IncomingMessage} req - Node.js HTTP 请求对象 (在 Next.js API 路由中就是 req 参数)
 * @param {object} [options] - formidable 配置选项
 * @param {number} [options.maxFileSize=10 * 1024 * 1024] - 最大允许文件大小 (默认 10MB)
 * @param {boolean} [options.allowMultiple=false] - 是否允许上传多个同名字段的文件 (默认 false)
 * @returns {Promise<{ fields: formidable.Fields, files: formidable.Files }>} 返回包含解析后的字段和文件对象的 Promise
 */
export async function handleFileUploadInMemory(req, options = {}) {
  // 设置默认选项
  const {
    maxFileSize = 10 * 1024 * 1024, // 默认 10MB
    allowMultiple = false,
  } = options;

  console.log('[handleFileUploadInMemory] 开始处理文件上传 (内存模式)...');
  console.log(`[handleFileUploadInMemory] 配置: maxFileSize=${maxFileSize} bytes, allowMultiple=${allowMultiple}`);

  // 配置 formidable
  const form = formidable({
    maxFileSize: maxFileSize,     // 限制文件大小
    multiples: allowMultiple,     // 是否允许多文件
    keepExtensions: true,         // 保留文件扩展名
    // 关键：指定文件写入流的处理器，使用我们的内存写入流
    fileWriteStreamHandler: createMemoryWriteStream,
    filter: function ({ name, originalFilename, mimetype }) {
        // 过滤只允许特定类型的文件 (例如 PDF 和 TXT)
        // name 是表单字段名, originalFilename 是原始文件名, mimetype 是文件类型
        const allowed = mimetype && (mimetype.includes('application/pdf') || mimetype.includes('text/plain'));
        if (!allowed) {
            console.warn(`[handleFileUploadInMemory] 拒绝上传文件: name='${originalFilename}', type='${mimetype}' (类型不允许)`);
        }
        return allowed; // 只允许 PDF 和 TXT
    }
  });

  // 使用 Promise 包装 formidable 的异步解析过程
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        // 如果解析出错 (例如文件过大、类型不对被 filter 拒绝等)
        console.error('[handleFileUploadInMemory] formidable 解析请求时出错:', err);
        // 根据错误类型可以返回更具体的错误信息
        if (err.code === 'LIMIT_FILE_SIZE') {
            reject(new Error(`文件大小超过限制 (${maxFileSize / 1024 / 1024}MB)`));
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
             reject(new Error(`文件类型不被允许 (仅支持 PDF, TXT)`));
        } else {
            reject(new Error(`处理上传请求失败: ${err.message}`));
        }
      } else {
        // 解析成功
        console.log('[handleFileUploadInMemory] formidable 解析成功。');
        // console.log('[handleFileUploadInMemory] fields:', fields); // 调试时可以看普通字段
        // console.log('[handleFileUploadInMemory] files (结构预览):', JSON.stringify(files, null, 2)); // 调试时看文件结构
        resolve({ fields, files }); // 返回解析结果
      }
    });
  });
}

/**
 * 从内存中的 PDF 文件数据 Buffer 中提取文本。
 * @param {object} file - formidable 返回的文件对象 (包含了 _writeStream 及 chunks)
 * @returns {Promise<string>} 提取出的文本内容
 * @throws {Error} 如果读取内存数据或解析 PDF 失败
 */
export async function extractTextFromMemoryPdf(file) {
  if (!file || typeof file !== 'object') {
     throw new Error("无效的文件对象提供给 extractTextFromMemoryPdf");
  }
  console.log(`[extractTextFromMemoryPdf] 尝试从文件对象中提取 PDF 文本: ${file.originalFilename}`);

  try {
    // 从文件对象的 _writeStream 中获取 chunks 数组
    console.log("[extractTextFromMemoryPdf] 访问 file._writeStream.chunks...");
    const chunks = file?._writeStream?.chunks;

    // 验证 chunks 是否有效
    if (!chunks || !Array.isArray(chunks)) {
      console.error("[extractTextFromMemoryPdf] 错误: 未能从 file._writeStream 中找到有效的 chunks 数组。", file?._writeStream);
      throw new Error("无法读取文件内存数据 (chunks not found in _writeStream)");
    }
    if (chunks.length === 0) {
         console.warn("[extractTextFromMemoryPdf] 警告: 文件数据块 (chunks) 数组为空，可能文件内容为空。");
         // 可以选择返回空字符串或抛出错误，这里选择尝试继续，pdf-parse 应该能处理空 Buffer
    } else {
        console.log(`[extractTextFromMemoryPdf] 找到 ${chunks.length} 个数据块 (chunks)。`);
    }

    // 合并 Buffer 数组
    const fileBuffer = Buffer.concat(chunks);
    console.log(`[extractTextFromMemoryPdf] 成功合并 ${fileBuffer.length} 字节的数据 Buffer。`);

    // 使用 pdf-parse 解析 Buffer
    console.log("[extractTextFromMemoryPdf] 调用 pdf-parse 解析 Buffer...");
    // 提供一个空的 options 对象给 pdfParse 可能有助于避免某些潜在问题
    const options = {};
    const data = await pdfParse(fileBuffer, options);
    console.log("[extractTextFromMemoryPdf] pdf-parse 解析完成。");

    // 返回提取的文本，如果为空则返回空字符串
    return data?.text || '';

  } catch (error) {
    console.error(`[extractTextFromMemoryPdf] 解析 PDF (来自内存) 时出错 (原始文件名: ${file?.originalFilename}):`, error);
    // 抛出包含原始错误信息的错误
    throw new Error(`解析 PDF 文件失败: ${error.message}`);
  }
}

/**
 * 从内存中的文本文件数据 Buffer 中读取内容。
 * @param {object} file - formidable 返回的文件对象 (包含了 _writeStream 及 chunks)
 * @returns {string} 文件文本内容 (UTF-8 编码)
 * @throws {Error} 如果读取内存数据失败
 */
export function readTextFileFromMemory(file) {
   if (!file || typeof file !== 'object') {
     throw new Error("无效的文件对象提供给 readTextFileFromMemory");
  }
  console.log(`[readTextFileFromMemory] 尝试从文件对象中读取 TXT 内容: ${file.originalFilename}`);

  try {
    // 从文件对象的 _writeStream 中获取 chunks 数组
    console.log("[readTextFileFromMemory] 访问 file._writeStream.chunks...");
    const chunks = file?._writeStream?.chunks;

    // 验证 chunks 是否有效
    if (!chunks || !Array.isArray(chunks)) {
      console.error("[readTextFileFromMemory] 错误: 未能从 file._writeStream 中找到有效的 chunks 数组。", file?._writeStream);
      throw new Error("无法读取文件内存数据 (chunks not found in _writeStream)");
    }
     if (chunks.length === 0) {
         console.warn("[readTextFileFromMemory] 警告: 文件数据块 (chunks) 数组为空，返回空字符串。");
         return ''; // 文件为空，返回空字符串
     } else {
        console.log(`[readTextFileFromMemory] 找到 ${chunks.length} 个数据块 (chunks)。`);
     }

    // 合并 Buffer 数组
    const fileBuffer = Buffer.concat(chunks);
    console.log(`[readTextFileFromMemory] 成功合并 ${fileBuffer.length} 字节的数据 Buffer。`);

    // 将 Buffer 转换为 UTF-8 字符串并返回
    return fileBuffer.toString('utf8');

  } catch (error) {
    console.error(`[readTextFileFromMemory] 读取 TXT 文件 (来自内存) 时出错 (原始文件名: ${file?.originalFilename}):`, error);
    throw new Error(`读取文本文件失败: ${error.message}`);
  }
}