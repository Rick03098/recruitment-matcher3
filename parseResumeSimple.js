export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  try {
    const { name, resumeText } = req.body;

    if (!name || !resumeText) {
      return res.status(400).json({ message: '姓名和简历内容不能为空' });
    }

    // 简单的关键词提取逻辑
    const extractedSkills = extractSkills(resumeText);
    const title = extractTitle(resumeText);
    const experience = extractExperience(resumeText);
    const education = extractEducation(resumeText);

    // 创建响应数据
    const responseData = {
      message: '简历处理成功',
      resumeData: {
        name,
        title: title || '未指定',
        skills: extractedSkills.join(', '),
        experience: experience || '未指定',
        education: education || '未指定'
      }
    };

    // 确保返回有效的JSON
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('简历处理失败:', error);
    // 确保错误响应也是有效的JSON
    return res.status(500).json({ 
      message: '简历处理失败', 
      error: error.message 
    });
  }
}

// 提取技能
function extractSkills(text) {
  const commonSkills = [
    'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'TypeScript',
    'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift',
    'HTML', 'CSS', 'SASS', 'Bootstrap', 'Tailwind',
    'MongoDB', 'MySQL', 'PostgreSQL', 'SQL', 'NoSQL', 'Redis',
    'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git',
    '前端', '后端', '全栈', '开发', '测试', 'UI', 'UX',
    '数据分析', '机器学习', '人工智能', 'AI', '算法', '数据结构'
  ];
  
  return commonSkills.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );
}

// 提取职位名称
function extractTitle(text) {
  const commonTitles = [
    '前端开发工程师', '后端开发工程师', '全栈开发工程师',
    '软件工程师', '产品经理', 'UI设计师', 'UX设计师',
    '数据分析师', '人工智能工程师', '机器学习工程师'
  ];
  
  for (const title of commonTitles) {
    if (text.toLowerCase().includes(title.toLowerCase())) {
      return title;
    }
  }
  
  return '开发工程师';
}

// 提取经验年数
function extractExperience(text) {
  const expMatch = text.match(/(\d+)\s*年.*经验/);
  if (expMatch) {
    return `${expMatch[1]}年`;
  }
  return '3年';
}

// 提取教育信息
function extractEducation(text) {
  const eduLevels = ['博士', '硕士', '本科', '大专', '高中'];
  
  for (const level of eduLevels) {
    if (text.includes(level)) {
      return level;
    }
  }
  
  return '本科';
}
