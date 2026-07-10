import React from 'react';
import { FileQuestion } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: any, item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[] | null | undefined;
  columns: Column<T>[];
  isLoading: boolean;
  isEmpty: boolean;
}

export function DataTable<T>({ data, columns, isLoading, isEmpty }: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full h-12 bg-gray-200 animate-pulse rounded"></div>
        ))}
      </div>
    );
  }

  if (isEmpty || !data || data.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
        <FileQuestion className="w-12 h-12 mb-4 text-gray-400" />
        <p className="text-lg font-medium">No data found</p>
        <p className="text-sm">There are no records to display at this time.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto border rounded-lg shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            {columns.map((col, index) => (
              <th key={index} className="p-4 font-semibold text-gray-700">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data?.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b hover:bg-gray-50 transition">
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="p-4 text-gray-800">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
