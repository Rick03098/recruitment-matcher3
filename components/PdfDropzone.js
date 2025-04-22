import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function PdfDropzone({ onFileUpload, label, helpText, maxFilesCount = 1 }) {
  const [fileError, setFileError] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const onDrop = useCallback(async (acceptedFiles) => {
    setFileError(null);
    
    // 验证文件类型
    const invalidFiles = acceptedFiles.filter(
      file => !['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)
    );
    
    if (invalidFiles.length > 0) {
      setFileError('仅支持PDF、DOCX和TXT文件格式');
      return;
    }
    
    // 验证文件数量
    if (maxFilesCount > 0 && acceptedFiles.length > maxFilesCount) {
      setFileError(`一次最多只能上传${maxFilesCount}个文件`);
      return;
    }
    
    try {
      setUploading(true);
      await onFileUpload(acceptedFiles);
    } catch (error) {
      console.error('文件上传错误:', error);
      setFileError('文件上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, [onFileUpload, maxFilesCount]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    }
  });

  return (
    <div>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input {...getInputProps()} disabled={uploading} />
        <div className="mb-3">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4h-8m-12 0H8a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-1 text-sm text-gray-600">
            {uploading ? '正在上传...' : (
              <>
                将文件拖放到此处或
                <button className="text-blue-500 hover:text-blue-700 font-medium mx-1">
                  浏览文件
                </button>
                {label || ''}
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {helpText || '支持的格式: PDF, DOCX, TXT'}
          </p>
        </div>
      </div>
      
      {fileError && (
        <p className="mt-2 text-sm text-red-600">{fileError}</p>
      )}
    </div>
  );
}
