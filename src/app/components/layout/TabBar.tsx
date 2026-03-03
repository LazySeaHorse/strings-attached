import React from 'react';
import { X, Plus, FileText, File } from 'lucide-react';
import { useDocumentStore } from '../stores';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useDocumentStore();

  const handleCloseTab = (tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const hasWork = (tab.highlights?.length ?? 0) > 0 ||
        (tab.annotations?.length ?? 0) > 0 ||
        (tab.pulledIndices?.length ?? 0) > 0;
      if (hasWork && !window.confirm(`Close "${tab.document.title || 'Untitled'}"? You have unsaved highlights, annotations, or pulled words.`)) {
        return;
      }
    }
    closeTab(tabId);
  };

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex items-center shrink-0"
      style={{
        height: 36,
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f0',
        paddingLeft: 8,
        gap: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isPdf = tab.document.type === 'pdf';
        const title = tab.document.title || 'Untitled';
        const displayTitle = title.length > 24 ? title.slice(0, 22) + '...' : title;

        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="cursor-pointer flex items-center gap-1.5 group"
            style={{
              padding: '0 10px',
              height: 28,
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 500,
              color: isActive ? '#171717' : '#a3a3a3',
              background: isActive ? '#ffffff' : 'transparent',
              boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 100ms ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = '#525252';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = '#a3a3a3';
            }}
          >
            {isPdf ? (
              <File size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
            ) : (
              <FileText size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
            )}
            <span>{displayTitle}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
              className="cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100"
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: 'none',
                background: 'transparent',
                color: '#a3a3a3',
                marginLeft: 2,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f0f0f0';
                e.currentTarget.style.color = '#525252';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a3a3a3';
              }}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}

      {/* Add tab button — deselects current tab to show EmptyState */}
      <button
        onClick={() => setActiveTab(null)}
        className="cursor-pointer flex items-center justify-center transition-colors duration-100"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          color: '#d4d4d4',
          flexShrink: 0,
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f0f0f0';
          e.currentTarget.style.color = '#a3a3a3';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#d4d4d4';
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}