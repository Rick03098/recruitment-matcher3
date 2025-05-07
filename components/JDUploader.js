import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseJobDescription, validateFile } from '../utils/fileService';

const JDUploader = ({ onUploadSuccess, onUploadError }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        try {
            setIsUploading(true);
            setError(null);

            // 验证文件
            validateFile(file);

            // 解析职位描述
            const result = await parseJobDescription(file);
            onUploadSuccess(result);
        } catch (error) {
            console.error('Upload error:', error);
            setError(error.message);
            onUploadError(error);
        } finally {
            setIsUploading(false);
        }
    }, [onUploadSuccess, onUploadError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt']
        },
        maxSize: 10 * 1024 * 1024, // 10MB
        multiple: false
    });

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
                    ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <input {...getInputProps()} disabled={isUploading} />
                <div className="space-y-4">
                    <div className="text-4xl text-gray-400">
                        {isUploading ? '⏳' : '📄'}
                    </div>
                    <div className="text-lg font-medium text-gray-700">
                        {isUploading ? '正在处理文件...' : '拖放文件到这里，或点击选择文件'}
                    </div>
                    <div className="text-sm text-gray-500">
                        支持 PDF、Word、TXT 格式，最大 10MB
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600">{error}</p>
                </div>
            )}
        </div>
    );
};

export default JDUploader; 