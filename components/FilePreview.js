import { useState } from 'react';

export default function FilePreview({ file, parsedData, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  
  // 计算文件大小显示
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // 确定文件图标
  const getFileIcon = () => {
    if (file.type === 'application/pdf') {
      return (
        <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5V1H7.97a2 2 0 00-2 2v18a2 2 0 002 2h9.06a2 2 0 002-2V8h-4a2 2 0 01-2-2zM9 17a1 1 0 110-2h6a1 1 0 110 2H9zm0-4a1 1 0 110-2h6a1 1 0 110 2H9z" />
          <path d="M14 1v5a1 1 0 001 1h5l-6-6z" />
        </svg>
      );
    } else if (file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return (
        <svg className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5V1H7.97a2 2 0 00-2 2v18a2 2 0 002 2h9.06a2 2 0 002-2V8h-4a2 2 0 01-2-2zM9 17a1 1 0 110-2h6a1 1 0 110 2H9zm0-4a1 1 0 110-2h6a1 1 0 110 2H9z" />
          <path d="M14 1v5a1 1 0 001 1h5l-6-6z" />
        </svg>
      );
    } else {
      return (
        <svg className="h-8 w-8 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5V1H7.97a2 2 0 00-2 2v18a2 2 0 002 2h9.06a2 2 0 002-2V8h-4a2 2 0 01-2-2zM9 17a1 1 0 110-2h6a1 1 0 110 2H9zm0-4a1 1 0 110-2h6a1 1 0 110 2H9z" />
          <path d="M14 1v5a1 1 0 001 1h5l-6-6z" />
        </svg>
      );
    }
  };

  return (
    <div className="mt-4 text-left">
      <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
        <div className="flex items-center">
          {getFileIcon()}
          <div className="ml-3">
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
          </div>
        </div>
        {onRemove && (
          <button 
            className="text-gray-400 hover:text-gray-500"
            onClick={onRemove}
            title="删除文件"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {parsedData && (
        <div className="mt-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              解析结果:
            </label>
            <button 
              className="text-xs text-blue-500 hover:text-blue-700"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '收起' : '展开'}
            </button>
          </div>
          
          {expanded ? (
            <div className="border rounded p-3 bg-gray-50">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-medium">检测到的技能:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parsedData.skills && parsedData.skills.length > 0 ? (
                      parsedData.skills.map((skill, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500">无检测到的技能</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-medium">工作经验:</p>
                  <p>{parsedData.experience || '未检测到'}</p>
                </div>
                {parsedData.education && (
                  <div className="col-span-2">
                    <p className="font-medium">教育背景:</p>
                    <p>{parsedData.education}</p>
                  </div>
                )}
                {parsedData.rawText && (
                  <div className="col-span-2 mt-2">
                    <p className="font-medium">解析的原始内容 (部分):</p>
                    <p className="text-xs text-gray-600 mt-1 max-h-32 overflow-y-auto">
                      {parsedData.rawText.substring(0, 500)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded p-3 bg-gray-50">
              <div className="flex flex-wrap gap-1">
                {parsedData.skills && parsedData.skills.slice(0, 4).map((skill, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                    {skill}
                  </span>
                ))}
                {parsedData.skills && parsedData.skills.length > 4 && (
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                    +{parsedData.skills.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
