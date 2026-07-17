import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, Video, MoreVertical, Send, Smile, Play, Pause, RefreshCw, 
  Smile as EmojiIcon, ShieldAlert, BadgeHelp, EyeOff, Film, Ban,
  Volume2, Mic, Check, CheckCheck, Gamepad2, Sparkles, Image, Zap, Flame, User, X,
  Plus, ArrowLeft, Search, PhoneOff, Settings as SettingsIcon, Crown, UserPlus, UserMinus, Maximize2, Minimize2, Download,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, 
  doc, setDoc, arrayUnion, arrayRemove, getDoc, writeBatch, getDocs, serverTimestamp,
  increment, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Message, LIST_OF_GAMES } from '../types';
import { sendPushToUser } from '../lib/webPush';
import { EMOJI_LIST } from '../emojis';
import { SecureAvatar } from './SecureAvatar';
import { VerifiedBadge } from './VerifiedBadge';

// @ts-ignore
import orionAiLogo from '../assets/images/orion_ai_logo_1782673841547.jpg';
// @ts-ignore
import oxaLlcLogo from '../assets/images/oxa_llc_logo_1782673859506.jpg';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export const GROUP_PICTURE_PRESETS = [
  { name: 'Squad', url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=150&h=150&fit=crop' },
  { name: 'Gamers', url: 'https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?w=150&h=150&fit=crop' },
  { name: 'Office', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&h=150&fit=crop' },
  { name: 'Nature', url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=150&h=150&fit=crop' },
  { name: 'Devs', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150&h=150&fit=crop' },
  { name: 'Beats', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop' },
  { name: 'Athletes', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&h=150&fit=crop' },
  { name: 'Scholars', url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=150&h=150&fit=crop' },
];

const getBotPhotoURL = (uid: string, url: string | undefined): string => {
  if (uid === 'orion-ai') return orionAiLogo;
  if (uid === 'oxa-llc') return oxaLlcLogo;
  return url || '';
};

const getAnimatedEmojiUrl = (emoji: string) => {
  // Convert emoji to sequence of code points
  const codePoints = Array.from(emoji)
    .map(char => char.codePointAt(0)?.toString(16))
    .filter(hex => hex && hex !== 'fe0f'); // remove variation selectors
  
  const hexStr = codePoints.join('_');
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${hexStr}/512.webp`;
};

// Component that resolves an external image to a local blob URL
// This hides "pollinations.ai" domain and sets tab title to local domain when dragged or opened in a tab.
const SecureImage = ({ src, className, ...props }: { src: string; className?: string; [key: string]: any }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!src) return;
    
    // If it's already a blob or data URL, use it directly
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      setBlobUrl(src);
      return;
    }

    // Otherwise, fetch and convert to blob url
    fetch(src)
      .then(res => res.blob())
      .then(blob => {
        if (active) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      })
      .catch(err => {
        console.warn("Failed to create blob URL for image:", err);
        if (active) {
          setBlobUrl(src); // Fallback to raw URL if CORS fails
        }
      });

    return () => {
      active = false;
    };
  }, [src]);

  return (
    <img 
      src={blobUrl || src} 
      className={className} 
      {...props} 
    />
  );
};

// Helper to escape special characters for regex search
const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Sub-helper to highlight matched search terms safely in text segments
const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  const segments = text.split(regex);
  return segments.map((seg, idx) => {
    if (seg.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={idx} className="bg-amber-400/35 text-inherit font-bold px-0.5 rounded shadow-sm border-b border-amber-500">
          {seg}
        </mark>
      );
    }
    return seg;
  });
};

// Helper to parse and render standard text with 3D animated Noto Emojis
const renderEmojisOnly = (text: string, highlightText?: string) => {
  if (!text) return '';
  const EMOJI_REGEX = /(\p{Emoji_Presentation})/gu;
  const parts = text.split(EMOJI_REGEX);
  if (parts.length === 1) {
    return highlightText ? highlightMatch(text, highlightText) : text;
  }
  return parts.map((part, i) => {
    if (part && part.match(/\p{Emoji_Presentation}/u)) {
      return (
        <span key={i} className="relative inline-flex items-center align-middle" style={{ contentVisibility: 'auto' }}>
          <span className="absolute opacity-0 pointer-events-none select-text" style={{ fontSize: '0.1px', width: '1px', height: '1px', overflow: 'hidden' }}>{part}</span>
          <img 
            src={getAnimatedEmojiUrl(part)} 
            alt={part} 
            draggable="false"
            className="w-5.5 h-5.5 object-contain inline-block align-middle transform hover:scale-115 transition-all duration-150 select-none"
            onError={(evt) => {
              (evt.target as HTMLElement).style.display = 'none';
              const parent = (evt.target as HTMLElement).parentElement;
              if (parent && !parent.querySelector(`.fallback-emoji-${i}`)) {
                const span = document.createElement('span');
                span.className = `text-xs fallback-emoji-${i} align-middle`;
                span.innerText = part;
                parent.insertBefore(span, evt.target as HTMLElement);
              }
            }}
            referrerPolicy="no-referrer"
          />
        </span>
      );
    }
    return highlightText ? <React.Fragment key={i}>{highlightMatch(part, highlightText)}</React.Fragment> : part;
  });
};

// General-purpose parser supporting blue text links and animated Noto Emojis
const renderMessageContent = (text: string, highlightText?: string) => {
  if (!text) return null;

  const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(URL_REGEX);

  if (parts.length === 1) {
    // No links found, just render emojis normally
    return (
      <p className="text-xs leading-relaxed font-sans select-text break-words whitespace-pre-wrap">
        {renderEmojisOnly(text, highlightText)}
      </p>
    );
  }

  return (
    <p className="text-xs leading-relaxed font-sans select-text break-words whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.match(URL_REGEX)) {
          const href = part.toLowerCase().startsWith('http') ? part : `https://${part}`;
          return (
            <a 
              key={i} 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 underline font-semibold break-all inline-block"
            >
              {part}
            </a>
          );
        } else {
          return <React.Fragment key={i}>{renderEmojisOnly(part, highlightText)}</React.Fragment>;
        }
      })}
    </p>
  );
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const getDaySeparator = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return 'Today';
  } else if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }
};

interface ChatWindowProps {
  chatId: string;
  myProfile: UserProfile;
  partnerProfile: UserProfile;
  onOpenGames: () => void;
  onSetGameChallenge: (gameId: string) => void;
  onCloseChat?: () => void;
  profilesMap: Record<string, UserProfile>;
  autoOpenProfile?: boolean;
}

