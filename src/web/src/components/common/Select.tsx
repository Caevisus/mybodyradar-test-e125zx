import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { IBaseProps } from '../../interfaces/common.interface';
import { themeConfig } from '../../config/theme.config';

// Interfaces
export interface ISelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ISelectProps extends IBaseProps {
  options: ISelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  placeholder?: string;
  error?: string;
}

// Constants
const DEBOUNCE_DELAY = 300;
const VIRTUAL_ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 8;

// Utility function for debounced search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Filter options based on search text
const filterOptions = (options: ISelectOption[], searchText: string): ISelectOption[] => {
  const normalizedSearch = searchText.toLowerCase().trim();
  return options.filter(option => 
    option.label.toLowerCase().includes(normalizedSearch)
  );
};

export const Select = React.forwardRef<HTMLDivElement, ISelectProps>((props, ref) => {
  const {
    options,
    value,
    onChange,
    multiple = false,
    disabled = false,
    searchable = false,
    placeholder = 'Select option',
    error,
    className,
    style
  } = props;

  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const debouncedSearch = useDebounce(searchText, DEBOUNCE_DELAY);

  // Filtered options
  const filteredOptions = React.useMemo(() => 
    filterOptions(options, debouncedSearch),
    [options, debouncedSearch]
  );

  // Virtual scroll calculations
  const startIndex = Math.floor(scrollTop / VIRTUAL_ITEM_HEIGHT);
  const endIndex = Math.min(
    startIndex + VISIBLE_ITEMS,
    filteredOptions.length
  );

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle option selection
  const handleOptionSelect = useCallback((option: ISelectOption) => {
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
  }, [multiple, value, onChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0) {
          handleOptionSelect(filteredOptions[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [filteredOptions, focusedIndex, handleOptionSelect]);

  // Styles
  const selectStyles = {
    container: {
      position: 'relative' as const,
      width: '100%',
      fontFamily: themeConfig.typography.fontFamily.primary,
    },
    button: {
      width: '100%',
      padding: themeConfig.spacing.base.md,
      border: `1px solid ${error ? themeConfig.colors.feedback.error : themeConfig.colors.primary.main}`,
      borderRadius: '4px',
      backgroundColor: disabled ? themeConfig.colors.surface.light.paper : themeConfig.colors.surface.light.background,
      color: disabled ? themeConfig.colors.primary.light : themeConfig.colors.primary.main,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: themeConfig.shadows.sm,
    },
    dropdown: {
      position: 'absolute' as const,
      top: '100%',
      left: 0,
      right: 0,
      maxHeight: VIRTUAL_ITEM_HEIGHT * VISIBLE_ITEMS,
      marginTop: '4px',
      backgroundColor: themeConfig.colors.surface.light.elevated,
      borderRadius: '4px',
      boxShadow: themeConfig.shadows.lg,
      zIndex: 1000,
      overflow: 'auto',
    },
    option: {
      padding: themeConfig.spacing.base.md,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
    },
    searchInput: {
      width: '100%',
      padding: themeConfig.spacing.base.sm,
      border: 'none',
      borderBottom: `1px solid ${themeConfig.colors.primary.light}`,
      outline: 'none',
    },
  };

  return (
    <div
      ref={mergeRefs([ref, containerRef])}
      className={classNames('select-container', className)}
      style={{ ...selectStyles.container, ...style }}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls="select-dropdown"
      aria-label={placeholder}
    >
      <button
        type="button"
        style={selectStyles.button}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-disabled={disabled}
      >
        {getSelectedLabel()}
      </button>

      {isOpen && (
        <div
          id="select-dropdown"
          ref={dropdownRef}
          role="listbox"
          style={{
            ...selectStyles.dropdown,
            height: Math.min(filteredOptions.length, VISIBLE_ITEMS) * VIRTUAL_ITEM_HEIGHT,
          }}
          onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          onKeyDown={handleKeyDown}
          aria-multiselectable={multiple}
        >
          {searchable && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search..."
              style={selectStyles.searchInput}
              aria-label="Search options"
            />
          )}

          <div
            style={{
              height: filteredOptions.length * VIRTUAL_ITEM_HEIGHT,
              position: 'relative',
            }}
          >
            {filteredOptions.slice(startIndex, endIndex).map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={isOptionSelected(option.value)}
                aria-disabled={option.disabled}
                style={{
                  ...selectStyles.option,
                  position: 'absolute',
                  top: (startIndex + index) * VIRTUAL_ITEM_HEIGHT,
                  backgroundColor: focusedIndex === startIndex + index
                    ? themeConfig.colors.primary.light
                    : 'transparent',
                  opacity: option.disabled ? 0.5 : 1,
                }}
                onClick={() => handleOptionSelect(option)}
              >
                {multiple && (
                  <input
                    type="checkbox"
                    checked={isOptionSelected(option.value)}
                    readOnly
                    aria-hidden="true"
                  />
                )}
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            color: themeConfig.colors.feedback.error,
            fontSize: themeConfig.typography.fontSize.sm,
            marginTop: themeConfig.spacing.base.xs,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );

  // Helper functions
  function getSelectedLabel(): string {
    if (multiple) {
      const selectedValues = Array.isArray(value) ? value : [];
      if (selectedValues.length === 0) return placeholder;
      return `${selectedValues.length} selected`;
    }

    const selectedOption = options.find(opt => opt.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  }

  function isOptionSelected(optionValue: string): boolean {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  }

  function mergeRefs(refs: any[]): React.RefCallback<any> {
    return (value: any) => {
      refs.forEach(ref => {
        if (typeof ref === 'function') {
          ref(value);
        } else if (ref != null) {
          (ref as React.MutableRefObject<any>).current = value;
        }
      });
    };
  }
});

Select.displayName = 'Select';

export default Select;