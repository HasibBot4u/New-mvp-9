export const isVideoFile = (filename: string) => /\.(mp4|webm|ogg|mov|mkv|avi)$/i.test(filename);
export const isPdfFile = (filename: string) => /\.pdf$/i.test(filename);
export const isImageFile = (filename: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
export const getFileExtension = (filename: string) => filename.split('.').pop()?.toLowerCase() || '';
export const getFileIcon = (filename: string) => {
  if (isVideoFile(filename)) return 'video';
  if (isPdfFile(filename)) return 'file-text';
  if (isImageFile(filename)) return 'image';
  return 'file';
};
