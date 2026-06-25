export interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
  blockedUsers: string[]; // List of uids blocked by this user
  closeFriends: string[]; // List of uids in close friends
  customList: string[]; // List of uids in custom stories list
  theme: string; // 'deep-dark' | 'amoled' | 'midnight-blue' | 'emerald' | 'crimson-velvet' | 'cyberpunk'
  stealthMode: boolean; // Hide online status
  readReceipts: boolean; // Send/receive blue double ticks
  notificationSounds: Record<string, string>; // userId -> soundId ('default' | 'chime' | 'glass' | 'pop' | 'retro' | 'synth')
  status: 'online' | 'offline';
  lastSeen?: any; // Firestore timestamp
}

export type MessageType = 'text' | 'voice' | 'image' | 'sticker' | 'call_log' | 'game_challenge' | 'game_result';

export interface GameInfo {
  gameId: string; // ID of the mini game (e.g. 'chess', 'tictactoe')
  gameName: string;
  status: 'pending' | 'active' | 'completed' | 'declined';
  turnUid: string;
  score: Record<string, number>; // uid -> score
  state: any; // Serialized game board or moves
  winnerUid?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any; // Firestore timestamp
  type: MessageType;
  mediaUrl?: string; // Audio base64 or sticker ID or image url
  duration?: number; // duration of voice note in seconds
  reactions?: Record<string, string>; // uid -> emoji (e.g. '❤️', '👍')
  gameInfo?: GameInfo;
  read: boolean;
}

export interface Story {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  mediaType: 'text' | 'image';
  mediaUrl?: string; // Image base64 if type is image
  text?: string; // Text content or overlay text
  background?: string; // Hex color or gradient for text story
  timestamp: any;
  closeFriendsOnly: boolean;
  customListOnly: boolean;
  viewers: string[]; // List of uids who viewed this story
}

export interface CallSession {
  id: string;
  callerId: string;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  timestamp: any;
}

export interface MiniGame {
  id: string;
  name: string;
  description: string;
  iconName: string; // Lucide icon identifier
  isTwoPlayer: boolean;
}

export const LIST_OF_GAMES: MiniGame[] = [
  { id: 'tictactoe', name: 'Tic-Tac-Toe', description: 'Classic 3x3 grid alignment game.', iconName: 'Grid', isTwoPlayer: true },
  { id: 'connect4', name: 'Connect Four', description: 'Drop checkers to connect four in a row.', iconName: 'Columns', isTwoPlayer: true },
  { id: 'rockpaperscissors', name: 'R-P-S', description: 'Classic Rock-Paper-Scissors shootout.', iconName: 'Hand', isTwoPlayer: true },
  { id: 'chess', name: 'Mini-Chess', description: 'Play mini chess turns with your friend.', iconName: 'Crown', isTwoPlayer: true },
  { id: 'checkers', name: 'Checkers', description: 'Classic draft jump-and-capture game.', iconName: 'Disc', isTwoPlayer: true },
  { id: 'wordle', name: 'Word Guess', description: '6 attempts to solve the secret 5-letter word.', iconName: 'Hash', isTwoPlayer: false },
  { id: 'hangman', name: 'Hangman', description: 'Guess the hidden phrase letter by letter.', iconName: 'Smile', isTwoPlayer: false },
  { id: 'snake', name: 'Retro Snake', description: 'Eat apples and grow without hitting walls.', iconName: 'TrendingUp', isTwoPlayer: false },
  { id: 'pong', name: 'Micro Pong', description: 'Bounce the ball past your opponent.', iconName: 'Tv', isTwoPlayer: true },
  { id: 'memory', name: 'Memory Match', description: 'Flip cards and find matching icon pairs.', iconName: 'Layers', isTwoPlayer: false },
  { id: 'flappy', name: 'Konnect Bird', description: 'Flap and navigate through narrow green pipes.', iconName: 'ArrowUpCircle', isTwoPlayer: false },
  { id: 'minesweeper', name: 'Minesweeper', description: 'Uncover the safe grid cells and avoid hidden bombs.', iconName: 'Zap', isTwoPlayer: false },
  { id: 'simonsays', name: 'Simon Sequence', description: 'Observe and repeat the flashing color sequence.', iconName: 'RefreshCw', isTwoPlayer: false },
  { id: 'tetris', name: 'Block Drop', description: 'Fit falling blocks together to clear lines.', iconName: 'Box', isTwoPlayer: false },
  { id: 'typing', name: 'Typing Blitz', description: 'Type the scrolling word pool before time runs out.', iconName: 'Keyboard', isTwoPlayer: false },
  { id: 'math', name: 'Math Marathon', description: 'Race against time to solve rapid math operations.', iconName: 'PlusMinus', isTwoPlayer: false },
  { id: 'colormatch', name: 'Stroop Reflex', description: 'Tap true/false if word color matches meaning.', iconName: 'Palette', isTwoPlayer: false },
  { id: 'dotsandboxes', name: 'Dots & Boxes', description: 'Connect dots to claim squares and score points.', iconName: 'Layout', isTwoPlayer: true },
  { id: 'slidepuzzle', name: '15-Puzzle', description: 'Slide sliding blocks back into perfect numerical order.', iconName: 'Grid3X3', isTwoPlayer: false },
  { id: 'trivia', name: 'Trivia Pursuit', description: 'Multiple choice trivia across various subjects.', iconName: 'HelpCircle', isTwoPlayer: false }
];

