import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useIntersectionObserver } from 'react-intersection-observer'; // v9.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import { IBaseProps } from '../../interfaces/common.interface';

// Dropdown option interface
interface IDropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  description?: string;
  groupId?: string;
}

// Component props interface extending base props
interface IDropdownProps extends IBaseProps {
  options: IDropdownOption[];
  value: string | number | (string | number)[];
  onChange: (value: string | number | (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  error?: string;
  maxHeight?: number;
  loading?: boolean;
  searchable?: boolean;
  virtualized?: boolean;
  onSearch?: (query: string) => void;
  loadMore?: () => void;
  hasMore?: boolean;
  groupBy?: string;
  renderOption?: (option: IDropdownOption) => React.ReactNode;
}

const DEBOUNCE_DELAY = 300;
const DEFAULT_MAX_HEIGHT = 300;
const OPTION_HEIGHT = 48; // Material Design 3.0 list item height

const Dropdown: React.FC<IDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  multiple = false,
  error,
  maxHeight = DEFAULT_MAX_HEIGHT,
  loading = false,
  searchable = false,
  virtualized = false,
  onSearch,
  loadMore,
  hasMore = false,
  groupBy,
  renderOption,
  className,
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Intersection observer for infinite loading
  const { ref: intersectionRef } = useIntersectionObserver({
    threshold: 0.5,
    onChange: (entry) => {
      if (entry.isIntersecting && hasMore && !loading && loadMore) {
        loadMore();
      }
    },
  });

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => optionsRef.current,
    estimateSize: () => OPTION_HEIGHT,
    overscan: 5,
  });

  // Handle dropdown toggle
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
      setHighlightedIndex(-1);
    }
  }, [disabled, isOpen]);

  // Handle option selection
  const handleSelect = useCallback((option: IDropdownOption) => {
    if (option.disabled) return;

    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      const newValue = values.includes(option.value)
        ? values.filter(v => v !== option.value)
        : [...values, option.value];
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
    }
  }, [multiple, onChange, value]);

  // Handle search input
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      onSearch?.(query);
    }, DEBOUNCE_DELAY);
  }, [onSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!isOpen && event.key !== 'Enter' && event.key !== ' ') return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < options.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : options.length - 1
        );
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (highlightedIndex >= 0) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
        }
        break;
    }
  }, [isOpen, options, highlightedIndex, handleSelect]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render option
  const renderOptionItem = useCallback((option: IDropdownOption, index: number) => {
    const isSelected = multiple 
      ? Array.isArray(value) && value.includes(option.value)
      : value === option.value;
    
    const optionClassName = classNames(
      'dropdown-option',
      {
        'dropdown-option--selected': isSelected,
        'dropdown-option--highlighted': index === highlightedIndex,
        'dropdown-option--disabled': option.disabled
      }
    );

    return (
      <div
        key={option.value}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
        className={optionClassName}
        onClick={() => handleSelect(option)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        {renderOption ? renderOption(option) : (
          <>
            {option.icon && <span className="dropdown-option__icon">{option.icon}</span>}
            <span className="dropdown-option__label">{option.label}</span>
            {option.description && (
              <span className="dropdown-option__description">{option.description}</span>
            )}
          </>
        )}
      </div>
    );
  }, [multiple, value, highlightedIndex, handleSelect, renderOption]);

  const dropdownClassName = classNames(
    'dropdown',
    {
      'dropdown--open': isOpen,
      'dropdown--disabled': disabled,
      'dropdown--error': error,
      'dropdown--multiple': multiple
    },
    className
  );

  return (
    <div
      ref={dropdownRef}
      className={dropdownClassName}
      style={style}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        onClick={handleToggle}
      >
        <span className="dropdown__trigger-text">
          {multiple 
            ? Array.isArray(value) && value.length > 0
              ? `${value.length} selected`
              : placeholder
            : options.find(opt => opt.value === value)?.label || placeholder
          }
        </span>
      </button>

      {isOpen && (
        <div 
          className="dropdown__menu"
          role="listbox"
          aria-multiselectable={multiple}
          ref={optionsRef}
          style={{ maxHeight }}
        >
          {searchable && (
            <div className="dropdown__search">
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search..."
                aria-label="Search dropdown options"
              />
            </div>
          )}

          {virtualized ? (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative'
              }}
            >
              {virtualizer.getVirtualItems().map(virtualRow => (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {renderOptionItem(options[virtualRow.index], virtualRow.index)}
                </div>
              ))}
            </div>
          ) : (
            options.map((option, index) => renderOptionItem(option, index))
          )}

          {loading && (
            <div className="dropdown__loading" role="status">
              Loading...
            </div>
          )}

          {hasMore && !loading && (
            <div ref={intersectionRef} className="dropdown__load-more">
              Loading more...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="dropdown__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;