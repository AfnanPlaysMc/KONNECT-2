import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Settings as SettingsIcon, Film, Trophy, QrCode, 
  LogOut, UserPlus, Check, X, Bell, Moon, Sun, ShieldAlert, BadgeHelp, CheckCheck, Menu, Contact
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { VerifiedBadge } from './VerifiedBadge';
import { 
  collection, query, where, getDocs, doc, setDoc, onSnapshot, 
  getDoc, addDoc, updateDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { UserProfile, THEMES } from '../types';

// @ts-ignore
import orionAiLogo from '../assets/images/orion_ai_logo_1782673841547.jpg';
// @ts-ignore
import oxaLlcLogo from '../assets/images/oxa_llc_logo_1782673859506.jpg';

const getBotPhotoURL = (uid: string, url: string | undefined): string => {
  if (uid === 'orion-ai') return orionAiLogo;
  if (uid === 'oxa-llc') return oxaLlcLogo;
  return url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
};

interface SidebarProps {
  profile: UserProfile;
  activeChatId: string | null;
  onSelectChat: (chatId: string, partnerProfile: UserProfile) => void;
  onOpenSettings: () => void;
  onOpenContacts: () => void;
  onOpenStories: () => void;
  onOpenSports: () => void;
  onOpenMobileMenu?: () => void;
  onOpenChatWithFriend?: (friendUid: string) => void;
}

const getAnimatedEmojiUrl = (emoji: string) => {
  const codePoints = Array.from(emoji)
    .map(char => char.codePointAt(0)?.toString(16))
    .filter(hex => hex && hex !== 'fe0f');
  const hexStr = codePoints.join('_');
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${hexStr}/512.webp`;
};

const renderMessageTextWithEmojis = (text: string) => {
  if (!text) return '';
  const EMOJI_REGEX = /(\p{Emoji_Presentation})/gu;
  const parts = text.split(EMOJI_REGEX);
  if (parts.length === 1) {
    return text;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5 align-middle">
      {parts.map((part, i) => {
        if (part && part.match(/\p{Emoji_Presentation}/u)) {
          return (
            <span key={i} className="relative inline-flex items-center align-middle" style={{ contentVisibility: 'auto' }}>
              {/* Hidden text representation so standard browser selections capture the actual emoji char */}
              <span className="absolute opacity-0 pointer-events-none select-text" style={{ fontSize: '0.1px', width: '1px', height: '1px', overflow: 'hidden' }}>{part}</span>
              <img 
                src={getAnimatedEmojiUrl(part)} 
                alt={part} 
                draggable="false"
                className="w-4 h-4 object-contain inline-block align-middle select-none"
                onError={(evt) => {
                  (evt.target as HTMLElement).style.display = 'none';
                  const parent = (evt.target as HTMLElement).parentElement;
                  if (parent && !parent.querySelector(`.fallback-sidebar-emoji-${i}`)) {
                    const span = document.createElement('span');
                    span.className = `text-[11px] fallback-sidebar-emoji-${i} align-middle`;
                    span.innerText = part;
                    parent.insertBefore(span, evt.target as HTMLElement);
                  }
                }}
                referrerPolicy="no-referrer"
              />
            </span>
          );
        }
        return <span key={i} className="align-middle">{part}</span>;
      })}
    </span>
  );
};

export default function Sidebar({ 
  profile, activeChatId, onSelectChat, onOpenSettings, onOpenContacts, onOpenStories, onOpenSports, onOpenMobileMenu, onOpenChatWithFriend 
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<{ id: string; partner: UserProfile; lastMessage?: any; unread?: number }[]>([]);
  const [realtimeProfiles, setRealtimeProfiles] = useState<Record<string, UserProfile>>({});
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  
  // Add Friend Modal
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [addMessage, setAddMessage] = useState('');
  const [addError, setAddError] = useState('');
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [searchedUser, setSearchedUser] = useState<UserProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);

  // Group creation states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [loadingCreateGroup, setLoadingCreateGroup] = useState(false);

  // Sync profiles collection in real-time
  useEffect(() => {
    const q = query(collection(db, 'profiles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profilesMap: Record<string, UserProfile> = {};
      snapshot.forEach((docSnap) => {
        profilesMap[docSnap.id] = docSnap.data() as UserProfile;
      });
      setRealtimeProfiles(profilesMap);
    }, (error) => {
      console.warn("Profiles real-time subscription handled error:", error);
    });
    return () => unsubscribe();
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const res = await Notification.requestPermission();
      setPermissionStatus(res);
    }
  };

  // Read incoming friend requests
  useEffect(() => {
    const q = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', profile.uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data(), id: doc.id });
      });
      setIncomingRequests(list);
    }, (error) => {
      console.warn("Friend requests onSnapshot handled error:", error);
    });
    return () => unsubscribe();
  }, [profile.uid]);

  const handleAcceptRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, 'friendRequests', req.id), { status: 'accepted' });
      
      const chatRef = doc(collection(db, 'chats'));
      await setDoc(chatRef, {
        participants: [req.fromUid, profile.uid],
        lastMessage: {
          text: `Established friendship with @${req.fromUsername}`,
          timestamp: new Date(),
          senderId: req.fromUid
        },
        unreadCount: {
          [req.fromUid]: 0,
          [profile.uid]: 0
        }
      });

      await addDoc(collection(db, 'chats', chatRef.id, 'messages'), {
        senderId: req.fromUid,
        receiverId: profile.uid,
        text: `Hey there! Let's Konnect.`,
        timestamp: new Date(),
        type: 'text',
        read: false
      });
    } catch (e) {
      console.error('Error accepting friend request:', e);
    }
  };

  const handleDenyRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, 'friendRequests', req.id), { status: 'denied' });
    } catch (e) {
      console.error('Error denying friend request:', e);
    }
  };

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
        
        if (chatData.isGroup) {
          // This is a group chat! No partner lookups required since group fields are self-contained.
          chatsList.push({
            id: chatDoc.id,
            isGroup: true,
            groupName: chatData.groupName,
            groupPhotoURL: chatData.groupPhotoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(chatData.groupName)}`,
            groupDescription: chatData.groupDescription || '',
            admins: chatData.admins || [],
            createdBy: chatData.createdBy || '',
            participants: chatData.participants || [],
            partner: {
              uid: chatDoc.id,
              isGroup: true,
              displayName: chatData.groupName,
              username: `group_${chatDoc.id.slice(0, 6)}`,
              photoURL: chatData.groupPhotoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(chatData.groupName)}`,
              bio: chatData.groupDescription || 'Group Space',
              blockedUsers: [],
              closeFriends: [],
              customList: [],
              theme: 'midnight-blue',
              stealthMode: false,
              readReceipts: true,
              notificationSounds: {},
              status: 'offline'
            },
            lastMessage: chatData.lastMessage || null,
            unread: chatData.unreadCount?.[profile.uid] || 0
          });
          continue;
        }

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

      // Load local Orion AI chat
      const localChatKey = `konnect_local_chat_orion-ai_${profile.uid}`;
      const storedLocalOrion = localStorage.getItem(localChatKey);
      let localOrionChat: any = null;
      if (storedLocalOrion) {
        try {
          const parsed = JSON.parse(storedLocalOrion);
          localOrionChat = {
            id: parsed.id || `orion-ai-chat-${profile.uid}`,
            partner: {
              uid: 'orion-ai',
              displayName: 'Orion AI',
              username: 'orion_ai',
              photoURL: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150',
              bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
              status: 'online',
              theme: 'deep-dark'
            },
            lastMessage: parsed.lastMessage ? {
              ...parsed.lastMessage,
              timestamp: parsed.lastMessage.timestamp ? new Date(parsed.lastMessage.timestamp) : new Date()
            } : null,
            unread: parsed.unreadCount?.[profile.uid] || 0
          };
        } catch (e) {
          console.error(e);
        }
      }

      if (!localOrionChat) {
        localOrionChat = {
          id: `orion-ai-chat-${profile.uid}`,
          partner: {
            uid: 'orion-ai',
            displayName: 'Orion AI',
            username: 'orion_ai',
            photoURL: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150',
            bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
            status: 'online',
            theme: 'deep-dark'
          },
          lastMessage: {
            text: "Hello! I am Orion AI, your E2EE intelligent assistant. Type any secure query or prompt and I will decode it right away.",
            timestamp: new Date(),
            senderId: 'orion-ai'
          },
          unread: 0
        };
      }

      const getTimestampValue = (chat: any) => {
        const ts = chat.lastMessage?.timestamp;
        if (!ts) return 0;
        if (typeof ts.toDate === 'function') {
          return ts.toDate().getTime();
        }
        if (ts instanceof Date) {
          return ts.getTime();
        }
        if (typeof ts === 'string') {
          return new Date(ts).getTime();
        }
        if (typeof ts === 'number') {
          return ts;
        }
        if (ts && ts.seconds) {
          return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
        }
        return 0;
      };

      const filteredChats = chatsList.filter((c) => c.partner.uid !== 'orion-ai');
      const allChats = [localOrionChat, ...filteredChats];
      
      // Sort chats so that the most recently used (latest message timestamp) is on top
      allChats.sort((a, b) => getTimestampValue(b) - getTimestampValue(a));

      setChats(allChats);
    }, (error) => {
      console.warn("Chats onSnapshot handled error:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddMessage('');
    setSearchedUser(null);
    setLoadingAdd(true);

    const targetUsername = friendUsername.trim().toLowerCase().replace('@', '');
    if (targetUsername === profile.username) {
      setAddError('You cannot add yourself.');
      setLoadingAdd(false);
      return;
    }

    try {
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

      if (targetUser.blockedUsers?.includes(profile.uid) || profile.blockedUsers?.includes(targetUser.uid)) {
        throw new Error('This user cannot be added as a friend.');
      }

      setSearchedUser(targetUser);
    } catch (err: any) {
      setAddError(err.message || 'Failed to search user');
    } finally {
      setLoadingAdd(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!searchedUser) return;
    setLoadingAdd(true);
    setAddError('');
    setAddMessage('');

    try {
      // Check if chat already exists
      const existingChatQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', profile.uid)
      );
      const chatsSnap = await getDocs(existingChatQuery);
      let chatExists = false;
      chatsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.participants.includes(searchedUser.uid)) {
          chatExists = true;
        }
      });

      if (chatExists) {
        throw new Error('You are already friends with this user!');
      }

      const requestRef = doc(db, 'friendRequests', `${profile.uid}_${searchedUser.uid}`);
      await setDoc(requestRef, {
        id: `${profile.uid}_${searchedUser.uid}`,
        fromUid: profile.uid,
        fromUsername: profile.username,
        fromDisplayName: profile.displayName,
        fromPhotoURL: profile.photoURL,
        toUid: searchedUser.uid,
        status: 'pending',
        timestamp: new Date()
      });

      setAddMessage(`Friend request sent to @${searchedUser.username}!`);
      setSearchedUser(null);
      setFriendUsername('');
      setTimeout(() => setShowAddFriend(false), 2000);
    } catch (err: any) {
      setAddError(err.message || 'Failed to send friend request');
    } finally {
      setLoadingAdd(false);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const gName = newGroupName.trim();
    if (!gName) return;

    setLoadingCreateGroup(true);
    try {
      const newChatRef = doc(collection(db, 'chats'));
      const groupData = {
        isGroup: true,
        groupName: gName,
        groupDescription: newGroupDesc.trim() || 'A standard group chat space',
        groupPhotoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(gName)}`,
        createdBy: profile.uid,
        admins: [profile.uid],
        participants: [profile.uid, ...selectedFriendsForGroup],
        noAdminMode: false,
        createdAt: new Date(),
        lastMessage: {
          text: `Group "${gName}" was created. Welcome everyone!`,
          senderId: profile.uid,
          timestamp: new Date()
        },
        unreadCount: {
          [profile.uid]: 0
        }
      } as any;

      // Also set unread count for other participants
      selectedFriendsForGroup.forEach(uid => {
        groupData.unreadCount[uid] = 1;
      });

      await setDoc(newChatRef, groupData);

      // Add a message record to subcollection
      const messageRef = doc(collection(db, `chats/${newChatRef.id}/messages`));
      await setDoc(messageRef, {
        id: messageRef.id,
        senderId: profile.uid,
        receiverId: newChatRef.id,
        text: `Group "${gName}" was created. Welcome everyone!`,
        timestamp: new Date(),
        type: 'text',
        read: false
      });

      // Reset form
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedFriendsForGroup([]);
      setShowCreateGroup(false);

      // Select the new group chat
      onSelectChat(newChatRef.id, {
        uid: newChatRef.id,
        isGroup: true,
        displayName: gName,
        username: `group_${newChatRef.id.slice(0, 6)}`,
        photoURL: groupData.groupPhotoURL,
        bio: groupData.groupDescription,
        blockedUsers: [],
        closeFriends: [],
        customList: [],
        theme: 'midnight-blue',
        stealthMode: false,
        readReceipts: true,
        notificationSounds: {},
        status: 'offline'
      });
    } catch (err) {
      console.error('Error creating group:', err);
    } finally {
      setLoadingCreateGroup(false);
    }
  };

  // Map chats with real-time profile data
  const mappedChats = chats.map(c => {
    const partnerProfile = realtimeProfiles[c.partner.uid] || c.partner;
    const isBot = partnerProfile.uid === 'orion-ai' || partnerProfile.uid === 'oxa-llc';
    const isOnline = isBot || (partnerProfile.status === 'online' && !partnerProfile.stealthMode);
    
    return {
      ...c,
      partner: {
        ...partnerProfile,
        status: (isOnline ? 'online' : 'offline') as 'online' | 'offline'
      }
    };
  });

  // Filter chats by search query
  const filteredChats = mappedChats.filter(c => 
    c.partner.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partner.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // List of standard friends you can add to a group
  const availableFriends = (Object.values(realtimeProfiles) as UserProfile[]).filter(p => 
    p.uid !== profile.uid && 
    p.uid !== 'orion-ai' && 
    p.uid !== 'oxa-llc'
  );

  const activeThemeObj = THEMES.find(t => t.id === (profile.theme || 'deep-dark')) || THEMES[0];
  const isLight = activeThemeObj.id === 'blue-white';

  const themeClasses = {
    wrapper: `w-full sm:w-80 border-r ${activeThemeObj.border} ${activeThemeObj.card} flex flex-col h-full ${activeThemeObj.text} select-none flex-shrink-0 ${activeChatId ? 'hidden sm:flex' : 'flex'}`,
    header: `p-4 border-b ${activeThemeObj.border} bg-black/5 flex items-center justify-between`,
    headerText: `font-bold text-sm ${isLight ? 'text-slate-800' : 'text-slate-200'} line-clamp-1`,
    usernameText: `text-[10px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`,
    iconBtn: `p-1.5 hover:bg-black/10 dark:hover:bg-white/5 rounded-lg transition`,
    inputBg: `w-full pl-9 pr-4 py-2 bg-black/5 dark:bg-white/5 border ${activeThemeObj.border} rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono`,
    quickLaunch: `p-3 border-b ${activeThemeObj.border} bg-black/5 grid grid-cols-2 gap-2`,
    quickBtn: `flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border ${activeThemeObj.border} hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition group`,
    quickText: `text-[9px] font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`,
    conversationsTitle: `px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`,
    chatItem: (isActive: boolean) => {
      if (isActive) {
        return isLight 
          ? `bg-blue-500/10 border-l-2 border-l-blue-600 border-b border-slate-100` 
          : `bg-indigo-600/10 border-l-2 border-l-indigo-500 border-b border-white/5`;
      }
      return `hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/[0.03] dark:border-white/[0.03]`;
    },
    chatPartnerName: `font-bold text-xs flex items-center gap-0.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`,
    chatLastMsg: `text-[10px] line-clamp-1 mt-0.5 max-w-[150px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`,
    chatTime: `text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  };

  return (
    <div className={themeClasses.wrapper}>
      
      {/* USER PROFILE CARD HEADER */}
      <div className={`${themeClasses.header} flex items-center justify-between p-3 gap-2`}>
        <div className="flex items-center min-w-0 flex-1">
          {/* Hamburger Menu icon for mobile */}
          <button 
            onClick={onOpenMobileMenu}
            className="sm:hidden p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center flex-shrink-0 mr-1"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 text-slate-400" />
          </button>

          {/* APP LOGO */}
          <div className="p-1.5 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <AppLogo className="w-5 h-5 text-white" />
          </div>

          {/* VERTICAL SEPARATOR LINE */}
          <div className={`h-8 w-[1px] ${isLight ? 'bg-slate-200' : 'bg-white/10'} mx-3 flex-shrink-0`} />

          {/* USER AVATAR */}
          <div className="relative flex-shrink-0 mr-2.5">
            <img src={profile.photoURL} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-slate-300" />
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${profile.stealthMode ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          </div>

          {/* USER DETAILS & SETTINGS COG & CONTACT ICON */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h3 className={`${themeClasses.headerText} leading-tight font-bold text-xs truncate`}>{profile.displayName}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`${themeClasses.usernameText} truncate text-[10px]`}>@{profile.username}</span>
              <button 
                onClick={onOpenSettings}
                title="Settings"
                className="text-slate-400 hover:text-indigo-400 transition p-0.5 rounded flex items-center justify-center flex-shrink-0"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={onOpenContacts}
                title="Google Contacts Sync & Invite"
                className="text-blue-500 hover:text-blue-400 transition p-0.5 rounded flex items-center justify-center flex-shrink-0"
              >
                <Contact className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK LAUNCH TOOLS */}
      <div className={themeClasses.quickLaunch}>
        <button 
          onClick={onOpenStories}
          className={themeClasses.quickBtn}
        >
          <Film className="w-4 h-4 text-blue-500 group-hover:scale-110 transition" />
          <span className={themeClasses.quickText}>Stories</span>
        </button>

        <button 
          onClick={() => setShowAddFriend(true)}
          className={themeClasses.quickBtn}
        >
          <UserPlus className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition" />
          <span className={themeClasses.quickText}>Add Friend</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search channels, aliases..."
            className={themeClasses.inputBg}
          />
        </div>
      </div>

      {/* CHATS LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* INCOMING FRIEND REQUESTS */}
        {incomingRequests.length > 0 && (
          <div className="px-3 mb-4">
            <h4 className="px-1 py-1.5 text-[9px] uppercase font-bold tracking-widest text-blue-500 font-mono flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> Friend Requests ({incomingRequests.length})
            </h4>
            <div className="space-y-2">
              {incomingRequests.map((req) => (
                <div key={req.id} className="p-2.5 bg-blue-500/5 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <img src={req.fromPhotoURL} alt={req.fromUsername} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-800 line-clamp-1">{req.fromDisplayName}</p>
                      <p className="text-[9px] text-slate-400 font-mono">@{req.fromUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleAcceptRequest(req)}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition active:scale-95"
                      title="Accept Request"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDenyRequest(req)}
                      className="p-1 bg-rose-600 hover:bg-rose-500 rounded-lg text-white transition active:scale-95"
                      title="Deny Request"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ONLINE USER INDICATOR */}
        {(() => {
          const onlineUsers = (Object.values(realtimeProfiles) as UserProfile[]).filter(u => {
            if (u.uid === profile.uid || u.uid === 'orion-ai' || u.uid === 'oxa-llc') return false;
            if (u.status !== 'online' || u.stealthMode) return false;
            
            // Real-time heartbeat: must have been active within last 3 minutes (180,000ms)
            if (u.lastSeen) {
              try {
                const lastSeenDate = u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen);
                return (Date.now() - lastSeenDate.getTime()) < 180000;
              } catch (e) {
                return false;
              }
            }
            return false;
          });
          if (onlineUsers.length === 0) return null;
          return (
            <div className={`px-4 py-3.5 border-b ${isLight ? 'border-slate-100' : 'border-white/5'} mb-2`}>
              <h4 className={`text-[9px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'} mb-2.5 font-mono flex items-center gap-1.5`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                Online Users ({onlineUsers.length})
              </h4>
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
                {onlineUsers.map((user) => {
                  const existingChat = chats.find(c => c.partner.uid === user.uid);
                  return (
                    <div 
                      key={user.uid} 
                      onClick={() => {
                        if (existingChat) {
                          onSelectChat(existingChat.id, existingChat.partner);
                        } else if (onOpenChatWithFriend) {
                          onOpenChatWithFriend(user.uid);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                      title={`Chat with ${user.displayName}`}
                    >
                      <div className="relative">
                        <img 
                          src={getBotPhotoURL(user.uid, user.photoURL)} 
                          alt={user.displayName} 
                          className={`w-9.5 h-9.5 rounded-full object-cover border-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`} 
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0c1017]" />
                      </div>
                      <span className={`text-[8.5px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-300'} font-sans max-w-[50px] truncate`}>
                        {user.displayName.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {(() => {
          const officialsChats = filteredChats.filter(c => c.partner.uid === 'orion-ai' || c.partner.uid === 'oxa-llc');
          const groupsChats = filteredChats.filter(c => c.isGroup === true);
          const normalChats = filteredChats.filter(c => !c.isGroup && c.partner.uid !== 'orion-ai' && c.partner.uid !== 'oxa-llc');

          const renderChatItem = (chat: any) => {
            const isActive = activeChatId === chat.id;
            const lastMsgText = chat.lastMessage?.text || 'No messages';
            let lastMsgTime = '';
            if (chat.lastMessage?.timestamp) {
              try {
                const ts = chat.lastMessage.timestamp;
                const date = ts.toDate ? ts.toDate() : new Date(ts);
                lastMsgTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } catch (e) {
                console.warn(e);
              }
            }
            const isBot = chat.partner.uid === 'orion-ai' || chat.partner.uid === 'oxa-llc';
            const isOnline = !chat.isGroup && (isBot || (chat.partner.status === 'online' && !chat.partner.stealthMode));

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id, chat.partner)}
                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition relative rounded-xl mx-2 my-0.5 ${
                  isActive 
                    ? (isLight ? 'bg-indigo-50 text-indigo-950 font-semibold' : 'bg-white/5 text-white font-semibold') 
                    : (isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/[0.02] text-slate-300')
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={getBotPhotoURL(chat.partner.uid, chat.partner.photoURL)} 
                      alt={chat.partner.displayName} 
                      className={`w-9 h-9 rounded-full object-cover border ${isLight ? 'border-slate-200' : 'border-slate-800'}`} 
                      referrerPolicy="no-referrer"
                    />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h5 className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'} flex items-center gap-1.5 truncate`}>
                      {chat.partner.displayName}
                      {(chat.partner.uid === 'orion-ai' || chat.partner.uid === 'oxa-llc') && (
                        <VerifiedBadge className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                    </h5>
                    <p className={`text-[10px] ${isActive ? (isLight ? 'text-indigo-600' : 'text-indigo-400') : 'text-slate-500'} w-full truncate mt-0.5`}>
                      {renderMessageTextWithEmojis(lastMsgText)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[9px] font-mono ${isActive ? (isLight ? 'text-indigo-600' : 'text-indigo-400') : 'text-slate-500'}`}>{lastMsgTime}</span>
                  {chat.unread > 0 && (
                    <span className="h-4 min-w-[16px] px-1 bg-indigo-600 text-[9px] font-mono font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-4">
              {/* CATEGORY: OFFICIALS */}
              {officialsChats.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between px-4 mt-3 mb-1 select-none">
                    <span className={`text-[9px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'} font-mono`}>Officials</span>
                  </div>
                  {officialsChats.map(chat => renderChatItem(chat))}
                </div>
              )}

              {/* CATEGORY: CHATS */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between px-4 mt-3 mb-1 select-none">
                  <span className={`text-[9px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'} font-mono`}>Chats</span>
                  <button 
                    onClick={() => setShowAddFriend(true)}
                    className={`p-1 ${isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/5 text-slate-400'} rounded-lg hover:text-white transition active:scale-95`}
                    title="Add Friend / New Chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {normalChats.length === 0 ? (
                  <div className="px-4 py-2 text-center text-slate-500 text-[9px] italic font-mono">
                    No normal chats. Click + to add friend.
                  </div>
                ) : (
                  normalChats.map(chat => renderChatItem(chat))
                )}
              </div>

              {/* CATEGORY: GROUPS */}
              <div className="space-y-0.5 pb-6">
                <div className="flex items-center justify-between px-4 mt-3 mb-1 select-none">
                  <span className={`text-[9px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'} font-mono`}>Groups</span>
                  <button 
                    onClick={() => setShowCreateGroup(true)}
                    className={`p-1 ${isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/5 text-slate-400'} rounded-lg hover:text-white transition active:scale-95`}
                    title="Create Group"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {groupsChats.length === 0 ? (
                  <div className="px-4 py-2 text-center text-slate-500 text-[9px] italic font-mono">
                    No groups joined. Click + to create.
                  </div>
                ) : (
                  groupsChats.map(chat => renderChatItem(chat))
                )}
              </div>
            </div>
          );
        })()}
      </div>



      {/* LOGOUT TRAIL */}
      <div className={`p-3.5 border-t ${activeThemeObj.border} bg-black/5 flex flex-col gap-2`}>
        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <div className="flex items-center gap-1">
            <AppLogo className="w-4 h-4" />
            <span>Konnect Beta 2026</span>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-1 hover:text-rose-400 transition font-bold"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
        <div className={`text-[9px] ${isLight ? 'text-slate-400 border-slate-100' : 'text-neutral-600 border-white/5'} font-bold tracking-widest text-center uppercase border-t pt-2.5 font-mono`}>
          DEVELOPED BY OXA LLC • AFNAN WAZIR
        </div>
      </div>

      {/* MODAL: ADD FRIEND via Username */}
      {showAddFriend && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0c1017] border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-xs text-white">Add friend by handle</h4>
              <button 
                onClick={() => {
                  setShowAddFriend(false);
                  setSearchedUser(null);
                  setAddError('');
                  setAddMessage('');
                }} 
                className="p-1 hover:bg-slate-800 rounded-full text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
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

            {!searchedUser ? (
              <form onSubmit={handleSearchUser} className="space-y-3">
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
                      className="w-full pl-6 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loadingAdd}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition"
                >
                  {loadingAdd ? 'Searching...' : 'Search User'}
                </button>
              </form>
            ) : (
              <div className="text-center py-4 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <img 
                    src={searchedUser.photoURL} 
                    alt={searchedUser.username} 
                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500/30 shadow-lg" 
                  />
                  <p className="text-xs font-mono text-slate-300 font-bold">@{searchedUser.username}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setSearchedUser(null)}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-400"
                  >
                    Back
                  </button>
                  <button 
                    onClick={sendFriendRequest}
                    disabled={loadingAdd}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition"
                  >
                    {loadingAdd ? 'Sending...' : 'Add Friend'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP CHAT */}
      {showCreateGroup && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-xs bg-[#0c1017] border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col max-h-[90%]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h4 className="font-bold text-xs text-white">Create Group Chat</h4>
              <button 
                onClick={() => {
                  setShowCreateGroup(false);
                  setNewGroupName('');
                  setNewGroupDesc('');
                  setSelectedFriendsForGroup([]);
                }} 
                className="p-1 hover:bg-slate-800 rounded-full text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
              <div>
                <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">Group Name</label>
                <input 
                  type="text" 
                  required
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="The Squad ⚽"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">Group Description</label>
                <textarea 
                  value={newGroupDesc}
                  onChange={e => setNewGroupDesc(e.target.value)}
                  placeholder="Official discussion space..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">Select Members ({selectedFriendsForGroup.length})</label>
                <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-xl custom-scrollbar">
                  {availableFriends.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic text-center py-2 font-mono">No users found in contacts</p>
                  ) : (
                    availableFriends.map(friend => {
                      const isChecked = selectedFriendsForGroup.includes(friend.uid);
                      return (
                        <label key={friend.uid} className="flex items-center justify-between cursor-pointer p-1.5 rounded-lg hover:bg-white/5 transition select-none">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={getBotPhotoURL(friend.uid, friend.photoURL)} className="w-5.5 h-5.5 rounded-full object-cover" alt="Avatar" referrerPolicy="no-referrer" />
                            <span className="text-[11px] text-slate-300 truncate font-medium">{friend.displayName}</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedFriendsForGroup(prev => prev.filter(uid => uid !== friend.uid));
                              } else {
                                setSelectedFriendsForGroup(prev => [...prev, friend.uid]);
                              }
                            }}
                            className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 bg-slate-900"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loadingCreateGroup || !newGroupName.trim()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white rounded-xl shadow transition mt-1"
              >
                {loadingCreateGroup ? 'Creating...' : 'Create Group Space'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
