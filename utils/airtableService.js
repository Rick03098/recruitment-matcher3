// utils/airtableService.js
import Airtable from 'airtable';

// 从环境变量读取配置
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

// 检查环境变量是否都已设置
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  console.error("错误：Airtable 环境变量 (AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME) 未在 .env.local 文件中完全配置！");
}

// 初始化 Airtable Base
let base;
try {
    // 只有在所有配置都存在时才尝试初始化
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
         base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
         console.log(`Airtable Base (ID: ${AIRTABLE_BASE_ID}) 初始化成功。`);
    } else {
        throw new Error("Airtable API Key或Base ID缺失。");
    }
} catch (error) {
    console.error(`初始化 Airtable Base (ID: ${AIRTABLE_BASE_ID}) 时出错:`, error);
    base = null; // 标记为不可用
}

/**
 * 将解析结果保存到Airtable
 * @param {object} resumeData - 包含解析出的简历信息的对象
 * @param {string} source - 简历来源 (例如文件名或'手动输入')
 * @returns {Promise<object>} 创建的 Airtable 记录 (包含 id 和字段)
 */
export async function saveToAirtable(resumeData, source) {
  if (!base) {
      throw new Error("Airtable Base 未成功初始化，无法保存。");
  }
  if (!AIRTABLE_TABLE_NAME) {
     throw new Error("Airtable 表名 (AIRTABLE_TABLE_NAME) 未在 .env.local 中配置，无法保存。");
  }

  try {
    const table = AIRTABLE_TABLE_NAME; // 使用从环境变量获取的表名

    // 准备 Airtable 记录数据 (确保字段名与你的 'resumepool' 表列名一致)
    const recordData = {
      "Name": resumeData.name || '未检测到姓名',
      "Title": resumeData.title || (Array.isArray(resumeData.experience) && resumeData.experience.length > 0 ? resumeData.experience[0].title : '未检测到职位'), // 尝试从第一条经验获取 Title
      "Skills": Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : (resumeData.skills || ''),
      "Experience": typeof resumeData.experience === 'object' ? JSON.stringify(resumeData.experience, null, 2) : (resumeData.experience || '未检测到'),
      "Education": typeof resumeData.education === 'object' ? JSON.stringify(resumeData.education, null, 2) : (resumeData.education || '未检测到'),
      "Contact": typeof resumeData.contact === 'object' ? JSON.stringify(resumeData.contact, null, 2) : (resumeData.contact || '未检测到'),
      "Source": source || '未知来源',
      "Upload Date": new Date().toISOString(),
      "RawTextPreview": resumeData.rawTextPreview || '' // 确保这个字段在Airtable存在
    };

    console.log(`准备发送到 Airtable 表 '${table}' 的数据:`, JSON.stringify(recordData, null, 2));

    const records = await base(table).create([ { fields: recordData } ]);

    if (!records || records.length === 0) {
      throw new Error('Airtable 记录创建失败');
    }
    console.log(`成功创建 Airtable 记录, ID: ${records[0].id}`);
    return { id: records[0].id, ...recordData };

  } catch (error) {
    console.error(`保存到 Airtable 表 '${AIRTABLE_TABLE_NAME}' 时出错:`, error);
     // 提供更具体的错误帮助信息
     if (error.message.includes('NOT_FOUND')) {
         console.error(`错误详情：找不到 Base ID ('<span class="math-inline">\{AIRTABLE\_BASE\_ID\}'\) 或 Table Name \('</span>{AIRTABLE_TABLE_NAME}')。请检查 .env.local 文件和你的 Airtable 设置。`);
     } else if (error.message.includes('AUTHENTICATION_REQUIRED') || error.message.includes('INVALID_API_KEY')) {
         console.error(`错误详情：Airtable API Key ('${AIRTABLE_API_KEY ? '***' + AIRTABLE_API_KEY.slice(-4) : '未设置'}') 无效或权限不足。请检查 .env.local 文件。`);
     } else if (error.message.includes('INVALID_REQUEST') || error.message.includes('UNKNOWN_FIELD_NAME')) {
         console.error('错误详情：Airtable 请求无效。请检查发送的 recordData 结构中的字段名 ("Name", "Title", "Skills"...) 是否与 Airtable 表中的列名完全匹配，并且数据类型是否兼容。发送的数据:', recordData);
     }
    throw new Error(`保存到 Airtable 失败: ${error.message}`);
  }
}