export const THEMES = [
  { id: 'high-density', name: 'High Density', bg: 'bg-[#0A0B0D]', border: 'border-neutral-800', text: 'text-[#E4E6EB]', card: 'bg-[#0E1013]', primary: 'bg-blue-600', accent: 'text-blue-500' },
  { id: 'deep-dark', name: 'Deep Onyx', bg: 'bg-[#0A0B0D]', border: 'border-neutral-800', text: 'text-[#E4E6EB]', card: 'bg-[#0E1013]', primary: 'bg-blue-600', accent: 'text-blue-500' },
  { id: 'amoled', name: 'Pure AMOLED', bg: 'bg-[#000000]', border: 'border-[#121212]', text: 'text-[#f8fafc]', card: 'bg-[#0a0a0a]', primary: 'bg-[#ffffff]', accent: 'text-white' },
  { id: 'midnight-blue', name: 'Midnight Ocean', bg: 'bg-[#0b132b]', border: 'border-[#1c2541]', text: 'text-[#e0e1dd]', card: 'bg-[#1c2541]', primary: 'bg-[#3a86c8]', accent: 'text-[#3a86c8]' },
  { id: 'emerald', name: 'Emerald Cyber', bg: 'bg-[#05110c]', border: 'border-[#0a2f1d]', text: 'text-[#e6f4ea]', card: 'bg-[#081e14]', primary: 'bg-[#10b981]', accent: 'text-[#10b981]' },
  { id: 'crimson-velvet', name: 'Crimson Night', bg: 'bg-[#140507]', border: 'border-[#300a0d]', text: 'text-[#fbeef0]', card: 'bg-[#20080a]', primary: 'bg-[#e11d48]', accent: 'text-[#f43f5e]' },
  { id: 'cyberpunk', name: 'Neon Cyber', bg: 'bg-[#0d0211]', border: 'border-[#2a0835]', text: 'text-[#fae8ff]', card: 'bg-[#1a0522]', primary: 'bg-[#d946ef]', accent: 'text-[#f472b6]' }
];

export const NOTIFICATION_SOUNDS = [
  { id: 'default', name: 'Classic Ping' },
  { id: 'chime', name: 'Elegant Chime' },
  { id: 'glass', name: 'Crystal Glass' },
  { id: 'pop', name: 'Bubble Pop' },
  { id: 'retro', name: '8-Bit Beep' },
  { id: 'synth', name: 'Synth Drop' }
];

export const STICKERS = [
  { id: 'k_hello', name: 'Konnect Hello', emoji: '👋', anim: 'animate-bounce' },
  { id: 'k_love', name: 'Heart Pulse', emoji: '❤️', anim: 'animate-pulse' },
  { id: 'k_fire', name: 'Super Hot', emoji: '🔥', anim: 'animate-pulse' },
  { id: 'k_party', name: 'Celebration', emoji: '🎉', anim: 'animate-wiggle' },
  { id: 'k_laugh', name: 'LOL Spin', emoji: '😂', anim: 'hover:rotate-12 duration-200' },
  { id: 'k_mindblown', name: 'Mind Blown', emoji: '🤯', anim: 'scale-110' },
  { id: 'k_cool', name: 'Cool Swag', emoji: '😎', anim: 'translate-y-1' },
  { id: 'k_dance', name: 'Groovy Disco', emoji: '🕺', anim: 'animate-bounce' },
  { id: 'k_game', name: 'Game Time', emoji: '🎮', anim: 'animate-pulse' },
  { id: 'k_call', name: 'Call Me', emoji: '🤙', anim: 'animate-bounce' }
];
