import { useState, useCallback } from 'react';
import PdfDropzone from './PdfDropzone';

export default function BatchImportModal({ isOpen, onClose, onImportSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload' 或 'results'
  
  // 处理文件上传
  const handleFileUpload = useCallback(async (files) => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      
      const response = await fetch('/api/batchImportPdf', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '批量导入失败');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data);
        setStep('results');
        
        // 如果有错误，显示在结果页面
        if (data.errors && data.errors.length > 0) {
          setError(`部分文件处理失败: ${data.errors.length} 个错误`);
        }
      } else {
        throw new Error(data.message || '批量处理失败');
      }
    } catch (err) {
      console.error('批量导入错误:', err);
      setError(`批量导入失败: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, []);
  
  // 完成导入
  const handleFinishImport = () => {
    if (results && results.results && results.results.length > 0) {
      onImportSuccess(results.results);
    }
    onClose();
  };
  
  // 如果模态框未打开，不渲染任何内容
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">批量导入PDF简历</h3>
          <button 
            className="text-gray-400 hover:text-gray-500"
            onClick={onClose}
            disabled={uploading}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {step === 'upload' ? (
          <>
            <div className="mb-4">
              <p className="text-gray-600 mb-4">
                请选择要批量导入的PDF简历文件。系统将自动解析每个文件并提取关键信息。
              </p>
              
              <PdfDropzone 
                onFileUpload={handleFileUpload}
                label="批量上传简历"
                helpText="支持同时上传多个PDF文件，每个文件最大10MB"
                maxFilesCount={0} // 不限制文件数量
              />
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button 
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                onClick={onClose}
                disabled={uploading}
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">处理结果</h4>
                <span className="text-sm text-green-600">
                  成功: {results?.results?.length || 0} 文件
                  {results?.errors?.length > 0 && `, 失败: ${results.errors.length} 文件`}
                </span>
              </div>
              
              <div className="border rounded max-h-80 overflow-y-auto">
                {results?.results?.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          姓名
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          职位
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          技能
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          经验
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.results.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {item.candidate.name || '未知'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {item.candidate.title || '未检测到'}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {item.candidate.skills && item.candidate.skills.length > 0 ? (
                                item.candidate.skills.slice(0, 3).map((skill, i) => (
                                  <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {skill}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500 text-xs">无检测到的技能</span>
                              )}
                              {item.candidate.skills && item.candidate.skills.length > 3 && (
                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                                  +{item.candidate.skills.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {item.candidate.experience || '未检测到'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    没有成功解析的简历
                  </div>
                )}
              </div>
              
              {results?.errors?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-red-600">错误列表</h4>
                  <ul className="text-sm text-red-600 bg-red-50 p-3 rounded max-h-40 overflow-y-auto">
                    {results.errors.map((error, index) => (
                      <li key={index} className="mb-1">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <button 
                className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                onClick={onClose}
              >
                取消
              </button>
              <button 
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={handleFinishImport}
                disabled={!results?.results?.length}
              >
                导入 {results?.results?.length || 0} 个简历
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
