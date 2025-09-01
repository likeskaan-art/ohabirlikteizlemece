import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import VideoPlayer from './components/VideoPlayer';
import Chat from './components/Chat';
import Playlist from './components/Playlist';
import VideoChat from './components/VideoChat';
import ScreenSharePlayer from './components/ScreenSharePlayer';
import './App.css';
import config from './config';

function App() {
  // State management
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [messages, setMessages] = useState([]);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [showMode, setShowMode] = useState('iframe'); // 'iframe', 'screen-share'

  // WebRTC states
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const localVideoRef = useRef(null);
  const peerConnections = useRef(new Map());

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Video type detection
  const getVideoType = (url) => {
    if (!url) return 'none';
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'youtube';
    } else if (lowerUrl.includes('vimeo.com')) {
      return 'vimeo';
    } else if (lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg')) {
      return 'direct';
    } else {
      return 'iframe';
    }
  };

  // Embed URL generator with OK.ru support
  const getEmbedUrl = (url) => {
    if (!url) return '';
    
    const videoType = getVideoType(url);
    
    if (videoType === 'youtube') {
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      return videoId ? `https://www.youtube.com/embed/${videoId[1]}?enablejsapi=1&origin=${window.location.origin}` : url;
    } else if (videoType === 'vimeo') {
      const videoId = url.match(/vimeo\.com\/(\d+)/);
      return videoId ? `https://player.vimeo.com/video/${videoId[1]}?title=0&byline=0&portrait=0` : url;
    } else if (url.toLowerCase().includes('ok.ru')) {
      // OK.ru için özel işleme
      const videoId = url.match(/ok\.ru\/video\/(\d+)/);
      if (videoId) {
        return `https://ok.ru/videoembed/${videoId[1]}`;
      }
      // Fallback olarak orijinal URL'i döndür
      return url;
    }
    
    return url;
  };

  // Check if URL needs special handling
  const needsSpecialHandling = (url) => {
    if (!url) return false;
    return url.toLowerCase().includes('ok.ru') || 
           url.toLowerCase().includes('vk.com') ||
           url.toLowerCase().includes('dailymotion.com');
  };

  // WebRTC Functions
  const createPeerConnection = (targetId) => {
    const peerConnection = new RTCPeerConnection(iceServers);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          target: targetId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream alındı:', targetId);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(targetId, event.streams[0]);
        return newMap;
      });
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Bağlantı durumu:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(targetId);
          return newMap;
        });
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    peerConnections.current.set(targetId, peerConnection);
    return peerConnection;
  };

  const toggleMicrophone = async () => {
    try {
      if (!localStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: isCameraOn 
        });
        setLocalStream(stream);
        setIsMicOn(true);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Mevcut peer bağlantılarına track ekle
        peerConnections.current.forEach(pc => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });
        
        return;
      }
      
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      } else {
        // Audio track yoksa yeni stream oluştur
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = newStream.getAudioTracks()[0];
        localStream.addTrack(audioTrack);
        setIsMicOn(true);
      }
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error);
      showNotification('Mikrofon izni gerekli', 'error');
    }
  };

  const toggleCamera = async () => {
    try {
      if (!localStream || !localStream.getVideoTracks().length) {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: isMicOn, 
          video: true 
        });
        
        if (localStream) {
          // Mevcut audio track'i koru, video track'i ekle
          const audioTrack = localStream.getAudioTracks()[0];
          const videoTrack = stream.getVideoTracks()[0];
          
          // Eski stream'i durdur
          localStream.getTracks().forEach(track => track.stop());
          
          // Yeni stream oluştur
          const newStream = new MediaStream();
          if (audioTrack) newStream.addTrack(audioTrack);
          newStream.addTrack(videoTrack);
          
          setLocalStream(newStream);
        } else {
          setLocalStream(stream);
        }
        
        setIsCameraOn(true);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Peer bağlantılarını güncelle
        peerConnections.current.forEach(pc => {
          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });
        });
        
        return;
      }
      
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
      }
    } catch (error) {
      console.error('Kamera erişim hatası:', error);
      showNotification('Kamera izni gerekli', 'error');
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            mediaSource: 'screen',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        
        // Önceki stream'i durdur
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        
        setLocalStream(stream);
        setIsScreenSharing(true);
        setIsCameraOn(false);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Peer bağlantılarını güncelle
        peerConnections.current.forEach(pc => {
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
        });
        
        // Ekran paylaşımı bittiğinde otomatik durdur
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setLocalStream(null);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
        };
        
        showNotification('Ekran paylaşımı başlatıldı', 'success');
        
      } else {
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
          setLocalStream(null);
        }
        setIsScreenSharing(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        showNotification('Ekran paylaşımı durduruldu', 'success');
      }
    } catch (error) {
      console.error('Ekran paylaşım hatası:', error);
      showNotification('Ekran paylaşımı izni gerekli', 'error');
    }
  };

  // Notification system
  const [notifications, setNotifications] = useState([]);

