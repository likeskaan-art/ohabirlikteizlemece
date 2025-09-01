const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Client URL configuration
const getClientUrls = () => {
  if (isProduction) {
    const railwayUrl = `https://${process.env.RAILWAY_STATIC_URL || 'your-app'}.railway.app`;
    return [
      railwayUrl,
      process.env.CLIENT_URL || railwayUrl,
      'https://your-custom-domain.com'
    ];
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://127.0.0.1:3000'
  ];
};

const allowedOrigins = [
  ...getClientUrls(),
  'https://ok.ru',
  'https://www.ok.ru',
  'https://vk.com',
  'https://www.vk.com'
];

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS rejected origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-XSS-Protection', '1; mode=block');
  if (isProduction) {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Socket.io configuration
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true
});

// Production'da static files serve et
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'client/build')));
}

// Data storage
const rooms = new Map();
const connectedUsers = new Map();

// Utility functions
const sanitizeMessage = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().substring(0, 500).replace(/<[^>]*>/g, '');
};

const cleanupEmptyRooms = () => {
  const now = Date.now();
  const ROOM_TIMEOUT = 5 * 60 * 1000;
  let cleanedCount = 0;
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.length === 0 && (now - room.lastActivity) > ROOM_TIMEOUT) {
      rooms.delete(roomId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Boş oda temizlendi: ${cleanedCount} adet`);
  }
};

// API Routes
app.get('/api/create-room', (req, res) => {
  try {
    const roomId = uuidv4().substring(0, 8).toUpperCase();
    
    const roomData = {
      id: roomId,
      created: Date.now(),
      lastActivity: Date.now(),
      users: [],
      playlist: [],
      currentVideo: null,
      videoState: {
        currentTime: 0,
        isPlaying: false,
        lastUpdate: Date.now()
      },
      messages: [],
      settings: {
        maxUsers: 50,
        allowGuests: true
      }
    };
    
    rooms.set(roomId, roomData);
    
    console.log(`Yeni oda oluşturuldu: ${roomId}`);
    res.json({ 
      roomId,
      success: true,
      message: 'Oda başarıyla oluşturuldu'
    });
  } catch (error) {
    console.error('Oda oluşturma hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Oda oluşturulamadı' 
    });
  }
});

app.get('/api/room/:roomId', (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase();
    const room = rooms.get(roomId);
    
    if (room) {
      res.json({ 
        exists: true,
        room: {
          id: room.id,
          userCount: room.users.length,
          currentVideo: room.currentVideo,
          created: room.created,
          lastActivity: room.lastActivity
        }
      });
    } else {
      res.json({ 
        exists: false,
        message: 'Oda bulunamadı'
      });
    }
  } catch (error) {
    console.error('Oda bilgisi alma hatası:', error);
    res.status(500).json({ 
      exists: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    rooms: rooms.size,
    connectedUsers: connectedUsers.size,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı:', socket.id);
  
  connectedUsers.set(socket.id, {
    id: socket.id,
    connectedAt: Date.now(),
    lastActivity: Date.now()
  });

  socket.on('join-room', (data) => {
    try {
      const { roomId, username } = data;
      
      if (!roomId || !username) {
        socket.emit('error', 'Oda ID ve kullanıcı adı gerekli');
        return;
      }

      const upperRoomId = roomId.toUpperCase();
      let room = rooms.get(upperRoomId);
      
      if (!room) {
        room = {
          id: upperRoomId,
          created: Date.now(),
          lastActivity: Date.now(),
          users: [],
          playlist: [],
          currentVideo: null,
          videoState: {
            currentTime: 0,
            isPlaying: false,
            lastUpdate: Date.now()
          },
          messages: [],
          settings: {
            maxUsers: 50,
            allowGuests: true
          }
        };
        rooms.set(upperRoomId, room);
        console.log(`Oda oluşturuldu: ${upperRoomId}`);
      }

      if (room.users.length >= room.settings.maxUsers) {
        socket.emit('error', 'Oda dolu');
        return;
      }

      const existingUser = room.users.find(u => u.username === username);
      if (existingUser) {
        socket.emit('error', 'Bu kullanıcı adı zaten alınmış');
        return;
      }

      socket.join(upperRoomId);
      socket.roomId = upperRoomId;
      socket.username = username;

      const user = {
        id: socket.id,
        username: username,
        isHost: room.users.length === 0,
        joinedAt: Date.now(),
        isReady: false
      };
      
      room.users.push(user);
      room.lastActivity = Date.now();

      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        Object.assign(userInfo, {
          username,
          roomId: upperRoomId,
          isHost: user.isHost
        });
      }

      console.log(`${username} odaya katıldı: ${upperRoomId} (${room.users.length} kişi)`);

      socket.to(upperRoomId).emit('user-joined', user);
      
      socket.emit('room-state', {
        users: room.users,
        playlist: room.playlist,
        currentVideo: room.currentVideo,
        videoState: room.videoState,
        messages: room.messages.slice(-100)
      });

      const welcomeMsg = {
        id: uuidv4(),
        username: 'Sistem',
        text: `${username} odaya katıldı`,
        timestamp: Date.now(),
        type: 'system'
      };
      
      room.messages.push(welcomeMsg);
      io.to(upperRoomId).emit('new-message', welcomeMsg);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', 'Odaya katılırken hata oluştu');
    }
  });

  socket.on('video-control', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { action, currentTime, timestamp } = data;
      
      room.videoState = {
        currentTime: currentTime || room.videoState.currentTime,
        isPlaying: action === 'play',
        lastUpdate: timestamp || Date.now()
      };
      room.lastActivity = Date.now();

      socket.to(socket.roomId).emit('video-sync', {
        action,
        currentTime: room.videoState.currentTime,
        timestamp: room.videoState.lastUpdate,
        by: socket.username
      });

    } catch (error) {
      console.error('Video control error:', error);
    }
  });

  socket.on('change-video', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { url, title } = data;
      
      if (!url || !url.trim()) {
        socket.emit('error', 'Geçerli bir video URL\'si giriniz');
        return;
      }

      const videoData = {
        url: url.trim(),
        title: title || 'Video',
        by: socket.username,
        timestamp: Date.now()
      };

      room.currentVideo = videoData;
      room.videoState = {
        currentTime: 0,
        isPlaying: false,
        lastUpdate: Date.now()
      };
      room.lastActivity = Date.now();

      io.to(socket.roomId).emit('video-changed', videoData);

    } catch (error) {
      console.error('Change video error:', error);
    }
  });

  socket.on('add-to-playlist', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { url, title } = data;
      
      if (!url || !url.trim()) return;

      const playlistItem = {
        id: uuidv4(),
        url: url.trim(),
        title: title || 'Untitled Video',
        addedBy: socket.username,
        addedAt: Date.now()
      };
      
      room.playlist.push(playlistItem);
      room.lastActivity = Date.now();
      
      io.to(socket.roomId).emit('playlist-updated', room.playlist);

    } catch (error) {
      console.error('Add to playlist error:', error);
    }
  });

  socket.on('remove-from-playlist', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { itemId } = data;
      const itemIndex = room.playlist.findIndex(item => item.id === itemId);
      
      if (itemIndex !== -1) {
        room.playlist.splice(itemIndex, 1);
        room.lastActivity = Date.now();
        io.to(socket.roomId).emit('playlist-updated', room.playlist);
      }

    } catch (error) {
      console.error('Remove from playlist error:', error);
    }
  });

  socket.on('send-message', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { text } = data;
      
      if (!text || !text.trim() || text.trim().length > 500) {
        return;
      }

      const message = {
        id: uuidv4(),
        username: socket.username,
        text: sanitizeMessage(text),
        timestamp: Date.now(),
        type: 'message'
      };

      room.messages.push(message);
      room.lastActivity = Date.now();
      
      if (room.messages.length > 1000) {
        room.messages = room.messages.slice(-1000);
      }

      io.to(socket.roomId).emit('new-message', message);

    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('send-reaction', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { emoji } = data;
      if (!emoji) return;

      const reaction = {
        id: uuidv4(),
        username: socket.username,
        emoji: emoji,
        timestamp: Date.now(),
        type: 'reaction'
      };

      room.lastActivity = Date.now();
      io.to(socket.roomId).emit('new-reaction', reaction);

    } catch (error) {
      console.error('Send reaction error:', error);
    }
  });

  socket.on('webrtc-offer', (data) => {
    try {
      const { target, offer } = data;
      if (!target || !offer) {
        console.error('Eksik WebRTC offer verisi');
        return;
      }

      console.log(`WebRTC offer: ${socket.id} -> ${target}`);
      socket.to(target).emit('webrtc-offer', {
        offer: offer,
        from: socket.id,
        fromUsername: socket.username
      });

      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        userInfo.lastActivity = Date.now();
      }

    } catch (error) {
      console.error('WebRTC offer error:', error);
      socket.emit('webrtc-error', { message: 'Offer gönderilemedi' });
    }
  });

  socket.on('webrtc-answer', (data) => {
    try {
      const { target, answer } = data;
      if (!target || !answer) {
        console.error('Eksik WebRTC answer verisi');
        return;
      }

      console.log(`WebRTC answer: ${socket.id} -> ${target}`);
      socket.to(target).emit('webrtc-answer', {
        answer: answer,
        from: socket.id,
        fromUsername: socket.username
      });

      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        userInfo.lastActivity = Date.now();
      }

    } catch (error) {
      console.error('WebRTC answer error:', error);
      socket.emit('webrtc-error', { message: 'Answer gönderilemedi' });
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    try {
      const { target, candidate } = data;
      if (!target || !candidate) {
        console.error('Eksik ICE candidate verisi');
        return;
      }

      socket.to(target).emit('webrtc-ice-candidate', {
        candidate: candidate,
        from: socket.id,
        fromUsername: socket.username
      });

      const userInfo = connectedUsers.get(socket.id);
      if (userInfo) {
        userInfo.lastActivity = Date.now();
      }

    } catch (error) {
      console.error('ICE candidate error:', error);
    }
  });

  socket.on('manual-sync', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { action } = data;
      room.lastActivity = Date.now();
      
      console.log(`Manuel sync: ${action} by ${socket.username} in ${socket.roomId}`);
      
      socket.to(socket.roomId).emit('manual-sync-command', {
        action,
        by: socket.username,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Manual sync error:', error);
    }
  });

  socket.on('screen-share-started', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      room.lastActivity = Date.now();
      console.log(`Ekran paylaşımı başladı: ${socket.username} in ${socket.roomId}`);
      
      socket.to(socket.roomId).emit('screen-share-status', {
        status: 'started',
        by: socket.username,
        timestamp: Date.now()
      });

      const message = {
        id: uuidv4(),
        username: 'Sistem',
        text: `${socket.username} ekran paylaşımını başlattı`,
        timestamp: Date.now(),
        type: 'system'
      };
      
      room.messages.push(message);
      io.to(socket.roomId).emit('new-message', message);

    } catch (error) {
      console.error('Screen share start error:', error);
    }
  });

  socket.on('screen-share-stopped', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      room.lastActivity = Date.now();
      console.log(`Ekran paylaşımı durdu: ${socket.username} in ${socket.roomId}`);
      
      socket.to(socket.roomId).emit('screen-share-status', {
        status: 'stopped',
        by: socket.username,
        timestamp: Date.now()
      });

      const message = {
        id: uuidv4(),
        username: 'Sistem',
        text: `${socket.username} ekran paylaşımını durdurdu`,
        timestamp: Date.now(),
        type: 'system'
      };
      
      room.messages.push(message);
      io.to(socket.roomId).emit('new-message', message);

    } catch (error) {
      console.error('Screen share stop error:', error);
    }
  });

  socket.on('user-status-update', (data) => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      const { isReady, status } = data;
      const user = room.users.find(u => u.id === socket.id);
      
      if (user) {
        if (typeof isReady === 'boolean') {
          user.isReady = isReady;
        }
        if (status) {
          user.status = status;
        }
        
        room.lastActivity = Date.now();
        
        io.to(socket.roomId).emit('user-status-updated', {
          userId: socket.id,
          username: socket.username,
          isReady: user.isReady,
          status: user.status
        });
      }

    } catch (error) {
      console.error('User status update error:', error);
    }
  });

  socket.on('get-room-stats', () => {
    try {
      const room = rooms.get(socket.roomId);
      if (!room) return;

      socket.emit('room-stats', {
        roomId: room.id,
        userCount: room.users.length,
        messageCount: room.messages.length,
        playlistCount: room.playlist.length,
        hasCurrentVideo: !!room.currentVideo,
        created: room.created,
        uptime: Date.now() - room.created,
        lastActivity: room.lastActivity
      });

    } catch (error) {
      console.error('Room stats error:', error);
    }
  });

  socket.on('ping', () => {
    socket.emit('pong');
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.lastActivity = Date.now();
    }
  });

  socket.on('typing-start', () => {
    socket.to(socket.roomId).emit('user-typing', {
      username: socket.username,
      isTyping: true
    });
  });

  socket.on('typing-stop', () => {
    socket.to(socket.roomId).emit('user-typing', {
      username: socket.username,
      isTyping: false
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`Kullanıcı ayrıldı: ${socket.id} (${socket.username || 'Anonymous'}) - ${reason}`);
    
    try {
      connectedUsers.delete(socket.id);
      
      if (socket.roomId) {
        const room = rooms.get(socket.roomId);
        if (room) {
          const userIndex = room.users.findIndex(user => user.id === socket.id);
          let removedUser = null;
          
          if (userIndex !== -1) {
            removedUser = room.users[userIndex];
            room.users.splice(userIndex, 1);
            room.lastActivity = Date.now();
            
            if (removedUser.isHost && room.users.length > 0) {
              room.users[0].isHost = true;
              
              io.to(socket.roomId).emit('new-host', {
                newHost: room.users[0]
              });
              
              const hostMessage = {
                id: uuidv4(),
                username: 'Sistem',
                text: `${room.users[0].username} yeni host oldu`,
                timestamp: Date.now(),
                type: 'system'
              };
              
              room.messages.push(hostMessage);
              io.to(socket.roomId).emit('new-message', hostMessage);
              
              console.log(`Yeni host belirlendi: ${room.users[0].username} in ${socket.roomId}`);
            }
          }
          
          if (removedUser) {
            socket.to(socket.roomId).emit('user-left', {
              id: socket.id,
              username: removedUser.username
            });

            const leaveMessage = {
              id: uuidv4(),
              username: 'Sistem',
              text: `${removedUser.username} odadan ayrıldı`,
              timestamp: Date.now(),
              type: 'system'
            };
            
            room.messages.push(leaveMessage);
            io.to(socket.roomId).emit('new-message', leaveMessage);
          }

          if (room.users.length === 0) {
            console.log(`Oda boş kaldı, temizlik zamanlanıyor: ${socket.roomId}`);
            setTimeout(() => {
              const currentRoom = rooms.get(socket.roomId);
              if (currentRoom && currentRoom.users.length === 0) {
                rooms.delete(socket.roomId);
                console.log(`Boş oda silindi: ${socket.roomId}`);
              }
            }, 300000);
          }
        }
      }
    } catch (error) {
      console.error('Disconnect handling error:', error);
    }
  });

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error);
    socket.emit('error', 'Bağlantı hatası oluştu');
  });
});

// Periodic maintenance
setInterval(() => {
  try {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 30 * 60 * 1000;
    
    connectedUsers.forEach((userInfo, socketId) => {
      if (now - userInfo.lastActivity > INACTIVE_TIMEOUT) {
        connectedUsers.delete(socketId);
        console.log(`Inactive user cleaned up: ${socketId}`);
      }
    });
    
    cleanupEmptyRooms();
    
    const memUsage = process.memoryUsage();
    console.log(`Stats - Rooms: ${rooms.size}, Users: ${connectedUsers.size}, Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    if (memUsage.heapUsed > 400 * 1024 * 1024) {
      console.log('High memory usage, attempting cleanup...');
      if (global.gc) {
        global.gc();
        console.log(`GC completed, new usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      }
    }
    
  } catch (error) {
    console.error('Maintenance error:', error);
  }
}, 5 * 60 * 1000);

// Production'da React app serve et
if (isProduction) {
  app.get('*', (req, res) => {
    try {
      res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    } catch (error) {
      console.error('Static file serve error:', error);
      res.status(500).send('Static files could not be served');
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express middleware error:', err);
  res.status(500).json({ 
    error: 'Sunucu hatası',
    message: isProduction ? 'Bir hata oluştu' : err.message,
    timestamp: Date.now()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint bulunamadı',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /api/create-room',
      'GET /api/room/:roomId', 
      'GET /api/status',
      'WebSocket /socket.io/'
    ]
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} sinyali alındı, sunucu güvenli şekilde kapatılıyor...`);
  
  io.emit('server-shutdown', { 
    message: 'Sunucu bakıma alınıyor, lütfen birkaç dakika sonra tekrar deneyin...',
    timestamp: Date.now()
  });
  
  console.log('Kullanıcılara kapanma bildirimi gönderildi');
  
  setTimeout(() => {
    console.log('Socket bağlantıları kapatılıyor...');
    io.close(() => {
      console.log('Socket.io kapatıldı');
    });
    
    server.close(() => {
      console.log('HTTP server kapatıldı');
      console.log('Güle güle!');
      process.exit(0);
    });
  }, 3000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  const memoryUsageMB = Math.round(usage.heapUsed / 1024 / 1024);
  
  if (memoryUsageMB > 450) {
    console.log(`Yüksek memory kullanımı: ${memoryUsageMB}MB`);
  }
}, 2 * 60 * 1000);

// Server startup
server.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 BİRLİKTE İZLE SERVER BAŞLATILDI');
  console.log('='.repeat(50));
  console.log(`📡 Server URL: http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏠 Host: ${HOST}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`⏰ Started: ${new Date().toLocaleString('tr-TR')}`);
  console.log('='.repeat(50));
  
  if (isProduction) {
    console.log('🔗 CORS Allowed Origins:');
    allowedOrigins.forEach((origin, index) => {
      console.log(`   ${index + 1}. ${origin}`);
    });
    console.log('🔒 Production security headers enabled');
  } else {
    console.log('🔧 Development mode active');
    console.log('📱 Frontend: http://localhost:3000');
    console.log('🔓 CORS policy relaxed for development');
  }
  
  console.log('='.repeat(50));
  console.log('✅ Server ready to accept connections!');
  console.log('🎯 Socket.io ready for WebRTC signaling');
  console.log('='.repeat(50) + '\n');
});