// pages/api/simpleMatch.js
export default async function handler(req, res) {
  console.log('simpleMatch API被调用');
  
  try {
    // 简单响应，不做复杂处理
    return res.status(200).json({
      matches: [
        {
          id: '1',
          name: '张三',
          title: '前端开发工程师',
          skills: ['JavaScript', 'React'],
          experience: '3年',
          education: '本科',
          matchScore: 85,
          matchDetails: {
            skillsScore: 85,
            experienceScore: 80,
            educationScore: 90,
            matchedSkills: ['JavaScript', 'React'],
            missingSkills: [],
            analysis: '候选人技能匹配良好',
            recommendation: '推荐考虑'
          }
        }
      ],
      jobRequirements: {
        jobTitle: '前端开发',
        skills: ['JavaScript', 'React'],
        experience: '3年以上',
        education: '本科及以上'
      }
    });
  } catch (error) {
    console.error('匹配过程出错:', error);
    return res.status(500).json({ error: error.message });
  }
}
