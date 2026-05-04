import { FixedSizeGrid } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { EntityCard } from '@/components/ui/EntityCard';

export function VirtualVideoGrid({ videos, onEdit, onDelete }: any) {
  const columnCount = 3;
  const columnWidth = 300;
  const rowHeight = 220;
  const rowCount = Math.ceil(videos.length / columnCount);

  const Cell = ({ columnIndex, rowIndex, style }: any) => {
    const videoIndex = rowIndex * columnCount + columnIndex;
    if (videoIndex >= videos.length) return null;
    const v = videos[videoIndex];

    return (
      <div style={{ ...style, padding: '8px' }}>
        <EntityCard
          title={v.title}
          subtitle={v.source_type}
          onEdit={() => onEdit(v)}
          onDelete={() => onDelete(v)}
        />
      </div>
    );
  };

  const Sizer = AutoSizer as any;
  const VGrid = FixedSizeGrid as any;

  return (
    <div style={{ flex: 1, minHeight: '400px' }}>
      <Sizer>
        {({ height, width }: { height: number, width: number }) => (
          <VGrid
            columnCount={columnCount}
            columnWidth={columnWidth}
            height={height}
            rowCount={rowCount}
            rowHeight={rowHeight}
            width={width}
          >
            {Cell as any}
          </VGrid>
        )}
      </Sizer>
    </div>
  );
}
