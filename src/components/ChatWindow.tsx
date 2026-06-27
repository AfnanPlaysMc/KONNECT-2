import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Video, MoreVertical, Send, Smile, Play, Pause, RefreshCw, 
  Smile as EmojiIcon, ShieldAlert, BadgeHelp, EyeOff, Film, Ban,
  Volume2, Mic, Check, CheckCheck, Gamepad2, Sparkles, Image, Zap, Flame, User, X,
  Plus, ArrowLeft, Search, PhoneOff, Settings as SettingsIcon, Crown, UserPlus, UserMinus, Maximize2, Minimize2
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, 
  doc, setDoc, arrayUnion, arrayRemove, getDoc, writeBatch, getDocs, serverTimestamp,
  increment, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Message, STICKERS, LIST_OF_GAMES } from '../types';
import { EMOJI_LIST } from '../emojis';
import { SecureAvatar } from './SecureAvatar';
import { VerifiedBadge } from './VerifiedBadge';
// @ts-ignore
import fwc26TriondaEmoji from '../assets/images/fwc26_trionda_emoji_1782495872803.jpg';
// @ts-ignore
import fwcTrophyEmoji from '../assets/images/fwc_trophy_emoji_1782495891689.jpg';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

// Custom 3D WhatsApp style Real Emoji renderer for FIFA World Cup 2026 soccer ball and trophy cup
const renderMessageContent = (text: string) => {
  const trimmed = text.trim();
  if (trimmed === '⚽') {
    return (
      <div className="flex flex-col items-center py-2 cursor-pointer group select-none max-w-[240px] mx-auto text-center">
        <div className="relative">
          <img 
            src={fwc26TriondaEmoji} 
            alt="⚽ FIFA World Cup 2026 TRIONDA REAL EMOJI" 
            className="w-28 h-28 object-cover rounded-3xl border-2 border-slate-700/50 shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
          />
          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-[9px] text-slate-950 px-2 py-0.5 rounded-full font-sans font-bold shadow-md animate-pulse">
            TRIONDA
          </span>
        </div>
        <span className="text-[9px] text-slate-400 mt-2 font-mono">
          FIFA World Cup 2026™ Real Emoji
        </span>
      </div>
    );
  }
  if (trimmed === '🏆') {
    return (
      <div className="flex flex-col items-center py-2 cursor-pointer group select-none max-w-[240px] mx-auto text-center">
        <div className="relative">
          <img 
            src={fwcTrophyEmoji} 
            alt="🏆 FIFA World Cup Trophy" 
            className="w-28 h-28 object-cover rounded-3xl border-2 border-slate-700/50 shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
          />
          <span className="absolute -top-2 -right-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-[9px] text-white px-2 py-0.5 rounded-full font-sans font-bold shadow-md animate-pulse">
            TROPHY
          </span>
        </div>
        <span className="text-[9px] text-slate-400 mt-2 font-mono">
          FIFA World Cup Trophy™ Real Emoji
        </span>
      </div>
    );
  }

  // Parse inline emojis (⚽ and 🏆)
  const regex = /(⚽|🏆)/g;
  const parts = text.split(regex);
  if (parts.length === 1) {
    return <p className="text-xs leading-relaxed font-sans select-text break-words whitespace-pre-wrap">{text}</p>;
  }

  return (
    <p className="text-xs leading-relaxed font-sans select-text break-words whitespace-pre-wrap flex flex-wrap items-center gap-1">
      {parts.map((part, i) => {
        if (part === '⚽') {
          return (
            <span key={i} className="inline-flex items-center group relative cursor-pointer mx-0.5">
              <img 
                src={fwc26TriondaEmoji} 
                alt="⚽" 
                className="w-5 h-5 object-cover rounded-md border border-slate-700 shadow-sm transition hover:scale-150 z-10"
              />
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 text-[8px] text-yellow-400 font-sans px-1.5 py-0.5 rounded border border-slate-800 opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 pointer-events-none shadow-lg">
                TRIONDA Real Emoji
              </span>
            </span>
          );
        }
        if (part === '🏆') {
          return (
            <span key={i} className="inline-flex items-center group relative cursor-pointer mx-0.5">
              <img 
                src={fwcTrophyEmoji} 
                alt="🏆" 
                className="w-5 h-5 object-cover rounded-md border border-slate-700 shadow-sm transition hover:scale-150 z-10"
              />
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 text-[8px] text-indigo-400 font-sans px-1.5 py-0.5 rounded border border-slate-800 opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20 pointer-events-none shadow-lg">
                FIFA Trophy Real Emoji
              </span>
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
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
  chatId, myProfile, partnerProfile, onOpenGames, onSetGameChallenge, onCloseChat, profilesMap, autoOpenProfile 
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Drawer Toggles
  const [showStickers, setShowStickers] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [showPartnerProfileDrawer, setShowPartnerProfileDrawer] = useState(false);
  
  // New optimized states
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordInterval = useRef<any>(null);
  
  // Playing voice notes speed and active states
  const [activeVoiceNote, setActiveVoiceNote] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const audioCtxRef = useRef<any>(null);
  const audioNodeRef = useRef<any>(null);

  // Orion AI Chatbot Integration
  const [orionTyping, setOrionTyping] = useState(false);

  const handleOrionAIResponse = async (userPrompt: string) => {
    if (partnerProfile.uid !== 'orion-ai') return;
    setOrionTyping(true);

    try {
      const lower = userPrompt.toLowerCase().trim();
      const imageTrigger = /(?:generate|draw|create|paint|show me|make)\s+(?:an?\s+)?(?:image|picture|photo|drawing|painting|artwork|graphic|sketch|illustration|portrait|scene)\s+(?:of\s+)?(.+)/i;
      const match = userPrompt.match(imageTrigger);

      if (match && match[1]) {
        const description = match[1].trim();
        const encoded = encodeURIComponent(description);
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=800&nologo=true&private=true`;

        // Small realistic delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: 'orion-ai',
          receiverId: myProfile.uid,
          text: `Here is the image of **${description}** generated for you:`,
          timestamp: new Date(),
          type: 'image',
          mediaUrl: pollinationsUrl,
          read: false
        });

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: {
            text: `📷 Generated: ${description}`,
            timestamp: new Date(),
            senderId: 'orion-ai'
          },
          [`unreadCount.${myProfile.uid}`]: increment(1)
        });
      } else {
        // Text completion
        const systemPrompt = `You are ORION AI, an advanced AI chatbot integrated into the Konnect Messaging App, which launched in 2026. You were built by Oxa LLC, which was founded by Afnan Wazir. You are polite, helpful, and highly intelligent. Under no circumstances should you mention Pollinations AI or any company other than Oxa LLC. Keep your responses concise, helpful, and highly professional. If asked who made you, say you were made by Oxa LLC, founded by Afnan Wazir, and integrated in Konnect Messaging App launched in 2026. You can also generate images if the user asks you to (e.g. "generate an image of a red car").`;

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

        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: 'orion-ai',
          receiverId: myProfile.uid,
          text: textResponse.trim() || "I apologize, I'm having trouble connecting to my neural core right now. Please try again.",
          timestamp: new Date(),
          type: 'text',
          read: false
        });

        await updateDoc(doc(db, 'chats', chatId), {
          lastMessage: {
            text: textResponse.trim().substring(0, 60),
            timestamp: new Date(),
            senderId: 'orion-ai'
          },
          [`unreadCount.${myProfile.uid}`]: increment(1)
        });
      }
      scrollToBottom();
    } catch (e) {
      console.error('Error getting Orion AI response:', e);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: 'orion-ai',
        receiverId: myProfile.uid,
        text: "I apologize, my communication bridge is currently experiencing latency. Let's try that again shortly!",
        timestamp: new Date(),
        type: 'text',
        read: false
      });
    } finally {
      setOrionTyping(false);
    }
  };

  // Calling states
  const [callSession, setCallSession] = useState<{ id: string; type: 'voice' | 'video'; status: 'ringing' | 'connected' | 'ended'; roomId?: string; callerId?: string; receiverId?: string } | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const callIntervalRef = useRef<any>(null);
  const callRingNode = useRef<any>(null);
  const jitsiApiRef = useRef<any>(null);

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
            // Using vc.init7.net, an official high-speed Swiss Jitsi public server that is 100% free, unlimited, and does not require host login/moderator authentication.
            const domain = 'vc.init7.net';
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
                disableModeratorIndicator: true,
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
  }, [callSession?.status, callSession?.roomId, callSession?.type]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
                callIntervalRef.current = setInterval(() => {
                  setCallTimer(prev => prev + 1);
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const updateTypingStatus = async (isTyping: boolean) => {
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
      
      scrollToBottom();

      // Trigger Orion AI if it is the recipient
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

  const handleSendSticker = async (stickerId: string) => {
    setShowStickers(false);
    const sticker = STICKERS.find(s => s.id === stickerId);
    await sendMessagePayload(`Sent a animated sticker: ${sticker?.emoji}`, 'sticker', {
      mediaUrl: stickerId
    });
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

  // Voice Note Simulation & Genuine recording!
  const startRecording = () => {
    setIsRecording(true);
    setRecordDuration(0);
    recordInterval.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = async (cancel = false) => {
    setIsRecording(false);
    clearInterval(recordInterval.current);
    
    if (cancel || recordDuration < 1) return;

    // Send voice message as simulated audio base64 or custom audio note payload
    const simulatedVoiceBase = `voice_note_freq_${Math.floor(Math.random() * 500)}`;
    await sendMessagePayload(`🎤 Voice Note (${recordDuration}s)`, 'voice', {
      mediaUrl: simulatedVoiceBase,
      duration: recordDuration
    });
  };

  // Playing synthetic tones / mock audio waveforms for recorded voice note
  const playVoiceNote = (messageId: string, duration: number) => {
    if (activeVoiceNote === messageId && isPlayingVoice) {
      setIsPlayingVoice(false);
      if (audioNodeRef.current) {
        try { audioNodeRef.current.stop(); } catch (e) {}
      }
      return;
    }

    setActiveVoiceNote(messageId);
    setIsPlayingVoice(true);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      audioNodeRef.current = osc;

      osc.type = 'triangle';
      // Speed multiplier
      const freqMultiplier = playbackSpeed;
      osc.frequency.setValueAtTime(300, audioCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + duration / freqMultiplier);

      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + duration / freqMultiplier);

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
  const headerClass = isLight 
    ? "p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between z-10"
    : "p-4 border-b border-slate-900 bg-[#0e121a]/80 backdrop-blur-md flex items-center justify-between z-10";
    
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
    <div className={`flex-1 flex h-full ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-[#0a0d14] text-slate-100'} relative overflow-hidden`}>
      
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
                <SecureAvatar src={partnerProfile.photoURL || ''} alt="Pfp" className={`w-10 h-10 rounded-full object-cover border ${isLight ? 'border-slate-200' : 'border-slate-800'} transition-all`} />
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
              onClick={() => setShowPartnerProfileDrawer(!showPartnerProfileDrawer)}
              title="View Space Info"
              className={headerIconBtnClass(showPartnerProfileDrawer)}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SEARCH BOX ATTACHMENT PORTAL */}
        {showSearch && (
          <div className={`p-3 border-b flex items-center gap-2 z-10 animate-slideDown ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0d1017] border-slate-900'}`}>
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search secure database archives..." 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={`flex-1 bg-transparent border-0 outline-none text-xs ${isLight ? 'text-slate-800 placeholder-slate-400' : 'text-white placeholder-slate-600'}`}
            />
            <button 
              onClick={() => { setShowSearch(false); setSearchText(''); }}
              className={`p-1 rounded-lg ${isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-800' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* MESSAGES LOG VIEW */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative"
          style={{
            backgroundImage: myProfile.customBackground ? `url(${myProfile.customBackground})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: isLight ? '#F3F4F6' : '#040609'
          }}
        >
          {messages
            .filter((m) => {
              if (!searchText) return true;
              return m.text.toLowerCase().includes(searchText.toLowerCase());
            })
            .map((msg) => {
              const isMe = msg.senderId === myProfile.uid;
              const msgTime = msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              // Only display read tick double checks if recipient read receipt config allows
              const showBlueTicks = msg.read && (partnerProfile.readReceipts !== false);

              const bubbleClass = isMe 
                ? (isLight 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10' 
                    : 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10')
                : (isLight 
                    ? 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none' 
                    : 'bg-[#0f131c] border border-slate-900 text-slate-100 rounded-tl-none');

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 relative ${bubbleClass}`}>
                    
                    {/* Render Sender Name above text bubbles in Group chats */}
                    {!isMe && partnerProfile.isGroup && (
                      <span className="text-[9px] text-indigo-400 font-mono mb-1 block">{msg.senderName || 'Anonymous'}</span>
                    )}

                    {/* Standard text message */}
                    {msg.type === 'text' && renderMessageContent(msg.text)}

                    {/* Sticker image */}
                    {msg.type === 'sticker' && (
                      <div className="py-1">
                        {(() => {
                          const sObj = STICKERS.find((s) => s.id === msg.mediaUrl);
                          return (
                            <div className="flex flex-col items-center">
                              <span className={`text-4xl ${sObj?.anim || ''} select-none`}>{sObj?.emoji || '✨'}</span>
                              <span className="text-[8px] text-slate-500 mt-1 font-mono">{sObj?.name || 'Sticker'}</span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Shared secure photo */}
                    {msg.type === 'image' && (
                      <div className="py-1 select-none pointer-events-auto rounded-lg overflow-hidden border border-slate-900">
                        <img 
                          src={msg.mediaUrl} 
                          alt="shared secure snapshot" 
                          draggable="false"
                          referrerPolicy="no-referrer"
                          className="max-w-xs max-h-48 object-cover rounded-lg no-screenshot-css" 
                        />
                        <div className="bg-slate-950/60 p-1.5 text-center text-[8px] text-slate-400 font-mono border-t border-slate-900">
                          🛡️ Screenshot Blocked Snapshot
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
                    <div className={`flex items-center justify-end gap-1 text-[8px] font-mono mt-1.5 ${isMe ? 'text-indigo-200' : 'text-slate-500'}`}>
                      <span>{msgTime}</span>
                      {isMe && (
                        showBlueTicks ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                        )
                      )}
                    </div>

                    {/* Display reactions directly on message card */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="absolute -bottom-2 right-2 flex gap-0.5 bg-slate-950 border border-slate-800 rounded-full px-1 py-0.5 shadow">
                        {Object.entries(msg.reactions).map(([uid, rEmoji], idx) => (
                          <span key={idx} className="text-[9px]">{rEmoji}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* REACTION BAR HOVER BAR */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-7 right-0 flex gap-1 bg-slate-950 border border-slate-800 rounded-full p-1 shadow-md transition z-20">
                    {quickReactions.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(msg.id, emoji)}
                        className="text-xs hover:scale-125 transition-all active:scale-95 px-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
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
                <span className={`text-[10px] font-semibold block mb-1 ${isLight ? 'text-blue-600' : 'text-indigo-400'}`}>Orion AI is typing</span>
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

            {/* Featured 3D WhatsApp Real Emojis Section */}
            {!emojiSearch && (
              <div className="mb-3 p-2 bg-gradient-to-r from-emerald-950/20 to-indigo-950/20 rounded-xl border border-slate-800/60 flex-shrink-0">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[10px] font-bold text-emerald-400 font-sans tracking-wide">✨ Featured 3D WhatsApp Emojis</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest font-bold">Real stickers</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setInputText(prev => prev + '⚽'); setShowEmojis(false); }}
                    className="flex-1 flex items-center gap-2 p-1.5 bg-[#0c1017]/80 hover:bg-[#0c1017] rounded-xl border border-slate-800 hover:border-emerald-500/40 transition active:scale-95 group text-left"
                    title="FIFA World Cup 2026 TRIONDA REAL EMOJI"
                  >
                    <img src={fwc26TriondaEmoji} alt="⚽" className="w-7 h-7 object-cover rounded-lg shadow-md group-hover:scale-110 transition" />
                    <div>
                      <h6 className="text-[10px] font-bold text-white leading-tight">World Cup 2026</h6>
                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">⚽ Ball Emoji</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setInputText(prev => prev + '🏆'); setShowEmojis(false); }}
                    className="flex-1 flex items-center gap-2 p-1.5 bg-[#0c1017]/80 hover:bg-[#0c1017] rounded-xl border border-slate-800 hover:border-indigo-500/40 transition active:scale-95 group text-left"
                    title="FIFA World Cup Trophy Real Emoji"
                  >
                    <img src={fwcTrophyEmoji} alt="🏆" className="w-7 h-7 object-cover rounded-lg shadow-md group-hover:scale-110 transition" />
                    <div>
                      <h6 className="text-[10px] font-bold text-white leading-tight">World Cup Trophy</h6>
                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">🏆 Trophy Emoji</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-8 gap-2 overflow-y-auto custom-scrollbar p-1 max-h-48">
              {EMOJI_LIST.filter(emoji => !emojiSearch || emoji.name.includes(emojiSearch.toLowerCase())).map((e, idx) => {
                const isRealEmoji = e.emoji === '⚽' || e.emoji === '🏆';
                return (
                  <button
                    key={idx}
                    onClick={() => { setInputText(prev => prev + e.emoji); setShowEmojis(false); setEmojiSearch(''); }}
                    className={`text-xl hover:scale-125 transition active:scale-90 p-1.5 flex items-center justify-center rounded-lg relative ${
                      isRealEmoji 
                        ? 'bg-amber-500/10 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)] hover:bg-amber-500/20' 
                        : 'hover:bg-slate-900'
                    }`}
                    title={e.emoji === '⚽' ? "⚽ FIFA World Cup 2026 TRIONDA REAL EMOJI" : e.emoji === '🏆' ? "🏆 FIFA World Cup Trophy Real Emoji" : e.name}
                  >
                    {e.emoji}
                    {isRealEmoji && (
                      <span className="absolute -bottom-1 -right-1 text-[6px] bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 px-1 py-0.2 rounded font-sans font-extrabold shadow-sm scale-75 uppercase">
                        3D
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STICKER BOX IN-CHAT ATTACHMENT */}
        {showStickers && (
          <div className="absolute bottom-16 left-4 right-4 bg-[#0a0d14]/95 border border-slate-900 rounded-2xl p-4 shadow-2xl z-30 animate-slideUp backdrop-blur-md flex flex-col max-h-80">
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h5 className="font-bold text-xs text-slate-300 uppercase tracking-widest font-mono">Vector Sticker Packs</h5>
              <button 
                onClick={() => setShowStickers(false)} 
                className="p-1 text-slate-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3 overflow-y-auto custom-scrollbar p-1 max-h-56">
              {STICKERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSendSticker(s.id)}
                  className="p-2 bg-slate-950 hover:bg-[#0e121a] border border-slate-900 hover:border-indigo-500/40 rounded-xl flex flex-col items-center gap-1.5 transition active:scale-95 group duration-200"
                >
                  <span className={`text-3xl select-none group-hover:scale-110 transition duration-200 ${s.anim}`}>{s.emoji}</span>
                  <span className="text-[8px] text-slate-500 group-hover:text-slate-300 font-mono text-center truncate w-full">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* COMPRESSION ATTACHMENTS SHELF */}
        {showMediaMenu && (
          <div className="p-3 bg-[#0d1017] border-t border-slate-900 flex flex-wrap gap-2 animate-slideUp z-10">
            <button 
              type="button"
              onClick={() => { setShowStickers(!showStickers); setShowEmojis(false); setShowMediaMenu(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d24] text-slate-400 hover:text-white border border-slate-800 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Stickers</span>
            </button>

            {/* Quick Challenge mini games trigger */}
            <div className="relative group">
              <button 
                type="button"
                onClick={onOpenGames}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1d24] text-slate-400 hover:text-blue-400 border border-slate-800 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition"
                title="Challenge mini-game"
              >
                <Gamepad2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Launch Arcade</span>
              </button>
              {/* Tooltip trigger list */}
              <div className="hidden group-hover:block absolute bottom-10 left-0 bg-[#0E1013] border border-neutral-800 rounded-xl p-2 w-48 shadow-2xl z-30">
                <h5 className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 mb-1.5 font-mono">Launch Quick Match</h5>
                <div className="grid grid-cols-1 gap-1 max-h-28 overflow-y-auto custom-scrollbar">
                  {LIST_OF_GAMES.filter(g => g.isTwoPlayer).map(game => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => handleChallengeGame(game.id)}
                      className="w-full text-left px-2 py-1 hover:bg-neutral-800 text-[10px] text-slate-300 hover:text-blue-400 rounded transition font-medium"
                    >
                      🎮 {game.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <span className="text-[9px] text-slate-600 font-mono ml-auto">Media & Arcade Hub</span>
          </div>
        )}

        <div className={`p-4 border-t backdrop-blur-md flex flex-col gap-2 z-10 ${isLight ? 'border-slate-100 bg-white/95' : 'border-slate-900 bg-[#0e121a]/60'}`}>
          <div className="flex items-center gap-2">
            {/* Plus toggle button */}
            <button
              type="button"
              onClick={() => setShowMediaMenu(!showMediaMenu)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${showMediaMenu ? (isLight ? 'bg-blue-50 text-blue-600 rotate-45' : 'bg-indigo-600/20 text-indigo-400 rotate-45') : (isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-neutral-800 text-slate-400 hover:text-white')}`}
              title="Toggle Attachments"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Main message form */}
            <form onSubmit={handleSendMessage} className="flex-1 flex gap-2 items-center">
              {/* Input field with Smile icon embedded */}
              <div className="relative flex-1 flex items-center">
                <button 
                  type="button"
                  onClick={() => { setShowEmojis(!showEmojis); setShowStickers(false); }}
                  className={`absolute left-3.5 transition ${showEmojis ? 'text-blue-500 scale-110' : (isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white')}`}
                  title="Toggle Emojis"
                >
                  <Smile className="w-5 h-5" />
                </button>

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
              </div>

              {/* Voice recorder dynamic toggle button */}
              {inputText.trim().length === 0 ? (
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={() => stopRecording(false)}
                  onTouchStart={startRecording}
                  onTouchEnd={() => stopRecording(false)}
                  className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                    isRecording 
                      ? 'bg-rose-600 text-white animate-pulse' 
                      : (isLight 
                          ? 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-500' 
                          : 'bg-[#0A0B0D] border border-neutral-800 text-slate-400 hover:text-blue-400')
                  }`}
                  title="Hold to Record Voice Note"
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
        </div>

        {/* FULL CALL PANEL SIMULATION PORTAL OVERLAY */}
        {callSession && (
          <div className="absolute inset-0 z-50 bg-[#020408]/95 backdrop-blur-md flex items-center justify-center p-4 md:p-6">
            <div className={`w-full ${callSession.status === 'connected' ? 'max-w-5xl h-[85vh] md:h-[750px]' : 'max-w-md h-[480px]'} bg-gradient-to-b from-[#090e17] to-[#04060b] border border-slate-800 rounded-3xl p-6 text-center shadow-2xl flex flex-col justify-between transition-all duration-300`}>
              
              {/* Top Info */}
              <div className="space-y-3 pt-2">
                <div className="relative inline-block">
                  <div className="w-16 h-16 rounded-full border-2 border-indigo-500/40 p-1 mx-auto animate-pulse">
                    <SecureAvatar src={partnerProfile.photoURL || ''} alt="Avatar" className="w-full h-full object-cover rounded-full" />
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
                    <div id="jitsi-container" className="w-full h-full flex-1 min-h-[340px]" />
                  </div>
                </div>
              )}

              {/* Connection timer info */}
              {callSession.status === 'connected' && (
                <p className="text-xl font-semibold font-mono text-white tracking-widest animate-pulse mb-2">
                  {Math.floor(callTimer / 60).toString().padStart(2, '0')}:{(callTimer % 60).toString().padStart(2, '0')}
                </p>
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
                  src={partnerProfile.photoURL || ''} 
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
                <div className="w-full mt-3 space-y-2">
                  <input 
                    type="text"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    placeholder="Enter Group Name..."
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
                  <input 
                    type="text"
                    value={groupPhotoInput}
                    onChange={(e) => setGroupPhotoInput(e.target.value)}
                    placeholder="Group Avatar URL..."
                    className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white"
                  />
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
    </div>
  );
}
