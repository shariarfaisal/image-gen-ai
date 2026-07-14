import { useState, useMemo } from 'react';

export default function TemplateSidebar({ templates, onSelectTemplate, isOpen, onToggle }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.prompt.toLowerCase().includes(q)
    );
  }, [templates, search]);

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
      <aside className={`template-sidebar ${isOpen ? 'template-sidebar--open' : ''}`}>
        <div className="template-sidebar__header">
          <h2>Templates</h2>
          <span className="template-sidebar__count">{filtered.length}</span>
          <button className="template-sidebar__close" onClick={onToggle}>
            ✕
          </button>
        </div>
        <div className="template-sidebar__search-wrap">
          <svg className="template-sidebar__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            className="template-sidebar__search"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="template-sidebar__list">
          {filtered.map((t) => (
            <button
              key={t.id}
              className="template-card"
              onClick={() => onSelectTemplate(t)}
            >
              <div className="template-card__preview">
                <img
                  src={t.previewPath}
                  alt={t.name}
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="template-card__name">{t.name}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="template-sidebar__empty">No templates found</p>
          )}
        </div>
      </aside>
    </>
  );
}
