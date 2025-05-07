import fs from 'fs';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function getImageBase64(filePath) {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        return imageBuffer.toString('base64');
    } catch (error) {
        console.error('读取图片失败:', error);
        throw new Error('读取图片失败: ' + error.message);
    }
}

export async function visionExtractTextFromImage(base64Image) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "请提取图片中的所有文本内容，保持原始格式。如果有多页，请按页码顺序提取。"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096
        });

        return response;
    } catch (error) {
        console.error('Vision API 调用失败:', error);
        throw new Error('图片文本提取失败: ' + error.message);
    }
}

export async function extractTextFromVisionResponse(visionRes) {
    try {
        const content = visionRes.choices[0].message.content;
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.map(x => x.text || '').join('\n');
        return '';
    } catch (error) {
        console.error('解析 Vision 响应失败:', error);
        return '';
    }
} 