// utils/airtableService.js
import Airtable from 'airtable';

// --- Airtable 配置 ---
// 从环境变量读取配置
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

// 检查环境变量是否都已设置
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  console.error("错误：Airtable 环境变量 (AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME) 未在 .env.local 文件中完全配置！");
}

// 初始化 Airtable Base 实例
let base;
try {
    // 只有在所有配置都存在时才尝试初始化
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
         base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
         console.log(`Airtable Base (ID: ${AIRTABLE_BASE_ID}) 初始化成功。`);
    } else {
        throw new Error("Airtable API Key 或 Base ID 缺失。");
    }
} catch (error) {
    console.error(`初始化 Airtable Base (ID: ${AIRTABLE_BASE_ID}) 时出错:`, error);
    base = null; // 标记为不可用
}
// --- 配置结束 ---


/**
 * 将解析结果 (包含增强字段) 保存到 Airtable
 * @param {object} parsedData - 包含从 OpenAI 解析出的丰富简历信息的对象
 * @param {string} source - 简历来源 (例如文件名或'手动输入')
 * @returns {Promise<object>} 创建的 Airtable 记录 (包含 id 和字段)
 * @throws {Error} 如果保存失败
 */
export async function saveToAirtable(parsedData, source) {
  // 检查 Airtable base 是否成功初始化
  if (!base) {
      console.error("[saveToAirtable] Airtable Base 未初始化，无法保存。");
      throw new Error("Airtable Base 未成功初始化，无法保存。");
  }
  // 检查表名是否配置
  if (!AIRTABLE_TABLE_NAME) {
     console.error("[saveToAirtable] Airtable 表名未配置，无法保存。");
     throw new Error("Airtable 表名 (AIRTABLE_TABLE_NAME) 未在 .env.local 中配置，无法保存。");
  }
  // 检查传入的数据是否有效
  if (!parsedData || typeof parsedData !== 'object') {
       console.error("[saveToAirtable] 错误：接收到的 parsedData 为空或无效。");
       throw new Error("无法保存空的或无效的解析数据到 Airtable。");
  }

  try {
    const table = AIRTABLE_TABLE_NAME; // 使用配置的表名

    // --- 准备要写入 Airtable 的记录数据 ---
    // **重要:** 这里的键名 ("Name", "Title", "CoreSkills" 等) 必须与你在 Airtable 'resumepool' 表中创建的列名 **完全一致** (包括大小写)！
    const recordData = {
      // --- 基础字段 ---
      "Name": parsedData.name || '姓名未检测',
      // 尝试从第一条工作经历获取 Title
      "Title": (Array.isArray(parsedData.experienceDetails) && parsedData.experienceDetails.length > 0 ? parsedData.experienceDetails[0]?.title : null) || '职位未检测',
      // 存储联系方式对象为 JSON 字符串 (假设 Airtable 字段是 Long Text)
      "Contact": parsedData.contact ? JSON.stringify(parsedData.contact) : null,
      "Source": source || '未知来源',
      "Upload Date": new Date().toISOString(),
      "RawTextPreview": parsedData.rawTextPreview || '', // 来自 API 路由

      // --- 新增字段 ---
      // 直接存储数字，如果 OpenAI 返回 null 或非数字，则存 null
      "TotalYearsExperience": typeof parsedData.totalYearsExperience === 'number' ? parsedData.totalYearsExperience : null,
      // 将数组转换为逗号分隔的字符串，存入 Long Text 字段
      "CoreSkills": Array.isArray(parsedData.coreSkills) ? parsedData.coreSkills.join(', ') : '',
      "SoftSkills": Array.isArray(parsedData.softSkills) ? parsedData.softSkills.join(', ') : '',
      "ProcessSkills": Array.isArray(parsedData.processSkills) ? parsedData.processSkills.join(', ') : '',
      "Tools": Array.isArray(parsedData.tools) ? parsedData.tools.join(', ') : '',
      // 直接存储字符串
      "ExperienceSummary": parsedData.experienceSummary || null,
      // 将对象/数组转换为 JSON 字符串存储 (假设 Airtable 字段是 Long Text)
      "EducationDetails": parsedData.educationDetails ? JSON.stringify(parsedData.educationDetails, null, 2) : null,
      "ExperienceDetails": Array.isArray(parsedData.experienceDetails) ? JSON.stringify(parsedData.experienceDetails, null, 2) : null,

      // "KeywordsRaw": ..., // 如果需要处理 KeywordsRaw，在这里添加逻辑

    };

    // 打印最终准备发送的数据，方便调试字段名和类型
    console.log(`[saveToAirtable] 准备发送到 Airtable 表 '${table}' 的最终数据:`, JSON.stringify(recordData, null, 2));

    // 使用 Airtable API 创建记录
    const records = await base(table).create([ { fields: recordData } ]);

    // 检查 Airtable API 的响应
    if (!records || records.length === 0) {
      console.error('[saveToAirtable] Airtable record creation API call returned no records.');
      throw new Error('Airtable 记录创建失败 (API 未返回记录)');
    }
    console.log(`[saveToAirtable] 成功创建 Airtable 记录, ID: ${records[0].id}`);

    // 返回包含 Airtable 记录 ID 和我们发送的数据的对象
    // 注意：Airtable API 返回的 records[0].fields 可能只包含部分字段或有不同格式
    // 返回 recordData 可以确保我们得到的是我们期望存入的数据结构
    return { id: records[0].id, ...recordData };

  } catch (error) {
    console.error(`[saveToAirtable] 保存到 Airtable 表 '${AIRTABLE_TABLE_NAME}' 时出错:`, error);
     // 提供更具体的错误诊断信息
     if (error.message && (error.message.includes('UNKNOWN_FIELD_NAME') || error.message.includes('Invalid request'))) {
         console.error(`[saveToAirtable] 错误详情：请仔细检查上面打印的 "最终数据" 中的键名（如 "Name", "CoreSkills" 等）是否与你的 Airtable 表 '${AIRTABLE_TABLE_NAME}' 中的列名完全一致（包括大小写），并且数据类型是否兼容（例如，数字字段不能接收文本，多选字段需要特定格式等）。`);
     } else if (error.message && error.message.includes('NOT_FOUND')) {
          console.error(`[saveToAirtable] 错误详情：找不到 Base ID ('${AIRTABLE_BASE_ID}') 或 Table Name ('${AIRTABLE_TABLE_NAME}')。请检查 .env.local 文件和你的 Airtable 设置。`);
     } else if (error.message && error.message.includes('invalid authentication credentials')) { // 可能的 PAT 错误信息
          console.error(`[saveToAirtable] 错误详情：Airtable 认证失败。请检查 .env.local 中的 AIRTABLE_API_KEY 是否为有效的、且有权限访问该 Base 的 Personal Access Token 或 API Key。`);
     }
    // 重新抛出错误，让上层调用知道保存失败了
    throw new Error(`保存到 Airtable 失败: ${error.message}`);
  }
}
