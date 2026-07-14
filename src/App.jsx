import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { getTemplates, generateImage, describeImage, getModelsForProvider } from './services/api';
import './App.css';

function compressImage(base64Str, maxDim = 120, quality = 0.5) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'openrouter', label: 'Open Router' },
  { id: 'gemini', label: 'Gemini' },
];

export default function App() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const models = useMemo(() => getModelsForProvider(provider), [provider]);
  const [selectedModel, setSelectedModel] = useState(models[0]?.value || '');

  useEffect(() => {
    if (models.length > 0 && !models.find((m) => m.value === selectedModel)) {
      setSelectedModel(models[0].value);
    }
  }, [models, selectedModel]);

  const [resolution, setResolution] = useState('640px');

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 420;
  });

  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  const [searchText, setSearchText] = useState('');

  const [generations, setGenerations] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const historyEndRef = useRef(null);

  const handleSidebarResizeStart = useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const panel = document.querySelector('.editor-panel');
    if (!panel) return;

    const startWidth = panel.getBoundingClientRect().width;
    const startX = mouseDownEvent.clientX;

    const handleMouseMove = (mouseMoveEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const newWidth = Math.max(280, Math.min(700, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    getTemplates().then((data) => {
      setTemplates(data);
      if (data && data.length > 0) {
        setSelectedTemplate(data[0]);
        setPromptText(data[0].prompt);
      }
    });
  }, []);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [generations]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!searchText.trim()) return templates;
    const q = searchText.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.prompt.toLowerCase().includes(q)
    );
  }, [templates, searchText]);

  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setPromptText(template.prompt);
  }, []);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result, 120, 0.5);
      setUploadedImage(compressed);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const compressed = await compressImage(reader.result, 120, 0.5);
            setUploadedImage(compressed);
          };
          reader.onerror = (err) => {
            console.error("FileReader paste error:", err);
          };
          reader.readAsDataURL(file);
          e.preventDefault();
        }
      }
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async () => {
        const compressed = await compressImage(reader.result, 120, 0.5);
        setUploadedImage(compressed);
      };
      reader.onerror = (err) => {
        console.error("FileReader drop error:", err);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleClearImage = useCallback(() => {
    setUploadedImage(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!promptText.trim() && !uploadedImage) return;

    const newGenId = Date.now().toString();
    const newGen = {
      id: newGenId,
      prompt: promptText,
      refImage: uploadedImage,
      model: selectedModel,
      provider,
      status: 'pending',
      resultUrl: null,
      error: null,
    };

    setGenerations((prev) => [...prev, newGen]);
    setIsGenerating(true);

    try {
      let finalPromptToSend = promptText;
      if (uploadedImage) {
        const description = await describeImage({ base64Image: uploadedImage, provider, apiKey });
        finalPromptToSend = `Style/Reference description: ${description}\n\nUser instructions: ${promptText}`;
      }

      const images = uploadedImage ? [{ src: uploadedImage }] : [];
      const result = await generateImage({ prompt: finalPromptToSend, images, model: selectedModel, provider, apiKey });

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === newGenId
            ? { ...g, status: 'completed', resultUrl: result.resultUrl }
            : g
        )
      );
    } catch (err) {
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === newGenId
            ? { ...g, status: 'failed', error: err.message || 'Failed to generate' }
            : g
        )
      );
    } finally {
      setIsGenerating(false);
    }
  }, [promptText, uploadedImage, selectedModel, provider, apiKey]);

  const getTemplateBadges = (index) => {
    const badgeMap = {
      0: { flames: 2, isNew: false },
      1: { flames: 0, isNew: true },
      2: { flames: 6, isNew: false },
      3: { flames: 0, isNew: false },
      4: { flames: 0, isNew: false },
      5: { flames: 3, isNew: false },
      6: { flames: 1, isNew: false },
    };
    return badgeMap[index] || { flames: Math.floor(Math.sin(index) * 4) + 2, isNew: false };
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="navbar__left">
          <div className="navbar__logo">
            <svg viewBox="0 0 24 24" className="navbar__logo-svg">
              <path d="M4 18V6l6 6 6-6v12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M12 12l6 6v-12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <span className="navbar__title">Image Gen AI</span>
        </div>

        <div className="navbar__center">
          <div className="provider-selector">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                className={`provider-btn ${provider === p.id ? 'provider-btn--active' : ''}`}
                onClick={() => setProvider(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="api-key-wrap">
            <input
              type={showApiKey ? 'text' : 'password'}
              className="api-key-input"
              placeholder={`${PROVIDERS.find((p) => p.id === provider)?.label || ''} API Key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button
              className="api-key-toggle"
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            {apiKey && <span className="api-key-dot" />}
          </div>
        </div>
      </header>

      <div className="app__layout">
        <aside className="editor-panel" style={{ width: `${sidebarWidth}px` }}>

          <div className="editor-panel__header">
            <div className="editor-panel__title-section">
              <div className="editor-panel__icon-box">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div>
                <h3>AI Generations</h3>
                <p>Prompt results & history</p>
              </div>
            </div>
          </div>

          <div className="editor-panel__history">
            {generations.length === 0 ? (
              <div className="history-empty">
                <div className="history-empty__icon">🎨</div>
                <p>Describe your image below or click a template on the right to start generating.</p>
              </div>
            ) : (
              generations.map((g) => (
                <div key={g.id} className="history-card">
                  <div className="history-card__meta">
                    <p className="history-card__prompt">"{g.prompt}"</p>
                    {g.refImage && (
                      <div className="history-card__ref-preview">
                        <span>Ref Image:</span>
                        <img src={g.refImage} alt="Ref" />
                      </div>
                    )}
                  </div>

                  <div className="history-card__result">
                    {g.status === 'pending' && (
                      <div className="history-card__loading">
                        <span className="spinner" />
                        <p>Generating your image...</p>
                      </div>
                    )}

                    {g.status === 'completed' && g.resultUrl && (
                      <div className="history-card__img-wrapper">
                        <img src={g.resultUrl} alt="Generated result" />
                        <a href={g.resultUrl} download={`generated-${g.id}.png`} className="history-card__download-btn">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                          Download
                        </a>
                      </div>
                    )}

                    {g.status === 'failed' && (
                      <div className="history-card__error">
                        <p>⚠️ {g.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={historyEndRef} />
          </div>

          <div className="editor-panel__input-section">
            <div
              className="editor-card"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="editor-card__inputs">

                <div className="uploaded-images-row">
                  <label className="upload-slot upload-slot--dashed" title="Click to upload, drag-and-drop, or Paste image directly into prompt box">
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </label>
                  {uploadedImage && (
                    <div className="upload-slot upload-slot--preview">
                      <img
                        src={uploadedImage}
                        alt="Face ref"
                        onError={(e) => {
                          console.error("Uploaded thumbnail failed to load, source length:", uploadedImage?.length);
                        }}
                      />
                      <button className="upload-slot__remove" onClick={handleClearImage}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <textarea
                  className="editor-card__textarea"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Describe your design... (Paste images with Cmd+V)"
                />

                <div className="editor-card__controls">
                  <div
                    className="control-badge control-badge--clickable"
                    onClick={() => setAspectRatio(aspectRatio === '1:1' ? '9:16' : '1:1')}
                  >
                    <span>{aspectRatio}</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </div>

                  <div className="control-badge control-badge--model-select">
                    <span className="model-brand-icon">🌱</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="model-select-dropdown"
                    >
                      {models.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="control-badge">
                    <span># 1</span>
                  </div>

                  <div
                    className="control-badge control-badge--clickable"
                    onClick={() => setResolution(resolution === '640px' ? '1024px' : '640px')}
                  >
                    <span>{resolution}</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="5" width="14" height="14" rx="1" />
                      <path d="M9 9h6v6" />
                    </svg>
                  </div>
                </div>

              </div>
            </div>

            <button
              className="btn-generate"
              onClick={handleGenerate}
              disabled={isGenerating || (!promptText.trim() && !uploadedImage)}
            >
              <span>Generate Image</span>
              <span className="btn-generate__icon">⚡</span>
            </button>
          </div>

        </aside>
        <div className="sidebar-resizer" onMouseDown={handleSidebarResizeStart} />

        <main className="gallery-panel">
          <div className="gallery-panel__header">
            <div className="gallery-tabs">
              <span className="gallery-tab gallery-tab--active">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="gallery-tab-icon">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Style Templates
              </span>
            </div>

            <div className="gallery-search-wrap">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="gallery-search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search templates"
                className="gallery-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <div className="templates-grid">
            {filteredTemplates.map((t, idx) => {
              const badge = getTemplateBadges(idx);
              const isSelected = selectedTemplate?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`template-card ${isSelected ? 'template-card--selected' : ''}`}
                  onClick={() => handleSelectTemplate(t)}
                >
                  <img
                    src={t.previewPath}
                    alt={t.name}
                    className="template-card__img"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="template-card__gradient" />

                  <div className="template-card__hot-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M17.65 11.23c-1.35-3.32-4.04-5.32-5.65-8.23-1.61 2.91-4.3 4.91-5.65 8.23-1.6 3.96-.34 8.77 3.65 10.3 3.99 1.53 8.25-1.57 7.65-10.3zM12 18a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                    </svg>
                    <span>{badge.flames}</span>
                  </div>

                  {badge.isNew && (
                    <div className="template-card__new-badge">
                      <span>NEW</span>
                    </div>
                  )}

                  <div className="template-card__title">
                    {t.name}
                  </div>
                </div>
              );
            })}

            {filteredTemplates.length === 0 && (
              <div className="gallery-empty">
                <p>No style templates found for "{searchText}"</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
