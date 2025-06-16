import React, { useCallback, useState } from 'react';
import './DataHub.css';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  maxFiles?: number;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept = '.csv',
  multiple = true,
  disabled = false,
  maxFiles = 10
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    const validFiles: File[] = [];
    const fileArray = Array.from(files);

    // Validate files
    for (const file of fileArray) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        continue; // Skip non-CSV files
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        continue; // Skip files that are too large
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Limit number of files
    const filesToProcess = validFiles.slice(0, maxFiles);
    
    // Create uploaded file entries
    const newUploadedFiles: UploadedFile[] = filesToProcess.map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36)}`,
      status: 'pending'
    }));

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    onFilesSelected(filesToProcess);
  }, [disabled, maxFiles, onFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [handleFiles]);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const clearAllFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-zone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="file-upload-content">
          <div className="file-upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
          </div>
          <h3 className="file-upload-title">
            {isDragOver ? 'Drop CSV files here' : 'Drag & drop CSV files here'}
          </h3>
          <p className="file-upload-description">
            or <label htmlFor="file-input" className="file-upload-link">browse files</label> to upload
          </p>
          <p className="file-upload-info">
            Supports CSV files up to 10MB each{multiple ? `, maximum ${maxFiles} files` : ''}
          </p>
          <input
            id="file-input"
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInput}
            disabled={disabled}
            className="file-input-hidden"
          />
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files">
          <div className="uploaded-files-header">
            <h4>Uploaded Files ({uploadedFiles.length})</h4>
            <button
              type="button"
              onClick={clearAllFiles}
              className="btn btn-sm btn-secondary"
            >
              Clear All
            </button>
          </div>
          <div className="uploaded-files-list">
            {uploadedFiles.map((uploadedFile) => (
              <div key={uploadedFile.id} className="uploaded-file-item">
                <div className="uploaded-file-info">
                  <div className="uploaded-file-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                  </div>
                  <div className="uploaded-file-details">
                    <div className="uploaded-file-name">{uploadedFile.file.name}</div>
                    <div className="uploaded-file-size">{formatFileSize(uploadedFile.file.size)}</div>
                  </div>
                </div>
                <div className="uploaded-file-actions">
                  <div className={`uploaded-file-status status-${uploadedFile.status}`}>
                    {uploadedFile.status === 'pending' && (
                      <span className="status-text">Ready</span>
                    )}
                    {uploadedFile.status === 'processing' && (
                      <span className="status-text">Processing...</span>
                    )}
                    {uploadedFile.status === 'completed' && (
                      <span className="status-text">✓ Completed</span>
                    )}
                    {uploadedFile.status === 'error' && (
                      <span className="status-text">✗ Error</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(uploadedFile.id)}
                    className="remove-file-btn"
                    title="Remove file"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {uploadedFile.error && (
                  <div className="uploaded-file-error">
                    {uploadedFile.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 