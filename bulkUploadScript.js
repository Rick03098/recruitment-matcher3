// bulkUploadScript.js
// 一个本地脚本，用于自动扫描文件夹并将简历文件逐个上传到 API

console.log('脚本开始执行，准备加载模块...'); // <--- 诊断日志

const fs = require('fs').promises; // 使用 promise 版本的 fs
console.log('模块: fs 加载成功'); // <--- 诊断日志

const path = require('path');
console.log('模块: path 加载成功'); // <--- 诊断日志

const axios = require('axios'); // 用于发送 HTTP 请求
console.log('模块: axios 加载成功'); // <--- 诊断日志

const FormData = require('form-data'); // 用于构建 multipart/form-data 请求体
console.log('模块: form-data 加载成功'); // <--- 诊断日志

console.log('所有核心模块加载完毕。'); // <--- 诊断日志


// --- 配置区域 --- (!!! 请检查路径 !!!)

// 1. 包含简历文件的文件夹路径 (已按你的要求修改)
const RESUME_FOLDER_PATH = '/Users/wangjianle/Desktop/MiraclePlus/hiring/qijiresume'; // <--- 用户指定路径

// 2. (可选) 处理成功后，将文件移动到的文件夹路径 (请确保此文件夹存在，或设为 null)
const PROCESSED_FOLDER_PATH = '/Users/wangjianle/Desktop/MiraclePlus/hiring/qijiresume2'; // <--- 如果需要，请修改或设为 null

// 3. 你的 Next.js 应用 API 的地址 (保持不变)
const API_URL = 'http://localhost:3000/api/uploadAndSaveResume';

// 4. 每次上传之间的延迟时间 (已按你的要求修改为 15 秒)
const DELAY_BETWEEN_UPLOADS_MS = 1500; // 1.5 秒

// 5. 只处理这些文件扩展名 (保持不变)
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];

// --- 脚本主逻辑 ---

/**
 * 异步函数：处理单个文件的上传
 * @param {string} filePath 文件的完整路径
 * @param {string} fileName 文件名
 */
async function uploadFile(filePath, fileName) {
  console.log(`\n[处理中] 文件: ${fileName}`);

  // 创建 FormData 对象
  const form = new FormData();
  try {
    // 将文件内容添加到 form-data 中
    form.append('file', await fs.readFile(filePath), fileName); // 使用 await 读取文件
    console.log(`  - 正在上传到: ${API_URL}`);

    // 发送 POST 请求
    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(), // 包含 form-data 生成的 Content-Type header
      },
      timeout: 60000, // 设置超时时间 60 秒
    });

    // 检查响应状态
    if (response.status === 200 && response.data?.success) {
      console.log(`  ✅ [成功] ${fileName}: ${response.data.message}`);
      // 可选：移动已处理的文件
      if (PROCESSED_FOLDER_PATH) {
        try {
          const destPath = path.join(PROCESSED_FOLDER_PATH, fileName);
           console.log(`  - 正在移动文件到: ${destPath}`);
          await fs.rename(filePath, destPath); // 使用 await 移动
          console.log(`  - 文件移动成功.`);
        } catch (moveError) {
          console.error(`  ❌ [错误] 移动文件 ${fileName} 失败:`, moveError.message);
        }
      }
      return true; // 成功
    } else {
      console.error(`  ❌ [失败] ${fileName}: API 返回错误或非成功状态。`);
      console.error('     响应状态:', response.status);
      console.error('     响应数据:', JSON.stringify(response.data, null, 2)); // 打印更详细的数据
      return false; // 失败
    }
  // 在 uploadFile 函数内部...
} catch (error) {
    // --- 修改错误日志 ---
    console.error(`  ❌ [失败] 上传或处理文件 ${fileName} 时发生网络或代码错误:`);
    if (error.response) {
      // 这是 Axios 从服务器收到了错误响应 (例如 4xx, 5xx)
      console.error('     错误类型: HTTP Error Response');
      console.error('     HTTP 状态码:', error.response.status);
      // 尝试打印后端返回的 JSON 错误信息
      console.error('     后端返回数据:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // 请求已发出，但没有收到响应 (可能是网络问题、超时、DNS 错误、API 地址不通等)
      console.error('     错误类型: Network Error / No Response');
      console.error('     错误代码 (如果可用):', error.code); // 例如 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'
      console.error('     错误消息:', error.message); // 即使之前为空，这里也尝试打印
    } else {
      // 在设置请求时就发生错误，或者其他类型的错误
      console.error('     错误类型: Request Setup / Generic Error');
      console.error('     错误消息:', error.message);
    }
    // **额外打印完整的错误对象结构，帮助我们看到所有信息**
    console.error('     完整错误对象详情:', error);
    // --- 日志修改结束 ---
    return false; // 表示失败
  }
// 函数的右括号 }
}