export default function ChatWindow({ 
  chatId, myProfile, partnerProfile: rawPartnerProfile, onOpenGames, onSetGameChallenge, onCloseChat, profilesMap, autoOpenProfile 
}: ChatWindowProps) {
  const partnerProfile = rawPartnerProfile.uid === 'orion-ai' ? {
    ...rawPartnerProfile,
    displayName: 'Neurox AI',
    username: 'neurox_ai',
    bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
  } : rawPartnerProfile;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [aiMode, setAiMode] = useState<'AI' | 'WIKI'>(() => {
    return (localStorage.getItem(`konnect_ai_mode_${myProfile.uid}`) as 'AI' | 'WIKI') || 'AI';
  });
  
  // Drawer Toggles
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showPartnerProfileDrawer, setShowPartnerProfileDrawer] = useState(false);
  
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const touchTimeoutRef = useRef<Record<string, any>>({});

  const handleTouchStart = (msgId: string, e: React.TouchEvent) => {
    // Clear any existing timer for this message
    if (touchTimeoutRef.current[msgId]) {
      clearTimeout(touchTimeoutRef.current[msgId]);
    }
    touchTimeoutRef.current[msgId] = setTimeout(() => {
      setActiveReactionPickerId(msgId);
      if (navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, 450); // 450ms for long-press
  };

  const handleTouchEnd = (msgId: string) => {
    if (touchTimeoutRef.current[msgId]) {
      clearTimeout(touchTimeoutRef.current[msgId]);
      delete touchTimeoutRef.current[msgId];
    }
  };
  
  // New optimized states
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'highlight' | 'filter'>('highlight');
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  // Derive message IDs matching search query
  const matchIds = React.useMemo(() => {
    if (!searchText) return [];
    return messages
      .filter((m) => m.type === 'text' && (m.text || '').toLowerCase().includes(searchText.toLowerCase()))
      .map((m) => m.id);
  }, [messages, searchText]);

  // Reset active search index when query changes
  useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchText]);

  // Navigate back and forth between matching message occurrences
  const handlePrevSearchMatch = () => {
    if (matchIds.length === 0) return;
    setActiveSearchIndex((prev) => (prev > 0 ? prev - 1 : matchIds.length - 1));
  };

  const handleNextSearchMatch = () => {
    if (matchIds.length === 0) return;
    setActiveSearchIndex((prev) => (prev < matchIds.length - 1 ? prev + 1 : 0));
  };

  // Scroll current matching message into view when focusing on it
  const focusedMatchId = matchIds[activeSearchIndex];
  useEffect(() => {
    if (searchText && focusedMatchId && searchMode === 'highlight') {
      const timer = setTimeout(() => {
        const element = document.getElementById(`msg-${focusedMatchId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusedMatchId, searchMode, searchText]);
  
  const [showMediaGrid, setShowMediaGrid] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);
  
  // Custom chat backgrounds ("option for more stuff")
  const [chatWallpaper, setChatWallpaper] = useState<string>(() => {
    return localStorage.getItem(`wallpaper_${chatId}`) || 'default';
  });

  // Sound preset
  const [chatSoundPreset, setChatSoundPreset] = useState<string>(() => {
    return localStorage.getItem(`sound_preset_${chatId}`) || 'synth';
  });

  // Auto-replier simulated state
  const [autoReplierActive, setAutoReplierActive] = useState<boolean>(() => {
    return localStorage.getItem(`autoreplier_${chatId}`) === 'true';
  });
  
  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordInterval = useRef<any>(null);
  const recordDurationRef = useRef<number>(0);
  
  // Real audio recording references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Playing voice notes speed and active states
  const [activeVoiceNote, setActiveVoiceNote] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const audioCtxRef = useRef<any>(null);
  const audioNodeRef = useRef<any>(null);

  // Sync playback speed to real audio player
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Orion AI Chatbot Integration
  const [orionTyping, setOrionTyping] = useState(false);

  const handleOrionAIResponse = async (userPrompt: string) => {
    if (partnerProfile.uid !== 'orion-ai') return;
    setOrionTyping(true);

    const localMsgsKey = `konnect_local_messages_orion-ai_${myProfile.uid}`;
    const localChatKey = `konnect_local_chat_orion-ai_${myProfile.uid}`;

    const saveLocalMessageAndChat = (replyText: string, replyType: Message['type'], mediaUrl?: string) => {
      const replyMsg = {
        id: `msg-orion-${Date.now()}`,
        senderId: 'orion-ai',
        receiverId: myProfile.uid,
        text: replyText,
        timestamp: new Date().toISOString(),
        type: replyType,
        read: false,
        ...(mediaUrl ? { mediaUrl } : {})
      };

      const storedMsgs = localStorage.getItem(localMsgsKey);
      let list = [];
      if (storedMsgs) {
        try {
          list = JSON.parse(storedMsgs);
        } catch (e) {
          console.error(e);
        }
      }
      list.push(replyMsg);
      localStorage.setItem(localMsgsKey, JSON.stringify(list));
      
      const formatted = list.map((m: any) => ({
        ...m,
        timestamp: m.timestamp ? { toDate: () => new Date(m.timestamp) } : null
      }));
      setMessages(formatted);
      scrollToBottom();

      localStorage.setItem(localChatKey, JSON.stringify({
        id: `orion-ai-chat-${myProfile.uid}`,
        participants: [myProfile.uid, 'orion-ai'],
        lastMessage: {
          text: replyType === 'image' ? `📷 Generated image of ${replyText}` : replyText.substring(0, 60),
          timestamp: new Date().toISOString(),
          senderId: 'orion-ai'
        },
        unreadCount: {
          [myProfile.uid]: 0,
          'orion-ai': 0
        }
      }));
    };

    try {
      if (aiMode === 'WIKI') {
        // Wikipedia Mode: Search for topic on Wikipedia
        try {
          const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(userPrompt)}&format=json&origin=*`;
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) {
            throw new Error('Wikipedia search failed');
          }
          const searchData = await searchRes.json();
          const searchResults = searchData?.query?.search || [];
          
          if (searchResults.length > 0) {
            const topTitle = searchResults[0].title;
            // Fetch summary and thumbnail
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
            const summaryRes = await fetch(summaryUrl);
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              const extract = summaryData.extract || '';
              const thumbnailSource = summaryData.thumbnail?.source || null;
              
              if (thumbnailSource) {
                // Save image
                saveLocalMessageAndChat(
                  `Wikipedia Image for "${topTitle}"`, 
                  'image', 
                  thumbnailSource
                );
                
                if (extract) {
                  // Wait for visual spacing
                  await new Promise(resolve => setTimeout(resolve, 850));
                  saveLocalMessageAndChat(extract, 'text');
                }
              } else {
                saveLocalMessageAndChat(extract || `No summary available on Wikipedia for "${topTitle}".`, 'text');
              }
            } else {
              saveLocalMessageAndChat(`I found the topic "${topTitle}" on Wikipedia, but I was unable to retrieve its summary at the moment.`, 'text');
            }
          } else {
            saveLocalMessageAndChat(`I searched Wikipedia but couldn't find any articles matching "${userPrompt}". Try a different topic!`, 'text');
          }
        } catch (wikiError) {
          console.error('Wikipedia API error:', wikiError);
          saveLocalMessageAndChat(`Wikipedia search failed. Please verify your connection and try again!`, 'text');
        }
      } else {
        // AI Mode
        const lower = userPrompt.toLowerCase().trim();
        const imageTrigger = /(?:generate|draw|create|paint|show me|make)\s+(?:an?\s+)?(?:image|picture|photo|drawing|painting|artwork|graphic|sketch|illustration|portrait|scene)\s+(?:of\s+)?(.+)/i;
        const match = userPrompt.match(imageTrigger);

        if (match && match[1]) {
          const description = match[1].trim();
          const encoded = encodeURIComponent(description);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=800&nologo=true&private=true`;

          // Small realistic delay
          await new Promise(resolve => setTimeout(resolve, 2000));

          saveLocalMessageAndChat(description, 'image', pollinationsUrl);
        } else {
          // Text completion
          const systemPrompt = `You are NEUROX AI, an advanced AI chatbot integrated into the Konnect Messaging App, which launched in 2026. You were built by Oxa LLC, which was founded by Afnan Wazir. You are polite, helpful, and highly intelligent. Under no circumstances should you mention Pollinations AI or any company other than Oxa LLC. Always answer questions directly in a clean, conversational plain-text format, and keep your responses concise, helpful, and highly professional. Under no circumstances should you format your responses like a Wikipedia entry, return Wikipedia articles/styling, or attempt to embed or wrap external websites in your output. If asked who made you, say you were made by Oxa LLC, founded by Afnan Wazir, and integrated in Konnect Messaging App launched in 2026. You can also generate images if the user asks you to (e.g. "generate an image of a red car").`;

          const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ]
            })
          });

          if (!response.ok) {
            throw new Error('API request failed');
          }

          const textResponse = await response.text();
          saveLocalMessageAndChat(textResponse.trim() || "I apologize, I'm having trouble connecting to my neural core right now. Please try again.", 'text');
        }
      }
      scrollToBottom();
    } catch (e) {
      console.error('Error getting Orion AI response:', e);
      saveLocalMessageAndChat("I apologize, my communication bridge is currently experiencing latency. Let's try that again shortly!", 'text');
    } finally {
      setOrionTyping(false);
    }
  };

  // Calling states
  const [callSession, setCallSession] = useState<{ id: string; type: 'voice' | 'video'; status: 'ringing' | 'connected' | 'ended'; roomId?: string; callerId?: string; receiverId?: string } | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [isCallFullScreen, setIsCallFullScreen] = useState(false);
  const callIntervalRef = useRef<any>(null);
  const callRingNode = useRef<any>(null);
  const jitsiApiRef = useRef<any>(null);
  const [jitsiSessionKey, setJitsiSessionKey] = useState(0);
  const [jitsiDomain, setJitsiDomain] = useState('meet.ffmuc.net'); // Default to meet.ffmuc.net (open-source public server, completely free & unlimited, no login or host account required!)

  // Initialize official Jitsi Meet External API when call is connected
  useEffect(() => {
    if (callSession?.status === 'connected' && callSession.roomId) {
      const timer = setTimeout(() => {
        const container = document.getElementById('jitsi-container');
        if (container && window.JitsiMeetExternalAPI) {
          if (jitsiApiRef.current) {
            jitsiApiRef.current.dispose();
            jitsiApiRef.current = null;
          }
          
          try {
            const domain = jitsiDomain;
            const options = {
              roomName: callSession.roomId,
              width: '100%',
              height: '100%',
              parentNode: container,
              configOverwrite: {
                prejoinPageEnabled: false,
                startWithVideoMuted: callSession.type === 'voice',
                startWithAudioMuted: false,
                disableDeepLinking: true,
                enableWelcomePage: false,
                hideLobbyButton: true,
                requireDisplayName: false,
                enableClosePage: false,
                hideWatermark: true,
                disableModeratorIndicator: false,
                lobby: {
                  enabled: false
                },
                hosts: {
                  domain: domain,
                  muc: `muc.${domain}`
                },
                maxMeetingDuration: 3600, // Guarantee up to 1 hour (3600 seconds) duration
                p2p: {
                  enabled: true,
                  preferH264: true
                },
                chromeExtensionBanner: {
                  preventShow: true
                },
                logoClickUrl: '',
                logoImageUrl: '',
                logoWidth: 0,
                logoHeight: 0
              },
              interfaceConfigOverwrite: {
                filmStripOnly: false,
                DEFAULT_BACKGROUND: '#090e17',
                SHOW_JITSI_WATERMARK: false,
                SHOW_BRAND_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                JITSI_WATERMARK_LINK: '',
                BRAND_WATERMARK_LINK: ''
              },
              userInfo: {
                displayName: myProfile.displayName,
                email: myProfile.username + '@konnect.com',
                avatarUrl: myProfile.photoURL
              }
            };
            jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

            // Handle hanging up inside Jitsi UI
            jitsiApiRef.current.addEventListener('readyToClose', () => {
              endCall();
            });
            jitsiApiRef.current.addEventListener('videoConferenceLeft', () => {
              endCall();
            });
          } catch (e) {
            console.error("Error starting Jitsi Meet External API:", e);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (jitsiApiRef.current) {
          jitsiApiRef.current.dispose();
          jitsiApiRef.current = null;
        }
      };
    }
  }, [callSession?.status, callSession?.roomId, callSession?.type, jitsiSessionKey, jitsiDomain]);



  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Real-time typing status variables
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);

  // Group detailed states
  const [currentGroupData, setCurrentGroupData] = useState<any>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupPhotoInput, setGroupPhotoInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [selectedNewMember, setSelectedNewMember] = useState('');

  // Emojis for quick reactions
  const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🎉'];

  // Read messages and update read receipts
  useEffect(() => {
    if (partnerProfile.uid === 'orion-ai') {
      const localMsgsKey = `konnect_local_messages_orion-ai_${myProfile.uid}`;
      const loadLocalMessages = () => {
        const stored = localStorage.getItem(localMsgsKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const formatted = parsed.map((m: any) => ({
              ...m,
              timestamp: m.timestamp ? { toDate: () => new Date(m.timestamp) } : null
            }));
            setMessages(formatted);
          } catch (e) {
            console.error(e);
          }
        } else {
          setMessages([]);
        }
        scrollToBottom();
      };
      
      loadLocalMessages();
      
      window.addEventListener('storage', loadLocalMessages);
      const interval = setInterval(loadLocalMessages, 1000);
      
      return () => {
        window.removeEventListener('storage', loadLocalMessages);
        clearInterval(interval);
      };
    }

    const q = query(
      collection(db, 'chats', chatId, 'messages'), 
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: Message[] = [];
      const unreadBatch = writeBatch(db);
      let needsCommit = false;

      snapshot.forEach((msgDoc) => {
        const data = msgDoc.data() as Message;
        list.push({ ...data, id: msgDoc.id });

        // If message is from partner and unread, let's mark it as read
        if (data.senderId === partnerProfile.uid && !data.read) {
          unreadBatch.update(doc(db, 'chats', chatId, 'messages', msgDoc.id), { read: true });
          needsCommit = true;
        }
      });

      setMessages(list);
      scrollToBottom();

      if (needsCommit) {
        try {
          await unreadBatch.commit();
          // Reset unread count for current user in chats document
          await updateDoc(doc(db, 'chats', chatId), {
            [`unreadCount.${myProfile.uid}`]: 0
          });
        } catch (e) {
          console.error(e);
        }
      }
    }, (error) => {
      console.warn("Messages onSnapshot handled error:", error);
    });

    return () => unsubscribe();
  }, [chatId, partnerProfile, myProfile]);

  // Handle auto-open drawer based on URL navigation
  useEffect(() => {
    if (autoOpenProfile) {
      setShowPartnerProfileDrawer(true);
    } else {
      setShowPartnerProfileDrawer(false);
    }
  }, [chatId, autoOpenProfile]);

  // Dismiss active reaction picker when clicking/tapping elsewhere
  useEffect(() => {
    const handleDismissPicker = () => {
      setActiveReactionPickerId(null);
    };
    window.addEventListener('click', handleDismissPicker);
    return () => window.removeEventListener('click', handleDismissPicker);
  }, []);

  // Typing status cleanup when switching chats or closing
  useEffect(() => {
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    return () => {
      if (chatId) {
        updateDoc(doc(db, 'chats', chatId), {
          [`typing.${myProfile.uid}`]: false
        }).catch(() => {});
      }
    };
  }, [chatId, myProfile.uid]);

  // Synchronize activeCall, typing, and group metadata with Firestore in real-time
  useEffect(() => {
    if (partnerProfile.uid === 'orion-ai') return;
    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Sync typing users
        const typing = data?.typing || {};
        setTypingUsers(typing);

        // Sync group details if active chat is a group
        if (data?.isGroup) {
          setCurrentGroupData(data);
        }

        const activeCall = data?.activeCall;
        
        if (activeCall) {
          // If a call is ongoing and we are not in ended state
          if (activeCall.status === 'ended') {
            if (callRingNode.current) {
              try { callRingNode.current.osc.stop(); } catch (e) {}
              callRingNode.current = null;
            }
            if (callIntervalRef.current) {
              clearInterval(callIntervalRef.current);
              callIntervalRef.current = null;
            }
            setCallSession(null);
          } else {
            // Update local call session
            setCallSession({
              id: activeCall.id,
              type: activeCall.type,
              status: activeCall.status,
              roomId: activeCall.roomId,
              callerId: activeCall.callerId,
              receiverId: activeCall.receiverId
            });
            
            // Handle sound and timer transitions
            if (activeCall.status === 'connected') {
              if (callRingNode.current) {
                try { callRingNode.current.osc.stop(); } catch (e) {}
                callRingNode.current = null;
              }
              // Start timer if not already running
              if (!callIntervalRef.current) {
                setCallTimer(0);
                setJitsiSessionKey(0); // Reset session key for new call
                callIntervalRef.current = setInterval(() => {
                  setCallTimer(prev => {
                    const next = prev + 1;
                    // Auto-restart Jitsi Meet iframe at 59 minutes 10 seconds (3550 seconds) to bypass any session limits automatically and guarantee at least 1 hour
                    if (next > 0 && next % 3550 === 0) {
                      console.log("Auto-restarting Jitsi call to extend duration and bypass limits...");
                      setJitsiSessionKey(k => k + 1);
                    }
                    return next;
                  });
                }, 1000);
              }
            } else if (activeCall.status === 'ringing') {
              // Play electronic ringing sound if we are the receiver or caller and sound is not already playing
              if (!callRingNode.current) {
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  osc.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  
                  osc.frequency.setValueAtTime(activeCall.receiverId === myProfile.uid ? 440 : 400, audioCtx.currentTime);
                  
                  const now = audioCtx.currentTime;
                  gainNode.gain.setValueAtTime(0, now);
                  for (let i = 0; i < 60; i += 3) {
                    if (activeCall.receiverId === myProfile.uid) {
                      // Receiver ring tone: beep-beep, pause
                      gainNode.gain.setValueAtTime(0.1, now + i);
                      gainNode.gain.setValueAtTime(0.1, now + i + 0.4);
                      gainNode.gain.setValueAtTime(0, now + i + 0.5);
                      gainNode.gain.setValueAtTime(0.1, now + i + 0.7);
                      gainNode.gain.setValueAtTime(0.1, now + i + 1.1);
                      gainNode.gain.setValueAtTime(0, now + i + 1.2);
                    } else {
                      // Caller ringback tone: long beep, pause
                      gainNode.gain.setValueAtTime(0.08, now + i);
                      gainNode.gain.setValueAtTime(0.08, now + i + 1.2);
                      gainNode.gain.setValueAtTime(0, now + i + 1.4);
                    }
                  }
                  
                  osc.start();
                  callRingNode.current = { osc, ctx: audioCtx };
                } catch (e) {}
              }
            }
          }
        } else {
          // No active call (was cleared or declined)
          if (callRingNode.current) {
            try { callRingNode.current.osc.stop(); } catch (e) {}
            callRingNode.current = null;
          }
          if (callIntervalRef.current) {
            clearInterval(callIntervalRef.current);
            callIntervalRef.current = null;
          }
          setCallSession(null);
        }
      }
    }, (error) => {
      console.warn("ChatDoc onSnapshot handled error:", error);
    });

    return () => {
      unsubscribe();
      if (callRingNode.current) {
        try { callRingNode.current.osc.stop(); } catch (e) {}
      }
      if (callIntervalRef.current) {
        clearInterval(callIntervalRef.current);
      }
    };
  }, [chatId, myProfile.uid]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const updateTypingStatus = async (isTyping: boolean) => {
    if (partnerProfile.uid === 'orion-ai') return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`typing.${myProfile.uid}`]: isTyping
      });
    } catch (err) {}
  };

  const handleTypingText = (text: string) => {
    setInputText(text);
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      updateTypingStatus(true);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      updateTypingStatus(false);
    }, 2000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    setInputText('');
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    updateTypingStatus(false);
    await sendMessagePayload(cleanText, 'text');
  };

  const sendMessagePayload = async (text: string, type: Message['type'], extraFields = {}) => {
    if (partnerProfile.uid === 'orion-ai') {
      const localMsgsKey = `konnect_local_messages_orion-ai_${myProfile.uid}`;
      const localChatKey = `konnect_local_chat_orion-ai_${myProfile.uid}`;

      const userMsg = {
        id: `msg-user-${Date.now()}`,
        senderId: myProfile.uid,
        receiverId: 'orion-ai',
        text,
        timestamp: new Date().toISOString(),
        type,
        read: true,
        ...extraFields
      };

      const storedMsgs = localStorage.getItem(localMsgsKey);
      let list = [];
      if (storedMsgs) {
        try {
          list = JSON.parse(storedMsgs);
        } catch (e) {
          console.error(e);
        }
      }
      list.push(userMsg);
      localStorage.setItem(localMsgsKey, JSON.stringify(list));
      
      const formatted = list.map((m: any) => ({
        ...m,
        timestamp: m.timestamp ? { toDate: () => new Date(m.timestamp) } : null
      }));
      setMessages(formatted);
      scrollToBottom();

      localStorage.setItem(localChatKey, JSON.stringify({
        id: `orion-ai-chat-${myProfile.uid}`,
        participants: [myProfile.uid, 'orion-ai'],
        lastMessage: {
          text: type === 'image' ? '📷 Image' : text,
          timestamp: new Date().toISOString(),
          senderId: myProfile.uid
        },
        unreadCount: {
          [myProfile.uid]: 0,
          'orion-ai': 0
        }
      }));

      // Trigger Orion AI if text
      if (type === 'text') {
        handleOrionAIResponse(text);
      }
      return;
    }

    const payload = {
      senderId: myProfile.uid,
      receiverId: partnerProfile.uid,
      text,
      timestamp: serverTimestamp() || new Date(),
      type,
      read: false,
      ...extraFields
    };

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), payload);
      
      // Update last message in active chat doc
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text,
          timestamp: new Date(),
          senderId: myProfile.uid
        },
        [`unreadCount.${partnerProfile.uid}`]: increment(1)
      });
      
      // Send real background push notification (runs async so it doesn't block the UI)
      sendPushToUser(
        partnerProfile.uid,
        `${myProfile.displayName} SENT A MESSAGE!`,
        type === 'image' ? '📷 Image' : text,
        myProfile.email
      ).catch(err => console.error("Push dispatch error:", err));
      
      scrollToBottom();

      // Trigger Orion AI if it is the recipient (should not be reached, but kept for fallback)
      if (partnerProfile.uid === 'orion-ai' && type === 'text') {
        handleOrionAIResponse(text);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Block/Unblock Option directly from Chat header
  const handleBlockAction = async () => {
    const isCurrentlyBlocked = myProfile.blockedUsers?.includes(partnerProfile.uid);
    let updatedBlocked = [...(myProfile.blockedUsers || [])];

    if (isCurrentlyBlocked) {
      updatedBlocked = updatedBlocked.filter(uid => uid !== partnerProfile.uid);
    } else {
      updatedBlocked.push(partnerProfile.uid);
    }

    try {
      await updateDoc(doc(db, 'profiles', myProfile.uid), { blockedUsers: updatedBlocked });
      myProfile.blockedUsers = updatedBlocked; // local trigger updates state
      onCloseChat?.();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async () => {
    if (!window.confirm(`Are you sure you want to remove @${partnerProfile.username} from your friends list?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      try {
        await deleteDoc(doc(db, 'friendRequests', `${myProfile.uid}_${partnerProfile.uid}`));
        await deleteDoc(doc(db, 'friendRequests', `${partnerProfile.uid}_${myProfile.uid}`));
      } catch (e) {}
      onCloseChat?.();
    } catch (e) {
      console.error('Error removing friend:', e);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm(`Are you sure you want to permanently clear all messages in this conversation?`)) {
      return;
    }
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      const snap = await getDocs(messagesRef);
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.delete(doc(db, 'chats', chatId, 'messages', d.id));
      });
      await batch.commit();

      // Update last message in active chat doc to reflect cleared status
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: {
          text: `Conversation cleared`,
          timestamp: new Date(),
          senderId: myProfile.uid
        }
      });
    } catch (e) {
      console.error('Error clearing chat history:', e);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      const snap = await getDoc(msgRef);
      if (snap.exists()) {
        const msg = snap.data() as Message;
        const currentReactions = { ...(msg.reactions || {}) };
        
        // Toggle reaction
        if (currentReactions[myProfile.uid] === emoji) {
          delete currentReactions[myProfile.uid];
        } else {
          currentReactions[myProfile.uid] = emoji;
        }

        await updateDoc(msgRef, { reactions: currentReactions });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Voice Note Genuine recording using Web Audio MediaRecorder!
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : '';
          
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      recordDurationRef.current = 0;

      recordInterval.current = setInterval(() => {
        setRecordDuration(prev => {
          const nextVal = prev + 1;
          recordDurationRef.current = nextVal;
          return nextVal;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = async (cancel = false) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    setIsRecording(false);
    clearInterval(recordInterval.current);

    const recorder = mediaRecorderRef.current;
    
    recorder.onstop = async () => {
      const finalDuration = recordDurationRef.current;
      if (cancel || finalDuration < 1) {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
        }
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { 
        type: recorder.mimeType || 'audio/webm' 
      });
      
      // Convert real blob to base64 Data URL for Firestore persistence
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        await sendMessagePayload(`🎤 Voice Note (${finalDuration}s)`, 'voice', {
          mediaUrl: base64Audio,
          duration: finalDuration
        });
      };

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    recorder.stop();
  };

  // Download generated/shared image as a raw file blob (bypasses navigation redirects)
  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `orion_secure_media_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.warn("Direct blob download failed, falling back to window open:", error);
      window.open(url, '_blank');
    }
  };

  // Playing synthetic tones OR genuine browser-recorded audio for voice note
  const playVoiceNote = (mediaUrl: string, duration: number) => {
    // If clicking active voice note, toggle it pause/play
    if (activeVoiceNote === mediaUrl && isPlayingVoice) {
      setIsPlayingVoice(false);
      if (audioPlayerRef.current) {
        try { audioPlayerRef.current.pause(); } catch (e) {}
      }
      if (audioNodeRef.current) {
        try { audioNodeRef.current.stop(); } catch (e) {}
      }
      return;
    }

    // Stop previous player
    if (audioPlayerRef.current) {
      try { audioPlayerRef.current.pause(); } catch (e) {}
      audioPlayerRef.current = null;
    }
    if (audioNodeRef.current) {
      try { audioNodeRef.current.stop(); } catch (e) {}
      audioNodeRef.current = null;
    }

    setActiveVoiceNote(mediaUrl);
    setIsPlayingVoice(true);

    // If mediaUrl is a real browser base64 audio string or URL, play it back!
    if (mediaUrl.startsWith('data:audio') || mediaUrl.startsWith('blob:') || mediaUrl.startsWith('http')) {
      try {
        const audio = new Audio(mediaUrl);
        audioPlayerRef.current = audio;
        audio.playbackRate = playbackSpeed;
        audio.play().catch((err) => {
          console.error("Audio playback error:", err);
          setIsPlayingVoice(false);
          setActiveVoiceNote(null);
        });
        audio.onended = () => {
          setIsPlayingVoice(false);
          setActiveVoiceNote(null);
        };
      } catch (e) {
        console.error("Failed to play real audio:", e);
        setIsPlayingVoice(false);
        setActiveVoiceNote(null);
      }
    } else {
      // Legacy or mock fallback - Play a beautiful zen bell hum (sine wave, soft decay) instead of high-pitched buzzy buzzer noise!
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        audioNodeRef.current = osc;

        osc.type = 'sine'; // much softer sine wave
        const freqMultiplier = playbackSpeed;
        osc.frequency.setValueAtTime(320, audioCtx.currentTime); // pleasant soft 320Hz hum
        osc.frequency.linearRampToValueAtTime(380, audioCtx.currentTime + duration / freqMultiplier);

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime); // pleasant moderate volume
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / freqMultiplier);

        osc.start();
        osc.stop(audioCtx.currentTime + duration / freqMultiplier);

        setTimeout(() => {
          setIsPlayingVoice(false);
          setActiveVoiceNote(null);
        }, (duration * 1000) / freqMultiplier);

      } catch (e) {
        console.warn(e);
        setIsPlayingVoice(false);
      }
    }
  };

  // Call session initiator
  const startCall = async (type: 'voice' | 'video') => {
    const uniqueRoomId = `konnect_jitsi_${chatId}_${Date.now().toString(36)}`;
    const callPayload = {
      id: 'call_' + Date.now(),
      type,
      status: 'ringing' as const, // Start in ringing state
      roomId: uniqueRoomId,
      callerId: myProfile.uid,
      receiverId: partnerProfile.uid
    };

    // Update conversation document in Firestore
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        activeCall: callPayload
      });
      // Send real background push notification for call ringing
      sendPushToUser(
        partnerProfile.uid,
        `${myProfile.displayName} INCOMING CALL!`,
        `Incoming ${type} call. Tap to join.`,
        myProfile.email
      ).catch(err => console.error("Call push dispatch error:", err));
    } catch (e) {
      console.error('Failed to initiate call:', e);
    }
  };

  const endCall = async () => {
    // Stop local sounds
    if (callRingNode.current) {
      try { callRingNode.current.osc.stop(); } catch (e) {}
      callRingNode.current = null;
    }
    if (callIntervalRef.current) {
      clearInterval(callIntervalRef.current);
      callIntervalRef.current = null;
    }

    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch (e) {}
      jitsiApiRef.current = null;
    }
    setIsCallFullScreen(false);

    // Log call outcome in message history
    if (callSession) {
      if (callSession.status === 'ringing') {
        if (callSession.callerId === myProfile.uid) {
          sendMessagePayload(`📞 Cancelled ${callSession.type === 'video' ? 'video' : 'voice'} call`, 'call_log');
        } else {
          sendMessagePayload(`📞 Declined ${callSession.type === 'video' ? 'video' : 'voice'} call`, 'call_log');
        }
      } else {
        sendMessagePayload(`📞 ${callSession.type === 'video' ? 'Video' : 'Voice'} call ended (${callTimer}s)`, 'call_log');
      }
    }

    // Reset Firestore activeCall
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        activeCall: null
      });
    } catch (e) {
      console.error('Failed to end call:', e);
    }

    setCallSession(null);
  };

  const acceptCall = async () => {
    if (callRingNode.current) {
      try { callRingNode.current.osc.stop(); } catch (e) {}
      callRingNode.current = null;
    }
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        'activeCall.status': 'connected'
      });
    } catch (e) {
      console.error('Failed to accept call:', e);
    }
  };

  const handleChallengeGame = (gameId: string) => {
    const game = LIST_OF_GAMES.find(g => g.id === gameId);
    if (!game) return;

    sendMessagePayload(`🎮 Friend Game Challenge: ${game.name}`, 'game_challenge', {
      gameInfo: {
        gameId,
        gameName: game.name,
        status: 'pending',
        turnUid: partnerProfile.uid,
        score: {
          [myProfile.uid]: 0,
          [partnerProfile.uid]: 0
        },
        state: null
      }
    });
  };

  const acceptGameChallenge = async (messageId: string, gameId: string) => {
    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        'gameInfo.status': 'active'
      });
      // Launch game hub
      onSetGameChallenge(gameId);
    } catch (e) {
      console.error(e);
    }
  };


      
  // Pre-populate editing inputs when group details load
  useEffect(() => {
    if (currentGroupData) {
      setGroupNameInput(currentGroupData.groupName || '');
      setGroupPhotoInput(currentGroupData.groupPhotoURL || '');
      setGroupDescInput(currentGroupData.groupDescription || '');
    }
  }, [currentGroupData, chatId]);

  const handleUpdateGroupDetails = async () => {
    if (!groupNameInput.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        groupName: groupNameInput.trim(),
        groupPhotoURL: groupPhotoInput.trim() || "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=120",
        groupDescription: groupDescInput.trim() || "Group Chat Space"
      });
      setIsEditingGroup(false);
    } catch (e) {
      console.error("Error updating group details:", e);
    }
  };

  const handleAddGroupMember = async (friendUid: string) => {
    if (!friendUid) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        participants: arrayUnion(friendUid)
      });
      setSelectedNewMember('');
    } catch (e) {
      console.error("Error adding group member:", e);
    }
  };

  const handleRemoveGroupMember = async (memberUid: string) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        participants: arrayRemove(memberUid),
        admins: arrayRemove(memberUid)
      });
    } catch (e) {
      console.error("Error removing group member:", e);
    }
  };

  const handleToggleAdmin = async (memberUid: string, isCurrentAdmin: boolean) => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        admins: isCurrentAdmin ? arrayRemove(memberUid) : arrayUnion(memberUid)
      });
    } catch (e) {
      console.error("Error toggling admin status:", e);
    }
  };

  const handleToggleNoAdminMode = async () => {
    if (!currentGroupData) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        noAdminMode: !currentGroupData.noAdminMode
      });
    } catch (e) {
      console.error("Error toggling no admin mode:", e);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        participants: arrayRemove(myProfile.uid),
        admins: arrayRemove(myProfile.uid)
      });
      if (onCloseChat) onCloseChat();
    } catch (e) {
      console.error("Error leaving group:", e);
    }
  };

  const isLight = myProfile.theme === 'blue-white';

  const wallpaperStyles = {
    default: isLight ? { backgroundColor: '#f8fafc' } : { backgroundColor: '#040609' },
    midnight: {
      backgroundColor: '#020617',
      backgroundImage: 'radial-gradient(ellipse at center, rgba(16,185,129,0.03) 0%, rgba(30,41,59,0.3) 100%)',
      backgroundSize: 'cover'
    },
    emerald: {
      backgroundColor: '#022c22',
      backgroundImage: 'radial-gradient(circle at top right, rgba(16,185,129,0.08) 0%, rgba(2,44,34,0.4) 100%)',
      backgroundSize: 'cover'
    },
    cyber: {
      backgroundColor: '#0c0a0f',
      backgroundImage: 'linear-gradient(rgba(244,63,94,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.02) 1px, transparent 1px)',
      backgroundSize: '24px 24px'
    },
    light: {
      backgroundColor: '#ffffff',
      backgroundImage: 'radial-gradient(circle at center, rgba(59,130,246,0.03) 0%, rgba(248,250,252,1) 100%)',
      backgroundSize: 'cover'
    }
  };

  const getWallpaperStyle = () => {
    if (myProfile.customBackground) {
      return {
        backgroundImage: `url(${myProfile.customBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    const styleObj = (wallpaperStyles as any)[chatWallpaper] || wallpaperStyles.default;
    return styleObj;
  };
  const isPartnerTyping = partnerProfile.uid === 'orion-ai' ? orionTyping : !!typingUsers[partnerProfile.uid];
  const headerClass = isLight 
    ? "p-3 sm:p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0"
    : "p-3 sm:p-4 border-b border-slate-900 bg-[#0e121a]/80 backdrop-blur-md flex items-center justify-between z-10 flex-shrink-0";
    
  const headerNameClass = isLight
    ? "font-bold text-sm text-slate-800 hover:text-blue-600 transition-all truncate flex items-center gap-1"
    : "font-bold text-sm text-slate-100 group-hover:text-indigo-400 transition-all truncate flex items-center gap-1";
    
  const backBtnClass = isLight
    ? "p-1.5 mr-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition flex items-center justify-center flex-shrink-0"
    : "p-1.5 mr-1 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center flex-shrink-0";
    
  const headerIconBtnClass = (isActive: boolean) => {
    if (isActive) {
      return isLight ? 'p-2 bg-blue-50 text-blue-600 rounded-lg transition' : 'p-2 bg-indigo-600/20 text-indigo-400 rounded-lg transition';
    }
    return isLight ? 'p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition' : 'p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-indigo-400 transition';
  };

  return (
    <motion.div 
      key={chatId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex-1 flex h-full ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#0a0d14] text-slate-100'} relative overflow-hidden`}
    >
      
      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        
        {/* HEADER SECTION */}
        <div className={headerClass}>
          <div className="flex items-center gap-2 min-w-0">
            {/* Back button */}
            <button 
              onClick={onCloseChat}
              className={backBtnClass}
              title="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div 
              onClick={() => setShowPartnerProfileDrawer(prev => !prev)}
              className="flex items-center gap-3 cursor-pointer group min-w-0"
              title="View profile details"
            >
              <div className="relative flex-shrink-0">
                <SecureAvatar src={getBotPhotoURL(partnerProfile.uid, partnerProfile.photoURL)} alt="Pfp" className={`w-10 h-10 rounded-full object-cover border ${isLight ? 'border-slate-200' : 'border-slate-800'} transition-all`} />
                {!partnerProfile.isGroup && (
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border ${isLight ? 'border-white' : 'border-[#0e121a]'} ${partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                )}
              </div>
              <div className="min-w-0">
                <h4 className={headerNameClass}>
                  {partnerProfile.displayName}
                  {(partnerProfile.uid === 'orion-ai' || partnerProfile.uid === 'oxa-llc') && (
                    <VerifiedBadge className="w-3.5 h-3.5" />
                  )}
                </h4>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  {partnerProfile.isGroup ? (
                    <span>Group Space • {currentGroupData?.participants?.length || 0} members</span>
                  ) : (
                    <span>{partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'Active now' : 'Away'} • {partnerProfile.bio || 'Available'}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Action button rails */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchText(''); }}
              title="Search chat messages"
              className={headerIconBtnClass(showSearch)}
            >
              <Search className="w-4 h-4" />
            </button>

            <button 
              onClick={() => { setShowMediaGrid(!showMediaGrid); setShowPartnerProfileDrawer(false); }}
              title="View shared media & images"
              className={headerIconBtnClass(showMediaGrid)}
            >
              <Image className="w-4 h-4" />
            </button>

            {!partnerProfile.isGroup && (
              <>
                <button 
                  onClick={() => startCall('voice')}
                  title="Start voice call"
                  className={headerIconBtnClass(false)}
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => startCall('video')}
                  title="Start video call"
                  className={headerIconBtnClass(false)}
                >
                  <Video className="w-4 h-4" />
                </button>
              </>
            )}

            <button 
              onClick={() => { setShowPartnerProfileDrawer(!showPartnerProfileDrawer); setShowMediaGrid(false); }}
              title="View Space Info"
              className={headerIconBtnClass(showPartnerProfileDrawer)}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SEARCH BOX ATTACHMENT PORTAL */}
        {showSearch && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 border-b flex flex-col md:flex-row md:items-center gap-3 z-10 flex-shrink-0 ${
              isLight 
                ? 'bg-slate-50/95 border-slate-200/60 shadow-sm' 
                : 'bg-[#0b0e14]/90 border-slate-900/80 shadow-inner'
            }`}
          >
            {/* Search Input Area */}
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                isLight 
                  ? 'bg-white border-slate-200/85 focus-within:border-blue-500' 
                  : 'bg-[#07090d] border-slate-800/80 focus-within:border-indigo-500'
              }`}>
                <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder="Search secure message history..." 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className={`w-full bg-transparent border-0 outline-none text-xs font-sans ${
                    isLight ? 'text-slate-800 placeholder-slate-400' : 'text-slate-100 placeholder-slate-600'
                  }`}
                  autoFocus
                />
                {searchText && (
                  <button 
                    onClick={() => setSearchText('')}
                    className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                )}
              </div>

              {/* Mode Toggle Capsule */}
              <div className={`p-1 rounded-xl flex items-center gap-1 border flex-shrink-0 self-start sm:self-auto ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-900'
              }`}>
                <button
                  type="button"
                  onClick={() => setSearchMode('highlight')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight uppercase transition-all ${
                    searchMode === 'highlight'
                      ? (isLight ? 'bg-white text-slate-800 shadow' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20')
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                  title="Highlight and navigate through matches in context"
                >
                  Jump
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('filter')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight uppercase transition-all ${
                    searchMode === 'filter'
                      ? (isLight ? 'bg-white text-slate-800 shadow' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20')
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                  title="Filter the chat to show only matching messages"
                >
                  Filter
                </button>
              </div>
            </div>

            {/* Navigation and Stats controls */}
            <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
              {searchText && (
                <div className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex items-center gap-1.5 ${
                  matchIds.length > 0 
                    ? (isLight ? 'bg-blue-50 text-blue-600' : 'bg-indigo-500/10 text-indigo-400')
                    : (isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/10 text-rose-400')
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {matchIds.length > 0 ? (
                    searchMode === 'highlight' ? (
                      <span>{activeSearchIndex + 1} of {matchIds.length} matches</span>
                    ) : (
                      <span>{matchIds.length} matches</span>
                    )
                  ) : (
                    <span>No matches</span>
                  )}
                </div>
              )}

              {searchMode === 'highlight' && matchIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevSearchMatch}
                    className={`p-1.5 rounded-lg transition-all border ${
                      isLight 
                        ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 font-bold' 
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 font-bold'
                    }`}
                    title="Previous match"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextSearchMatch}
                    className={`p-1.5 rounded-lg transition-all border ${
                      isLight 
                        ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 font-bold' 
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 font-bold'
                    }`}
                    title="Next match"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                onClick={() => { setShowSearch(false); setSearchText(''); }}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all ${
                  isLight 
                    ? 'hover:bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-800' 
                    : 'hover:bg-slate-900 border-slate-800 text-slate-500 hover:text-white'
                }`}
                title="Exit search"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* MESSAGES LOG VIEW */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative"
          style={getWallpaperStyle()}
        >
          {messages
            .filter((m) => {
              if (!searchText || searchMode === 'highlight') return true;
              return (m.text || '').toLowerCase().includes(searchText.toLowerCase());
            })
            .map((msg, index, arr) => {
              const isMe = msg.senderId === myProfile.uid;
              
              let msgDate = new Date();
              if (msg.timestamp) {
                msgDate = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
              }
              
              const prevMsg = index > 0 ? arr[index - 1] : null;
              let prevMsgDate = null;
              if (prevMsg && prevMsg.timestamp) {
                prevMsgDate = prevMsg.timestamp.toDate ? prevMsg.timestamp.toDate() : new Date(prevMsg.timestamp);
              }
              
              const showSeparator = !prevMsgDate || !isSameDay(msgDate, prevMsgDate);
              const currentDayGroup = getDaySeparator(msgDate);
              const msgTime = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              // Only display read tick double checks if recipient read receipt config allows
              const showBlueTicks = msg.read && (partnerProfile.readReceipts !== false);

              const isFocusedMatch = searchText && searchMode === 'highlight' && msg.id === matchIds[activeSearchIndex];

              const bubbleClass = isMe 
                ? (isLight 
                    ? `bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10 ${isFocusedMatch ? 'ring-4 ring-amber-400 dark:ring-amber-500 scale-[1.02] shadow-2xl z-10 transition-all duration-300' : ''}` 
                    : `bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10 ${isFocusedMatch ? 'ring-4 ring-amber-500 dark:ring-amber-400 scale-[1.02] shadow-2xl z-10 transition-all duration-300' : ''}`)
                : (isLight 
                    ? `bg-white border border-slate-200/80 text-slate-800 rounded-tl-none ${isFocusedMatch ? 'ring-4 ring-blue-500 dark:ring-indigo-500 scale-[1.02] shadow-2xl z-10 transition-all duration-300' : ''}` 
                    : `bg-[#0f131c] border border-slate-900 text-slate-100 rounded-tl-none ${isFocusedMatch ? 'ring-4 ring-indigo-500 dark:ring-indigo-400 scale-[1.02] shadow-2xl z-10 transition-all duration-300' : ''}`);

              return (
                <React.Fragment key={msg.id}>
                  {showSeparator && (
                    <div className="flex items-center justify-center my-6 select-none w-full col-span-full">
                      <div className={`h-[1px] flex-1 max-w-[120px] ${isLight ? 'bg-slate-200' : 'bg-white/5'}`} />
                      <span className={`mx-4 text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1 rounded-full ${
                        isLight 
                          ? 'bg-slate-100 text-slate-500 border border-slate-200/60 shadow-sm' 
                          : 'bg-[#0c1017] text-slate-400 border border-slate-800/80 shadow'
                      }`}>
                        {currentDayGroup}
                      </span>
                      <div className={`h-[1px] flex-1 max-w-[120px] ${isLight ? 'bg-slate-200' : 'bg-white/5'}`} />
                    </div>
                  )}

                  <div id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative w-full`}>
                    <div 
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 relative ${bubbleClass}`}
                      onTouchStart={(e) => handleTouchStart(msg.id, e)}
                      onTouchEnd={() => handleTouchEnd(msg.id)}
                      onTouchCancel={() => handleTouchEnd(msg.id)}
                      onContextMenu={(e) => {
                        if (window.innerWidth < 640) {
                          e.preventDefault();
                        }
                      }}
                    >
                      
                      {/* Render Sender Name above text bubbles in Group chats */}
                      {!isMe && partnerProfile.isGroup && (
                        <span className="text-[9px] text-indigo-400 font-mono mb-1 block">{msg.senderName || 'Anonymous'}</span>
                      )}

                      {/* Standard text message */}
                      {msg.type === 'text' && renderMessageContent(msg.text, searchText)}

                      {/* Sticker image fallback */}
                      {msg.type === 'sticker' && (
                        <div className="py-1">
                          {renderMessageContent(msg.text || '✨ [Animated Sticker]', searchText)}
                        </div>
                      )}

                      {/* Shared secure photo */}
                      {msg.type === 'image' && (
                        <div 
                          onClick={() => setSelectedLightboxImage(msg.mediaUrl)}
                          className="py-1 select-none pointer-events-auto rounded-lg overflow-hidden border border-slate-900 cursor-pointer hover:opacity-90 transition-all duration-200"
                        >
                          <SecureImage 
                            src={msg.mediaUrl} 
                            alt="shared secure snapshot" 
                            draggable="false"
                            referrerPolicy="no-referrer"
                            className="max-w-xs max-h-48 object-cover rounded-lg no-screenshot-css" 
                          />
                          <div className="bg-slate-950/60 p-1.5 text-center text-[8px] text-slate-400 font-mono border-t border-slate-900 flex items-center justify-center gap-1">
                            🛡️ Screenshot Blocked Snapshot • Zoom
                          </div>
                        </div>
                      )}

                      {/* Voice audio note */}
                      {msg.type === 'voice' && (
                        <div className="py-1 min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => playVoiceNote(msg.mediaUrl || '', msg.duration || 5)}
                              className="p-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-full text-white transition"
                            >
                              {activeVoiceNote === msg.mediaUrl && isPlayingVoice ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 pl-0.5" />}
                            </button>
                            
                            <div className="flex-1">
                              {/* Fake visual wave animation if active */}
                              <div className="flex gap-0.5 items-center justify-center h-4">
                                <span className={`w-0.5 bg-indigo-400 rounded transition-all ${isPlayingVoice && activeVoiceNote === msg.mediaUrl ? 'h-3 animate-pulse' : 'h-1'}`} />
                                <span className={`w-0.5 bg-indigo-400 rounded transition-all ${isPlayingVoice && activeVoiceNote === msg.mediaUrl ? 'h-4 animate-pulse' : 'h-1'}`} style={{ animationDelay: '100ms' }} />
                                <span className={`w-0.5 bg-indigo-400 rounded transition-all ${isPlayingVoice && activeVoiceNote === msg.mediaUrl ? 'h-2 animate-pulse' : 'h-1'}`} style={{ animationDelay: '200ms' }} />
                                <span className={`w-0.5 bg-indigo-400 rounded transition-all ${isPlayingVoice && activeVoiceNote === msg.mediaUrl ? 'h-3 animate-pulse' : 'h-1'}`} style={{ animationDelay: '300ms' }} />
                              </div>
                              
                              <div className="flex justify-between items-center mt-1 text-[8px] font-mono text-slate-400">
                                <span>Voice • {msg.duration || 0}s</span>
                                {activeVoiceNote === msg.mediaUrl && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1); }}
                                    className="bg-black/30 px-1 rounded-md text-[7px]"
                                  >
                                    {playbackSpeed}x
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Call Log item */}
                      {msg.type === 'call_log' && (
                        <div className="flex items-center gap-2 text-[10px] font-mono opacity-80 py-0.5">
                          <span>{msg.text}</span>
                        </div>
                      )}

                      {/* Game challenge item */}
                      {msg.type === 'game_challenge' && (
                        <div className="flex flex-col gap-2 py-1 min-w-[160px]">
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="w-4 h-4 text-fuchsia-400 animate-bounce" />
                            <span className="font-bold text-xs">Konnect Game Arena</span>
                          </div>
                          <p className="text-[10px] text-slate-300 font-mono">Challenged to: {msg.gameInfo?.gameName}</p>
                          
                          {msg.gameInfo?.status === 'pending' ? (
                            !isMe ? (
                              <button
                                onClick={() => acceptGameChallenge(msg.id, msg.gameInfo?.gameId || 'tictactoe')}
                                className="w-full mt-1 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-[10px] font-bold text-white rounded-lg transition"
                              >
                                Accept & Play Match
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-500 italic font-mono">Awaiting friend choice...</span>
                            )
                          ) : (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1"><Check className="w-3 h-3" /> Challenge active / Played</span>
                          )}
                        </div>
                      )}

                      {/* Timestamp & Double check ticks */}
                      <div className={`flex items-center justify-end gap-1 text-[8px] font-mono mt-1.5 ${isMe ? 'text-indigo-200/70' : 'text-slate-500/80'}`}>
                        <span>{msgTime}</span>
                        {isMe && (
                          showBlueTicks ? (
                            <CheckCheck className="w-3.5 h-3.5 text-cyan-400 inline-block" />
                          ) : (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline-block" />
                          )
                        )}
                      </div>

                      {/* Display reactions as floating bubbles beneath the message text */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1.5 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {(() => {
                            // Aggregate reactions: emoji -> list of userIds
                            const counts: Record<string, string[]> = {};
                            Object.entries(msg.reactions).forEach(([uid, rEmoji]) => {
                              const emojiStr = String(rEmoji);
                              const uidStr = String(uid);
                              if (!counts[emojiStr]) counts[emojiStr] = [];
                              counts[emojiStr].push(uidStr);
                            });

                            return Object.entries(counts).map(([rEmoji, uids]) => {
                              const reactedByMe = uids.includes(myProfile.uid);
                              const reactorsNames = uids.map(uid => {
                                const uidStr = String(uid);
                                return profilesMap[uidStr]?.displayName || (uidStr === myProfile.uid ? 'You' : 'User');
                              }).join(', ');
                              return (
                                <button
                                  key={rEmoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddReaction(msg.id, rEmoji);
                                  }}
                                  title={`Reacted by: ${reactorsNames}`}
                                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border transition-all duration-200 active:scale-95 hover:scale-105 shadow-sm ${
                                    reactedByMe
                                      ? (isLight 
                                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                          : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300')
                                      : (isLight 
                                          ? 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100' 
                                          : 'bg-[#101520] border-slate-800/60 text-slate-400 hover:bg-[#141c2c]')
                                  }`}
                                >
                                  <span>{rEmoji}</span>
                                  {uids.length > 1 && (
                                    <span className="font-mono text-[8.5px] font-bold opacity-80">{uids.length}</span>
                                  )}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>

                    {/* REACTION BAR HOVER / LONG-PRESS BAR */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={`
                        absolute -top-8 ${isMe ? 'right-0' : 'left-0'} 
                        flex gap-1 bg-[#090d16] border border-slate-800 rounded-full p-1 shadow-[0_4px_12px_rgba(0,0,0,0.5)] 
                        transition-all duration-200 z-30
                        ${activeReactionPickerId === msg.id 
                          ? 'opacity-100 scale-100 pointer-events-auto' 
                          : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'}
                      `}
                    >
                      {quickReactions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddReaction(msg.id, emoji);
                            setActiveReactionPickerId(null);
                          }}
                          className="text-xs hover:scale-125 transition-all active:scale-90 px-1 py-0.5 cursor-pointer duration-150"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

          {/* Real-time typing indicators */}
          {(() => {
            const activeTypers = Object.entries(typingUsers)
              .filter(([uid, isTyping]) => isTyping && uid !== myProfile.uid)
              .map(([uid]) => profilesMap[uid]?.displayName || 'Someone');
            
            if (activeTypers.length === 0) return null;
            
            return (
              <div className="flex items-center gap-2 p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl w-fit ml-4 mb-4 animate-pulse">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            );
          })()}

          {/* Orion AI Typing indicator */}
          {orionTyping && (
            <div className="flex flex-col items-start group relative animate-pulse ml-2 mb-2">
              <div className={`max-w-[70%] rounded-2xl px-4 py-3 relative rounded-tl-none ${
                isLight 
                  ? 'bg-white border border-slate-200/80 text-slate-800' 
                  : 'bg-[#0f131c] border border-slate-900 text-slate-100'
              }`}>
                <span className={`text-[10px] font-semibold block mb-1 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`}>Neurox AI is typing</span>
                <div className="flex items-center gap-1.5 py-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-blue-600' : 'bg-indigo-500'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-blue-600' : 'bg-indigo-500'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isLight ? 'bg-blue-600' : 'bg-indigo-500'}`} style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* EMOJI PORTAL IN-CHAT DRAWER WITH SEARCH */}
        {showEmojis && (
          <div className="absolute bottom-16 left-4 right-4 bg-[#0a0d14]/95 border border-slate-900 rounded-2xl p-4 shadow-2xl z-30 animate-slideUp backdrop-blur-md flex flex-col max-h-80">
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h5 className="font-bold text-xs text-slate-300 uppercase tracking-widest font-mono">Emoji Library</h5>
              <button 
                onClick={() => { setShowEmojis(false); setEmojiSearch(''); }} 
                className="p-1 text-slate-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="mb-3 flex-shrink-0">
              <input 
                type="text" 
                placeholder="Search secure emojis..." 
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0e121a] border border-slate-900 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-8 gap-2 overflow-y-auto custom-scrollbar p-1 max-h-48">
              {EMOJI_LIST.filter(emoji => !emojiSearch || emoji.name.includes(emojiSearch.toLowerCase())).map((e, idx) => {
                return (
                  <button
                    key={idx}
                    onClick={() => { setInputText(prev => prev + e.emoji); setShowEmojis(false); setEmojiSearch(''); }}
                    className="hover:scale-125 transition active:scale-90 p-1.5 flex items-center justify-center rounded-lg hover:bg-slate-900 cursor-pointer"
                    title={e.name}
                  >
                    <img 
                      src={getAnimatedEmojiUrl(e.emoji)} 
                      alt={e.emoji} 
                      className="w-6 h-6 object-contain"
                      onError={(evt) => {
                        // Fall back to text emoji if WebP fails to load
                        (evt.target as HTMLElement).style.display = 'none';
                        const parent = (evt.target as HTMLElement).parentElement;
                        if (parent && !parent.querySelector('.emoji-text-fallback')) {
                          const textSpan = document.createElement('span');
                          textSpan.className = 'text-xl emoji-text-fallback';
                          textSpan.innerText = e.emoji;
                          parent.appendChild(textSpan);
                        }
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`p-2.5 sm:p-4 border-t backdrop-blur-md flex flex-col gap-2 z-10 flex-shrink-0 ${isLight ? 'border-slate-100 bg-white/95' : 'border-slate-900 bg-[#0e121a]/60'}`}>
          {partnerProfile.uid === 'orion-ai' && (
            <div className="flex items-center justify-between gap-2 px-1 mb-1 pb-1.5 border-b border-dashed border-slate-800/20">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] uppercase font-bold font-mono tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Secure Mode:
                </span>
                <div className="flex bg-black/40 p-0.5 rounded-lg border border-slate-900">
                  <button
                    type="button"
                    onClick={() => {
                      setAiMode('AI');
                      localStorage.setItem(`konnect_ai_mode_${myProfile.uid}`, 'AI');
                    }}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                      aiMode === 'AI' 
                        ? 'bg-blue-600 text-white shadow-sm font-extrabold' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>AI MODE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiMode('WIKI');
                      localStorage.setItem(`konnect_ai_mode_${myProfile.uid}`, 'WIKI');
                    }}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded flex items-center gap-1 transition-all cursor-pointer ${
                      aiMode === 'WIKI' 
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Search className="w-2.5 h-2.5" />
                    <span>WIKI MODE</span>
                  </button>
                </div>
              </div>
              
              <span className={`text-[9px] font-mono tracking-widest font-semibold uppercase px-2 py-0.5 rounded border ${
                aiMode === 'WIKI' 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' 
                  : 'bg-blue-950/40 text-blue-400 border-blue-900/30'
              }`}>
                {aiMode === 'WIKI' ? 'Wikipedia Engine' : 'Neurox Intelligence'}
              </span>
            </div>
          )}

          {partnerProfile.uid === 'oxa-llc' ? (
            <div className={`p-3 rounded-xl border flex items-center justify-center gap-3 text-center w-full select-none ${
              isLight 
                ? 'bg-slate-50 border-slate-200 text-slate-500' 
                : 'bg-slate-950/40 border-slate-900/85 text-slate-400 font-mono text-[11px] uppercase tracking-wider'
            }`}>
              <Ban className="w-4 h-4 text-rose-500 animate-pulse flex-shrink-0" />
              <span>Direct messaging to Oxa LLC Support Line is disabled.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* Main message form */}
                <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 items-center">
                  {/* Input field with Smile icon embedded */}
                  <div className="relative flex-1 flex items-center">
                    <button 
                      type="button"
                      onClick={() => setShowEmojis(!showEmojis)}
                      className={`absolute left-3.5 transition z-20 ${showEmojis ? 'text-blue-500 scale-110' : (isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white')}`}
                      title="Toggle Emojis"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    {isRecording ? (
                      <div className={`w-full pl-11 pr-3 py-2.5 rounded-xl text-xs flex items-center justify-between font-mono border transition-all ${
                        isLight 
                          ? 'bg-rose-50 border-rose-200 text-rose-700' 
                          : 'bg-rose-950/20 border-rose-900/60 text-rose-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <span className="font-bold tracking-tight">E2EE Voice Capture: {recordDuration}s</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => stopRecording(true)}
                          className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[10px] uppercase font-bold tracking-wider transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        value={inputText}
                        onChange={e => handleTypingText(e.target.value)}
                        placeholder="Type your secure message..."
                        className={`w-full pl-11 pr-3 py-2.5 rounded-xl text-xs transition-all font-sans border ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                            : 'bg-[#0A0B0D] border-neutral-800 text-[#E4E6EB] placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        }`}
                      />
                    )}
                  </div>
     
                  {/* Voice recorder dynamic toggle button */}
                  {inputText.trim().length === 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecording) {
                          stopRecording(false);
                        } else {
                          startRecording();
                        }
                      }}
                      className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                        isRecording 
                          ? 'bg-rose-600 text-white animate-pulse' 
                          : (isLight 
                              ? 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-500' 
                              : 'bg-[#0A0B0D] border border-neutral-800 text-slate-400 hover:text-blue-400')
                      }`}
                      title={isRecording ? "Tap to send voice note" : "Tap to record voice note"}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition active:scale-[0.97]"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </form>
              </div>

              {/* Neurox AI Disclaimer */}
              {partnerProfile.uid === 'orion-ai' && (
                <div className={`text-[10px] text-center font-medium tracking-tight mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Neurox AI can make mistakes. Verify important info.
                </div>
              )}
            </div>
          )}

          {/* Real-time typing indicator with ripple effect below the message input area */}
          {isPartnerTyping && (
            <div className="flex items-center gap-2 px-1.5 py-0.5 animate-fadeIn">
              <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <span className={`absolute inline-flex h-full w-full rounded-full animate-ping opacity-60 ${isLight ? 'bg-blue-400' : 'bg-indigo-400'}`} />
                <span className={`absolute inline-flex h-3 w-3 rounded-full animate-pulse ${isLight ? 'bg-blue-500/50' : 'bg-indigo-500/50'}`} />
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isLight ? 'bg-blue-600' : 'bg-indigo-500'}`} />
              </div>
              <span className={`text-[10px] font-mono tracking-wider font-bold uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'} flex items-center gap-1`}>
                {partnerProfile.displayName} <span className="animate-pulse">is typing...</span>
              </span>
            </div>
          )}

        </div>

        {/* FULL CALL PANEL SIMULATION PORTAL OVERLAY */}
        {callSession && (
          <div className={isCallFullScreen ? "fixed inset-0 z-50 bg-black flex items-center justify-center p-0" : "absolute inset-0 z-50 bg-[#020408]/95 backdrop-blur-md flex items-center justify-center p-4 md:p-6"}>
            <div className={`w-full bg-gradient-to-b from-[#090e17] to-[#04060b] shadow-2xl flex flex-col justify-between transition-all duration-300 ${
              isCallFullScreen 
                ? 'h-screen w-screen border-none rounded-none p-4' 
                : (callSession.status === 'connected' ? 'max-w-5xl h-[85vh] md:h-[750px] border border-slate-800 rounded-3xl p-6' : 'max-w-md h-[480px] border border-slate-800 rounded-3xl p-6')
            }`}>
              
              {/* Top Info */}
              <div className="space-y-3 pt-2">
                <div className="relative inline-block">
                  <div className="w-16 h-16 rounded-full border-2 border-indigo-500/40 p-1 mx-auto animate-pulse">
                    <SecureAvatar src={getBotPhotoURL(partnerProfile.uid, partnerProfile.photoURL)} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  </div>
                  {callSession.type === 'video' && (
                    <span className="absolute bottom-0 right-1 p-1 bg-indigo-500 text-white rounded-full text-[10px]">📹</span>
                  )}
                </div>
                
                <h3 className="font-extrabold text-base text-white">{partnerProfile.displayName}</h3>
                <p className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">
                  {callSession.status === 'ringing' ? 'Incoming secure line...' : `Secure ${callSession.type} connected`}
                </p>
              </div>

              {/* Real Open-Source Calling Integration (Jitsi Meet iframe) */}
              {callSession.status === 'connected' && (
                <div className="my-4 flex flex-col justify-center flex-1 min-h-[350px]">
                  <div className="w-full h-full min-h-[340px] bg-black rounded-2xl overflow-hidden border border-slate-800 relative flex flex-col">
                    {/* Full screen / back controls overlay */}
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                      {isCallFullScreen ? (
                        <button 
                          onClick={() => setIsCallFullScreen(false)}
                          className="p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg backdrop-blur border border-slate-700/50 flex items-center gap-1.5 text-xs font-semibold shadow-lg transition active:scale-95 cursor-pointer"
                          title="Back to Normal View"
                        >
                          <Minimize2 className="w-4 h-4 text-indigo-400" />
                          <span>Back to Normal</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => setIsCallFullScreen(true)}
                          className="p-2 bg-slate-900/90 hover:bg-slate-800 text-white rounded-lg backdrop-blur border border-slate-700/50 flex items-center gap-1.5 text-xs font-semibold shadow-lg transition active:scale-95 cursor-pointer"
                          title="Full Screen Calling"
                        >
                          <Maximize2 className="w-4 h-4 text-indigo-400" />
                          <span>Full Screen</span>
                        </button>
                      )}
                    </div>
                    <div id="jitsi-container" className="w-full h-full flex-1 min-h-[340px]" />
                  </div>
                </div>
              )}

              {/* Connection timer and server info */}
              {callSession.status === 'connected' && (
                <div className="space-y-1 mb-2">
                  <p className="text-xl font-semibold font-mono text-white tracking-widest animate-pulse">
                    {Math.floor(callTimer / 60).toString().padStart(2, '0')}:{(callTimer % 60).toString().padStart(2, '0')}
                  </p>
                  
                  {/* Call server & limit bypass indicators */}
                  <div className="flex items-center justify-center gap-2.5 text-[10px] text-slate-400 bg-slate-950/40 px-3 py-1.5 border border-slate-900 rounded-xl max-w-xs mx-auto">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>SECURE JITSI DIRECT CALL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Simulated sound warning label */}
              {callSession.status === 'ringing' && (
                <p className="text-[10px] text-slate-500 px-6">
                  Direct connections are fully encrypted end-to-end to secure caller coordinates and metadata.
                </p>
              )}

              {/* Controls */}
              <div className="flex justify-center gap-6 pb-2">
                {callSession.status === 'ringing' ? (
                  <>
                    {callSession.callerId === myProfile.uid ? (
                      <button 
                        onClick={endCall}
                        className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <PhoneOff className="w-4 h-4" /> Cancel Call
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={endCall}
                          className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                          <PhoneOff className="w-4 h-4" /> Decline
                        </button>
                        <button 
                          onClick={acceptCall}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-full shadow-lg shadow-emerald-600/20 active:scale-95 transition-all animate-bounce flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4" /> Accept
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={endCall}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" /> Disconnect Call
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
      </div>
      
      {/* RIGHT DRAWER: PROFILE DETAILS OR GROUP SETTINGS */}
      {showPartnerProfileDrawer && (
        <div className="w-72 border-l border-slate-900 bg-[#0e121a] flex flex-col h-full z-20 flex-shrink-0 absolute right-0 top-0 bottom-0 shadow-2xl md:relative md:flex">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-900 bg-[#121620] flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider font-mono">
              {partnerProfile.isGroup ? 'Group Space Info' : 'Profile Details'}
            </h4>
            <button 
              onClick={() => setShowPartnerProfileDrawer(false)}
              className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Cover Banner */}
            <div 
              className="w-full h-24 bg-gradient-to-r from-indigo-900 to-slate-900 relative bg-cover bg-center"
              style={{ backgroundImage: partnerProfile.bannerURL ? `url(${partnerProfile.bannerURL})` : undefined }}
            />
            
            {/* Avatar & Info */}
            <div className="flex flex-col items-center -mt-10 px-4 pb-6 border-b border-slate-900/60 relative z-10">
              <div className="relative">
                <SecureAvatar 
                  src={getBotPhotoURL(partnerProfile.uid, partnerProfile.photoURL)} 
                  alt={partnerProfile.displayName} 
                  className="w-20 h-20 rounded-full border-4 border-[#0e121a] object-cover bg-neutral-800 shadow-lg" 
                />
              </div>
              
              {!isEditingGroup ? (
                <>
                  <h3 className="font-bold text-base text-white mt-2 text-center line-clamp-1 flex items-center gap-1 justify-center">
                    {partnerProfile.displayName}
                    {(partnerProfile.uid === 'orion-ai' || partnerProfile.uid === 'oxa-llc') && (
                      <VerifiedBadge className="w-4 h-4" />
                    )}
                  </h3>
                  <p className={`text-[10px] font-mono ${isLight ? 'text-blue-500' : 'text-indigo-400'}`}>
                    {partnerProfile.isGroup ? 'Secure Encrypted Group Space' : `@${partnerProfile.username}`}
                  </p>
                </>
              ) : (
                <div className="w-full mt-3 space-y-3 text-left">
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1 font-mono">Group Name</label>
                    <input 
                      type="text"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="Enter Group Name..."
                      className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 font-mono">Select Group Avatar Picture</label>
                    <div className="grid grid-cols-4 gap-2">
                      {GROUP_PICTURE_PRESETS.map((p) => {
                        const isSelected = groupPhotoInput === p.url;
                        return (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => setGroupPhotoInput(p.url)}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                              isSelected 
                                ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-95' 
                                : 'border-slate-800 hover:border-slate-700 hover:scale-105'
                            }`}
                          >
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover select-none" referrerPolicy="no-referrer" />
                            <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[7px] text-center text-white truncate font-mono">
                              {p.name}
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-indigo-500 rounded-full p-0.5 z-10">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Online/Offline status badge */}
              {!partnerProfile.isGroup && (
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-slate-950/40 rounded-full border border-slate-900">
                  <div className={`w-2 h-2 rounded-full ${partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    {partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'Online' : 'Offline'}
                  </span>
                </div>
              )}
            </div>

            {/* Bio / About */}
            <div className="p-5 space-y-4">
              <div>
                <h5 className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mb-1.5 font-mono">
                  {partnerProfile.isGroup ? 'Group Description' : 'Biography'}
                </h5>
                {!isEditingGroup ? (
                  <p className="text-xs text-slate-300 bg-slate-950/20 p-3 rounded-xl border border-slate-900/60 leading-relaxed font-sans">
                    {partnerProfile.bio || "No description provided."}
                  </p>
                ) : (
                  <textarea 
                    value={groupDescInput}
                    onChange={(e) => setGroupDescInput(e.target.value)}
                    placeholder="Group Description..."
                    className="w-full h-16 p-2 bg-slate-950 border border-slate-800 rounded text-xs text-white resize-none"
                  />
                )}
              </div>

              {partnerProfile.isGroup && currentGroupData && (
                <div className="space-y-4 border-t border-slate-900/60 pt-4">
                  
                  {/* GROUP ADMIN RULES AND ACTIONS */}
                  {(() => {
                    const isMeCreator = currentGroupData.createdBy === myProfile.uid;
                    const isMeAdmin = currentGroupData.admins?.includes(myProfile.uid) || isMeCreator || currentGroupData.noAdminMode;
                    
                    return (
                      <>
                        {/* Admin Action Bar */}
                        {isMeAdmin && (
                          <div className="space-y-2 bg-slate-950/30 p-3 rounded-xl border border-slate-900/40">
                            <h6 className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono flex items-center gap-1">
                              <SettingsIcon className="w-3 h-3 text-indigo-400" /> Admin Command panel
                            </h6>
                            
                            {!isEditingGroup ? (
                              <button 
                                onClick={() => setIsEditingGroup(true)}
                                className="w-full py-1.5 bg-slate-900 hover:bg-indigo-900/40 text-[10px] font-bold rounded-lg border border-slate-800 text-indigo-300 transition"
                              >
                                Edit Group Profile
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setIsEditingGroup(false)}
                                  className="flex-1 py-1 bg-slate-900 hover:bg-slate-800 text-[9px] font-bold rounded-lg border border-slate-800 text-slate-300 transition"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={handleUpdateGroupDetails}
                                  className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 text-[9px] font-bold rounded-lg text-white transition"
                                >
                                  Save Changes
                                </button>
                              </div>
                            )}

                            {/* Creator only admin switch */}
                            {isMeCreator && (
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-900/50">
                                <span className="text-[9px] text-slate-400 font-mono">No-Admin Mode</span>
                                <button 
                                  onClick={handleToggleNoAdminMode}
                                  className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all ${currentGroupData.noAdminMode ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
                                >
                                  {currentGroupData.noAdminMode ? 'ENABLED (Free-Edit)' : 'DISABLED (Restricted)'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Add Member list */}
                        {isMeAdmin && (
                          <div className="space-y-2">
                            <h6 className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Add Member to Group</h6>
                            <div className="flex gap-1.5">
                              <select 
                                value={selectedNewMember}
                                onChange={(e) => setSelectedNewMember(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
                              >
                                <option value="">Select Friend...</option>
                                {Object.values(profilesMap)
                                  .filter(p => p.uid !== myProfile.uid && !currentGroupData.participants?.includes(p.uid))
                                  .map(p => (
                                    <option key={p.uid} value={p.uid}>{p.displayName} (@{p.username})</option>
                                  ))}
                              </select>
                              <button 
                                onClick={() => handleAddGroupMember(selectedNewMember)}
                                disabled={!selectedNewMember}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-900 disabled:text-slate-700 text-white rounded transition"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Members rendering roster */}
                        <div className="space-y-2.5">
                          <h6 className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Roster ({currentGroupData.participants?.length || 0} Members)</h6>
                          <div className="space-y-1.5">
                            {currentGroupData.participants?.map((pUid: string) => {
                              const memberProf = profilesMap[pUid];
                              if (!memberProf) return null;
                              
                              const isCreator = currentGroupData.createdBy === pUid;
                              const isAdmin = currentGroupData.admins?.includes(pUid) || isCreator;
                              const isMemberOnline = memberProf.status === 'online' && !memberProf.stealthMode;

                              return (
                                <div key={pUid} className="flex items-center justify-between p-1.5 bg-slate-950/20 rounded-lg border border-slate-900/60">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="relative">
                                      <SecureAvatar src={memberProf.photoURL || ''} alt="member" className="w-7 h-7 rounded-full" />
                                      <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#0e121a] ${isMemberOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-medium text-slate-200 block truncate leading-tight">{memberProf.displayName}</span>
                                      <span className="text-[8px] text-slate-500 font-mono block truncate">@{memberProf.username}</span>
                                    </div>
                                  </div>

                                  {/* Member Flags / Actions */}
                                  <div className="flex items-center gap-1">
                                    {isCreator && (
                                      <span className="p-1 bg-yellow-950 border border-yellow-900/40 rounded text-[7px] text-yellow-500" title="Creator of this Group Space">
                                        <Crown className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                    {!isCreator && isAdmin && (
                                      <span className="p-1 bg-blue-950 border border-blue-900/40 rounded text-[7px] text-blue-400 font-mono uppercase font-bold">
                                        Admin
                                      </span>
                                    )}

                                    {/* Admin Action Menu for other members */}
                                    {isMeAdmin && pUid !== myProfile.uid && !isCreator && (
                                      <div className="flex gap-0.5 ml-1">
                                        <button 
                                          onClick={() => handleToggleAdmin(pUid, currentGroupData.admins?.includes(pUid))}
                                          title={currentGroupData.admins?.includes(pUid) ? "Revoke Admin Status" : "Grant Admin Status"}
                                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded transition"
                                        >
                                          <SettingsIcon className="w-3 h-3" />
                                        </button>
                                        <button 
                                          onClick={() => handleRemoveGroupMember(pUid)}
                                          title="Remove Member from Group"
                                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded transition"
                                        >
                                          <UserMinus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Leave Group Button */}
                  <div className="pt-2">
                    <button 
                      onClick={handleLeaveGroup}
                      className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/40 hover:text-rose-400 border border-rose-900/40 rounded-xl text-xs font-semibold text-rose-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Leave Group Space
                    </button>
                  </div>
                </div>
              )}

              {/* Relationship Actions for 1-on-1 direct channels */}
              {!partnerProfile.isGroup && (
                <div className="pt-4 border-t border-slate-900 space-y-2">
                  <button 
                    onClick={handleClearHistory}
                    className="w-full py-2 bg-slate-900 hover:bg-indigo-950/20 hover:text-indigo-400 hover:border-indigo-900/40 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Clear Chat History
                  </button>
                  <button 
                    onClick={handleRemoveFriend}
                    className="w-full py-2 bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-900/40 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Remove Friend
                  </button>
                  <button 
                    onClick={handleBlockAction}
                    className={`w-full py-2 border rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 ${myProfile.blockedUsers?.includes(partnerProfile.uid) ? 'bg-indigo-950/40 text-indigo-400 border-indigo-900/40' : 'bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-900/40 border-slate-800 text-slate-300'}`}
                  >
                    <Ban className="w-4 h-4" /> {myProfile.blockedUsers?.includes(partnerProfile.uid) ? 'Unblock Friend' : 'Block Friend'}
                  </button>
                </div>
              )}



            </div>
          </div>
        </div>
      )}

      {/* RIGHT DRAWER: SHARED MEDIA & IMAGES */}
      {showMediaGrid && (
        <div className={`w-72 border-l flex flex-col h-full z-20 flex-shrink-0 absolute right-0 top-0 bottom-0 shadow-2xl md:relative md:flex ${
          isLight 
            ? 'border-slate-200 bg-white text-slate-800' 
            : 'border-slate-900 bg-[#0e121a] text-slate-100'
        }`}>
          {/* Drawer Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-900 bg-[#121620]'
          }`}>
            <h4 className={`font-bold text-xs uppercase tracking-wider font-mono ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
              📷 Shared Media
            </h4>
            <button 
              onClick={() => setShowMediaGrid(false)}
              className={`p-1 rounded-full transition ${
                isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {(() => {
              // Filter messages for images/media files
              const mediaMessages = messages.filter(
                (msg) => msg.type === 'image' || (msg.mediaUrl && !msg.text.includes('Established friendship'))
              );

              if (mediaMessages.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                    <Image className="w-8 h-8 text-slate-500 mb-2.5 animate-pulse" />
                    <span className="text-xs text-slate-400 font-sans">No shared images or media found in this thread.</span>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 gap-2">
                  {mediaMessages.map((msg) => {
                    const imgUrl = msg.mediaUrl || msg.text;
                    return (
                      <div 
                        key={msg.id}
                        onClick={() => setSelectedLightboxImage(imgUrl)}
                        className={`aspect-square rounded-xl overflow-hidden cursor-pointer border relative group transition-all duration-300 hover:scale-[1.03] ${
                          isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-800 bg-[#070a0f]'
                        }`}
                      >
                        <img 
                          src={imgUrl} 
                          alt="Media" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center">
                          <Maximize2 className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ZOOM LIGHTBOX MODAL */}
      {selectedLightboxImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4 select-none animate-fadeIn"
          onClick={() => setSelectedLightboxImage(null)}
        >
          {/* Lightbox Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => downloadImage(selectedLightboxImage)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full border border-indigo-500/20 transition shadow-lg text-[10px] font-bold font-mono uppercase tracking-wider"
              title="Download Secure Image File"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button 
              onClick={() => setSelectedLightboxImage(null)}
              className="p-2 bg-neutral-900/80 hover:bg-neutral-800 text-white rounded-full border border-neutral-800 transition shadow-lg flex items-center justify-center"
              title="Close image zoom"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div 
            className="relative max-w-full max-h-[85vh] rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <SecureImage 
              src={selectedLightboxImage} 
              alt="Zoomed Media" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] object-contain mx-auto"
            />
          </div>
          
          <span className="text-[10px] text-neutral-500 font-mono mt-4">
            E2EE SECURE DIGITAL ARCHIVE • CLICK OUTSIDE TO CLOSE
          </span>
        </div>
      )}
    </motion.div>
  );
}
