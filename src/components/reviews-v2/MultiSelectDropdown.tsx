/**
 * MultiSelectDropdown Component
 * Dropdown with checkboxes for multi-select filtering
 * Supports searchable mode for filtering options
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export const MultiSelectDropdown: React.FC<Props> = ({
  options,
  selected,
  onChange,
  placeholder = 'Выберите...',
  allLabel = 'Все',
  searchable = false,
  searchPlaceholder = 'Поиск...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery(''); // Clear search on close
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1) {
      const opt = options.find(o => o.value === selected[0]);
      return opt?.label || selected[0];
    }
    return `Выбрано: ${selected.length}`;
  };

  // Filter options by search query
  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  return (
    <div className="multiselect-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`dropdown-trigger ${isOpen ? 'open' : ''} ${selected.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="dropdown-text">{getDisplayText()}</span>
        <ChevronDown
          className={`dropdown-chevron ${isOpen ? 'rotated' : ''}`}
          style={{ width: '16px', height: '16px' }}
        />
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {/* Search input */}
          {searchable && (
            <div className="search-container">
              <Search className="search-icon" style={{ width: '14px', height: '14px' }} />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options list */}
          <div className="options-list">
            {filteredOptions.length === 0 ? (
              <div className="no-results">Ничего не найдено</div>
            ) : (
              filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className={`dropdown-option ${selected.includes(option.value) ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleOption(option.value);
                  }}
                >
                  <span className="option-checkbox">
                    {selected.includes(option.value) && (
                      <Check style={{ width: '12px', height: '12px' }} />
                    )}
                  </span>
                  <span className="option-label">{option.label}</span>
                </label>
              ))
            )}
          </div>

          {selected.length > 0 && (
            <button
              type="button"
              className="clear-button"
              onClick={() => onChange([])}
            >
              Сбросить
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .multiselect-dropdown {
          position: relative;
          display: inline-block;
          min-width: 180px;
        }

        .dropdown-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 8px 12px;
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }

        .dropdown-trigger:hover {
          border-color: var(--color-primary);
        }

        .dropdown-trigger.open {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .dropdown-trigger.has-selection {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .dropdown-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dropdown-chevron {
          flex-shrink: 0;
          color: var(--color-muted);
          transition: transform 0.2s;
          margin-left: 8px;
        }

        .dropdown-chevron.rotated {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          max-height: 320px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .search-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--color-border-light);
          background: #f8fafc;
        }

        .search-icon {
          color: var(--color-muted);
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: var(--font-size-sm);
          outline: none;
          color: var(--color-foreground);
        }

        .search-input::placeholder {
          color: var(--color-muted);
        }

        .options-list {
          flex: 1;
          overflow-y: auto;
          max-height: 240px;
          padding: 4px 0;
        }

        .no-results {
          padding: 12px;
          text-align: center;
          color: var(--color-muted);
          font-size: var(--font-size-sm);
        }

        .dropdown-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.1s;
          font-size: var(--font-size-sm);
        }

        .dropdown-option:hover {
          background: #f8fafc;
        }

        .dropdown-option.selected {
          background: #eff6ff;
        }

        .option-checkbox {
          width: 16px;
          height: 16px;
          border: 1px solid var(--color-border);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: white;
        }

        .dropdown-option.selected .option-checkbox {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .option-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .clear-button {
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-top: 1px solid var(--color-border-light);
          background: transparent;
          color: var(--color-muted);
          font-size: var(--font-size-xs);
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .clear-button:hover {
          background: #fef2f2;
          color: #dc2626;
        }
      `}</style>
    </div>
  );
};