/**
 * 主函数：扫描目录并处理文件
 */
async function processResumeFolder() {
  console.log(`--- 开始处理简历文件夹 ---`); // 脚本主要逻辑的第一个日志
  console.log(`源文件夹: ${RESUME_FOLDER_PATH}`);
  if (PROCESSED_FOLDER_PATH) {
    console.log(`处理后移至: ${PROCESSED_FOLDER_PATH}`);
    // 确保目标文件夹存在
    try {
        await fs.access(PROCESSED_FOLDER_PATH);
    } catch (e) {
        console.log(`  - 注意：目标文件夹不存在，将尝试创建: ${PROCESSED_FOLDER_PATH}`);
        try {
             await fs.mkdir(PROCESSED_FOLDER_PATH, { recursive: true });
             console.log(`  - 目标文件夹创建成功。`);
        } catch (mkdirError) {
             console.error(`  - 错误：无法创建目标文件夹，文件将不会被移动。`, mkdirError.message);
             // 将 PROCESSED_FOLDER_PATH 设为 null，避免后续尝试移动时再次报错
             // processedFolderPath = null; // 或者在 uploadFile 中检查
        }
    }
  } else {
       console.log(`处理后不移动文件。`);
  }
  console.log(`API 端点: ${API_URL}`);
  console.log(`上传间隔: ${DELAY_BETWEEN_UPLOADS_MS / 1000} 秒`);
  console.log(`允许扩展名: ${ALLOWED_EXTENSIONS.join(', ')}`);
  console.log('-----------------------------');


  try {
    // 读取源文件夹中的所有文件/目录名
    let files;
     try{
        files = await fs.readdir(RESUME_FOLDER_PATH);
     } catch (readDirError) {
         console.error(`\n--- 错误：无法读取源文件夹 ---`);
         console.error(`路径: ${RESUME_FOLDER_PATH}`);
         console.error(`错误信息: ${readDirError.message}`);
         console.error(`请确认路径是否存在且有读取权限。脚本已停止。`);
         console.error('---------------------------------');
         return; // 无法读取目录，直接退出
     }


    // 筛选出符合条件的文件
    const resumeFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      // 额外检查：排除以 '.' 开头的隐藏文件
      return ALLOWED_EXTENSIONS.includes(ext) && !file.startsWith('.');
    });

    if (resumeFiles.length === 0) {
      console.log('在源文件夹中没有找到符合条件的简历文件 (.pdf 或 .txt)，或者文件都已被处理。脚本结束。');
      return;
    }

    console.log(`找到 ${resumeFiles.length} 个简历文件待处理。`);

    let successCount = 0;
    let failureCount = 0;

    // --- 逐个处理文件 ---
    for (let i = 0; i < resumeFiles.length; i++) {
      const fileName = resumeFiles[i];
      const filePath = path.join(RESUME_FOLDER_PATH, fileName);

      // 检查是否是文件
      try {
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) {
              console.log(`\n[跳过] ${fileName} 是一个目录，不是文件。`);
              continue;
          }
      } catch(statError){
           console.error(`\n[错误] 无法获取文件状态 ${fileName}:`, statError.message);
           failureCount++;
           continue; // 跳过无法访问的文件
      }

      // 调用上传函数
      const success = await uploadFile(filePath, fileName);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // 等待（如果不是最后一个文件）
      if (i < resumeFiles.length - 1) {
        console.log(`\n...等待 ${DELAY_BETWEEN_UPLOADS_MS / 1000} 秒后处理下一个文件...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_UPLOADS_MS));
      }
    }

    // --- 处理完成总结 ---
    console.log('\n--- 处理完成 ---');
    console.log(`总计尝试处理文件: ${resumeFiles.length}`);
    console.log(`成功上传并处理: ${successCount}`);
    console.log(`处理失败或跳过: ${failureCount}`);
    console.log('------------------');

  } catch (error) {
    // 捕获 processResumeFolder 函数中的其他意外错误
    console.error('\n--- 脚本执行过程中发生严重错误 ---');
    console.error(error.message);
    console.error('---------------------------------');
  }
}

// --- 运行主函数 ---
console.log('准备调用 processResumeFolder 函数...');
processResumeFolder();
console.log('processResumeFolder 函数已调用 (脚本主体执行完毕，等待异步操作完成)。'); // 修正日志说明