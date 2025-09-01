import React, { useEffect, useRef, useState } from 'react';

const Chat = ({ 
  messages, 
  onSendMessage, 
  onSendReaction, 
  currentUsername 
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Emoji listesi
  const emojis = [
    '😂', '😍', '🤔', '😮', '😢', '😡', '👍', '👎', 
    '❤️', '💕', '🔥', '⭐', '🎉', '👏', '🙌', '💯',
    '😎', '🤗', '😱', '🤢', '😴', '🤯', '🤪', '😇'
  ];

  // Mesajları en alta kaydır
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mesaj gönder
  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    onSendMessage(message.trim());
    setMessage('');
    chatInputRef.current?.focus();
  };

  // Enter tuşu ile mesaj gönder
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Emoji gönder
  const handleEmojiClick = (emoji) => {
    onSendReaction(emoji);
    setShowEmojiPicker(false);
  };

  // Mesaj zamanını formatla
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Mesaj tipine göre style
  const getMessageStyle = (msg) => {
    const isOwn = msg.username === currentUsername;
    return isOwn ? 'justify-end' : 'justify-start';
  };

  const getMessageBubbleStyle = (msg) => {
    const isOwn = msg.username === currentUsername;
    return isOwn 
      ? 'bg-blue-600 text-white' 
      : 'bg-gray-700 text-white';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="p-3 border-b border-gray-700 bg-gray-800">
        <h3 className="font-semibold text-white flex items-center">
          💬 Sohbet
          <span className="ml-auto text-xs text-gray-400">
            {messages.length} mesaj
          </span>
        </h3>
      </div>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-3xl mb-2">💭</div>
            <p>Henüz mesaj yok</p>
            <p className="text-xs">İlk mesajı sen gönder!</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${getMessageStyle(msg)}`}>
              <div className="max-w-xs lg:max-w-md">
                {msg.type === 'message' ? (
                  <div>
                    {/* Kullanıcı adı (kendi mesajı değilse) */}
                    {msg.username !== currentUsername && (
                      <div className="text-xs text-gray-400 mb-1 px-1">
                        {msg.username}
                      </div>
                    )}
                    
                    {/* Mesaj balonu */}
                    <div className={`rounded-2xl px-4 py-2 ${getMessageBubbleStyle(msg)} break-words`}>
                      <p className="text-sm">{msg.text}</p>
                      <div className="text-xs opacity-70 mt-1">
                        {formatMessageTime(msg.timestamp)}
                      </div>
                    </div>
                  </div>
                ) : msg.type === 'system' ? (
                  // Sistem mesajları
                  <div className="text-center text-xs text-gray-400 italic">
                    {msg.text}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="p-3 border-t border-gray-700 bg-gray-800">
          <div className="grid grid-cols-8 gap-2">
            {emojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl p-2 hover:bg-gray-700 rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat input */}
      <div className="p-3 border-t border-gray-700 bg-gray-800">
        <div className="flex space-x-2">
          {/* Emoji button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-3 py-2 text-xl hover:bg-gray-700 rounded transition-colors"
            title="Emoji gönder"
          >
            😊
          </button>

          {/* Message input */}
          <input
            ref={chatInputRef}
            type="text"
            placeholder="Mesajınızı yazın..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 text-sm"
            maxLength={500}
          />

          {/* Send button */}
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
            title="Mesaj gönder"
          >
            📤
          </button>
        </div>

        {/* Karakter sayacı */}
        <div className="text-xs text-gray-400 mt-1 text-right">
          {message.length}/500
        </div>
      </div>
    </div>
  );
};

export default Chat;
