export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只支持POST请求' });
  }

  const { jobDescription, resumes = [] } = req.body;

  if (!jobDescription) {
    return res.status(400).json({ message: '职位描述不能为空' });
  }

  if (resumes.length === 0) {
    return res.status(400).json({ message: '无简历数据进行匹配' });
  }

  try {
    // 从JD中提取关键词
    const keywords = extractKeywords(jobDescription);
    
    // 计算匹配度
    const matches = resumes.map(resume => {
      // 技能匹配
      const skills = resume.skills || [];
      const matchedSkills = skills.filter(skill => 
        keywords.some(keyword => 
          skill.toLowerCase().includes(keyword.toLowerCase()) || 
          keyword.toLowerCase().includes(skill.toLowerCase())
        )
      );
      
      const skillScore = keywords.length > 0 ? (matchedSkills.length / keywords.length) * 100 : 0;
      
      // 总分直接使用技能匹配分数
      const matchScore = Math.round(skillScore);
      
      return {
        ...resume,
        matchScore,
        matchDetails: {
          matchedSkills,
          missingSkills: skills.filter(skill => !matchedSkills.includes(skill)),
          analysis: generateAnalysis(resume.name, matchScore, matchedSkills)
        }
      };
    });
    
    // 按匹配度排序
    const sortedMatches = matches.sort((a, b) => b.matchScore - a.matchScore);
    
    // 职位要求
    const jobRequirements = {
      jobTitle: extractJobTitle(jobDescription),
      skills: keywords
    };
    
    return res.status(200).json({
      matches: sortedMatches,
      jobRequirements
    });
  } catch (error) {
    console.error('匹配过程出错:', error);
    return res.status(500).json({ error: '匹配过程出错: ' + error.message });
  }
}

// 提取关键词
function extractKeywords(text) {
  const commonTechKeywords = [
    'JavaScript', 'React', 'Vue', 'Angular', 'Node.js', 'TypeScript',
    'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift',
    'HTML', 'CSS', 'SASS', 'Bootstrap', 'Tailwind',
    'MongoDB', 'MySQL', 'PostgreSQL', 'SQL', 'NoSQL', 'Redis',
    'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git',
    'Linux', 'Windows', 'MacOS', 'Android', 'iOS',
    '前端', '后端', '全栈', '开发', '测试', 'UI', 'UX',
    '数据分析', '机器学习', '人工智能', 'AI', '算法', '数据结构',
    '市场营销', '用户增长', '内容运营', '社交媒体',
    '金融建模', '投资分析', 'Excel', 'PPT', 'Wind',
    'Figma', '产品原型', '信息架构', 'LeetCode', 'Tableau', 'R'
  ];
  
  // 提取常见技术关键词
  const extractedKeywords = commonTechKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return extractedKeywords.length > 0 ? extractedKeywords : ['技能'];
}

// 提取职位名称
function extractJobTitle(text) {
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
  
  return '未指定职位';
}

// 生成分析
function generateAnalysis(name, score, matchedSkills) {
  if (score >= 80) {
    return `${name}的技能非常匹配，掌握了${matchedSkills.join(', ')}等关键技能。`;
  } else if (score >= 50) {
    return `${name}的技能部分匹配，熟悉${matchedSkills.join(', ')}，但缺少一些关键技能。`;
  } else {
    return `${name}的技术栈与职位要求匹配度较低，可能需要额外培训。`;
  }
}
