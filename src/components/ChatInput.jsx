import { useRef, useState, useCallback, useEffect } from 'react';

export default function ChatInput({ onSend, isLoading, initialText }) {
  const [text, setText] = useState('');
  const [pastedImages, setPastedImages] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      textareaRef.current?.focus();
    }
  }, [initialText]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      Promise.all(
        imageFiles.map(
          (file) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ file, src: reader.result });
              reader.readAsDataURL(file);
            })
        )
      ).then((results) => {
        setPastedImages((prev) => [...prev, ...results]);
      });
    }
  }, []);

  const removeImage = useCallback((index) => {
    setPastedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    if ((!text.trim() && pastedImages.length === 0) || isLoading) return;
    onSend({ text: text.trim(), images: pastedImages });
    setText('');
    setPastedImages([]);
  }, [text, pastedImages, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="chat-input">
      {pastedImages.length > 0 && (
        <div className="chat-input__previews">
          {pastedImages.map((img, i) => (
            <div key={i} className="chat-input__preview-item">
              <img src={img.src} alt={`paste ${i}`} />
              <button
                className="chat-input__remove-img"
                onClick={() => removeImage(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="chat-input__row">
        <textarea
          ref={textareaRef}
          className="chat-input__textarea"
          placeholder="Describe the image you want to generate... (Paste images with Cmd+V)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={isLoading}
        />
        <button
          className="chat-input__send"
          onClick={handleSend}
          disabled={isLoading || (!text.trim() && pastedImages.length === 0)}
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}
