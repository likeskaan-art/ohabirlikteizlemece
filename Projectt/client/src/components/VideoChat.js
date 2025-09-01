import React, { useRef, useEffect, useState } from 'react';

const VideoChat = ({ 
  localStream, 
  remoteStreams, 
  isMicOn, 
  isCameraOn, 
  isScreenSharing,
  onToggleMic, 
  onToggleCamera, 
  onToggleScreenShare,
  users,
  currentUsername,
  localVideoRef
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [videoQuality, setVideoQuality] = useState('high');

  // Kullanıcı adını user ID'sinden al
  const getUsernameById = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.username : userId.slice(0, 8) + '...';
  };

  // Connection status güncelle
  useEffect(() => {
    if (localStream) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [localStream]);

  // Local stream'i video element'e bağla
  useEffect(() => {
    if (localVideoRef && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true; // Echo önleme
    }
  }, [localStream, localVideoRef]);

  // Minimize durumunda sadece buton göster
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="video-chat-toggle-btn"
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎥</span>
            <div className="text-left">
              <div className="text-sm font-semibold">Video Chat</div>
              <div className="text-xs opacity-75">
                {(remoteStreams?.size || 0) + (localStream ? 1 : 0)} kişi
              </div>
            </div>
          </div>
          
          {/* Connection indicator */}
          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
            connectionStatus === 'connected' ? 'bg-green-400' : 'bg-gray-400'
          }`} />
        </button>
      </div>
    );
  }

  return (
    <div className="video-chat-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white text-sm">🎥 Görüntülü Sohbet</h3>
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`} />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Ayarlar"
          >
            ⚙️
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Küçült"
          >
            ➖
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="p-3 border-b border-gray-700 bg-gray-800/50">
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Video Kalitesi:</label>
              <select 
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
              >
                <option value="low">Düşük (320p)</option>
                <option value="medium">Orta (480p)</option>
                <option value="high">Yüksek (720p)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Video grid */}
      <div className="video-grid">
        {/* Local video */}
        {localStream && (
          <div className="video-item">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="video-overlay">
              <div className="video-username">
                {isScreenSharing ? '🖥️ Ekranım' : '📹 Ben'}
              </div>
            </div>
            <div className="status-indicator">
              {!isMicOn && (
                <div className="status-badge mic-off" title="Mikrofon kapalı">
                  🔇
                </div>
              )}
              {!isCameraOn && !isScreenSharing && (
                <div className="status-badge camera-off" title="Kamera kapalı">
                  📷
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remote videos */}
        {remoteStreams && Array.from(remoteStreams.entries()).map(([userId, stream]) => (
          <div key={userId} className="video-item">
            <video
              autoPlay
              playsInline
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setActiveVideo(activeVideo === userId ? null : userId)}
              ref={(el) => { 
                if (el && stream) {
                  el.srcObject = stream;
                  el.muted = false; // Remote stream ses açık
                }
              }}
            />
            <div className="video-overlay">
              <div className="video-username">
                👤 {getUsernameById(userId)}
              </div>
            </div>
            {activeVideo === userId && (
              <div className="absolute top-2 left-2">
                <div className="bg-blue-500 rounded-full p-1">
                  <span className="text-xs">🔍</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Placeholder for empty slots */}
        {Array.from({ 
          length: Math.max(0, 4 - (localStream ? 1 : 0) - (remoteStreams?.size || 0)) 
        }).map((_, i) => (
          <div key={`empty-${i}`} className="video-item opacity-50">
            <div className="w-full h-full flex items-center justify-center bg-gray-800 border-2 border-dashed border-gray-600">
              <div className="text-center">
                <div className="text-lg mb-1">👤</div>
                <span className="text-xs text-gray-500">Boş</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* WebRTC kontrol butonları */}
      <div className="webrtc-controls">
        <button
          onClick={onToggleMic}
          className={`webrtc-btn ${isMicOn ? 'mic-on' : 'mic-off'}`}
          title={isMicOn ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
        >
          {isMicOn ? '🎤' : '🔇'}
        </button>

        <button
          onClick={onToggleCamera}
          className={`webrtc-btn ${isCameraOn ? 'camera-on' : 'camera-off'}`}
          title={isCameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'}
        >
          {isCameraOn ? '📹' : '📷'}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`webrtc-btn ${isScreenSharing ? 'screen-on' : 'screen-off'}`}
          title={isScreenSharing ? 'Ekran paylaşımını durdur' : 'Ekranı paylaş'}
        >
          {isScreenSharing ? '🟢' : '🖥️'}
        </button>
      </div>

      {/* Bağlantı durumu */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-center space-x-3 text-xs">
          <div className={`flex items-center gap-1 ${
            connectionStatus === 'connected' ? 'text-green-400' : 'text-gray-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' : 'bg-gray-400'
            }`} />
            <span>{connectionStatus === 'connected' ? 'Bağlı' : 'Bağlantı yok'}</span>
          </div>
          
          {remoteStreams && remoteStreams.size > 0 && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400">{remoteStreams.size} kişi</span>
            </>
          )}
          
          {localStream && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-blue-400">
                {isScreenSharing ? 'Ekran' : (isCameraOn ? 'Kamera' : 'Ses')}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Büyütülmüş video modal */}
      {activeVideo && remoteStreams && remoteStreams.has(activeVideo) && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] backdrop-blur"
          onClick={() => setActiveVideo(null)}
        >
          <div className="relative max-w-6xl max-h-6xl w-full h-full p-4">
            <video
              autoPlay
              playsInline
              className="w-full h-full object-contain rounded-lg border-2 border-blue-500/50"
              ref={(el) => { 
                if (el && remoteStreams.get(activeVideo)) {
                  el.srcObject = remoteStreams.get(activeVideo);
                  el.muted = false;
                }
              }}
            />
            
            {/* Video info overlay */}
            <div className="absolute top-8 left-8 bg-black/80 backdrop-blur rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">👤 {getUsernameById(activeVideo)}</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
            </div>
            
            {/* Close button */}
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-8 right-8 bg-black/80 hover:bg-black/90 text-white p-3 rounded-full transition-all hover:scale-110"
            >
              ✕
            </button>
            
            {/* Controls overlay */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur rounded-lg px-6 py-3">
              <div className="flex items-center gap-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMic();
                  }}
                  className={`webrtc-btn ${isMicOn ? 'mic-on' : 'mic-off'}`}
                >
                  {isMicOn ? '🎤' : '🔇'}
                </button>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCamera();
                  }}
                  className={`webrtc-btn ${isCameraOn ? 'camera-on' : 'camera-off'}`}
                >
                  {isCameraOn ? '📹' : '📷'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoChat;
