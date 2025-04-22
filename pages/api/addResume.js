export default function handler(req, res) {
  // 确保接受POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '只支持POST请求' });
  }

  try {
    // 获取请求数据
    const { name, resumeText } = req.body;
    
    // 验证数据
    if (!name || !resumeText) {
      return res.status(400).json({ success: false, message: '姓名和简历内容不能为空' });
    }
    
    // 提取技能 (简单演示)
    const skills = [];
    const keywords = ['UI', 'UX', 'HTML', 'CSS', 'JavaScript', 'React', 'Python'];
    keywords.forEach(keyword => {
      if (resumeText.includes(keyword)) {
        skills.push(keyword);
      }
    });
    
    // 模拟成功处理，返回固定格式的JSON
    return res.status(200).json({
      success: true,
      message: '简历已成功添加',
      data: {
        name,
        skills: skills.join(', ') || '无识别技能',
        experience: '3年',
        education: '本科'
      }
    });
  } catch (error) {
    // 确保错误信息也是有效的JSON
    console.error('处理简历时出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
}
