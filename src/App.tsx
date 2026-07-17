import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, collection, onSnapshot, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, THEMES } from './types';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import Settings from './components/Settings';
import Stories from './components/Stories';
import { AppLogo } from './components/AppLogo';
import { MessageSquare, Shield, Trophy, Film, Sparkles, RefreshCw, X, Contact } from 'lucide-react';
import { setGoogleAccessToken } from './googleTokenStore';
import { subscribeUserToPush } from './lib/webPush';

// @ts-ignore
import orionAiLogo from './assets/images/orion_ai_logo_1782673841547.jpg';
// @ts-ignore
import oxaLlcLogo from './assets/images/oxa_llc_logo_1782673859506.jpg';

const getBotPhotoURL = (uid: string, url: string | undefined): string => {
  if (uid === 'orion-ai') return orionAiLogo;
  if (uid === 'oxa-llc') return oxaLlcLogo;
  return url || '';
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);

  // Modal displays
  const [showSettings, setShowSettings] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'theme' | 'privacy' | 'sounds' | 'contacts'>('profile');
  const [bannerHidden, setBannerHidden] = useState(() => localStorage.getItem('konnect_invite_banner_hidden') === 'true');
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      setViewportHeight(window.visualViewport.height);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [hasRoutedOnMount, setHasRoutedOnMount] = useState(false);

  // Authenticated state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await syncProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        setActiveChatId(null);
        setActivePartner(null);
        setGoogleAccessToken(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync profiles map in real-time
  useEffect(() => {
    if (!user) {
      setProfilesMap({});
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      const map: Record<string, UserProfile> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        map[docSnap.id] = data;
      });
      setProfilesMap(map);
    }, (err) => {
      console.warn("Profiles collection sync handled error:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Periodic Heartbeat Interval to keep user "online" and set lastSeen in real-time
  useEffect(() => {
    if (!profile || !user) return;

    const interval = setInterval(async () => {
      try {
        const docRef = doc(db, 'profiles', user.uid);
        await updateDoc(docRef, { lastSeen: new Date(), status: 'online' });
      } catch (err) {
        console.error("Error updating heartbeat lastSeen:", err);
      }
    }, 60000); // every 60 seconds

    return () => clearInterval(interval);
  }, [profile, user]);

  const syncProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'profiles', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const pData = snap.data() as UserProfile;
        
        // Update presence to online & update lastSeen timestamp
        await updateDoc(docRef, { status: 'online', lastSeen: new Date() });
        setProfile({ ...pData, status: 'online', lastSeen: new Date() });
      } else {
        // Needs onboarding (handled inside Auth component)
        setProfile(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-seed Neurox AI and Oxa LLC profile & chat if they do not exist
  useEffect(() => {
    if (!profile) return;

    const seedBotsAndChats = async () => {
      try {
        const bots = [
          {
            uid: 'orion-ai',
            displayName: 'Neurox AI',
            username: 'neurox_ai',
            photoURL: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150',
            bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
            welcomeMessage: "Hello! I am Neurox AI, your E2EE intelligent assistant. Type any secure query or prompt and I will decode it right away."
          },
          {
            uid: 'oxa-llc',
            displayName: 'Oxa LLC',
            username: 'oxa_llc',
            photoURL: 'https://images.unsplash.com/photo-1634973357973-f2ed255753e1?w=150',
            bio: 'Official developers of the Konnect secure suite. Contact us for security audits or premium features.',
            welcomeMessage: "Welcome to Konnect! We are Oxa LLC, the development team behind this secure messaging platform. Feel free to explore our settings, premium features, and arcade. Let us know if you find any security bugs!"
          }
        ];

        for (const bot of bots) {
          if (bot.uid === 'orion-ai') {
            // Seed Orion AI locally instead of Firestore
            const localChatKey = `konnect_local_chat_orion-ai_${profile.uid}`;
            const localMsgsKey = `konnect_local_messages_orion-ai_${profile.uid}`;
            if (!localStorage.getItem(localChatKey)) {
              localStorage.setItem(localChatKey, JSON.stringify({
                id: `orion-ai-chat-${profile.uid}`,
                participants: [profile.uid, 'orion-ai'],
                lastMessage: {
                  text: bot.welcomeMessage,
                  timestamp: new Date().toISOString(),
                  senderId: 'orion-ai'
                },
                unreadCount: {
                  [profile.uid]: 0,
                  'orion-ai': 0
                }
              }));
            }
            if (!localStorage.getItem(localMsgsKey)) {
              localStorage.setItem(localMsgsKey, JSON.stringify([
                {
                  id: `welcome-${Date.now()}`,
                  senderId: 'orion-ai',
                  receiverId: profile.uid,
                  text: bot.welcomeMessage,
                  timestamp: new Date().toISOString(),
                  type: 'text',
                  read: true
                }
              ]));
            }
            continue; // Skip Firestore seeding for orion-ai
          }

          // 1. Ensure profile document exists
          const botProfileRef = doc(db, 'profiles', bot.uid);
          const botProfileSnap = await getDoc(botProfileRef);
          
          if (!botProfileSnap.exists()) {
            await setDoc(botProfileRef, {
              uid: bot.uid,
              displayName: bot.displayName,
              username: bot.username,
              photoURL: bot.photoURL,
              bannerURL: '',
              bio: bot.bio,
              blockedUsers: [],
              closeFriends: [],
              customList: [],
              theme: 'deep-dark',
              stealthMode: false,
              readReceipts: true,
              notificationSounds: {},
              status: 'online',
              lastSeen: new Date()
            });
            console.log(`Seeded bot profile: ${bot.displayName}`);
          }

          // 2. Ensure chat document exists for this user and this bot
          const chatsQuery = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', profile.uid)
          );
          const chatsSnap = await getDocs(chatsQuery);
          let chatExists = false;
          let existingChatId = '';
          
          chatsSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.participants && data.participants.includes(bot.uid)) {
              chatExists = true;
              existingChatId = docSnap.id;
            }
          });

          if (!chatExists) {
            // Create a brand new chat document
            const chatRef = doc(collection(db, 'chats'));
            const chatId = chatRef.id;
            
            await setDoc(chatRef, {
              participants: [profile.uid, bot.uid],
              lastMessage: {
                text: bot.welcomeMessage,
                timestamp: new Date(),
                senderId: bot.uid
              },
              unreadCount: {
                [profile.uid]: 0,
                [bot.uid]: 0
              }
            });

            // Add welcome message to messages subcollection
            const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
            await setDoc(msgRef, {
              senderId: bot.uid,
              receiverId: profile.uid,
              text: bot.welcomeMessage,
              timestamp: new Date(),
              type: 'text',
              read: false
            });

            console.log(`Created chat with bot ${bot.displayName}`);
          }
        }
      } catch (e) {
        console.warn("Failed to seed bots and chats:", e);
      }
    };

    seedBotsAndChats();
  }, [profile]);

  // Sync presence status: Offline on tab closing
  useEffect(() => {
    if (!profile) return;

    const handleOffline = async () => {
      try {
        await updateDoc(doc(db, 'profiles', profile.uid), { status: 'offline' });
      } catch (e) {}
    };

    window.addEventListener('beforeunload', handleOffline);
    return () => {
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, [profile]);

  // Request browser native notification permission and subscribe to background push automatically on load / login
  useEffect(() => {
    if (profile) {
      const initPush = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission !== 'granted') {
            await Notification.requestPermission().catch(err => {
              console.warn("Failed to request native notification permission automatically:", err);
            });
          }
          // Subscribe to Web Push / PWA background notifications
          try {
            await subscribeUserToPush(profile.uid);
          } catch (e) {
            console.warn("Failed to register background push subscription:", e);
          }
        }
      };
      initPush();
    }
  }, [profile]);

  // For beautiful in-app notifications
  const [activeNotification, setActiveNotification] = useState<{
    type: 'message' | 'call';
    title: string;
    body: string;
    icon: string;
    onClick: () => void;
  } | null>(null);

  const triggerNotification = (notif: {
    type: 'message' | 'call';
    title: string;
    body: string;
    icon: string;
    onClick: () => void;
  }) => {
    // 1. Show browser native notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const nativeNotif = new Notification(notif.title, {
          body: notif.body,
          icon: notif.icon,
        });
        nativeNotif.onclick = () => {
          window.focus();
          notif.onClick();
          nativeNotif.close();
        };
      } catch (err) {
        console.warn("Native Notification failed, falling back to in-app toast", err);
      }
    }

    // 2. Also show in-app custom notification toast so it displays the styled layout beautifully
    setActiveNotification(notif);
    // Auto-dismiss in-app notification after 5 seconds
    setTimeout(() => {
      setActiveNotification(current => current === notif ? null : current);
    }, 5000);
  };

  // Listen to incoming messages and calls globally
  useEffect(() => {
    if (!profile) return;

    // Listen to all chats for this user
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', profile.uid)
    );

    let isInitialLoad = true;

    // Keep track of processed message IDs or timestamps to avoid duplicates on initial sync
    const lastNotifiedTimestamps: Record<string, any> = {};

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (isInitialLoad) {
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const chatId = docSnap.id;
          if (data.lastMessage?.timestamp) {
            lastNotifiedTimestamps[chatId] = data.lastMessage.timestamp;
          }
        });
        isInitialLoad = false;
        return;
      }

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const chatId = docSnap.id;
        const lastMsg = data.lastMessage;
        const activeCall = data.activeCall;

        // 1. Check for incoming messages
        if (lastMsg && lastMsg.senderId !== profile.uid && lastMsg.senderId !== 'orion-ai' && lastMsg.senderId !== 'oxa-llc') {
          const storedTs = lastNotifiedTimestamps[chatId];
          const newTs = lastMsg.timestamp;
          
          if (newTs) {
            const storedTime = storedTs 
              ? (storedTs.toDate ? storedTs.toDate().getTime() : new Date(storedTs).getTime()) 
              : 0;
            const newTime = newTs.toDate ? newTs.toDate().getTime() : new Date(newTs).getTime();

            if (newTime > storedTime) {
              lastNotifiedTimestamps[chatId] = newTs;

              // Don't notify if we are currently looking at this active chat
              if (activeChatId !== chatId) {
                const senderId = lastMsg.senderId;
                const senderProfile = profilesMap[senderId];
                if (senderProfile) {
                  triggerNotification({
                    type: 'message',
                    title: `${senderProfile.displayName} SENT A MESSAGE!`,
                    body: `TAP TO VIEW IT`,
                    icon: getBotPhotoURL(senderProfile.uid, senderProfile.photoURL),
                    onClick: () => {
                      handleSelectChat(chatId, senderProfile);
                    }
                  });
                }
              }
            }
          }
        }

        // 2. Check for incoming calls
        if (activeCall && activeCall.status === 'ringing' && activeCall.receiverId === profile.uid) {
          const callSessionKey = `call_notified_${activeCall.id}`;
          if (!sessionStorage.getItem(callSessionKey)) {
            sessionStorage.setItem(callSessionKey, 'true');

            const callerId = activeCall.callerId;
            const callerProfile = profilesMap[callerId];
            if (callerProfile) {
              triggerNotification({
                type: 'call',
                title: `${callerProfile.displayName} INCOMING CALL!`,
                body: `TAP TO ACCEPT OR DECLINE`,
                icon: getBotPhotoURL(callerProfile.uid, callerProfile.photoURL),
                onClick: () => {
                  handleSelectChat(chatId, callerProfile);
                }
              });
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [profile, activeChatId, profilesMap]);

  const handleAuthSuccess = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setUser(auth.currentUser);
  };

  const handleUpdateProfileState = (updated: UserProfile) => {
    setProfile(updated);
  };

  const navigateToDashboard = () => {
    setShowStories(false);
    setShowSettings(false);
    setActiveChatId(null);
    setActivePartner(null);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/konnectmain') {
      window.history.pushState(null, '', '/konnectmain');
    }
  };

  const navigateToStories = () => {
    setShowStories(true);
    setShowSettings(false);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/stories') {
      window.history.pushState(null, '', '/stories');
    }
  };

  const navigateToSettings = (tab?: 'profile' | 'theme' | 'privacy' | 'sounds' | 'contacts') => {
    setSettingsTab(tab || 'profile');
    setShowSettings(true);
    setShowStories(false);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/settings') {
      window.history.pushState(null, '', '/settings');
    }
  };

  const handleSelectChat = (chatId: string, partner: UserProfile) => {
    let sanitizedPartner = partner;
    if (partner.uid === 'orion-ai') {
      sanitizedPartner = {
        ...partner,
        displayName: 'Neurox AI',
        username: 'neurox_ai',
        bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
      };
    }
    setActiveChatId(chatId);
    setActivePartner(sanitizedPartner);
    setShowStories(false);
    setShowSettings(false);
    setMobileMenuOpen(false);
    const targetPath = `/chat/friends/${sanitizedPartner.uid}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const openChatWithFriend = async (friendUid: string) => {
    if (!profile) return;
    if (friendUid === 'orion-ai') {
      setActiveChatId(`orion-ai-chat-${profile.uid}`);
      setActivePartner({
        uid: 'orion-ai',
        displayName: 'Neurox AI',
        username: 'neurox_ai',
        photoURL: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=150',
        bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
        status: 'online',
        theme: 'deep-dark'
      } as UserProfile);
      setShowStories(false);
      setShowSettings(false);
      setMobileMenuOpen(false);
      const targetPath = `/chat/friends/orion-ai`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      return;
    }

    try {
      const friendSnap = await getDoc(doc(db, 'profiles', friendUid));
      if (!friendSnap.exists()) return;
      const friendProfile = friendSnap.data() as UserProfile;

      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', profile.uid)
      );
      const qSnap = await getDocs(q);
      let foundChatId: string | null = null;
      qSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants && data.participants.includes(friendUid) && !data.isGroup) {
          foundChatId = docSnap.id;
        }
      });

      if (foundChatId) {
        setActiveChatId(foundChatId);
        setActivePartner(friendProfile);
        setShowStories(false);
        setShowSettings(false);
        setMobileMenuOpen(false);
        const targetPath = `/chat/friends/${friendUid}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      } else {
        const newChatRef = doc(collection(db, 'chats'));
        const newChatData = {
          participants: [profile.uid, friendUid],
          lastMessage: {
            text: 'Established friendship connection',
            timestamp: new Date(),
            senderId: profile.uid
          },
          unreadCount: {
            [profile.uid]: 0,
            [friendUid]: 0
          }
        };
        await setDoc(newChatRef, newChatData);
        setActiveChatId(newChatRef.id);
        setActivePartner(friendProfile);
        setShowStories(false);
        setShowSettings(false);
        setMobileMenuOpen(false);
        const targetPath = `/chat/friends/${friendUid}`;
        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      }
    } catch (e) {
      console.error("Error opening chat with friend from URL:", e);
    }
  };

  // 1. Initial Mount/Load Routing (Runs exactly once when profile is loaded)
  useEffect(() => {
    if (!profile || hasRoutedOnMount) return;

    const handleInitialRouting = async () => {
      const path = window.location.pathname;
      if (path.startsWith('/chat/friends/')) {
        const friendUid = path.split('/chat/friends/')[1];
        if (friendUid) {
          await openChatWithFriend(friendUid);
        }
      } else if (path === '/stories') {
        setShowStories(true);
        setShowSettings(false);
      } else if (path === '/sports') {
        setShowStories(false);
        setShowSettings(false);
        window.history.replaceState(null, '', '/konnectmain');
      } else if (path === '/settings') {
        setShowStories(false);
        setShowSettings(true);
      } else if (path === '/signinsignup') {
        window.history.replaceState(null, '', '/konnectmain');
      }
      setHasRoutedOnMount(true);
    };

    handleInitialRouting();
  }, [profile, hasRoutedOnMount]);

  // 2. Browser Navigation Popstate Listener (Synchronizes React states on Back/Forward buttons)
  useEffect(() => {
    if (!profile) return;

    const handlePopstateRouting = async () => {
      const path = window.location.pathname;

      if (path === '/konnectmain' || path === '/' || path === '/signinsignup') {
        setShowStories(false);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path === '/stories') {
        setShowStories(true);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path === '/sports') {
        setShowStories(false);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
        window.history.replaceState(null, '', '/konnectmain');
      } else if (path === '/settings') {
        setShowStories(false);
        setShowSettings(true);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path.startsWith('/chat/friends/')) {
        const friendUid = path.split('/chat/friends/')[1];
        if (friendUid) {
          await openChatWithFriend(friendUid);
        }
      }
    };

    window.addEventListener('popstate', handlePopstateRouting);
    return () => {
      window.removeEventListener('popstate', handlePopstateRouting);
    };
  }, [profile]);

  // Global keyboard shortcuts: Ctrl+1 (Dashboard), Ctrl+2 (Stories), Ctrl+3 (Settings)
  useEffect(() => {
    if (!profile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd key is pressed
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          navigateToDashboard();
        } else if (e.key === '2') {
          e.preventDefault();
          navigateToStories();
        } else if (e.key === '3') {
          e.preventDefault();
          navigateToSettings();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [profile]);

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      if (window.location.pathname !== '/signinsignup') {
        window.history.replaceState(null, '', '/signinsignup');
      }
    } else {
      if (window.location.pathname === '/signinsignup') {
        window.history.replaceState(null, '', '/konnectmain');
      }
    }
  }, [profile, loading]);

  // Retrieve matching theme values
  const currentThemeId = profile?.theme || 'deep-dark';
  const activeThemeObj = THEMES.find(t => t.id === currentThemeId) || THEMES[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="p-4 bg-indigo-600/10 rounded-2xl mb-4 border border-indigo-500/20 animate-pulse">
          <MessageSquare className="w-10 h-10 text-indigo-400 animate-spin" />
        </div>
        <h3 className="font-bold text-sm tracking-widest uppercase text-slate-300 font-mono">Initializing Konnect Space</h3>
        <p className="text-[10px] text-slate-600 mt-1.5">Checking biometric nodes & cloud layers...</p>
      </div>
    );
  }

  // If not logged in or missing profile, load Auth onboarding view
  if (!user || !profile) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // List friend IDs to determine stories filtering privacy constraints
  const partnerUids: string[] = activePartner ? [activePartner.uid] : [];

  const isLight = activeThemeObj.id === 'blue-white';
  const getNavBtnClass = (isActive: boolean) => {
    if (isActive) {
      return isLight 
        ? 'p-3 rounded-xl cursor-pointer transition bg-blue-50 text-blue-600' 
        : 'p-3 rounded-xl cursor-pointer transition bg-white/10 text-white';
    }
    return isLight 
      ? 'p-3 rounded-xl cursor-pointer transition text-slate-400 hover:text-slate-700 hover:bg-slate-100/50' 
      : 'p-3 rounded-xl cursor-pointer transition text-neutral-500 hover:text-neutral-300 hover:bg-white/5';
  };

  const renderBackgroundParticles = () => {
    if (currentThemeId !== 'football' && currentThemeId !== 'cricket') return null;

    const particleEmoji = currentThemeId === 'football' ? '⚽' : '🏏';
    const particles = [
      { id: 1, left: '5%', delay: '0s', speed: 'animate-float-slow', size: 'text-2xl sm:text-3xl' },
      { id: 2, left: '15%', delay: '4s', speed: 'animate-float-medium', size: 'text-xl sm:text-2xl' },
      { id: 3, left: '28%', delay: '1s', speed: 'animate-float-fast', size: 'text-lg sm:text-xl' },
      { id: 4, left: '40%', delay: '6s', speed: 'animate-float-slow', size: 'text-2xl sm:text-3xl' },
      { id: 5, left: '52%', delay: '2s', speed: 'animate-float-medium', size: 'text-xl sm:text-2xl' },
      { id: 6, left: '65%', delay: '8s', speed: 'animate-float-fast', size: 'text-lg sm:text-xl' },
      { id: 7, left: '78%', delay: '3s', speed: 'animate-float-slow', size: 'text-2xl sm:text-3xl' },
      { id: 8, left: '92%', delay: '5s', speed: 'animate-float-medium', size: 'text-xl sm:text-2xl' },
      { id: 9, left: '10%', delay: '7s', speed: 'animate-float-fast', size: 'text-lg' },
      { id: 10, left: '35%', delay: '9s', speed: 'animate-float-slow', size: 'text-2xl' },
      { id: 11, left: '60%', delay: '5s', speed: 'animate-float-medium', size: 'text-xl' },
      { id: 12, left: '85%', delay: '10s', speed: 'animate-float-fast', size: 'text-lg' },
    ];

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute bottom-0 select-none opacity-25 ${p.speed} ${p.size}`}
            style={{
              left: p.left,
              animationDelay: p.delay,
            }}
          >
            {particleEmoji}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`h-screen h-[100dvh] w-full max-w-full overflow-hidden ${activeThemeObj.bg} text-slate-100 flex items-center justify-center p-0 transition-all duration-300 relative`}
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      
      {/* Background Particles Overlay */}
      {renderBackgroundParticles()}
      
      {/* Sleek dashboard card frame */}
      <div className={`w-full h-full ${activeThemeObj.card} flex overflow-hidden shadow-2xl relative z-10`}>
        
        {/* Mobile Left Sidebar overlay backdrop */}
        {mobileMenuOpen && (
          <div 
            className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left Sidebar: App Navigation */}
        <div className={`
          fixed sm:static inset-y-0 left-0 z-50 w-20 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          sm:translate-x-0 transition-transform duration-300 ease-in-out
          flex flex-col items-center py-6 gap-8 flex-shrink-0
          ${activeThemeObj.card} border-r ${activeThemeObj.border}
        `}>
          <div className={`w-12 h-12 ${activeThemeObj.primary} rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10 font-black text-xl text-white select-none`}>
            <AppLogo className="w-8 h-8" />
          </div>
          <nav className="flex flex-col gap-6 flex-1 text-neutral-400">
            <button 
              onClick={navigateToDashboard}
              className={getNavBtnClass(!activeChatId && !showStories && !showSettings)}
              title="Dashboard"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={navigateToStories}
              className={getNavBtnClass(showStories)}
              title="Stories"
            >
              <Film className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigateToSettings('contacts')}
              className={getNavBtnClass(showSettings && settingsTab === 'contacts')}
              title="Google Contacts"
            >
              <Contact className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigateToSettings('profile')}
              className={getNavBtnClass(showSettings && settingsTab !== 'contacts')}
              title="Settings"
            >
              <Shield className="w-5 h-5" />
            </button>
          </nav>
          <div className="mt-auto">
            <button onClick={() => navigateToSettings('profile')} className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden bg-neutral-700 relative group transition hover:scale-105">
              <img src={profile.photoURL} alt="pfp" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        {/* SIDEBAR NAVIGATION PANEL */}
        <Sidebar 
          profile={profile}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onOpenSettings={() => navigateToSettings('profile')}
          onOpenContacts={() => navigateToSettings('contacts')}
          onOpenStories={navigateToStories}
          onOpenSports={() => {}}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenChatWithFriend={openChatWithFriend}
        />

        {/* PRIMARY MAIN PANEL */}
        <div className={`flex-1 flex flex-col bg-slate-950/10 relative h-full overflow-hidden ${activeChatId ? 'flex' : 'hidden sm:flex'}`}>
          {/* Top Invitation Banner */}
          {!bannerHidden && (
            <div className={`flex-shrink-0 px-4 py-3 flex items-center justify-between gap-3 text-xs font-bold border-b transition-all duration-300 animate-fadeIn ${
              isLight 
                ? 'bg-blue-50/90 border-blue-100 text-blue-700 shadow-sm' 
                : 'bg-indigo-950/45 border-indigo-900/50 text-indigo-200 shadow'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex-shrink-0 text-indigo-400">✨</span>
                <p className="truncate uppercase tracking-wider font-semibold">WANT TO MAKE YOUR CONTACTS JOIN?</p>
                <button 
                  onClick={() => navigateToSettings('contacts')}
                  className={`ml-3 px-3 py-1 text-[9px] uppercase font-mono tracking-wider font-bold rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                    isLight 
                      ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
                  }`}
                >
                  Invite Them
                </button>
              </div>
              <button 
                onClick={() => {
                  setBannerHidden(true);
                  localStorage.setItem('konnect_invite_banner_hidden', 'true');
                }}
                className={`p-1.5 rounded-full transition ${
                  isLight ? 'hover:bg-blue-100 text-blue-500 hover:text-blue-700' : 'hover:bg-indigo-900/40 text-indigo-400 hover:text-white'
                }`}
                title="Dismiss Banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeChatId && activePartner ? (
            <ChatWindow 
              chatId={activeChatId}
              myProfile={profile}
              partnerProfile={activePartner}
              onOpenGames={() => {}}
              onSetGameChallenge={() => {}}
              onCloseChat={navigateToDashboard}
              profilesMap={profilesMap}
            />
          ) : (
            /* WELCOME DASHBOARD IN-APP */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none relative overflow-hidden">
              {/* Decorative backgrounds */}
              <div className="absolute top-10 left-10 w-44 h-44 bg-indigo-500/5 rounded-full blur-2xl" />
              <div className="absolute bottom-10 right-10 w-44 h-44 bg-fuchsia-500/5 rounded-full blur-2xl" />

              <div className="p-4 bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 rounded-2xl mb-4 border border-indigo-500/10 shadow-lg shadow-indigo-500/5">
                <MessageSquare className="w-8 h-8 text-indigo-400 animate-pulse" />
              </div>

              <h2 className="text-xl font-extrabold text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-200">
                Welcome to Konnect Space
              </h2>
              <p className="text-[11px] text-slate-500 max-w-sm mt-2 leading-relaxed">
                Connect seamlessly with direct scanning, customized spaces, and stealth activity toggles.
              </p>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowStories(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-xl text-[10px] font-bold text-slate-300 flex items-center gap-1.5 transition active:scale-95 shadow"
                >
                  <Film className="w-3.5 h-3.5 text-indigo-400" /> View Stories
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OVERLAY MODAL: STORIES PANEL */}
        {showStories && (
          <Stories 
            profile={profile}
            friendIds={Object.keys(profilesMap).filter(uid => uid !== profile.uid)}
            onClose={() => setShowStories(false)}
          />
        )}

        {/* OVERLAY MODAL: SETTINGS PANEL */}
        {showSettings && (
          <Settings 
            profile={profile}
            onUpdateProfile={handleUpdateProfileState}
            onClose={() => setShowSettings(false)}
            initialTab={settingsTab}
          />
        )}

        {/* BEAUTIFUL IN-APP FLOATING NOTIFICATION TOAST */}
        {activeNotification && (
          <div 
            onClick={() => {
              activeNotification.onClick();
              setActiveNotification(null);
            }}
            className="fixed top-4 right-4 z-[9999] w-full max-w-[320px] bg-[#0c1017] border-2 border-indigo-500/30 rounded-2xl p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer hover:border-indigo-500 hover:bg-[#101520] transition-all duration-300 animate-slide-in flex gap-3 items-center select-none"
          >
            <img 
              src={activeNotification.icon} 
              alt="" 
              className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0" 
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col">
                <span className="text-[11px] text-white font-sans font-bold truncate">
                  {activeNotification.type === 'message' 
                    ? activeNotification.title.replace(' SENT A MESSAGE!', '') 
                    : activeNotification.title.replace(' INCOMING CALL!', '')}
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest text-emerald-400 mt-0.5 font-bold">
                  {activeNotification.type === 'message' ? 'SENT A MESSAGE!' : 'INCOMING CALL!'}
                </span>
              </div>
              <p className="text-[9px] text-blue-400 font-bold font-mono mt-1 uppercase tracking-wide">
                {activeNotification.type === 'message' ? 'TAP TO VIEW IT' : 'TAP TO ACCEPT OR DECLINE'}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
