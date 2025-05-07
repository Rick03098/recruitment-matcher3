import fs from 'fs';
import pdfParse from 'pdf-parse';
import { fromPath } from 'pdf2pic';
import { getImageBase64, visionExtractTextFromImage } from './openaiVision';

class FileParser {
    constructor() {
        this.supportedTypes = {
            'application/pdf': this.parsePDF,
            'text/plain': this.parseText,
            'application/msword': this.parseWord,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.parseWord,
            'image/jpeg': this.parseImage,
            'image/png': this.parseImage
        };
    }

    async parse(filePath, fileType) {
        const parser = this.supportedTypes[fileType];
        if (!parser) {
            throw new Error(`不支持的文件类型: ${fileType}`);
        }
        return await parser.call(this, filePath);
    }

    async parsePDF(filePath) {
        try {
            // 1. 首先尝试直接解析PDF文本
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            let text = pdfData.text;

            // 2. 如果文本提取不完整，使用OCR补充
            if (!text || text.length < 100) {
                const pdf2pic = fromPath(filePath, {
                    density: 180,
                    saveFilename: 'jd_page',
                    savePath: '/tmp',
                    format: 'jpeg',
                    width: 1200,
                    height: 1600
                });

                const totalPages = await this.getPdfPageCount(filePath);
                let ocrText = '';

                for (let i = 1; i <= totalPages; i++) {
                    const page = await pdf2pic(i);
                    const base64 = fs.readFileSync(page.path).toString('base64');
                    const visionRes = await visionExtractTextFromImage(base64);
                    ocrText += this.extractTextFromVisionResponse(visionRes) + '\n';
                    fs.unlinkSync(page.path);
                }

                text = text + '\n' + ocrText;
            }

            return text.trim();
        } catch (error) {
            console.error('PDF解析错误:', error);
            throw new Error('PDF解析失败: ' + error.message);
        }
    }

    async parseText(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8').trim();
        } catch (error) {
            throw new Error('文本文件读取失败: ' + error.message);
        }
    }

    async parseWord(filePath) {
        // TODO: 实现Word文件解析
        throw new Error('Word文件解析功能开发中');
    }

    async parseImage(filePath) {
        try {
            const base64 = await getImageBase64(filePath);
            const visionRes = await visionExtractTextFromImage(base64);
            return this.extractTextFromVisionResponse(visionRes).trim();
        } catch (error) {
            throw new Error('图片解析失败: ' + error.message);
        }
    }

    async getPdfPageCount(pdfPath) {
        const buffer = fs.readFileSync(pdfPath);
        const text = buffer.toString('latin1');
        const match = text.match(/\/Type\s*\/Page[^s]/g);
        return match ? match.length : 1;
    }

    extractTextFromVisionResponse(visionRes) {
        try {
            const contentArr = visionRes.choices[0].message.content;
            if (typeof contentArr === 'string') return contentArr;
            if (Array.isArray(contentArr)) return contentArr.map(x => x.text || '').join('\n');
            return '';
        } catch {
            return '';
        }
    }
}

export const fileParser = new FileParser(); 