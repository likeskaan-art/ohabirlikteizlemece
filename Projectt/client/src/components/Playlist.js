import React, { useState } from 'react';

const Playlist = ({
  playlist,
  currentVideo,
  onVideoSelect,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onEmojiClick,
  currentUsername,
  isHost
}) => {
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (newVideoUrl.trim()) {
      onAddToPlaylist(newVideoUrl.trim(), newVideoTitle.trim() || detectTitle(newVideoUrl));
      setNewVideoUrl('');
      setNewVideoTitle('');
      setShowAddForm(false);
    }
  };

  const detectTitle = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'YouTube Video';
    } else if (url.includes('dizibox')) {
      return 'Dizibox Video';
    } else if (url.includes('yabancidizi')) {
      return 'Yabancı Dizi';
    } else if (url.includes('ok.ru')) {
      return 'OK.ru Video';
    } else if (url.includes('hdfilmcehennemi')) {
      return 'HD Film';
    } else if (url.includes('vimeo')) {
      return 'Vimeo Video';
    }
    return 'Video';
  };

  const getSiteIcon = (url) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return '📺';
    if (url.includes('dizibox')) return '🎭';
    if (url.includes('yabancidizi')) return '🌟';
    if (url.includes('ok.ru')) return '🎪';
    if (url.includes('hdfilmcehennemi')) return '🎞️';
    if (url.includes('vimeo')) return '🎨';
    return '🎬';
  };

  const isCurrentVideo = (item) => {
    return currentVideo && currentVideo.url === item.url;
  };

  return (
    <div className="playlist-component-professional">
      {/* Playlist Header */}
      <div className="playlist-header-professional">
        <div className="playlist-title-container">
          <h3 className="playlist-title">📝 Playlist</h3>
          <div className="playlist-meta">
            <span className="playlist-count">{playlist.length} video</span>
            {playlist.length > 0 && (
              <span className="playlist-duration">
                ~{Math.round(playlist.length * 45)} dakika
              </span>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-professional btn-primary btn-small"
        >
          <span className="btn-icon">{showAddForm ? '✕' : '➕'}</span>
          <span className="btn-text">{showAddForm ? 'İptal' : 'Ekle'}</span>
        </button>
      </div>

      {/* Add video form */}
      {showAddForm && (
        <div className="add-video-form-professional">
          <form onSubmit={handleAddSubmit} className="add-form">
            <div className="form-group">
              <label className="form-label-small">🔗 Video URL</label>
              <input
                type="url"
                placeholder="Video linkini yapıştırın..."
                value={newVideoUrl}
                onChange={(e) => {
                  setNewVideoUrl(e.target.value);
                  if (e.target.value && !newVideoTitle) {
                    setNewVideoTitle(detectTitle(e.target.value));
                  }
                }}
                className="input-professional input-small"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label-small">📝 Başlık (Opsiyonel)</label>
              <input
                type="text"
                placeholder="Video başlığı..."
                value={newVideoTitle}
                onChange={(e) => setNewVideoTitle(e.target.value)}
                className="input-professional input-small"
                maxLength={100}
              />
            </div>
            
            <div className="form-actions">
              <button
                type="submit"
                disabled={!newVideoUrl.trim()}
                className="btn-professional btn-success btn-small w-full"
              >
                <span className="btn-icon">✅</span>
                <span className="btn-text">Playlist'e Ekle</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlist items */}
      <div className="playlist-items-professional">
        {playlist.length === 0 ? (
          <div className="empty-playlist">
            <div className="empty-playlist-icon">📝</div>
            <h4 className="empty-playlist-title">Playlist Boş</h4>
            <p className="empty-playlist-subtitle">
              Video ekleyerek izleme listesi oluşturun
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="btn-professional btn-primary btn-small"
            >
              <span className="btn-icon">➕</span>
              <span className="btn-text">İlk Videoyu Ekle</span>
            </button>
          </div>
        ) : (
          <div className="playlist-list">
            {playlist.map((item, index) => (
              <div 
                key={item.id} 
                className={`playlist-item-professional ${isCurrentVideo(item) ? 'active current' : ''}`}
              >
                <div className="playlist-item-header">
                  <div className="item-index">
                    {isCurrentVideo(item) ? (
                      <div className="playing-indicator-small">
                        <div className="pulse-dot-small"></div>
                      </div>
                    ) : (
                      <span className="index-number">{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="item-info">
                    <div className="item-title-container">
                      <span className="site-icon">{getSiteIcon(item.url)}</span>
                      <h4 className="item-title">{item.title}</h4>
                    </div>
                    <p className="item-meta">
                      <span className="added-by">{item.addedBy} tarafından eklendi</span>
                    </p>
                  </div>
                </div>

                <div className="playlist-item-actions">
                  <button
                    onClick={() => onVideoSelect(item.url, item.title)}
                    className="item-action-btn play"
                    title="Bu videoyu oynat"
                  >
                    <span className="action-icon">▶️</span>
                  </button>
                  
                  {(isHost || item.addedBy === currentUsername) && (
                    <button
                      onClick={() => onRemoveFromPlaylist(item.id)}
                      className="item-action-btn remove"
                      title="Playlist'ten kaldır"
                    >
                      <span className="action-icon">🗑️</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => window.open(item.url, '_blank')}
                    className="item-action-btn external"
                    title="Yeni sekmede aç"
                  >
                    <span className="action-icon">🔗</span>
                  </button>
                </div>

                {isCurrentVideo(item) && (
                  <div className="current-video-indicator">
                    <div className="indicator-line"></div>
                    <span className="indicator-text">Şu an oynatılıyor</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Playlist stats */}
      {playlist.length > 0 && (
        <div className="playlist-stats-professional">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-icon">📊</span>
              <div className="stat-info">
                <span className="stat-value">{playlist.length}</span>
                <span className="stat-label">Video</span>
              </div>
            </div>
            
            <div className="stat-item">
              <span className="stat-icon">⏱️</span>
              <div className="stat-info">
                <span className="stat-value">~{Math.round(playlist.length * 45)}</span>
                <span className="stat-label">Dakika</span>
              </div>
            </div>
            
            <div className="stat-item">
              <span className="stat-icon">👥</span>
              <div className="stat-info">
                <span className="stat-value">{new Set(playlist.map(p => p.addedBy)).size}</span>
                <span className="stat-label">Kişi</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Playlist;