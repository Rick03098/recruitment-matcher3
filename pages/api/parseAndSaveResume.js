import Airtable from 'airtable';

// 配置环境变量
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || 'patCOFt5DYSAv73VI.a27ea50b39361b388fe941cd6b562518a08f7943631c2deddd479a8bb1ba6d38';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appYPoERDFlNulJgi';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'tblQbhrbMuzqpXfZP';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只支持POST请求' });
  }

  try {
    const { name, resumeText } = req.body;
    
    // 验证数据
    if (!name || !resumeText) {
      return res.status(400).json({ success: false, message: '姓名和简历内容不能为空' });
    }
    
    // 解析简历内容
    const parsedData = parseResumeContent(resumeText);
    
    try {
      // 保存到Airtable
      const airtableRecord = await saveToAirtable({
        ...parsedData,
        name: name || parsedData.name
      }, '手动输入');
      
      // 返回成功响应
      return res.status(200).json({
        success: true,
        message: '简历已成功添加到简历库',
        data: {
          name,
          skills: parsedData.skills.join(', ') || '无识别技能',
          experience: parsedData.experience || '未检测到',
          education: parsedData.education || '未检测到'
        },
        airtableRecord
      });
    } catch (airtableError) {
      console.error('Airtable保存错误:', airtableError);
      
      // 即使Airtable保存失败，也返回解析结果
      return res.status(200).json({
        success: true,
        message: '简历已成功解析，但保存到Airtable失败: ' + airtableError.message,
        data: {
          name,
          skills: parsedData.skills.join(', ') || '无识别技能',
          experience: parsedData.experience || '未检测到',
          education: parsedData.education || '未检测到'
        },
        parsedData
      });
    }
  } catch (error) {
    console.error('处理简历时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message || '未知错误'
    });
  }
}

// 解析简历内容
function parseResumeContent(text) {
  try {
    const skills = extractSkills(text);
    const title = extractTitle(text);
    const experience = extractExperience(text);
    const education = extractEducation(text);
    const name = extractName(text);
    const contact = extractContact(text);
    
    return {
      name,
      title,
      skills,
      experience,
      education,
      contact,
      rawText: text.substring(0, 1000)
    };
  } catch (error) {
    console.error('解析简历内容出错:', error);
    return {
      name: '',
      title: '',
      skills: [],
      experience: '',
      education: '',
      contact: '',
      rawText: text.substring(0, 1000)
    };
  }
}

// 从文本中提取名字
function extractName(text) {
  try {
    const nameMatch = text.match(/(姓\s*名|名\s*字)\s*[：:]\s*([^\n\r,，.。、]+)/);
    if (nameMatch && nameMatch[2]) {
      return nameMatch[2].trim();
    }
    
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && line.length < 10 && !line.includes('简历') && !line.includes('个人')) {
        return line;
      }
    }
    
    return '未检测到';
  } catch (error) {
    return '未检测到';
  }
}

// 提取联系方式
function extractContact(text) {
  try {
    const contacts = [];
    
    const phoneMatch = text.match(/(\d{11})|(\d{3}[-\s]?\d{4}[-\s]?\d{4})/);
    if (phoneMatch) {
      contacts.push('电话: ' + phoneMatch[0]);
    }
    
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      contacts.push('邮箱: ' + emailMatch[0]);
    }
    
    return contacts.join(', ') || '未检测到';
  } catch (error) {
    return '未检测到';
  }
}

// 从文本中提取技能
function extractSkills(text) {
  try {
    const commonSkills = [
      'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'TypeScript',
      'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift',
      'HTML', 'CSS', 'SASS', 'Bootstrap', 'Tailwind',
      'MongoDB', 'MySQL', 'PostgreSQL', 'SQL', 'NoSQL', 'Redis',
      'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git',
      'Linux', 'Windows', 'MacOS', 'Android', 'iOS',
      '前端', '后端', '全栈', '开发', '测试', 'UI', 'UX',
      '数据分析', '机器学习', '人工智能', 'AI', '算法', '数据结构',
      '市场营销', '用户增长', '内容运营', '社交媒体',
      'Figma', '产品原型', '信息架构', 'Tableau', 'R'
    ];
    
    return commonSkills.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
  } catch (error) {
    return [];
  }
}

// 从文本中提取职位名称
function extractTitle(text) {
  try {
    const commonTitles = [
      '前端开发工程师', '后端开发工程师', '全栈开发工程师',
      '软件工程师', '产品经理', 'UI设计师', 'UX设计师',
      '数据分析师', '人工智能工程师', '机器学习工程师',
      '测试工程师', '运维工程师', '项目经理',
      '内容运营', '市场营销', '用户研究', '产品设计'
    ];
    
    for (const title of commonTitles) {
      if (text.includes(title)) {
        return title;
      }
    }
    
    return '开发工程师';
  } catch (error) {
    return '开发工程师';
  }
}

// 从文本中提取经验年数
function extractExperience(text) {
  try {
    const expMatch = text.match(/(\d+)\s*年.*经验/);
    if (expMatch) {
      return `${expMatch[1]}年`;
    }
    return '未检测到';
  } catch (error) {
    return '未检测到';
  }
}

// 从文本中提取教育信息
function extractEducation(text) {
  try {
    const eduLevels = ['博士', '硕士', '本科', '大专', '高中'];
    
    for (const level of eduLevels) {
      if (text.includes(level)) {
        return level;
      }
    }
    
    return '未检测到';
  } catch (error) {
    return '未检测到';
  }
}

// 将解析结果保存到Airtable
async function saveToAirtable(resumeData, source) {
  // 初始化Airtable
  const base = new Airtable({apiKey: AIRTABLE_API_KEY}).base(AIRTABLE_BASE_ID);
  const table = base(AIRTABLE_TABLE_NAME);
  
  // 准备记录数据
  const fields = {
    "Name": resumeData.name || '未检测到姓名',
    "Title": resumeData.title || '未检测到职位',
    "Skills": resumeData.skills || [],
    "Experience": resumeData.experience || '未检测到',
    "Education": resumeData.education || '未检测到',
    "Contact": resumeData.contact || '未检测到',
    "Source": source || '手动输入',
    "Upload Date": new Date().toISOString()
  };
  
  // 创建记录
  return new Promise((resolve, reject) => {
    table.create([{fields}], function(err, records) {
      if (err) {
        console.error('Airtable错误:', err);
        return reject(err);
      }
      
      const record = records[0];
      resolve({
        id: record.getId(),
        ...fields
      });
    });
  });
}
