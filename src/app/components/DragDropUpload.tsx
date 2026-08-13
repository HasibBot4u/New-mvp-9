import { useDropzone } from 'react-dropzone';
import { FileText } from 'lucide-react';

interface DragDropUploadProps {
  onUpload: (file: File) => void;
  accept?: Record<string, string[]>;
}

export function DragDropUpload({ onUpload, accept = { 'application/pdf': ['.pdf'] } }: DragDropUploadProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    onDrop: files => files.forEach(onUpload)
  });
  
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted'}`}>
      <input {...getInputProps()} />
      <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {isDragActive ? 'Drop files here...' : 'Drag & drop files here, or click to select'}
      </p>
    </div>
  );
}
