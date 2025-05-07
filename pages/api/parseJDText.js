import { parseJobDescriptionWithOpenAI } from '../../utils/openaiService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只支持POST请求' });
  }
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '缺少有效的JD文本' });
  }
  try {
    const result = await parseJobDescriptionWithOpenAI(text);
    if (!result.success) {
      return res.status(200).json({ error: result.error || 'JD结构化分析失败' });
    }
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'JD结构化分析异常' });
  }
} 