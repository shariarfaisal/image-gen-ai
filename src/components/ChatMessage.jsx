export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`message ${isUser ? 'message--user' : 'message--assistant'}`}>
      <div className="message__avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message__body">
        {message.images && message.images.length > 0 && (
          <div className="message__images">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={typeof img === 'string' ? img : img.src}
                alt={`attached ${i}`}
                className="message__image-thumb"
              />
            ))}
          </div>
        )}
        {message.text && <div className="message__text">{message.text}</div>}
        {message.resultUrl && (
          <div className="message__result">
            <img src={message.resultUrl} alt="generated" className="message__result-img" />
          </div>
        )}
        {message.isLoading && (
          <div className="message__loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
