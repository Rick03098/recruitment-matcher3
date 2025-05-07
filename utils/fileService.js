import { FILE_CONFIG } from './config';

export const parseJobDescription = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/parseJDFile', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to parse job description');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error parsing job description:', error);
    throw error;
  }
};

export const validateFile = (file) => {
  if (!file) {
    throw new Error('请选择文件');
  }

  if (!FILE_CONFIG.JD.allowedTypes.includes(file.type)) {
    throw new Error(`不支持的文件类型。请上传 ${FILE_CONFIG.JD.allowedTypes.join(', ')} 格式的文件`);
  }

  if (file.size > FILE_CONFIG.JD.maxSize) {
    throw new Error(`文件大小不能超过 ${FILE_CONFIG.JD.maxSize / 1024 / 1024}MB`);
  }

  return true;
};

// 保存文件
export async function saveFile(file, directory) {
  const timestamp = Date.now();
  const filename = `${timestamp}-${file.originalname}`;
  const filepath = path.join(directory, filename);

  await fs.promises.writeFile(filepath, file.buffer);
  return {
    filename,
    filepath,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  };
}

// 解析JD文件
export async function parseJDFile(file) {
  try {
    let extractedText = '';
    let structuredData = null;

    // 处理图片文件
    if (file.mimetype.startsWith('image/')) {
      const base64Image = file.buffer.toString('base64');
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `分析以下职位描述图片。首先准确提取完整文本。然后，基于提取的文本，提供一个包含关键要求的 JSON 对象。JSON 对象必须包含以下精确的键：
- "jobTitle": string (广告中提到的具体职位)
- "requiredSkills": string[] (必备技能列表)
- "preferredSkills": string[] (优先技能列表)
- "yearsExperience": string (工作经验要求)
- "educationLevel": string (学历要求)
- "responsibilities": string[] (工作职责列表)

如果无法可靠地提取 JSON 结构，仅返回从图片中提取的完整文本。`
              },
              {
                type: "image_url",
                image_url: {
                  "url": `data:${file.mimetype};base64,${base64Image}`,
                  "detail": "high"
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          structuredData = JSON.parse(content);
          extractedText = content;
        } catch (parseError) {
          extractedText = content;
        }
      }
    } 
    // 处理文本文件
    else {
      extractedText = file.buffer.toString('utf-8');
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "你是一个专业的招聘顾问，擅长从职位描述中提取结构化信息。"
          },
          {
            role: "user",
            content: `请从以下职位描述中提取关键信息，并以JSON格式返回：

${extractedText}

请确保返回的是有效的JSON格式，包含以下字段：
- jobTitle: 职位名称
- requiredSkills: 必备技能数组
- preferredSkills: 优先技能数组
- yearsExperience: 工作经验要求
- educationLevel: 学历要求
- responsibilities: 工作职责数组`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          structuredData = JSON.parse(content);
        } catch (parseError) {
          console.warn('JSON解析错误:', parseError);
        }
      }
    }

    return {
      success: true,
      data: {
        text: extractedText,
        structuredData,
        fileInfo: {
          name: file.originalname,
          size: file.size,
          type: file.mimetype
        }
      }
    };
  } catch (error) {
    console.error('JD解析错误:', error);
    return {
      success: false,
      error: error.message || '文件解析失败'
    };
  }
} 