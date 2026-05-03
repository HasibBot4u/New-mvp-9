import { File, FileText, Image, Video } from "lucide-react";
import { getFileIcon } from "@/lib/fileTypes";

export function FileIcon({ filename, className }: { filename: string; className?: string }) {
  const icon = getFileIcon(filename);
  if (icon === 'video') return <Video className={className} />;
  if (icon === 'file-text') return <FileText className={className} />;
  if (icon === 'image') return <Image className={className} />;
  return <File className={className} />;
}
