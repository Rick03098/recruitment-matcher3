export default function handler(req, res) {
  // 返回模拟简历数据
  const mockResumes = [
    {
      id: '1',
      name: '张三',
      skills: ['JavaScript', 'React', 'HTML', 'CSS']
    },
    {
      id: '2',
      name: '李四',
      skills: ['Java', 'Spring Boot', 'MySQL']
    }
  ];
  
  res.status(200).json({ resumes: mockResumes });
}
