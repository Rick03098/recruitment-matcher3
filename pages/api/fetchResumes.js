// pages/api/fetchResumes.js
import Airtable from 'airtable';

// --- Airtable 配置 ---
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

// 检查配置
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  console.error("[API /fetchResumes] 错误：Airtable 环境变量未完全配置！");
  // 在实际部署中，这里可能应该直接抛出错误
}

let base;
try {
    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
        base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    } else {
        throw new Error("Airtable API Key 或 Base ID 缺失。");
    }
} catch (error) {
    console.error(`[API /fetchResumes] 初始化 Airtable Base 时出错:`, error);
    base = null;
}
// --- 配置结束 ---


/**
 * 安全地将逗号分隔的字符串转换为数组
 * @param {string | undefined | null} str - 输入字符串
 * @returns {string[]} 返回字符串数组，如果输入无效则返回空数组
 */
function safeStringToArray(str) {
    if (typeof str === 'string' && str.trim() !== '') {
        return str.split(',').map(item => item.trim()); // 分割并去除首尾空格
    }
    return []; // 返回空数组
}

/**
 * 安全地解析 JSON 字符串
 * @param {string | undefined | null} jsonString - 输入的 JSON 字符串
 * @param {any} defaultValue - 解析失败时返回的默认值 (例如 null, [], {})
 * @returns {any} 解析后的对象/数组，或默认值
 */
function safeJsonParse(jsonString, defaultValue = null) {
    if (typeof jsonString === 'string' && jsonString.trim() !== '') {
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.warn(`[API /fetchResumes] 解析 JSON 字符串失败: "${jsonString.substring(0, 50)}..."`, e);
            return defaultValue; // 解析失败返回默认值
        }
    }
    return defaultValue; // 输入无效返回默认值
}


export default async function handler(req, res) {
  // 检查 Airtable base 是否成功初始化
  if (!base) {
      return res.status(500).json({ error: 'Airtable 服务配置错误，无法获取简历。' });
  }
   if (!AIRTABLE_TABLE_NAME) {
       return res.status(500).json({ error: 'Airtable 表名未配置，无法获取简历。' });
   }

  console.log(`[API /fetchResumes] 开始从 Airtable 表 '${AIRTABLE_TABLE_NAME}' 获取简历...`);

  try {
    const allRecords = []; // 用于存储所有获取到的记录

    // Airtable 查询配置
    await base(AIRTABLE_TABLE_NAME)
      .select({
        // 在这里列出你需要从 Airtable 获取的所有字段名！
        // **确保这些字段名与你在 Airtable 表中设置的完全一致！**
        fields: [
          "Name",
          "Title", // 我们在 save 时会尝试填充这个
          "Contact", // JSON 字符串
          "Source",
          "Upload Date",
          "RawTextPreview",
          // --- 新增字段 ---
          "TotalYearsExperience", // Number
          "CoreSkills",         // 逗号分隔字符串
          "SoftSkills",         // 逗号分隔字符串
          "ProcessSkills",      // 逗号分隔字符串
          "Tools",              // 逗号分隔字符串
          "ExperienceSummary",  // Long Text (String)
          "EducationDetails",   // JSON 字符串
          "ExperienceDetails",  // JSON 字符串
          // "KeywordsRaw"      // 如果需要也获取这个
        ],
        
        view: "Grid view", // 或者你使用的特定视图名称
         // 可以添加排序，例如按上传日期降序
         sort: [{field: "Upload Date", direction: "desc"}]
      })
      .eachPage(
        function page(records, fetchNextPage) {
          // 这个函数会在获取到每一页数据时被调用
          console.log(`[API /fetchResumes] 获取到 ${records.length} 条记录...`);
          records.forEach(record => {
            // --- 处理获取到的数据 ---
            const rawData = record.fields;
            const processedData = {
              id: record.id, // 保留 Airtable 记录 ID
              name: rawData.Name || '未知姓名',
              title: rawData.Title || '未知职位',
              contact: safeJsonParse(rawData.Contact, {}), // 解析联系方式 JSON
              source: rawData.Source || '未知',
              uploadDate: rawData['Upload Date'], // 直接使用日期字符串
              rawTextPreview: rawData.RawTextPreview || '',

              // --- 处理新增字段 ---
              totalYearsExperience: typeof rawData.TotalYearsExperience === 'number' ? rawData.TotalYearsExperience : null,
              // 将逗号分隔的字符串转回数组
              coreSkills: safeStringToArray(rawData.CoreSkills),
              softSkills: safeStringToArray(rawData.SoftSkills),
              processSkills: safeStringToArray(rawData.ProcessSkills),
              tools: safeStringToArray(rawData.Tools),
              // 直接使用文本
              experienceSummary: rawData.ExperienceSummary || null,
              // 解析 JSON 字符串
              educationDetails: safeJsonParse(rawData.EducationDetails, {}),
              experienceDetails: safeJsonParse(rawData.ExperienceDetails, []), // 默认为空数组
              // keywordsRaw: rawData.KeywordsRaw || '', // 如果获取了 KeywordsRaw
            };
            allRecords.push(processedData);
          });

          // 获取下一页数据
          fetchNextPage();
        },
        function done(err) {
          // 这个函数会在所有页面都获取完毕或发生错误时被调用
          if (err) {
            console.error('[API /fetchResumes] 从 Airtable 获取数据时出错:', err);
            // 直接在回调中发送错误响应可能不是最佳实践，最好通过 Promise reject
            // 但为了简单起见，我们先在这里处理
             if (!res.headersSent) { // 确保响应头还没发送
                 res.status(500).json({ error: `获取 Airtable 数据失败: ${err.message}` });
             }
            return; // 提前退出
          }

          // 所有数据获取成功
          console.log(`[API /fetchResumes] 总共获取并处理了 ${allRecords.length} 条简历记录。`);
          if (!res.headersSent) {
              res.status(200).json({
                  resumes: allRecords,
                  source: 'airtable', // 指明数据来源
                  count: allRecords.length
              });
          }
        }
      );

    // 注意：上面的 eachPage 方法是异步的，它完成后会调用 done 函数。
    // Node.js 进程不会在这里等待，所以我们需要确保 done 函数能发送响应。

  } catch (error) {
    // 捕获 base(..).select(...) 调用本身可能抛出的同步错误 (虽然不常见)
    console.error('[API /fetchResumes] 调用 Airtable select 方法时出错:', error);
     if (!res.headersSent) {
        res.status(500).json({ error: `Airtable API 调用失败: ${error.message}` });
     }
  }
}