const showNotification = (message, type = 'info') => {
  const id = uuidv4();
  const notification = { id, message, type };
  
  setNotifications(prev => [...prev, notification]);
  
  setTimeout(() => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, 4000);
};

  // Socket connection
  useEffect(() => {
    if (isConnected && username && roomId) {
      const newSocket = io(config.API_URL, {
        transports: ['websocket', 'polling']
      });
      
      newSocket.on('connect', () => {
        console.log('Socket bağlandı');
        newSocket.emit('join-room', { roomId, username });
      });

      newSocket.on('room-state', (state) => {
        setConnectedUsers(state.users);
        setPlaylist(state.playlist);
        setCurrentVideo(state.currentVideo);
        setMessages(state.messages);
        if (state.videoState) {
          setIsPlaying(state.videoState.isPlaying);
          setCurrentTime(state.videoState.currentTime);
        }
      });

      newSocket.on('user-joined', (user) => {
        setConnectedUsers(prev => [...prev, user]);
        setMessages(prev => [...prev, {
          id: uuidv4(),
          username: 'Sistem',
          text: `${user.username} odaya katıldı`,
          timestamp: Date.now(),
          type: 'system'
        }]);
        
        // WebRTC offer gönder
        if (localStream) {
          setTimeout(() => createOffer(user.id), 1000);
        }
      });

      newSocket.on('user-left', (data) => {
        setConnectedUsers(prev => prev.filter(user => user.id !== data.id));
        setMessages(prev => [...prev, {
          id: uuidv4(),
          username: 'Sistem',
          text: `${data.username} odadan ayrıldı`,
          timestamp: Date.now(),
          type: 'system'
        }]);
        
        // WebRTC connection temizle
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.id);
          return newMap;
        });
        
        if (peerConnections.current.has(data.id)) {
          peerConnections.current.get(data.id).close();
          peerConnections.current.delete(data.id);
        }
      });

      newSocket.on('video-sync', (data) => {
        const { action, currentTime: syncTime, timestamp } = data;
        
        if (action === 'play') {
          const delay = Date.now() - timestamp;
          const adjustedTime = syncTime + (delay / 1000);
          
          setIsPlaying(true);
          setCurrentTime(adjustedTime);
          
          if (videoRef.current) {
            videoRef.current.currentTime = adjustedTime;
            videoRef.current.play().catch(console.error);
          }
        } else if (action === 'pause') {
          setIsPlaying(false);
          setCurrentTime(syncTime);
          
          if (videoRef.current) {
            videoRef.current.currentTime = syncTime;
            videoRef.current.pause();
          }
        } else if (action === 'seek') {
          setCurrentTime(syncTime);
          
          if (videoRef.current) {
            videoRef.current.currentTime = syncTime;
          }
        }
      });

      newSocket.on('video-changed', (data) => {
        setCurrentVideo(data);
        setCurrentTime(0);
        setIsPlaying(false);
        setMessages(prev => [...prev, {
          id: uuidv4(),
          username: 'Sistem',
          text: `${data.by} videoyu değiştirdi: ${data.title}`,
          timestamp: Date.now(),
          type: 'system'
        }]);
      });

      newSocket.on('new-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('new-reaction', (reaction) => {
        setMessages(prev => [...prev, {
          id: reaction.id,
          username: reaction.username,
          text: reaction.emoji,
          timestamp: reaction.timestamp,
          type: 'reaction'
        }]);
      });

      newSocket.on('playlist-updated', (newPlaylist) => {
        setPlaylist(newPlaylist);
      });

      // WebRTC events
      newSocket.on('webrtc-offer', async (data) => {
        const { offer, from } = data;
        const peerConnection = createPeerConnection(from);
        
        try {
          await peerConnection.setRemoteDescription(offer);
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          newSocket.emit('webrtc-answer', {
            target: from,
            answer: answer
          });
        } catch (error) {
          console.error('Offer işleme hatası:', error);
        }
      });

      newSocket.on('webrtc-answer', async (data) => {
        const { answer, from } = data;
        const peerConnection = peerConnections.current.get(from);
        
        if (peerConnection) {
          try {
            await peerConnection.setRemoteDescription(answer);
          } catch (error) {
            console.error('Answer işleme hatası:', error);
          }
        }
      });

      newSocket.on('webrtc-ice-candidate', async (data) => {
        const { candidate, from } = data;
        const peerConnection = peerConnections.current.get(from);
        
        if (peerConnection) {
          try {
            await peerConnection.addIceCandidate(candidate);
          } catch (error) {
            console.error('ICE candidate hatası:', error);
          }
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket bağlantı hatası:', error);
        showNotification('Sunucu bağlantısı kurulamadı', 'error');
      });

      setSocket(newSocket);

      return () => {
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }
        peerConnections.current.forEach(pc => pc.close());
        newSocket.disconnect();
      };
    }
  }, [isConnected, username, roomId]);

  // Local stream güncellemelerini peer bağlantılarına yansıt
  useEffect(() => {
    if (localStream) {
      peerConnections.current.forEach(pc => {
        // Eski track'leri kaldır
        pc.getSenders().forEach(sender => {
          if (sender.track) {
            pc.removeTrack(sender);
          }
        });
        
        // Yeni track'leri ekle
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      });
    }
  }, [localStream]);

  const createOffer = async (targetId) => {
    const peerConnection = createPeerConnection(targetId);
    
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('webrtc-offer', {
        target: targetId,
        offer: offer
      });
    } catch (error) {
      console.error('Offer oluşturma hatası:', error);
    }
  };

  // Room management
  const createRoom = async () => {
    if (!username.trim()) return;
    
    try {
      const response = await fetch(`${config.API_URL}/api/create-room`);
      const data = await response.json();
      setRoomId(data.roomId);
      setIsHost(true);
      setIsConnected(true);
      showNotification('Oda başarıyla oluşturuldu', 'success');
    } catch (error) {
      console.error('Oda oluşturma hatası:', error);
      // Fallback
      const newRoomId = uuidv4().substring(0, 8);
      setRoomId(newRoomId);
      setIsHost(true);
      setIsConnected(true);
      showNotification('Oda oluşturuldu (çevrimdışı mod)', 'success');
    }
  };

  const joinRoom = async (inputRoomId) => {
    if (!username.trim() || !inputRoomId.trim()) return;
    
    try {
      const response = await fetch(`${config.API_URL}/api/room/${inputRoomId}`);
      const data = await response.json();
      
      if (data.exists) {
        setRoomId(inputRoomId);
        setIsHost(false);
        setIsConnected(true);
        showNotification('Odaya başarıyla katıldınız', 'success');
      } else {
        showNotification('Oda bulunamadı!', 'error');
      }
    } catch (error) {
      console.error('Odaya katılma hatası:', error);
      // Fallback - direkt katıl
      setRoomId(inputRoomId);
      setIsHost(false);
      setIsConnected(true);
      showNotification('Odaya katıldınız (çevrimdışı mod)', 'success');
    }
  };

  
  // Video controls
  const handlePlay = () => {
    if (socket) {
      const now = Date.now();
      const currentVideoTime = videoRef.current ? videoRef.current.currentTime : currentTime;
      
      setIsPlaying(true);
      socket.emit('video-control', {
        action: 'play',
        currentTime: currentVideoTime,
        timestamp: now
      });
    }
  };

  const handlePause = () => {
    if (socket) {
      const now = Date.now();
      const currentVideoTime = videoRef.current ? videoRef.current.currentTime : currentTime;
      
      setIsPlaying(false);
      socket.emit('video-control', {
        action: 'pause',
        currentTime: currentVideoTime,
        timestamp: now
      });
    }
  };

  const handleSeek = (time) => {
    if (socket) {
      setCurrentTime(time);
      socket.emit('video-control', {
        action: 'seek',
        currentTime: time,
        timestamp: Date.now()
      });
    }
  };

  const handleVideoChange = (url, title) => {
    if (socket) {
      const videoData = {
        url,
        title: title || 'Video',
        by: username,
        timestamp: Date.now()
      };
      setCurrentVideo(videoData);
      socket.emit('change-video', videoData);
      showNotification(`Video değiştirildi: ${title}`, 'success');
    }
  };

  // Chat functions
  const sendMessage = (message) => {
    if (socket && message.trim()) {
      const messageData = {
        id: uuidv4(),
        username,
        text: message.trim(),
        timestamp: Date.now(),
        type: 'message'
      };
      socket.emit('send-message', messageData);
    }
  };

  const sendEmoji = (emoji) => {
    if (socket) {
      socket.emit('send-reaction', { emoji });
    }
  };

  // Playlist functions
  const addToPlaylist = (url, title) => {
    if (socket) {
      socket.emit('add-to-playlist', { url, title: title || 'Untitled Video' });
      showNotification('Playlist\'e eklendi', 'success');
    }
  };

  const removeFromPlaylist = (itemId) => {
    if (socket) {
      socket.emit('remove-from-playlist', { itemId });
    }
  };

  const selectFromPlaylist = (url, title) => {
    handleVideoChange(url, title);
  };

  // Room URL generator
  const getRoomUrl = () => {
    return `${window.location.origin}?room=${roomId}`;
  };

  const copyRoomUrl = () => {
    navigator.clipboard.writeText(getRoomUrl()).then(() => {
      showNotification('Oda linki kopyalandı!', 'success');
    }).catch(() => {
      showNotification('Link kopyalanamadı', 'error');
    });
  };

  // URL'den room ID alma
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  // Ana render
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card card-primary" style={{maxWidth: '500px', width: '100%'}}>
          <div className="text-center space-y-6">
            {/* Logo/Header */}
            <div>
              <h1 className="text-4xl font-bold mb-2">🎬 Birlikte İzle</h1>
              <p className="text-gray-300">Sevdiklerinizle birlikte film ve dizi izleyin</p>
            </div>

            {/* Username input */}
            <div className="form-group">
              <label className="form-label">👤 Kullanıcı Adınız</label>
              <input
                type="text"
                placeholder="Adınızı girin..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
              />
            </div>

            {/* Room actions */}
            <div className="space-y-3">
              <button
                onClick={createRoom}
                disabled={!username.trim()}
                className="btn btn-primary w-full advanced-btn"
              >
                🚀 Yeni Oda Oluştur
              </button>

              <div className="text-gray-400 text-sm">veya</div>

              <div className="form-row">
                <input
                  type="text"
                  placeholder="Oda kodu..."
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="input"
                  style={{flex: 1}}
                />
                <button
                  onClick={() => joinRoom(roomId)}
                  disabled={!username.trim() || !roomId.trim()}
                  className="btn btn-success advanced-btn"
                >
                  🔗 Katıl
                </button>
              </div>
            </div>

            {/* Features preview */}
            <div className="text-left">
              <h3 className="font-semibold text-white mb-3">✨ Özellikler:</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span>Senkronize video izleme</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span>Sesli ve görüntülü sohbet</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span>Ekran paylaşımı desteği</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span>Playlist ve emoji reaksiyonları</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span>Tüm dizi siteleri ile uyumlu</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="notification-container">
          {notifications.map(notification => (
            <div key={notification.id} className={`notification show ${notification.type}`}>
              <div className="flex items-center gap-2">
                <span className="notification-icon">
                  {notification.type === 'success' ? '✅' : 
                   notification.type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <span>{notification.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="header">
        <div className="container">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">🎬 Birlikte İzle</h1>
              <div className="user-badge">
                <span className="status-online">●</span>
                <span>{username}</span>
                {isHost && <span className="host-badge">👑 Host</span>}
              </div>
            </div>

            <div className="header-right">
              {/* Connected users display */}
              <div className="connected-users-display">
                <div className="users-count">
                  <span className="count-icon">👥</span>
                  <span className="count-number">{connectedUsers.length}</span>
                </div>
                <div className="users-avatars">
                  {connectedUsers.slice(0, 3).map(user => (
                    <div key={user.id} className="user-avatar" title={user.username}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {connectedUsers.length > 3 && (
                    <div className="user-avatar more" title={`+${connectedUsers.length - 3} more`}>
                      +{connectedUsers.length - 3}
                    </div>
                  )}
                </div>
              </div>

              {/* Room info */}
              <div className="room-info-display">
                <span className="room-label">Oda:</span>
                <div className="room-code">{roomId}</div>
                <button
                  onClick={copyRoomUrl}
                  className="copy-btn tooltip"
                  data-tooltip="Oda linkini kopyala"
                >
                  📋
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container">
        <div className="grid grid-2">
          {/* Sol panel - Video alanı */}
          <div className="space-y-4">
            {/* Video URL input (sadece host için) */}
            {isHost && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  🎥 Video Kontrolü
                </h3>
                
                <VideoUrlInput 
                  onVideoChange={handleVideoChange}
                  currentVideo={currentVideo}
                />

                {/* İzleme modu seçimi */}
                <div className="mode-selection">
                  <h4 className="font-medium mb-3">📺 İzleme Modu</h4>
                  <div className="mode-buttons">
                    <button
                      onClick={() => setShowMode('iframe')}
                      className={`btn-mode ${showMode === 'iframe' ? 'active' : ''}`}
                    >
                      🖼️ Direkt Görüntüleme
                    </button>
                    <button
                      onClick={() => setShowMode('screen-share')}
                      className={`btn-mode ${showMode === 'screen-share' ? 'active' : ''}`}
                    >
                      📺 Ekran Paylaşımı
                    </button>
                  </div>
                  <p className="mode-description">
                    {showMode === 'iframe' 
                      ? 'Video doğrudan burada görünür (reklamlar sorun olabilir)'
                      : 'Ekranınızı paylaşın (reklamları geçmek için ideal)'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Video player veya screen share */}
            {showMode === 'iframe' ? (
              <VideoPlayer
                videoUrl={currentVideo?.url}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                videoRef={videoRef}
                iframeRef={iframeRef}
                getVideoType={getVideoType}
                getEmbedUrl={getEmbedUrl}
                currentVideo={currentVideo}
                needsSpecialHandling={needsSpecialHandling}
                isHost={isHost}
              />
            ) : (
              <ScreenSharePlayer
                videoUrl={currentVideo?.url}
                isHost={isHost}
                socket={socket}
                roomId={roomId}
                onScreenShare={toggleScreenShare}
                isScreenSharing={isScreenSharing}
                localStream={localStream}
                remoteStreams={remoteStreams}
                currentVideo={currentVideo}
              />
            )}

            {/* WebRTC Video Chat */}
            <VideoChat 
              localStream={localStream}
              remoteStreams={remoteStreams}
              isMicOn={isMicOn}
              isCameraOn={isCameraOn}
              isScreenSharing={isScreenSharing}
              onToggleMic={toggleMicrophone}
              onToggleCamera={toggleCamera}
              onToggleScreenShare={toggleScreenShare}
              users={connectedUsers}
              currentUsername={username}
              localVideoRef={localVideoRef}
            />
          </div>

          {/* Sağ panel - Chat ve Playlist */}
          <div className="space-y-4">
            {/* Chat */}
            <div className="chat-container">
              <div className="p-4 border-b border-gray-600">
                <h3 className="font-semibold flex items-center gap-2">
                  💬 Sohbet
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">
                    {messages.length}
                  </span>
                </h3>
              </div>
              
              <Chat
                messages={messages}
                onSendMessage={sendMessage}
                onSendReaction={sendEmoji}
                currentUsername={username}
              />
            </div>

            {/* Playlist */}
            <div className="playlist-container">
              <Playlist
                playlist={playlist}
                currentVideo={currentVideo}
                onVideoSelect={selectFromPlaylist}
                onAddToPlaylist={addToPlaylist}
                onRemoveFromPlaylist={removeFromPlaylist}
                onEmojiClick={sendEmoji}
                currentUsername={username}
                isHost={isHost}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="notification-container">
        {notifications.map(notification => (
          <div key={notification.id} className={`notification show ${notification.type}`}>
            <div className="flex items-center gap-2">
              <span className="notification-icon">
                {notification.type === 'success' ? '✅' : 
                 notification.type === 'error' ? '❌' : 'ℹ️'}
              </span>
              <span>{notification.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Video URL Input Component
const VideoUrlInput = ({ onVideoChange, currentVideo }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      onVideoChange(videoUrl.trim(), videoTitle.trim());
      setVideoUrl('');
      setVideoTitle('');
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
    } else if (url.includes('dizipal')) {
      return 'Dizipal Video';
    } else if (url.includes('jetfilmizle')) {
      return 'JetFilmizle';
    }
    return '';
  };

  const handleUrlChange = (url) => {
    setVideoUrl(url);
    if (url && !videoTitle) {
      setVideoTitle(detectTitle(url));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="form-group">
        <label className="form-label">🔗 Video URL</label>
        <input
          type="url"
          placeholder="https://example.com/video..."
          value={videoUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          className="input"
        />
        <div className="text-xs text-gray-400 mt-1">
          Desteklenen siteler: YouTube, Dizibox, YabancıDizi, OK.ru, HDFilmCehennemi, Dizipal ve daha fazlası
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">📝 Video Başlığı</label>
        <input
          type="text"
          placeholder="Video başlığı (opsiyonel)"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          className="input"
        />
      </div>

      <button
        type="submit"
        disabled={!videoUrl.trim()}
        className="btn btn-primary w-full advanced-btn"
      >
        {currentVideo ? '🔄 Video Değiştir' : '▶️ Video Başlat'}
      </button>

      {currentVideo && (
        <div className="success-state">
          <span className="success-icon">▶️</span>
          <div>
            <div className="font-medium">Şu an oynatılıyor:</div>
            <div className="text-sm opacity-80">{currentVideo.title}</div>
            <div className="text-xs opacity-60">{currentVideo.by} tarafından eklendi</div>
          </div>
        </div>
      )}
    </form>
  );
};

export default App;