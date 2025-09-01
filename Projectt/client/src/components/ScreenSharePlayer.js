import React, { useState, useRef, useEffect } from 'react';

const ScreenSharePlayer = ({
  videoUrl,
  isHost,
  socket,
  roomId,
  onScreenShare,
  isScreenSharing,
  localStream,
  remoteStreams,
  currentVideo
}) => {
  const [shareMethod, setShareMethod] = useState('browser'); // 'browser', 'window', 'tab'
  const [isSharing, setIsSharing] = useState(false);
  const [shareQuality, setShareQuality] = useState('high'); // 'low', 'medium', 'high'
  const [showInstructions, setShowInstructions] = useState(true);
  const localVideoRef = useRef(null);

  useEffect(() => {
    setIsSharing(isScreenSharing);
  }, [isScreenSharing]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const getShareMethodIcon = (method) => {
    switch (method) {
      case 'browser': return '🌐';
      case 'window': return '🪟';
      case 'tab': return '📑';
      default: return '📺';
    }
  };

  const getShareMethodTitle = (method) => {
    switch (method) {
      case 'browser': return 'Tam Ekran';
      case 'window': return 'Pencere';
      case 'tab': return 'Sekme';
      default: return 'Bilinmiyor';
    }
  };

  const getShareMethodDescription = (method) => {
    switch (method) {
      case 'browser': return 'Tüm ekranınızı paylaşın';
      case 'window': return 'Sadece bir pencereyi paylaşın';
      case 'tab': return 'Sadece bir tarayıcı sekmesini paylaşın';
      default: return '';
    }
  };

  const getQualitySettings = (quality) => {
    switch (quality) {
      case 'low':
        return { width: 640, height: 360, frameRate: 15 };
      case 'medium':
        return { width: 1280, height: 720, frameRate: 30 };
      case 'high':
        return { width: 1920, height: 1080, frameRate: 30 };
      default:
        return { width: 1280, height: 720, frameRate: 30 };
    }
  };

  const startScreenShare = async () => {
    try {
      const qualitySettings = getQualitySettings(shareQuality);
      
      const constraints = {
        video: {
          mediaSource: 'screen',
          width: { ideal: qualitySettings.width, max: qualitySettings.width },
          height: { ideal: qualitySettings.height, max: qualitySettings.height },
          frameRate: { ideal: qualitySettings.frameRate, max: qualitySettings.frameRate }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      await onScreenShare();
      setShowInstructions(false);
    } catch (error) {
      console.error('Ekran paylaşım hatası:', error);
    }
  };

  const stopScreenShare = async () => {
    await onScreenShare();
    setShowInstructions(true);
  };

  const renderInstructions = () => {
    if (!showInstructions || isSharing) return null;

    return (
      <div className="screen-share-instructions">
        <div className="instructions-content">
          <div className="instructions-header">
            <div className="instructions-icon">📺</div>
            <h3 className="instructions-title">Ekran Paylaşımı Rehberi</h3>
          </div>

          <div className="instructions-steps">
            <div className="instruction-step">
              <div className="step-indicator">1</div>
              <div className="step-content">
                <h4 className="step-title">Video sitesini açın</h4>
                <p className="step-description">
                  Dizibox, YabancıDizi veya başka bir sitede videonuzu bulun
                </p>
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-indicator">2</div>
              <div className="step-content">
                <h4 className="step-title">Tam ekran yapın</h4>
                <p className="step-description">
                  Videoyu tam ekran moduna alın (F11 veya fullscreen butonu)
                </p>
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-indicator">3</div>
              <div className="step-content">
                <h4 className="step-title">Ekranı paylaşın</h4>
                <p className="step-description">
                  Aşağıdaki "Paylaşımı Başlat" butonuna tıklayın
                </p>
              </div>
            </div>
          </div>

          {currentVideo && (
            <div className="current-video-reminder">
              <div className="reminder-header">
                <span className="reminder-icon">💡</span>
                <span className="reminder-title">Şu an seçili video:</span>
              </div>
              <p className="reminder-video">{currentVideo.title}</p>
              <button
                onClick={() => window.open(currentVideo.url, '_blank')}
                className="btn-professional btn-warning btn-small"
              >
                <span className="btn-icon">🔗</span>
                <span className="btn-text">Bu Videoyu Aç</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderShareControls = () => {
    return (
      <div className="share-controls-professional">
        {/* Quality settings */}
        <div className="quality-settings">
          <h4 className="settings-title">🎯 Paylaşım Kalitesi</h4>
          <div className="quality-buttons">
            <button
              onClick={() => setShareQuality('low')}
              className={`quality-btn ${shareQuality === 'low' ? 'active' : ''}`}
            >
              <span className="quality-icon">📱</span>
              <div className="quality-info">
                <span className="quality-label">Düşük</span>
                <span className="quality-specs">360p • 15fps</span>
              </div>
            </button>
            
            <button
              onClick={() => setShareQuality('medium')}
              className={`quality-btn ${shareQuality === 'medium' ? 'active' : ''}`}
            >
              <span className="quality-icon">💻</span>
              <div className="quality-info">
                <span className="quality-label">Orta</span>
                <span className="quality-specs">720p • 30fps</span>
              </div>
            </button>
            
            <button
              onClick={() => setShareQuality('high')}
              className={`quality-btn ${shareQuality === 'high' ? 'active' : ''}`}
            >
              <span className="quality-icon">🖥️</span>
              <div className="quality-info">
                <span className="quality-label">Yüksek</span>
                <span className="quality-specs">1080p • 30fps</span>
              </div>
            </button>
          </div>
        </div>

        {/* Share method selection */}
        <div className="share-method-settings">
          <h4 className="settings-title">🎯 Paylaşım Türü</h4>
          <div className="method-buttons">
            <button
              onClick={() => setShareMethod('browser')}
              className={`share-method-btn-professional ${shareMethod === 'browser' ? 'active' : ''}`}
            >
              <span className="method-icon">🌐</span>
              <div className="method-info">
                <span className="method-label">Tam Ekran</span>
                <span className="method-desc">Tüm ekranı paylaş</span>
              </div>
            </button>
            
            <button
              onClick={() => setShareMethod('window')}
              className={`share-method-btn-professional ${shareMethod === 'window' ? 'active' : ''}`}
            >
              <span className="method-icon">🪟</span>
              <div className="method-info">
                <span className="method-label">Pencere</span>
                <span className="method-desc">Sadece bir pencere</span>
              </div>
            </button>
            
            <button
              onClick={() => setShareMethod('tab')}
              className={`share-method-btn-professional ${shareMethod === 'tab' ? 'active' : ''}`}
            >
              <span className="method-icon">📑</span>
              <div className="method-info">
                <span className="method-label">Sekme</span>
                <span className="method-desc">Tarayıcı sekmesi</span>
              </div>
            </button>
          </div>
        </div>

        {/* Start/Stop button */}
        <div className="share-action-container">
          {!isSharing ? (
            <button
              onClick={startScreenShare}
              className="action-btn-professional start"
            >
              <span className="action-icon">🚀</span>
              <span className="action-text">Paylaşımı Başlat</span>
            </button>
          ) : (
            <button
              onClick={stopScreenShare}
              className="action-btn-professional stop"
            >
              <span className="action-icon">🛑</span>
              <span className="action-text">Paylaşımı Durdur</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderMainVideo = () => {
    // Host'un kendi ekran paylaşımı
    if (isHost && isSharing && localStream) {
      return (
        <div className="screen-share-main-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="screen-video-element"
          />
          <div className="sharing-overlay">
            <div className="sharing-info">
              <div className="sharing-status">
                <div className="status-indicator live"></div>
                <span className="status-text">CANLI PAYLAŞIM</span>
              </div>
              <p className="sharing-description">Ekranınız diğer kullanıcılarla paylaşılıyor</p>
            </div>
          </div>
        </div>
      );
    }

    // Başka birinin ekran paylaşımını izleme
    if (!isHost && remoteStreams.size > 0) {
      const hostStream = Array.from(remoteStreams.values())[0]; // İlk stream'i al
      return (
        <div className="screen-share-main-video">
          <video
            autoPlay
            playsInline
            ref={(ref) => {
              if (ref && hostStream) {
                ref.srcObject = hostStream;
              }
            }}
            className="screen-video-element"
          />
          <div className="viewing-overlay">
            <div className="viewing-info">
              <div className="viewing-status">
                <div className="status-indicator receiving"></div>
                <span className="status-text">CANLI İZLEME</span>
              </div>
              <p className="viewing-description">Host'un ekranını izliyorsunuz</p>
            </div>
          </div>
        </div>
      );
    }

    // Hiç paylaşım yok
    return (
      <div className="no-screen-share">
        <div className="no-share-content">
          <div className="no-share-icon">📺</div>
          <h3 className="no-share-title">Ekran Paylaşımı Yok</h3>
          <p className="no-share-subtitle">
            {isHost 
              ? 'Ekranınızı paylaşarak diğer kullanıcılarla video izleyin'
              : 'Host henüz ekran paylaşımı başlatmadı'
            }
          </p>
          
          {currentVideo && (
            <div className="current-video-info">
              <div className="video-info-header">
                <span className="video-info-icon">🎬</span>
                <span className="video-info-title">Seçili Video:</span>
              </div>
              <p className="video-info-name">{currentVideo.title}</p>
              <button
                onClick={() => window.open(currentVideo.url, '_blank')}
                className="btn-professional btn-primary btn-small"
              >
                <span className="btn-icon">🔗</span>
                <span className="btn-text">Bu Videoyu Aç</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="screen-share-container-professional">
      {/* Instructions panel */}
      {renderInstructions()}

      {/* Main video area */}
      <div className="screen-share-main-area">
        <div className="aspect-video relative">
          {renderMainVideo()}
        </div>
      </div>

      {/* Controls panel - sadece host için */}
      {isHost && (
        <div className="screen-share-controls-panel">
          <div className="controls-header">
            <h3 className="controls-title">🎮 Ekran Paylaşım Kontrolleri</h3>
            <div className="controls-status">
              <div className={`status-dot ${isSharing ? 'active' : 'inactive'}`}></div>
              <span className="status-label">
                {isSharing ? 'Paylaşım Aktif' : 'Paylaşım Kapalı'}
              </span>
            </div>
          </div>

          {renderShareControls()}
        </div>
      )}

      {/* Viewer info - host değil ise */}
      {!isHost && (
        <div className="viewer-info-panel">
          <div className="viewer-info-content">
            <div className="viewer-header">
              <span className="viewer-icon">👁️</span>
              <h4 className="viewer-title">İzleyici Modu</h4>
            </div>
            <p className="viewer-description">
              Host ekran paylaşımını başlattığında burada görünecektir.
            </p>
            
            {currentVideo && (
              <div className="viewer-video-info">
                <p className="viewer-video-text">
                  <strong>Seçili Video:</strong> {currentVideo.title}
                </p>
                <button
                  onClick={() => window.open(currentVideo.url, '_blank')}
                  className="btn-professional btn-secondary btn-small"
                >
                  <span className="btn-icon">🔗</span>
                  <span className="btn-text">Kendi Sekmemde Aç</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tips panel */}
      <div className="screen-share-tips">
        <div className="tips-header">
          <span className="tips-icon">💡</span>
          <h4 className="tips-title">İpuçları</h4>
        </div>
        
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-icon">🚀</span>
            <span className="tip-text">En iyi deneyim için videoyu tam ekran yapın</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📢</span>
            <span className="tip-text">Ses paylaşımı için "Sistem sesi dahil et" seçin</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span className="tip-text">Yavaş internet varsa kaliteyi düşürün</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔒</span>
            <span className="tip-text">Gizli sekmeleri paylaşmamaya dikkat edin</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenSharePlayer;