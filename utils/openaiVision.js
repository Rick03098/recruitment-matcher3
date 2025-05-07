import axios from 'axios';
import fs from 'fs';

export async function getImageBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return data.toString('base64');
}

export async function visionExtractTextFromImage(base64, openaiApiKey) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4-vision-preview', // 或 gpt-4o
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别图片中的职位描述文本，并尽量结构化输出（如岗位、必备技能、优先技能、经验、学历等）。' },
            { type: 'image_url', image_url: { "url": `data:image/jpeg;base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 2048
    },
    {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
} 