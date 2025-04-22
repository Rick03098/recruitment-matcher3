import { saveToAirtable } from '../../utils/airtableService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只支持POST请求' });
  }

  try {
    const { name, title, skills, experience, education, contact, fileName } = req.body;
    
    // 验证数据
    if (!name) {
      return res.status(400).json({ success: false, message: '姓名不能为空' });
    }
    
    // 准备数据
    const resumeData = {
      name,
      title: title || '',
      skills: Array.isArray(skills) ? skills : [],
      experience: experience || '',
      education: education || '',
      contact: contact || ''
    };
    
    // 保存到Airtable
    const airtableRecord = await saveToAirtable(resumeData, fileName || '手动输入');
    
    return res.status(200).json({
      success: true,
      message: '简历已成功添加到简历库',
      data: {
        id: airtableRecord.id,
        name,
        skills: Array.isArray(skills) ? skills.join(', ') : '',
        experience: experience || '未检测到',
        education: education || '未检测到'
      }
    });
  } catch (error) {
    console.error('保存简历时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message || '未知错误'
    });
  }
}
