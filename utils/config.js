// 文件类型配置
export const FILE_CONFIG = {
  JD: {
    maxSize: 15 * 1024 * 1024, // 15MB
    allowedTypes: [
      'application/pdf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    allowedExtensions: ['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx']
  }
};

// API配置
export const API_CONFIG = {
  timeout: 30000, // 30秒超时
  maxRetries: 3,  // 最大重试次数
};

// OpenAI配置
export const OPENAI_CONFIG = {
  model: {
    text: "gpt-3.5-turbo",
    vision: "gpt-4-vision-preview"
  },
  maxTokens: 1000,
  temperature: 0.3
}; 