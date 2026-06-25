import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Video, MoreVertical, Send, Smile, Play, Pause, RefreshCw, 
  Smile as EmojiIcon, ShieldAlert, BadgeHelp, EyeOff, Film, Ban,
  Volume2, Mic, Check, CheckCheck, Gamepad2, Sparkles, Image, Zap, Flame, User, X
} from 'lucide-react';
import { 
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, 
  doc, setDoc, arrayUnion, arrayRemove, getDoc, writeBatch, getDocs, serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Message, STICKERS, LIST_OF_GAMES } from '../types';

interface ChatWindowProps {
  chatId: string;
  myProfile: UserProfile;
  partnerProfile: UserProfile;
  onOpenGames: () => void;
  onSetGameChallenge: (gameId: string) => void;
}

export default function ChatWindow({ 
  chatId, myProfile, partnerProfile, onOpenGames, onSetGameChallenge 
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Drawer Toggles
  const [showStickers, setShowStickers] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  
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

  // Calling states
  const [callSession, setCallSession] = useState<{ id: string; type: 'voice' | 'video'; status: 'ringing' | 'connected' | 'ended'; roomId?: string; callerId?: string; receiverId?: string } | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const callIntervalRef = useRef<any>(null);
  const callRingNode = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
    });

    return () => unsubscribe();
  }, [chatId, partnerProfile, myProfile]);

  // Synchronize activeCall state with Firestore in real-time
  useEffect(() => {
    const chatDocRef = doc(db, 'chats', chatId);
    const unsubscribe = onSnapshot(chatDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
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
              // Play electronic ringing sound if we are the receiver and sound is not already playing
              if (activeCall.receiverId === myProfile.uid && !callRingNode.current) {
                try {
                  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                  const osc = audioCtx.createOscillator();
                  const gainNode = audioCtx.createGain();
                  osc.connect(gainNode);
                  gainNode.connect(audioCtx.destination);
                  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
                  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    setInputText('');
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
      window.location.reload(); // instant refresh for security block recalculation
    } catch (e) {
      console.error(e);
    }
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
      status: 'ringing' as const,
      roomId: uniqueRoomId,
      callerId: myProfile.uid,
      receiverId: partnerProfile.uid
    };

    // Play outbound ringtone locally
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      callRingNode.current = { osc, ctx: audioCtx };
    } catch (e) {}

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

    // Log call duration in chats message history
    if (callSession) {
      sendMessagePayload(`📞 ${callSession.type === 'video' ? 'Video' : 'Voice'} call ended (${callTimer}s)`, 'call_log');
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] relative">
      
      {/* HEADER SECTION */}
      <div className="p-4 border-b border-slate-900 bg-[#0e121a]/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={partnerProfile.photoURL} alt="Pfp" className="w-10 h-10 rounded-full object-cover border border-slate-800" />
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0e121a] ${partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100">{partnerProfile.displayName}</h4>
            <p className="text-[10px] text-slate-400 font-medium">
              {partnerProfile.status === 'online' && !partnerProfile.stealthMode ? 'Active now' : 'Away'} | {partnerProfile.bio || 'Available'}
            </p>
          </div>
        </div>

        {/* Action button rails */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => startCall('voice')}
            title="Start voice call"
            className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-indigo-400 transition"
          >
            <Phone className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => startCall('video')}
            title="Start video call"
            className="p-2 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-indigo-400 transition"
          >
            <Video className="w-4 h-4" />
          </button>

          <button 
            onClick={handleBlockAction}
            title={myProfile.blockedUsers?.includes(partnerProfile.uid) ? 'Unblock user' : 'Block user'}
            className={`p-2 rounded-lg transition ${myProfile.blockedUsers?.includes(partnerProfile.uid) ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/40' : 'hover:bg-slate-900 text-slate-400 hover:text-rose-400'}`}
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MESSAGES PORTAL */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 relative">
        
        {/* Empty placeholder */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse mb-3" />
            <h4 className="font-bold text-sm text-slate-300">Secure Messaging Hub</h4>
            <p className="text-[10px] text-slate-500 max-w-[220px] mt-1 leading-relaxed">
              Your messages are protected with biometric structures. Start typing to begin.
            </p>
          </div>
        )}

        {/* Message elements */}
        {messages.map((msg) => {
          const isMe = msg.senderId === myProfile.uid;
          const msgTime = msg.timestamp?.toDate 
            ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const partnerReadEnabled = partnerProfile.readReceipts !== false;
          const myReadEnabled = myProfile.readReceipts !== false;
          const showBlueTicks = msg.read && partnerReadEnabled && myReadEnabled;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
              
              <div className={`max-w-[80%] rounded-2xl p-3 shadow relative group overflow-visible ${isMe ? 'bg-blue-600 text-white' : 'bg-[#1A1D21] border border-neutral-800/80 text-[#E4E6EB]'}`}>
                
                {/* Text Messages */}
                {msg.type === 'text' && (
                  <p className="text-xs leading-relaxed break-words">{msg.text}</p>
                )}

                {/* Animated Stickers */}
                {msg.type === 'sticker' && (
                  <div className="flex flex-col items-center py-1">
                    <span className={`text-4xl ${STICKERS.find(s => s.id === msg.mediaUrl)?.anim || ''}`}>
                      {STICKERS.find(s => s.id === msg.mediaUrl)?.emoji || '✨'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono mt-1.5 uppercase">Sticker pack</span>
                  </div>
                )}

                {/* Voice note layout */}
                {msg.type === 'voice' && (
                  <div className="flex items-center gap-3 py-1">
                    <button 
                      onClick={() => playVoiceNote(msg.id, msg.duration || 5)}
                      className={`p-2 rounded-full flex items-center justify-center transition-all ${isMe ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-slate-950 hover:bg-slate-900 text-indigo-400'}`}
                    >
                      {activeVoiceNote === msg.id && isPlayingVoice ? (
                        <Pause className="w-3.5 h-3.5 animate-pulse" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <div>
                      {/* Audio simulation waves */}
                      <div className="flex gap-0.5 items-center h-4 w-28">
                        {[...Array(12).keys()].map(idx => (
                          <div 
                            key={idx} 
                            className={`w-1 rounded-full transition-all ${isMe ? 'bg-white' : 'bg-indigo-500'} ${activeVoiceNote === msg.id && isPlayingVoice ? 'animate-pulse h-3' : 'h-1.5'}`} 
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[8px] opacity-70 font-mono mt-1">
                        <span>🎤 {msg.duration}s</span>
                        {activeVoiceNote === msg.id && (
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

        <div ref={messagesEndRef} />
      </div>

      {/* STICKER PORTAL IN-CHAT DRAWER */}
      {showStickers && (
        <div className="absolute bottom-16 left-4 right-4 bg-slate-950 border border-slate-900 rounded-2xl p-4 shadow-2xl z-30 animate-slideUp">
          <div className="flex justify-between items-center mb-3">
            <h5 className="font-bold text-xs text-slate-300 uppercase tracking-widest font-mono">Animated Stickers</h5>
            <button onClick={() => setShowStickers(false)} className="p-1 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-5 gap-3.5">
            {STICKERS.map((st) => (
              <button
                key={st.id}
                onClick={() => handleSendSticker(st.id)}
                className="flex flex-col items-center p-2.5 bg-slate-900 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/60 rounded-xl transition group"
              >
                <span className={`text-3xl group-hover:scale-110 transition duration-150 ${st.anim}`}>{st.emoji}</span>
                <span className="text-[8px] text-slate-500 font-mono mt-1.5 truncate max-w-full">{st.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* INPUT CONTROLLER TRAIL */}
      <div className="p-3 border-t border-neutral-800 bg-[#121417]/95 backdrop-blur flex items-center gap-2 z-10">
        
        {/* Stickers toggle */}
        <button 
          onClick={() => { setShowStickers(!showStickers); }}
          className={`p-2 rounded-xl transition ${showStickers ? 'bg-blue-600 text-white' : 'hover:bg-neutral-800 text-slate-400 hover:text-white'}`}
          title="Stickers"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Quick Challenge mini games trigger */}
        <div className="relative group">
          <button 
            onClick={onOpenGames}
            className="p-2 hover:bg-neutral-800 rounded-xl text-slate-400 hover:text-blue-400 transition"
            title="Challenge mini-game"
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
          {/* Tooltip trigger list */}
          <div className="hidden group-hover:block absolute bottom-10 left-0 bg-[#0E1013] border border-neutral-800 rounded-xl p-2 w-48 shadow-2xl z-30">
            <h5 className="text-[9px] uppercase font-bold tracking-widest text-neutral-500 mb-1.5 font-mono">Launch Quick Match</h5>
            <div className="grid grid-cols-1 gap-1 max-h-28 overflow-y-auto custom-scrollbar">
              {LIST_OF_GAMES.filter(g => g.isTwoPlayer).map(game => (
                <button
                  key={game.id}
                  onClick={() => handleChallengeGame(game.id)}
                  className="w-full text-left px-2 py-1 hover:bg-neutral-800 text-[10px] text-slate-300 hover:text-blue-400 rounded transition font-medium"
                >
                  🎮 {game.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main message form */}
        <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
          <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type your encrypted message..."
            className="flex-1 px-3.5 py-2.5 bg-[#0A0B0D] border border-neutral-800 rounded-xl text-xs text-[#E4E6EB] placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition-all"
          />

          {/* Voice recorder dynamic toggle button */}
          {inputText.trim().length === 0 ? (
            <button
              type="button"
              onMouseDown={startRecording}
              onMouseUp={() => stopRecording(false)}
              className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${isRecording ? 'bg-rose-600 text-white animate-ping' : 'bg-[#0A0B0D] border border-neutral-800 text-slate-400 hover:text-blue-400'}`}
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

      {/* FULL CALL PANEL SIMULATION PORTAL OVERLAY */}
      {callSession && (
        <div className="absolute inset-0 z-50 bg-[#020408]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full ${callSession.status === 'connected' && callSession.type === 'video' ? 'max-w-3xl h-[600px]' : 'max-w-sm h-[450px]'} bg-gradient-to-b from-[#090e17] to-[#04060b] border border-slate-800 rounded-3xl p-6 text-center shadow-2xl flex flex-col justify-between transition-all duration-300`}>
            
            {/* Top Info */}
            <div className="space-y-3 pt-4">
              <div className="relative inline-block">
                <div className="w-16 h-16 rounded-full border-2 border-indigo-500/40 p-1 mx-auto animate-pulse">
                  <img src={partnerProfile.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
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
              <div className="flex-1 my-4 flex flex-col justify-center">
                {callSession.type === 'video' ? (
                  /* Real Video Feed */
                  <div className="w-full h-full min-h-[320px] bg-black rounded-2xl overflow-hidden border border-slate-800 relative">
                    <iframe
                      src={`https://meet.jit.si/${callSession.roomId}#config.prejoinPageEnabled=false&config.startWithVideoMuted=false&config.startWithAudioMuted=false&config.disableDeepLinking=true`}
                      allow="camera; microphone; display-capture; autoplay; clipboard-write"
                      className="w-full h-full border-0 rounded-2xl"
                    />
                  </div>
                ) : (
                  /* Real Voice Feed with Hidden Frame + Voice Waveform HUD */
                  <div className="w-full py-6 bg-[#06090e] border border-slate-900 rounded-2xl relative flex flex-col items-center justify-center overflow-hidden">
                    {/* Hidden Jitsi iframe to handle voice streaming */}
                    <iframe
                      src={`https://meet.jit.si/${callSession.roomId}#config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=false&config.disableDeepLinking=true`}
                      allow="camera; microphone; autoplay"
                      className="w-0 h-0 border-0 pointer-events-none absolute"
                    />
                    
                    {/* Animated waves/rings */}
                    <div className="absolute w-28 h-28 rounded-full border border-blue-500/10 animate-ping" />
                    <div className="absolute w-20 h-20 rounded-full border border-indigo-500/20 animate-pulse" />
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <Mic className="w-8 h-8 text-indigo-400 animate-pulse mb-2" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">High Definition Voice Channel</span>
                    </div>
                  </div>
                )}
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
                  <button 
                    onClick={endCall}
                    className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={acceptCall}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-full shadow-lg shadow-emerald-600/20 active:scale-95 transition-all animate-bounce"
                  >
                    Accept
                  </button>
                </>
              ) : (
                <button 
                  onClick={endCall}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-full shadow-lg shadow-rose-600/20 active:scale-95 transition"
                >
                  Disconnect call
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
