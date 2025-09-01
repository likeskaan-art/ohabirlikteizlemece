// Client configuration for production deployment

const config = {
  // API URL configuration
  API_URL: process.env.NODE_ENV === 'production' 
    ? window.location.origin  // Railway otomatik olarak doğru URL'i verir
    : 'http://localhost:5000',
  
  // Socket.io URL configuration  
  SOCKET_URL: process.env.NODE_ENV === 'production'
    ? window.location.origin
    : 'http://localhost:5000',

  // WebRTC STUN servers
  ICE_SERVERS: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  },

  // App settings
  MAX_MESSAGE_LENGTH: 500,
  MAX_ROOM_USERS: 50,
  HEARTBEAT_INTERVAL: 30000, // 30 saniye
  
  // Video settings
  SUPPORTED_VIDEO_SITES: [
    'youtube.com',
    'youtu.be', 
    'vimeo.com',
    'dizibox.com',
    'yabancidizi.org',
    'hdfilmcehennemi.com',
    'ok.ru',
    'vk.com',
    'dizipal.com',
    'jetfilmizle.com'
  ],

  // Debug mode
  DEBUG: process.env.NODE_ENV !== 'production'
};

// Helper functions
export const log = (...args) => {
  if (config.DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

export const isProduction = () => process.env.NODE_ENV === 'production';

export const getApiUrl = (endpoint) => {
  return `${config.API_URL}/api${endpoint}`;
};

export const getSocketUrl = () => {
  return config.SOCKET_URL;
};

export default config;