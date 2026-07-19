import React, { useState, useMemo, useEffect } from 'react';
import { icons } from 'lucide-react';
import Fuse from 'fuse.js';

interface IconPickerProps {
  onSelect: (iconName: string) => void;
  onClose: () => void;
  currentIcon?: string;
}

const allIconNames = Object.keys(icons).filter(name => name !== 'createLucideIcon' && name !== 'default');

// Prepare data for Fuse.js
const iconData = allIconNames.map(name => ({ name }));

export default function IconPicker({ onSelect, onClose, currentIcon }: IconPickerProps) {
  const [search, setSearch] = useState("");

  const fuse = useMemo(() => new Fuse(iconData, {
    keys: ['name'],
    threshold: 0.3,
  }), []);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return allIconNames.slice(0, 100); // Show first 100 when no search to avoid lag
    return fuse.search(search).map(result => result.item.name).slice(0, 100);
  }, [search, fuse]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          width: '90%',
          maxWidth: '500px',
          height: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>Select an Icon</h3>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
              {/* Simple Search SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Intelligent search (e.g. 'camera', 'heart')..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '0.9rem'
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {filteredIcons.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
              No icons found for "{search}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '1rem' }}>
              {filteredIcons.map(iconName => {
                const IconComponent = (icons as any)[iconName];
                if (!IconComponent) return null;
                const isSelected = currentIcon === iconName;
                
                return (
                  <button
                    key={iconName}
                    onClick={() => onSelect(iconName)}
                    title={iconName}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1rem 0.5rem',
                      background: isSelected ? 'var(--text-primary)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--text-primary)' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                      }
                    }}
                  >
                    <IconComponent size={24} strokeWidth={1.5} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
