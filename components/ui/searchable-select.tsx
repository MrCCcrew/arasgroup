"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchableSelect({ value, onChange, options, placeholder = "اختر...", label, className = "" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && <label className="mb-1 block text-xs text-muted-foreground">{label}</label>}

      <div
        className="input-field flex cursor-pointer items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-sm ${!selectedOption ? "text-muted-foreground" : ""}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                className="input-field w-full pr-8 text-sm"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-auto">
            <div
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleSelect("")}
            >
              {placeholder}
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد نتائج</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-muted ${
                    opt.value === value ? "bg-primary/10" : ""
                  }`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
