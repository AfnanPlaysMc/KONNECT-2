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
import GamesHub from './components/GamesHub';
import { MessageSquare, Shield, Gamepad2, Film, Sparkles, RefreshCw } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);

  // Modal displays
  const [showSettings, setShowSettings] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [initialLaunchGameId, setInitialLaunchGameId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const syncProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'profiles', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const pData = snap.data() as UserProfile;
        
        // Update presence to online
        await updateDoc(docRef, { status: 'online' });
        setProfile({ ...pData, status: 'online' });
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

  // Auto-seed Orion AI and Oxa LLC profile & chat if they do not exist
  useEffect(() => {
    if (!profile) return;

    const seedBotsAndChats = async () => {
      try {
        const bots = [
          {
            uid: 'orion-ai',
            displayName: 'Orion AI',
            username: 'orion_ai',
            photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
            bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
            welcomeMessage: "Hello! I am Orion AI, your E2EE intelligent assistant. Type any secure query or prompt and I will decode it right away."
          },
          {
            uid: 'oxa-llc',
            displayName: 'Oxa LLC',
            username: 'oxa_llc',
            photoURL: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=150',
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

  const handleAuthSuccess = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setUser(auth.currentUser);
  };

  const handleUpdateProfileState = (updated: UserProfile) => {
    setProfile(updated);
  };

  const navigateToDashboard = () => {
    setShowStories(false);
    setShowGames(false);
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
    setShowGames(false);
    setShowSettings(false);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/stories') {
      window.history.pushState(null, '', '/stories');
    }
  };

  const navigateToArcade = (gameId: string | null = null) => {
    setInitialLaunchGameId(gameId);
    setShowGames(true);
    setShowStories(false);
    setShowSettings(false);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/arcade') {
      window.history.pushState(null, '', '/arcade');
    }
  };

  const navigateToSettings = () => {
    setShowSettings(true);
    setShowStories(false);
    setShowGames(false);
    setMobileMenuOpen(false);
    if (window.location.pathname !== '/settings') {
      window.history.pushState(null, '', '/settings');
    }
  };

  const handleSelectChat = (chatId: string, partner: UserProfile) => {
    setActiveChatId(chatId);
    setActivePartner(partner);
    setShowStories(false);
    setShowGames(false);
    setShowSettings(false);
    setMobileMenuOpen(false);
    const targetPath = `/chat/friends/${partner.uid}`;
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
        displayName: 'Orion AI',
        username: 'orion_ai',
        photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        bio: 'Your secure, intelligent AI companion for high-density end-to-end encrypted intelligence.',
        status: 'online',
        theme: 'deep-dark'
      } as UserProfile);
      setShowStories(false);
      setShowGames(false);
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
        setShowGames(false);
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
        setShowGames(false);
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
        setShowGames(false);
        setShowSettings(false);
      } else if (path === '/arcade') {
        setShowStories(false);
        setShowGames(true);
        setShowSettings(false);
      } else if (path === '/settings') {
        setShowStories(false);
        setShowGames(false);
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
        setShowGames(false);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path === '/stories') {
        setShowStories(true);
        setShowGames(false);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path === '/arcade') {
        setShowStories(false);
        setShowGames(true);
        setShowSettings(false);
        setActiveChatId(null);
        setActivePartner(null);
      } else if (path === '/settings') {
        setShowStories(false);
        setShowGames(false);
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

  return (
    <div className={`h-screen h-[100dvh] w-screen overflow-hidden ${activeThemeObj.bg} text-slate-100 flex items-center justify-center p-0 transition-all duration-300`}>
      
      {/* Sleek dashboard card frame */}
      <div className={`w-full h-full ${activeThemeObj.card} flex overflow-hidden shadow-2xl relative`}>
        
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
          <div className={`w-12 h-12 ${activeThemeObj.primary} rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 font-black text-xl text-white select-none`}>
            K
          </div>
          <nav className="flex flex-col gap-6 flex-1 text-neutral-400">
            <button 
              onClick={navigateToDashboard}
              className={getNavBtnClass(!activeChatId && !showStories && !showGames && !showSettings)}
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
              onClick={() => navigateToArcade()}
              className={getNavBtnClass(showGames)}
              title="Arcade"
            >
              <Gamepad2 className="w-5 h-5" />
            </button>
            <button 
              onClick={navigateToSettings}
              className={getNavBtnClass(showSettings)}
              title="Settings"
            >
              <Shield className="w-5 h-5" />
            </button>
          </nav>
          <div className="mt-auto">
            <button onClick={navigateToSettings} className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden bg-neutral-700 relative group transition hover:scale-105">
              <img src={profile.photoURL} alt="pfp" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        {/* SIDEBAR NAVIGATION PANEL */}
        <Sidebar 
          profile={profile}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onOpenSettings={navigateToSettings}
          onOpenStories={navigateToStories}
          onOpenGames={() => navigateToArcade()}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* PRIMARY MAIN PANEL */}
        <div className={`flex-1 flex flex-col bg-slate-950/10 relative h-full ${activeChatId ? 'flex' : 'hidden sm:flex'}`}>
          {activeChatId && activePartner ? (
            <ChatWindow 
              chatId={activeChatId}
              myProfile={profile}
              partnerProfile={activePartner}
              onOpenGames={() => navigateToArcade()}
              onSetGameChallenge={(gameId) => navigateToArcade(gameId)}
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
                Connect seamlessly with direct scanning, customized spaces, stealth activity toggles, and play over 20 mini-games inside active channels.
              </p>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowStories(true)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800/80 rounded-xl text-[10px] font-bold text-slate-300 flex items-center gap-1.5 transition active:scale-95 shadow"
                >
                  <Film className="w-3.5 h-3.5 text-indigo-400" /> View Stories
                </button>
                <button 
                  onClick={() => setShowGames(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold text-white flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-indigo-600/10"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-white" /> Open Arcade
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

        {/* OVERLAY MODAL: ARCADE PORTAL */}
        {showGames && (
          <div className="absolute inset-0 z-40 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md h-full max-h-[540px] md:h-[540px] bg-[#0c1017] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <GamesHub 
                onClose={() => setShowGames(false)}
                activeFriendId={activePartner?.uid}
                activeFriendName={activePartner?.displayName}
                initialLaunchGameId={initialLaunchGameId}
                onSendGameResult={async (gameId, gameName, score, resultText) => {
                  if (activeChatId && activePartner) {
                    // Update latest game match info inside chat conversation
                    const customMessageText = `🎮 Play Result: ${resultText}`;
                    const payload = {
                      senderId: profile.uid,
                      receiverId: activePartner.uid,
                      text: customMessageText,
                      timestamp: new Date(),
                      type: 'game_result' as const,
                      read: false,
                      gameInfo: {
                        gameId,
                        gameName,
                        status: 'completed' as const,
                        turnUid: activePartner.uid,
                        score: {
                          [profile.uid]: score
                        },
                        winnerUid: score > 0 ? profile.uid : score === 0 ? activePartner.uid : undefined,
                        state: null
                      }
                    };
                    try {
                      const messagesColl = collection(db, 'chats', activeChatId, 'messages');
                      await setDoc(doc(messagesColl), payload);
                      await updateDoc(doc(db, 'chats', activeChatId), {
                        lastMessage: {
                          text: customMessageText,
                          timestamp: new Date(),
                          senderId: profile.uid
                        }
                      });
                    } catch (e) {
                      console.error(e);
                    }
                  }
                  setShowGames(false);
                }}
              />
            </div>
          </div>
        )}

        {/* OVERLAY MODAL: SETTINGS PANEL */}
        {showSettings && (
          <Settings 
            profile={profile}
            onUpdateProfile={handleUpdateProfileState}
            onClose={() => setShowSettings(false)}
          />
        )}

      </div>
    </div>
  );
}
