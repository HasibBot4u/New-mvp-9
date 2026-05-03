import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useInView } from 'react-intersection-observer';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFViewer({ url }: { url: string }) {
  const [numPages, setNumPages] = useState(0);
  const [visiblePages, setVisiblePages] = useState(5);
  const [scale, setScale] = useState(1.2);
  const { ref, inView } = useInView({ threshold: 0 });
  
  useEffect(() => {
    if (inView && visiblePages < numPages) {
      setVisiblePages(p => Math.min(p + 3, numPages));
    }
  }, [inView, numPages, visiblePages]);
  
  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex gap-2 p-2 bg-muted sticky top-0 z-10 border-b items-center justify-center">
        <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-sm self-center tabular-nums">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setScale(1.2)}>
          <Maximize className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-muted/30 flex flex-col items-center">
        <Document 
          file={url} 
          onLoadSuccess={(doc) => setNumPages(doc.numPages)}
          loading={<div className="p-10 text-muted-foreground animate-pulse">Loading PDF...</div>}
        >
          {Array.from({ length: visiblePages }, (_, i) => (
            <div key={i} className="mb-4 mx-auto max-w-full overflow-x-auto shadow-lg bg-white">
              <Page pageNumber={i + 1} scale={scale} />
            </div>
          ))}
          {numPages > 0 && <div ref={ref} className="h-20" />}
        </Document>
      </div>
    </div>
  );
}
