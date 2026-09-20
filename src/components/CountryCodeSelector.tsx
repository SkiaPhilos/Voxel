// src/components/CountryCodeSelector.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, Globe } from 'lucide-react';
import { COUNTRIES } from '../lib/countries';
import type { Country } from '../lib/countries';

interface CountryCodeSelectorProps {
  value: string; // e.g. "+92" or "PK"
  onChange: (country: Country) => void;
  variant?: 'input-prefix' | 'standalone';
  className?: string;
  disabled?: boolean;
  id?: string;
}

export const CountryCodeSelector: React.FC<CountryCodeSelectorProps> = ({
  value,
  onChange,
  variant = 'input-prefix',
  className = '',
  disabled = false,
  id = 'country-code-selector',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Match selected country
  const selectedCountry = useMemo(() => {
    const cleanVal = value.trim();
    return (
      COUNTRIES.find((c) => c.dialCode === cleanVal || c.code.toUpperCase() === cleanVal.toUpperCase()) ||
      COUNTRIES[0] // fallback to Pakistan
    );
  }, [value]);

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.dialCode.replace('+', '').includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (country: Country) => {
    onChange(country);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {variant === 'input-prefix' ? (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="h-full px-2.5 py-2 inline-flex items-center gap-1.5 bg-stone-100/80 hover:bg-stone-200/80 text-stone-800 text-xs font-semibold rounded-l-xl border-r border-stone-300 transition-colors cursor-pointer select-none focus:outline-hidden disabled:opacity-50"
          title={`Selected: ${selectedCountry.name} (${selectedCountry.dialCode})`}
        >
          <span className="text-base leading-none">{selectedCountry.flag}</span>
          <span className="font-mono text-stone-700">{selectedCountry.dialCode}</span>
          <ChevronDown className={`w-3 h-3 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 inline-flex items-center justify-between gap-2 bg-white border border-stone-300 hover:border-stone-400 text-stone-800 text-xs font-medium rounded-xl transition-colors cursor-pointer select-none focus:outline-hidden focus:ring-2 focus:ring-amber-700 disabled:opacity-50"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="font-medium truncate">{selectedCountry.name}</span>
            <span className="font-mono text-stone-500">({selectedCountry.dialCode})</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-72 max-h-80 bg-white rounded-xl shadow-xl border border-stone-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 left-0">
          {/* Search bar */}
          <div className="p-2 border-b border-stone-100 bg-stone-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code (e.g. PK, 92, US)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-amber-700 font-medium"
              />
            </div>
          </div>

          {/* List of Countries */}
          <div className="overflow-y-auto divide-y divide-stone-50 flex-1 p-1">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-400">
                No country found for &quot;{search}&quot;
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = c.code === selectedCountry.code;
                return (
                  <button
                    key={`${c.code}-${c.dialCode}`}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left rounded-lg text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/80 text-amber-900 font-semibold'
                        : 'hover:bg-stone-100/80 text-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm leading-none">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="font-mono text-[11px] text-stone-500">{c.dialCode}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-700" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Info Footer */}
          <div className="px-3 py-1.5 bg-stone-50 border-t border-stone-100 text-[10px] text-stone-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-stone-400" />
              <span>{COUNTRIES.length} Countries</span>
            </span>
            <span>Local &apos;0&apos; auto-converts</span>
          </div>
        </div>
      )}
    </div>
  );
};
