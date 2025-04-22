import fs from 'fs';
import pdfParse from 'pdf-parse';

// 从PDF文件中提取文本内容
export async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF解析错误:', error);
    throw new Error('PDF解析失败');
  }
}

// 解析简历内容
export function parseResumeContent(text) {
  // 提取关键信息
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
    // 包含部分原始文本用于预览
    rawText: text.substring(0, 1000)
  };
}

// 从文本中提取名字
export function extractName(text) {
  // 简单的名字提取规则，可根据简历常见格式调整
  const nameMatch = text.match(/(姓\s*名|名\s*字)\s*[：:]\s*([^\n\r,，.。、]+)/);
  if (nameMatch && nameMatch[2]) {
    return nameMatch[2].trim();
  }
  
  // 尝试从文本开头提取名字
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line && line.length < 10 && !line.includes('简历') && !line.includes('个人')) {
      return line;
    }
  }
  
  return '未检测到';
}

// 提取联系方式
export function extractContact(text) {
  const contacts = [];
  
  // 提取手机号
  const phoneMatch = text.match(/(\d{11})|(\d{3}[-\s]?\d{4}[-\s]?\d{4})/);
  if (phoneMatch) {
    contacts.push('电话: ' + phoneMatch[0]);
  }
  
  // 提取邮箱
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    contacts.push('邮箱: ' + emailMatch[0]);
  }
  
  return contacts.join(', ') || '未检测到';
}

// 尝试从文件名中提取姓名
export function extractNameFromFilename(filename) {
  // 移除扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 如果文件名像是"张三的简历"或"简历-李四"格式
  const nameMatch = nameWithoutExt.match(/(.*?)的?简历|简历[-_\s]+(.*)/);
  if (nameMatch) {
    return (nameMatch[1] || nameMatch[2]).trim();
  }
  
  // 否则直接返回文件名作为姓名
  return nameWithoutExt;
}

// 从文本中提取技能
export function extractSkills(text) {
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
}

// 从文本中提取职位名称
export function extractTitle(text) {
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
}

// 从文本中提取经验年数
export function extractExperience(text) {
  const expMatch = text.match(/(\d+)\s*年.*经验/);
  if (expMatch) {
    return `${expMatch[1]}年`;
  }
  return '未检测到';
}

// 从文本中提取教育信息
export function extractEducation(text) {
  const eduLevels = ['博士', '硕士', '本科', '大专', '高中'];
  const schools = ['大学', '学院', '学校'];
  
  for (const level of eduLevels) {
    if (text.includes(level)) {
      // 尝试匹配学校名称
      for (const schoolType of schools) {
        const regex = new RegExp(`([^\\s,，.。、]{2,15}${schoolType})`, 'g');
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          return `${level} - ${matches[0]}`;
        }
      }
      return level;
    }
  }
  
  return '未检测到';
}
