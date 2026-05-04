import { CSSProperties, useRef, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';

interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  width?: string | number;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  height?: number;
  itemHeight?: number;
}

export default function VirtualTable<T extends { id?: string | number }>({
  data,
  columns,
  height = 500,
  itemHeight = 48
}: VirtualTableProps<T>) {
  const [listWidth, setListWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setListWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    // Use ResizeObserver for more robust resizing
    const resizeObserver = new ResizeObserver(() => {
        updateWidth();
    });
    if(containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const Header = () => (
    <div className="flex w-full bg-black/40 border-b border-white/10 text-sm font-medium text-foreground-muted">
      {columns.map((col, i) => (
        <div 
          key={i} 
          className="px-4 py-3 truncate"
          style={{ width: col.width || 'flex-1', flex: col.width ? 'none' : '1' }}
        >
          {col.header}
        </div>
      ))}
    </div>
  );

  const Row = ({ index, style }: { index: number, style: CSSProperties }) => {
    const item = data[index];
    
    return (
      <div 
        style={style} 
        className="flex w-full border-b border-white/5 hover:bg-white/5 transition-colors text-sm"
      >
        {columns.map((col, i) => (
          <div 
            key={i} 
            className="px-4 flex items-center truncate"
            style={{ width: col.width || 'flex-1', flex: col.width ? 'none' : '1' }}
          >
            {col.cell 
              ? col.cell(item) 
              : col.accessorKey 
                ? String(item[col.accessorKey]) 
                : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full rounded-md border border-white/10 bg-surface/50 overflow-hidden flex flex-col">
      <Header />
      <div ref={containerRef} className="flex-1 w-full" style={{ height }}>
        {listWidth > 0 && (
          <List
            height={height}
            itemCount={data.length}
            itemSize={itemHeight}
            width={listWidth}
            className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
}
