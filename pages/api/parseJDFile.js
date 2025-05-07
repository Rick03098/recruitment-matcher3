import nextConnect from 'next-connect';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';

const upload = multer({ dest: '/tmp' });

const apiRoute = nextConnect({
  onError(error, req, res) {
    res.status(501).json({ success: false, message: `上传失败: ${error.message}` });
  },
  onNoMatch(req, res) {
    res.status(405).json({ success: false, message: `不支持的方法: ${req.method}` });
  },
});

apiRoute.use(upload.single('jobFile'));

apiRoute.post(async (req, res) => {
  try {
    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    fs.unlinkSync(filePath); // 删除临时文件
    res.status(200).json({ success: true, text: data.text });
  } catch (err) {
    res.status(500).json({ success: false, message: 'PDF解析失败: ' + err.message });
  }
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false, // 让multer接管
  },
}; 