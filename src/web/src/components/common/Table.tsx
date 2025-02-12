import React from 'react';
import clsx from 'clsx';
import type { IBaseProps } from '../../interfaces/common.interface';
import { Loading } from './Loading';

// Column interface with comprehensive configuration options
export interface Column<T> {
  id: string;
  header: string | React.ReactNode;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  cell?: (value: any, row: T) => React.ReactNode;
  responsive?: boolean | { breakpoint: number };
}

// Table props interface extending base component props
export interface TableProps<T> extends IBaseProps {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  sortable?: boolean;
  multiSort?: boolean;
  selectable?: boolean;
  selectedRows?: T[];
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  onSelect?: (selectedRows: T[]) => void;
  emptyMessage?: string;
  virtualized?: boolean;
  'aria-label'?: string;
}

// Sort state interface
interface SortState {
  id: string;
  direction: 'asc' | 'desc';
}

const Table = React.memo(<T extends Record<string, any>>(props: TableProps<T>) => {
  const {
    data,
    columns,
    loading = false,
    sortable = false,
    multiSort = false,
    selectable = false,
    selectedRows = [],
    onSort,
    onSelect,
    emptyMessage = 'No data available',
    virtualized = false,
    className,
    style,
    'aria-label': ariaLabel,
  } = props;

  // State management
  const [sortState, setSortState] = React.useState<SortState[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<T[]>(selectedRows);
  const [visibleColumns, setVisibleColumns] = React.useState<Column<T>[]>(columns);

  // Refs for virtualization
  const tableRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Effect for responsive columns
  React.useEffect(() => {
    const handleResize = () => {
      const updatedColumns = columns.filter(column => {
        if (!column.responsive) return true;
        const breakpoint = typeof column.responsive === 'object' 
          ? column.responsive.breakpoint 
          : 768;
        return window.innerWidth >= breakpoint;
      });
      setVisibleColumns(updatedColumns);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns]);

  // Sort handler
  const handleSort = React.useCallback((columnId: string) => {
    if (!sortable) return;

    setSortState(prevState => {
      const existingSort = prevState.find(sort => sort.id === columnId);
      const newDirection = !existingSort 
        ? 'asc' 
        : existingSort.direction === 'asc' ? 'desc' : 'asc';

      const newState = multiSort 
        ? [...prevState.filter(sort => sort.id !== columnId)]
        : [];

      const updatedSort = { id: columnId, direction: newDirection };
      newState.push(updatedSort);
      onSort?.(columnId, newDirection);
      return newState;
    });
  }, [sortable, multiSort, onSort]);

  // Selection handlers
  const handleSelectAll = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelection = e.target.checked ? data : [];
    setSelectedItems(newSelection);
    onSelect?.(newSelection);
  }, [data, onSelect]);

  const handleSelectRow = React.useCallback((row: T, checked: boolean) => {
    setSelectedItems(prev => {
      const newSelection = checked 
        ? [...prev, row]
        : prev.filter(item => item !== row);
      onSelect?.(newSelection);
      return newSelection;
    });
  }, [onSelect]);

  // Cell value accessor
  const getCellValue = React.useCallback((row: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return row[column.accessor];
  }, []);

  // Render header cell
  const renderHeaderCell = React.useCallback((column: Column<T>) => {
    const sortIcon = sortState.find(sort => sort.id === column.id)?.direction === 'asc' 
      ? '↑' 
      : '↓';

    return (
      <th
        key={column.id}
        style={{
          width: column.width,
          minWidth: column.minWidth,
          maxWidth: column.maxWidth,
        }}
        className={clsx('table__header-cell', {
          'table__header-cell--sortable': column.sortable && sortable,
        })}
        onClick={() => column.sortable && handleSort(column.id)}
        role={column.sortable ? 'button' : undefined}
        tabIndex={column.sortable ? 0 : undefined}
        aria-sort={sortState.find(sort => sort.id === column.id)?.direction}
      >
        <div className="table__header-content">
          {column.header}
          {column.sortable && sortable && sortState.find(sort => sort.id === column.id) && (
            <span className="table__sort-icon" aria-hidden="true">
              {sortIcon}
            </span>
          )}
        </div>
      </th>
    );
  }, [sortable, sortState, handleSort]);

  // Render table body
  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={visibleColumns.length + (selectable ? 1 : 0)}>
            <Loading size="small" />
          </td>
        </tr>
      );
    }

    if (!data.length) {
      return (
        <tr>
          <td 
            colSpan={visibleColumns.length + (selectable ? 1 : 0)}
            className="table__empty-message"
          >
            {emptyMessage}
          </td>
        </tr>
      );
    }

    return data.map((row, index) => (
      <tr
        key={index}
        className={clsx('table__row', {
          'table__row--selected': selectedItems.includes(row),
        })}
      >
        {selectable && (
          <td className="table__cell table__cell--checkbox">
            <input
              type="checkbox"
              checked={selectedItems.includes(row)}
              onChange={(e) => handleSelectRow(row, e.target.checked)}
              aria-label="Select row"
            />
          </td>
        )}
        {visibleColumns.map(column => (
          <td
            key={column.id}
            className="table__cell"
            style={{
              width: column.width,
              minWidth: column.minWidth,
              maxWidth: column.maxWidth,
            }}
          >
            {column.cell 
              ? column.cell(getCellValue(row, column), row)
              : getCellValue(row, column)}
          </td>
        ))}
      </tr>
    ));
  };

  return (
    <div
      ref={tableRef}
      className={clsx('table-container', className)}
      style={style}
    >
      <div 
        className="table-wrapper"
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <table className="table">
          <thead ref={headerRef}>
            <tr>
              {selectable && (
                <th className="table__header-cell table__header-cell--checkbox">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === data.length}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {visibleColumns.map(renderHeaderCell)}
            </tr>
          </thead>
          <tbody>
            {renderBody()}
          </tbody>
        </table>
      </div>
    </div>
  );
});

Table.displayName = 'Table';

export default Table;