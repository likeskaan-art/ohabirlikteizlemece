import React, { useEffect, useState, useRef } from 'react';

const VideoPlayer = ({ 
  videoUrl, 
  isPlaying, 
  currentTime, 
  onPlay, 
  onPause, 
  onSeek, 
  videoRef, 
  iframeRef,
  getVideoType,
  getEmbedUrl,
  currentVideo,
  needsSpecialHandling 
}) => {
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [iframeError, setIframeError] = useState(false);
  const [loadingState, setLoadingState] = useState('idle');
  const [retryCount, setRetryCount] = useState(0);

  const videoType = videoUrl ? getVideoType(videoUrl) : 'none';
  const embedUrl = videoUrl ? getEmbedUrl(videoUrl) : '';
  const controlsTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // OK.ru ve diğer sorunlu siteleri tespit et
  const isProblematicSite = (url) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('ok.ru') || 
           lowerUrl.includes('vk.com') ||
           lowerUrl.includes('rutube.ru') ||
           lowerUrl.includes('mail.ru') ||
           lowerUrl.includes('yandex.') ||
           lowerUrl.includes('dailymotion.com');
  };

  // Gelişmiş URL işleme
  const processVideoUrl = (url) => {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      
      // OK.ru için özel işlem
      if (urlObj.hostname.includes('ok.ru')) {
        // OK.ru embed URL'sine dönüştür
        const videoId = url.match(/\/video\/(\d+)/);
        if (videoId) {
          return `https://ok.ru/videoembed/${videoId[1]}`;
        }
      }
      
      // Diğer siteler için referrer ve sandbox ayarları
      return url;
    } catch (error) {
      console.warn('URL işleme hatası:', error);
      return url;
    }
  };

  // Zaman formatı
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress bar için yüzde hesapla
  const getProgressPercentage = () => {
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  };

  // Seek bar tıklama
  const handleProgressClick = (e) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  // Volume değişikliği
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  // Play/Pause toggle
  const togglePlayback = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const container = containerRef.current;
    
    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    }
  };

  // Kontrolleri otomatik gizle
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Mouse hareketlerini dinle
  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Iframe yükleme durumunu takip et
  const handleIframeLoad = () => {
    setLoadingState('loaded');
    setIframeError(false);
    setRetryCount(0);
  };

  const handleIframeError = () => {
    setLoadingState('error');
    setIframeError(true);
  };

  // Video metadata yüklendiğinde
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setLoadingState('loaded');
    }
  };

  // Time update handler
  const handleTimeUpdate = (e) => {
    setLocalCurrentTime(e.target.currentTime);
  };

  // Video yüklenmeye başladığında
  useEffect(() => {
    if (videoUrl) {
      setLoadingState('loading');
      setIframeError(false);
      setRetryCount(0);
    }
  }, [videoUrl]);

  // Kontroller timeout'u temizle
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Yeniden deneme fonksiyonu
  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      setLoadingState('loading');
      setIframeError(false);
      
      // Iframe'i yeniden yükle
      if (iframeRef.current) {
        const currentSrc = iframeRef.current.src;
        iframeRef.current.src = '';
        setTimeout(() => {
          iframeRef.current.src = currentSrc;
        }, 500);
      }
    }
  };

  // Site özel uyarısı render et
  const renderSiteWarning = () => {
    if (!videoUrl) return null;

    if (isProblematicSite(videoUrl)) {
      return (
        <div className="site-warning-card">
          <div className="warning-header">
            <div className="warning-icon">⚠️</div>
            <h4 className="warning-title">Özel Site Tespit Edildi</h4>
          </div>
          
          <div className="warning-content">
            <p className="warning-description">
              Bu site ({videoUrl.includes('ok.ru') ? 'OK.ru' : 'Özel Site'}) 
              coğrafi kısıtlamalar nedeniyle doğrudan iframe'de açılamayabilir.
            </p>
            
            <div className="warning-solutions">
              <h5 className="solutions-title">💡 Çözüm Önerileri:</h5>
              <ul className="solutions-list">
                <li>🌐 VPN kullanın (Almanya, ABD, Kanada)</li>
                <li>🕵️ Tarayıcı gizli modunu deneyin</li>
                <li>📺 Ekran paylaşımı moduna geçin</li>
                <li>🔄 Alternatif link arayın</li>
              </ul>
            </div>
            
            <div className="warning-actions">
              <button
                onClick={() => window.open(videoUrl, '_blank')}
                className="btn-professional btn-warning"
              >
                <span className="btn-icon">🔗</span>
                <span className="btn-text">Yeni Sekmede Aç</span>
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(videoUrl)}
                className="btn-professional btn-secondary"
              >
                <span className="btn-icon">📋</span>
                <span className="btn-text">Linki Kopyala</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Loading overlay
  const renderLoadingOverlay = () => {
    if (loadingState !== 'loading') return null;

    return (
      <div className="loading-overlay-professional">
        <div className="loading-content-professional">
          <div className="loading-spinner-professional">
            <div className="spinner-outer"></div>
            <div className="spinner-inner"></div>
          </div>
          <h3 className="loading-title">Video Yükleniyor</h3>
          <p className="loading-subtitle">
            {videoType === 'iframe' ? 'Site bağlantısı kuruluyor...' : 'Video dosyası yükleniyor...'}
          </p>
          <div className="loading-progress">
            <div className="progress-dots">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Error overlay
  const renderErrorOverlay = () => {
    if (loadingState !== 'error') return null;

    return (
      <div className="error-overlay-professional">
        <div className="error-content-professional">
          <div className="error-icon-animated">⚠️</div>
          <h3 className="error-title">Video Yüklenemedi</h3>
          <p className="error-description">
            {isProblematicSite(videoUrl) 
              ? 'Site coğrafi kısıtlamalar nedeniyle erişimi engelliyor'
              : 'Bağlantı hatası veya site kısıtlaması'
            }
          </p>
          
          <div className="error-actions">
            {retryCount < 3 && (
              <button
                onClick={handleRetry}
                className="btn-professional btn-warning"
              >
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Yeniden Dene ({3 - retryCount})</span>
              </button>
            )}
            <button
              onClick={() => window.open(videoUrl, '_blank')}
              className="btn-professional btn-primary"
            >
              <span className="btn-icon">🔗</span>
              <span className="btn-text">Yeni Sekmede Aç</span>
            </button>
          </div>
          
          <div className="error-help">
            <p className="help-text">
              Bu durumda "Ekran Paylaşımı" modunu kullanmanızı öneriyoruz.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Professional video controls
  const renderVideoControls = () => {
    if (videoType !== 'direct') return null;

    return (
      <div 
        className={`video-controls-professional ${showControls ? 'visible' : 'hidden'}`}
        onMouseEnter={() => setShowControls(true)}
      >
        {/* Progress bar */}
        <div className="progress-container-professional">
          <div 
            className="progress-bar-professional"
            onClick={handleProgressClick}
          >
            <div 
              className="progress-fill-professional"
              style={{ width: `${getProgressPercentage()}%` }}
            />
            <div 
              className="progress-handle-professional"
              style={{ left: `calc(${getProgressPercentage()}% - 8px)` }}
            />
          </div>
          <div className="progress-time-display">
            <span className="time-current">{formatTime(currentTime)}</span>
            <span className="time-separator">/</span>
            <span className="time-duration">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="main-controls-professional">
          <div className="controls-left">
            {/* Play/Pause */}
            <button
              onClick={togglePlayback}
              className={`video-control-btn-professional ${isPlaying ? 'pause' : 'play'}`}
            >
              <div className="btn-icon-large">
                {isPlaying ? '⏸️' : '▶️'}
              </div>
              <div className="btn-label">
                {isPlaying ? 'Duraklat' : 'Oynat'}
              </div>
            </button>

            {/* Volume Control */}
            <div className="volume-control-professional">
              <div className="volume-icon">
                {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
              </div>
              <div className="volume-slider-container">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="volume-slider-professional"
                />
                <div className="volume-percentage">
                  {Math.round(volume * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="controls-center">
            {/* Time Display */}
            <div className="time-display-professional">
              <span className="current-time">{formatTime(currentTime)}</span>
              <span className="time-divider">•</span>
              <span className="total-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="controls-right">
            {/* Settings */}
            <button
              className="video-control-btn-professional settings"
              onClick={() => setShowControls(!showControls)}
            >
              <div className="btn-icon">⚙️</div>
              <div className="btn-label">Ayarlar</div>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="video-control-btn-professional fullscreen"
            >
              <div className="btn-icon">
                {isFullscreen ? '🗗' : '⛶'}
              </div>
              <div className="btn-label">
                {isFullscreen ? 'Çık' : 'Tam Ekran'}
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Sync controls for iframe videos
  const renderSyncControls = () => {
    if (videoType === 'direct' || videoType === 'none') return null;

    return (
      <div className="sync-controls-professional">
        <div className="sync-controls-header">
          <h4 className="sync-title">⚡ Sync Kontrolleri</h4>
          <span className="sync-subtitle">Manuel senkronizasyon</span>
        </div>
        
        <div className="sync-buttons">
          <button
            onClick={onPlay}
            className="sync-btn-professional play"
          >
            <div className="sync-btn-icon">▶️</div>
            <div className="sync-btn-text">
              <span className="sync-btn-label">Oynat</span>
              <span className="sync-btn-desc">Herkesi başlat</span>
            </div>
          </button>
          
          <button
            onClick={onPause}
            className="sync-btn-professional pause"
          >
            <div className="sync-btn-icon">⏸️</div>
            <div className="sync-btn-text">
              <span className="sync-btn-label">Duraklat</span>
              <span className="sync-btn-desc">Herkesi durdur</span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  // Video info overlay
  const renderVideoInfo = () => {
    if (!currentVideo) return null;

    return (
      <div className="video-info-overlay-professional">
        <div className="video-info-content">
          <div className="video-status">
            <div className={`status-indicator ${isPlaying ? 'playing' : 'paused'}`}>
              {isPlaying ? '▶️' : '⏸️'}
            </div>
            <div className="status-text">
              {isPlaying ? 'Oynatılıyor' : 'Duraklatıldı'}
            </div>
          </div>
          
          <div className="video-details">
            <h4 className="video-title">{currentVideo.title}</h4>
            <p className="video-meta">
              {videoType === 'youtube' && '📺 YouTube'} 
              {videoType === 'vimeo' && '🎭 Vimeo'}
              {videoType === 'iframe' && '🌐 Web Player'}
              {videoType === 'direct' && '🎬 Direkt Video'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Empty state
  const renderEmptyState = () => {
    return (
      <div className="empty-state-professional">
        <div className="empty-content">
          <div className="empty-icon-container">
            <div className="empty-icon">🎬</div>
            <div className="empty-icon-bg"></div>
          </div>
          
          <div className="empty-text">
            <h3 className="empty-title">Video Seçilmedi</h3>
            <p className="empty-subtitle">Yukarıdan bir video URL'si ekleyin</p>
          </div>
          
          <div className="supported-sites">
            <h4 className="sites-title">🎯 Desteklenen Siteler</h4>
            <div className="sites-grid">
              <div className="site-card youtube">
                <div className="site-icon">📺</div>
                <span className="site-name">YouTube</span>
              </div>
              <div className="site-card dizibox">
                <div className="site-icon">🎭</div>
                <span className="site-name">Dizibox</span>
              </div>
              <div className="site-card ok-ru">
                <div className="site-icon">🎪</div>
                <span className="site-name">OK.ru</span>
              </div>
              <div className="site-card hdfilm">
                <div className="site-icon">🎞️</div>
                <span className="site-name">HD Film</span>
              </div>
              <div className="site-card yabanci">
                <div className="site-icon">🌟</div>
                <span className="site-name">Yabancı Dizi</span>
              </div>
              <div className="site-card vimeo">
                <div className="site-icon">🎨</div>
                <span className="site-name">Vimeo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="video-player-container-professional">
      {/* Site uyarısı */}
      {renderSiteWarning()}

      {/* Ana video container */}
      <div 
        ref={containerRef}
        className="video-container-professional"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <div className="aspect-video relative">
          {/* Loading overlay */}
          {renderLoadingOverlay()}

          {/* Error overlay */}
          {renderErrorOverlay()}

          {videoType === 'direct' ? (
            // Doğrudan video dosyası
            <video
              ref={videoRef}
              src={videoUrl}
              className="video-element-professional"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onLoadStart={() => setLoadingState('loading')}
              onCanPlay={() => setLoadingState('loaded')}
              onError={() => setLoadingState('error')}
              volume={volume}
              playsInline
            />
          ) : videoType === 'iframe' || videoType === 'youtube' || videoType === 'vimeo' ? (
            // iframe ile dış siteler
            <div className="iframe-container-professional">
              {!iframeError ? (
                <iframe
                  ref={iframeRef}
                  src={processVideoUrl(videoUrl) || embedUrl}
                  className="iframe-element-professional"
                  allowFullScreen
                  title="Video Player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; microphone; camera"
                  sandbox="allow-same-origin allow-scripts allow-presentation allow-forms allow-popups"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="iframe-error-professional">
                  <div className="iframe-error-content">
                    <div className="error-icon-large">🚫</div>
                    <h3 className="error-title-large">Site Erişimi Engellendi</h3>
                    <p className="error-desc-large">Site iframe'i engelliyor olabilir</p>
                    <div className="error-actions-large">
                      <button
                        onClick={() => window.open(videoUrl, '_blank')}
                        className="btn-professional btn-primary"
                      >
                        <span className="btn-icon">🔗</span>
                        <span className="btn-text">Yeni Sekmede Aç</span>
                      </button>
                      {retryCount < 3 && (
                        <button
                          onClick={handleRetry}
                          className="btn-professional btn-warning"
                        >
                          <span className="btn-icon">🔄</span>
                          <span className="btn-text">Tekrar Dene</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Video seçilmedi - Empty state
            renderEmptyState()
          )}

          {/* Video info overlay */}
          {renderVideoInfo()}
          
          {/* Video controls */}
          {renderVideoControls()}
          
          {/* Sync controls */}
          {renderSyncControls()}
        </div>
      </div>

      {/* İframe için özel talimatlar */}
      {videoType === 'iframe' && !isProblematicSite(videoUrl) && !iframeError && (
        <div className="iframe-info-card">
          <div className="info-header">
            <div className="info-icon">💡</div>
            <h4 className="info-title">İframe Modu Aktif</h4>
          </div>
          <div className="info-content">
            <p className="info-description">
              Video doğrudan site üzerinden oynatılıyor. Sync kontrolleri üstte.
            </p>
            <div className="info-tip">
              <span className="tip-icon">💭</span>
              <span className="tip-text">
                Eğer video görünmüyorsa "Ekran Paylaşımı" moduna geçin.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;