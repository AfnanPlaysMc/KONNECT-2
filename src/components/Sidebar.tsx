import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Settings as SettingsIcon, Film, Gamepad2, QrCode, 
  LogOut, UserPlus, Check, X, Bell, Moon, Sun, ShieldAlert, BadgeHelp, CheckCheck
} from 'lucide-react';
import { 
  collection, query, where, getDocs, doc, setDoc, onSnapshot, 
  getDoc, addDoc, updateDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface SidebarProps {
  profile: UserProfile;
  activeChatId: string | null;
  onSelectChat: (chatId: string, partnerProfile: UserProfile) => void;
  onOpenSettings: () => void;
  onOpenStories: () => void;
  onOpenGames: () => void;
}

export default function Sidebar({ 
  profile, activeChatId, onSelectChat, onOpenSettings, onOpenStories, onOpenGames 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<{ id: string; partner: UserProfile; lastMessage?: any; unread?: number }[]>([]);
  
  // Add Friend Modal
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);

  // QR Modal
  const [showQR, setShowQR] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [qrMessage, setQrMessage] = useState('');

  // Read active chats in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', profile.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatsList: any[] = [];
      
      for (const chatDoc of snapshot.docs) {
        const chatData = chatDoc.data();
        const partnerId = chatData.participants.find((p: string) => p !== profile.uid);
        
        if (!partnerId) continue;

        // Fetch partner profile
        try {
          const partnerSnap = await getDoc(doc(db, 'profiles', partnerId));
          if (partnerSnap.exists()) {
            const partnerProfile = partnerSnap.data() as UserProfile;
            
            // If we are blocked, or we have blocked them, do not show the chat or hide visibility appropriately
            const isBlockedByPartner = partnerProfile.blockedUsers?.includes(profile.uid);
            const iHaveBlockedPartner = profile.blockedUsers?.includes(partnerId);
            
            // If blocked, we cannot see their active profile, status or stories anymore!
            // Let's hide pfp, name, bio, etc., or show placeholder if blocked
            const sanitizedPartner = isBlockedByPartner || iHaveBlockedPartner ? {
              ...partnerProfile,
              displayName: 'Blocked Account',
              username: 'blocked',
              photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80',
              bannerURL: '',
              bio: 'Profile unavailable',
              status: 'offline' as const
            } : partnerProfile;

            // Fetch unread count & last message from subcollection of messages
            chatsList.push({
              id: chatDoc.id,
              partner: sanitizedPartner,
              lastMessage: chatData.lastMessage || null,
              unread: chatData.unreadCount?.[profile.uid] || 0
            });
          }
        } catch (e) {
          console.error('Error fetching partner profile:', e);
        }
      }

      setChats(chatsList);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddMessage('');
    setLoadingAdd(true);

    const targetUsername = friendUsername.trim().toLowerCase().replace('@', '');
    if (targetUsername === profile.username) {
      setAddError('You cannot add yourself.');
      setLoadingAdd(false);
      return;
    }

    try {
      // Find user by username
      const q = query(collection(db, 'profiles'), where('username', '==', targetUsername));
      const qSnap = await getDocs(q);
      
      if (qSnap.empty) {
        throw new Error('User not found. Check spelling.');
      }

      let targetUser: UserProfile | null = null;
      qSnap.forEach((d) => {
        targetUser = d.data() as UserProfile;
      });

      if (!targetUser) throw new Error('Failed to resolve user.');

      // Check if they blocked us
      if (targetUser.blockedUsers?.includes(profile.uid)) {
        throw new Error('This user cannot be added as a friend.');
      }

      const tUser = targetUser as UserProfile;

      // Check if chat already exists
      const existingChatQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', profile.uid)
      );
      const chatsSnap = await getDocs(existingChatQuery);
      let chatExists = false;
      let existingChatId = '';

      chatsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(tUser.uid)) {
          chatExists = true;
          existingChatId = doc.id;
        }
      });

      if (chatExists) {
        setAddMessage('Friendship already established! Chat loaded.');
        onSelectChat(existingChatId, tUser);
        setTimeout(() => setShowAddFriend(false), 1500);
        return;
      }

      // Create new chat
      const chatRef = doc(collection(db, 'chats'));
      await setDoc(chatRef, {
        participants: [profile.uid, tUser.uid],
        lastMessage: {
          text: `Established friendship with @${profile.username}`,
          timestamp: new Date(),
          senderId: profile.uid
        },
        unreadCount: {
          [profile.uid]: 0,
          [tUser.uid]: 0
        }
      });

      // Add a greeting message inside the chat
      await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
        senderId: profile.uid,
        receiverId: tUser.uid,
        text: `Hey there! Let's Konnect.`,
        timestamp: new Date(),
        type: 'text',
        read: false
      });

      setAddMessage(`Friend @${tUser.username} added successfully!`);
      onSelectChat(chatRef.id, tUser);
      setFriendUsername('');
      setTimeout(() => setShowAddFriend(false), 1500);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add friend');
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleQRScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQrMessage('');
    const input = qrCodeInput.trim();
    if (!input) return;

    if (input.startsWith('konnect://profile/')) {
      const uid = input.replace('konnect://profile/', '');
      try {
        const docSnap = await getDoc(doc(db, 'profiles', uid));
        if (docSnap.exists()) {
          const uProf = docSnap.data() as UserProfile;
          setFriendUsername(uProf.username);
          setShowQR(false);
          setShowAddFriend(true);
        } else {
          setQrMessage('QR Code expired or invalid user profile.');
        }
      } catch (err) {
        setQrMessage('Error scanning QR.');
      }
    } else {
      setQrMessage('Invalid QR string. Paste a valid Konnect code.');
    }
  };

  // Filter chats by search query
  const filteredChats = chats.filter(c => 
    c.partner.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partner.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-neutral-800 bg-[#0E1013] flex flex-col h-full text-slate-100 select-none flex-shrink-0">
      
      {/* USER PROFILE CARD HEADER */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={profile.photoURL} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-800" />
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0c1017] ${profile.stealthMode ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-200 line-clamp-1">{profile.displayName}</h3>
            <p className="text-[10px] font-mono text-slate-500">@{profile.username}</p>
          </div>
        </div>

        <div className="flex gap-1">
          <button 
            onClick={() => setShowQR(true)}
            title="My QR Code"
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button 
            onClick={onOpenSettings}
            title="Settings"
            className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK LAUNCH TOOLS */}
      <div className="p-3 border-b border-slate-900 bg-slate-950/20 grid grid-cols-3 gap-2">
        <button 
          onClick={onOpenStories}
          className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 transition group"
        >
          <Film className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Stories</span>
        </button>

        <button 
          onClick={onOpenGames}
          className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 transition group"
        >
          <Gamepad2 className="w-4 h-4 text-fuchsia-400 group-hover:scale-110 transition animate-bounce" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Games</span>
        </button>

        <button 
          onClick={() => setShowAddFriend(true)}
          className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-slate-900/30 border border-slate-900 hover:border-slate-800 hover:bg-slate-900/50 transition group"
        >
          <UserPlus className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Add Friend</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search channels, aliases..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
          />
        </div>
      </div>

      {/* CHATS LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <h4 className="px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">Conversations</h4>
        
        {filteredChats.length === 0 ? (
          <div className="text-center py-10 text-slate-600 px-4">
            <span className="block text-2xl mb-1">💬</span>
            <p className="text-[10px]">No chats found. Add friends using their handle username or scan their QR code to begin.</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChatId === chat.id;
            const lastMsgText = chat.lastMessage?.text || 'No messages';
            const lastMsgTime = chat.lastMessage?.timestamp
              ? new Date(chat.lastMessage.timestamp.toDate ? chat.lastMessage.timestamp.toDate() : chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const isOnline = chat.partner.status === 'online' && !chat.partner.stealthMode;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id, chat.partner)}
                className={`flex items-center justify-between p-3.5 border-b border-slate-900/40 cursor-pointer transition relative ${isActive ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500' : 'hover:bg-slate-900/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img src={chat.partner.photoURL} alt={chat.partner.displayName} className="w-10 h-10 rounded-full object-cover border border-slate-800" />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-[#0c1017] ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-200">{chat.partner.displayName}</h5>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 max-w-[150px]">{lastMsgText}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[9px] text-slate-500 font-mono">{lastMsgTime}</span>
                  {chat.unread > 0 && (
                    <span className="w-4 h-4 bg-indigo-600 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LOGOUT TRAIL */}
      <div className="p-3.5 border-t border-neutral-800 bg-[#0E1013] flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span>Konnect Premium v2.4</span>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-1 hover:text-rose-400 transition font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
        <div className="text-[9px] text-neutral-600 font-bold tracking-widest text-center uppercase border-t border-neutral-800/40 pt-2.5 font-mono">
          KONNECT BY OXA LLC
        </div>
      </div>

      {/* MODAL: ADD FRIEND via Username */}
      {showAddFriend && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0c1017] border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-xs text-white">Add friend by handle</h4>
              <button onClick={() => setShowAddFriend(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400"><X className="w-4 h-4" /></button>
            </div>

            {addError && (
              <div className="mb-3 p-2 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-[10px]">
                {addError}
              </div>
            )}

            {addMessage && (
              <div className="mb-3 p-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-[10px] flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> {addMessage}
              </div>
            )}

            <form onSubmit={handleAddFriend} className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Handle username</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 text-xs font-mono">@</span>
                  <input 
                    type="text" 
                    required
                    value={friendUsername}
                    onChange={e => setFriendUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="john_doe"
                    className="w-full pl-6 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loadingAdd}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition"
              >
                {loadingAdd ? 'Initiating contact...' : 'Form Friendship'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR SYSTEM */}
      {showQR && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0c1017] border border-slate-800 rounded-2xl p-5 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-4 text-left">
              <h4 className="font-bold text-xs text-white">QR Quick Profile Scan</h4>
              <button onClick={() => setShowQR(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400"><X className="w-4 h-4" /></button>
            </div>

            {/* QR display card */}
            <div className="bg-white p-4 rounded-xl inline-block mb-3.5 shadow">
              {/* Simulated crisp vector QR code of user profile */}
              <svg className="w-36 h-36 mx-auto" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="white"/>
                {/* QR corners */}
                <rect x="5" y="5" width="25" height="25" fill="black"/>
                <rect x="8" y="8" width="19" height="19" fill="white"/>
                <rect x="11" y="11" width="13" height="13" fill="black"/>

                <rect x="70" y="5" width="25" height="25" fill="black"/>
                <rect x="73" y="8" width="19" height="19" fill="white"/>
                <rect x="76" y="11" width="13" height="13" fill="black"/>

                <rect x="5" y="70" width="25" height="25" fill="black"/>
                <rect x="8" y="73" width="19" height="19" fill="white"/>
                <rect x="11" y="76" width="13" height="13" fill="black"/>
                
                {/* Random QR bits for profile code UID */}
                <rect x="35" y="10" width="10" height="5" fill="black"/>
                <rect x="50" y="5" width="5" height="15" fill="black"/>
                <rect x="60" y="15" width="10" height="10" fill="black"/>
                <rect x="35" y="40" width="30" height="20" fill="black"/>
                <rect x="10" y="45" width="15" height="10" fill="black"/>
                <rect x="45" y="75" width="20" height="10" fill="black"/>
                <rect x="75" y="45" width="10" height="25" fill="black"/>
                <rect x="85" y="80" width="10" height="10" fill="black"/>
              </svg>
            </div>

            <p className="text-[10px] text-slate-400 mb-4 font-mono">
              Share link code:<br/>
              <span className="text-indigo-400">konnect://profile/{profile.uid}</span>
            </p>

            {/* Simulated scan code input */}
            <div className="border-t border-slate-900 pt-3">
              <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1.5 text-left">Scan / Enter friend profile code</label>
              
              {qrMessage && (
                <div className="mb-2 p-1.5 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-[9px]">
                  {qrMessage}
                </div>
              )}

              <form onSubmit={handleQRScanSubmit} className="flex gap-2">
                <input 
                  type="text" 
                  value={qrCodeInput}
                  onChange={e => setQrCodeInput(e.target.value)}
                  placeholder="Paste code (e.g. konnect://profile/...)"
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-white focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-3 rounded-lg text-[10px] text-white font-semibold">Connect</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
