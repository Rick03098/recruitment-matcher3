import axios from 'axios';

const BAIDU_API_KEY = 'uqdiGk7aHJIgdACTWYpD9HEN';
const BAIDU_SECRET_KEY = 'M6pd8ZNBMifuGe4aUTQ8sNt6rILHTwmW';
let cachedToken = null;
let tokenExpire = 0;

export async function getBaiduAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpire) return cachedToken;
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
  const res = await axios.post(url);
  cachedToken = res.data.access_token;
  tokenExpire = now + (res.data.expires_in - 60) * 1000; // 提前一分钟过期
  return cachedToken;
}

export async function ocrImageByBaidu(imageBase64) {
  const accessToken = await getBaiduAccessToken();
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`;
  const res = await axios.post(url, `image=${encodeURIComponent(imageBase64)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (res.data.words_result) {
    return res.data.words_result.map(item => item.words).join('\n');
  }
  return '';
}

export async function ocrPdfByBaidu(pdfBase64) {
  const accessToken = await getBaiduAccessToken();
  const url = `https://aip.baidubce.com/rest/2.0/ocr/v1/pdf?access_token=${accessToken}`;
  const res = await axios.post(url, `pdf_file=${encodeURIComponent(pdfBase64)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (res.data.words_result) {
    // 合并所有页的文字
    return res.data.words_result.map(item => item.words).join('\n');
  }
  return '';
} 