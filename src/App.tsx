import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, collection } from 'firebase/firestore';
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
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activePartner, setActivePartner] = useState<UserProfile | null>(null);

  // Modal displays
  const [showSettings, setShowSettings] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [showGames, setShowGames] = useState(false);
  const [initialLaunchGameId, setInitialLaunchGameId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

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

  const handleSelectChat = (chatId: string, partner: UserProfile) => {
    setActiveChatId(chatId);
    setActivePartner(partner);
  };

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

  return (
    <div className={`min-h-screen ${activeThemeObj.bg} text-slate-100 flex items-center justify-center p-0 md:p-6 transition-all duration-300`}>
      
      {/* Sleek dashboard card frame */}
      <div className={`w-full max-w-6xl h-full md:h-[680px] bg-[#0c1017] border ${activeThemeObj.border} md:rounded-2xl flex overflow-hidden shadow-2xl relative`}>
        
        {/* Left Sidebar: App Navigation (High Density Style) */}
        <div className="hidden sm:flex w-20 bg-[#121417] border-r border-neutral-800 flex-col items-center py-6 gap-8 flex-shrink-0">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 font-black text-xl text-white select-none">
            K
          </div>
          <nav className="flex flex-col gap-6 flex-1 text-neutral-400">
            <button 
              onClick={() => { setActiveChatId(null); setActivePartner(null); }}
              className={`p-3 rounded-xl cursor-pointer transition ${!activeChatId ? 'bg-neutral-800/60 text-blue-400' : 'hover:text-neutral-200'}`}
              title="Dashboard"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowStories(true)}
              className="p-3 text-neutral-500 hover:text-neutral-300 cursor-pointer transition"
              title="Stories"
            >
              <Film className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setInitialLaunchGameId(null); setShowGames(true); }}
              className="p-3 text-neutral-500 hover:text-neutral-300 cursor-pointer transition"
              title="Arcade"
            >
              <Gamepad2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 text-neutral-500 hover:text-neutral-300 cursor-pointer transition"
              title="Settings"
            >
              <Shield className="w-5 h-5" />
            </button>
          </nav>
          <div className="mt-auto">
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden bg-neutral-700 relative group transition hover:scale-105">
              <img src={profile.photoURL} alt="pfp" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>

        {/* SIDEBAR NAVIGATION PANEL */}
        <Sidebar 
          profile={profile}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onOpenSettings={() => setShowSettings(true)}
          onOpenStories={() => setShowStories(true)}
          onOpenGames={() => {
            setInitialLaunchGameId(null);
            setShowGames(true);
          }}
        />

        {/* PRIMARY MAIN PANEL */}
        <div className="flex-1 flex flex-col bg-slate-950/10 relative h-full">
          {activeChatId && activePartner ? (
            <ChatWindow 
              chatId={activeChatId}
              myProfile={profile}
              partnerProfile={activePartner}
              onOpenGames={() => {
                setInitialLaunchGameId(null);
                setShowGames(true);
              }}
              onSetGameChallenge={(gameId) => {
                setInitialLaunchGameId(gameId);
                setShowGames(true);
              }}
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

        {/* RIGHT PANEL: GAMES & TOOLS (High Density Theme) */}
        <div className="hidden lg:flex w-72 bg-[#0E1013] border-l border-neutral-800 flex-col flex-shrink-0 text-[#E4E6EB]">
          {/* Profile Quick View */}
          {(() => {
            const displayProfile = activePartner || profile;
            return (
              <div className="p-5 border-b border-neutral-800">
                <div 
                  className="w-full h-20 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl relative overflow-hidden bg-cover bg-center"
                  style={{ backgroundImage: displayProfile.bannerURL ? `url(${displayProfile.bannerURL})` : undefined }}
                >
                  {displayProfile.uid === profile.uid && (
                    <button 
                      onClick={() => setShowSettings(true)}
                      className="absolute top-1.5 right-1.5 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold backdrop-blur-sm hover:bg-black/80 transition animate-pulse"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
                <div className="px-3 flex flex-col items-center -mt-8 relative z-10">
                  <div className="w-16 h-16 rounded-full border-4 border-[#0E1013] bg-neutral-800 overflow-hidden shadow-md">
                    <img referrerPolicy="no-referrer" src={displayProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <h3 className="font-bold text-sm text-white mt-1.5 line-clamp-1">{displayProfile.displayName}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono">@{displayProfile.username}</p>
                  
                  <div className="flex gap-2 w-full mt-3 pt-3 border-t border-neutral-800/60 text-center">
                    <div className="flex-1">
                      <p className="text-xs font-black text-white">1.2k</p>
                      <p className="text-[8px] text-neutral-500 uppercase tracking-widest font-mono">Friends</p>
                    </div>
                    <div className="flex-1 border-l border-neutral-800/60">
                      <p className="text-xs font-black text-white">24</p>
                      <p className="text-[8px] text-neutral-500 uppercase tracking-widest font-mono">Games</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Mini Games Section */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono">20 Mini Games</h4>
              <button 
                onClick={() => { setInitialLaunchGameId(null); setShowGames(true); }}
                className="text-[9px] text-blue-500 hover:text-blue-400 font-bold tracking-wider font-mono uppercase"
              >
                See All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button 
                onClick={() => { setInitialLaunchGameId('chess'); setShowGames(true); }}
                className="bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60 flex flex-col items-center gap-1.5 hover:border-blue-500/60 hover:bg-neutral-900/80 cursor-pointer text-center group transition-all"
              >
                <span className="text-xl group-hover:scale-110 transition duration-150">♟️</span>
                <span className="text-[9px] font-bold text-slate-300">Space Chess</span>
              </button>
              <button 
                onClick={() => { setInitialLaunchGameId('flappy'); setShowGames(true); }}
                className="bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60 flex flex-col items-center gap-1.5 hover:border-blue-500/60 hover:bg-neutral-900/80 cursor-pointer text-center group transition-all"
              >
                <span className="text-xl group-hover:scale-110 transition duration-150">🎮</span>
                <span className="text-[9px] font-bold text-slate-300">Pixel Run</span>
              </button>
              <button 
                onClick={() => { setInitialLaunchGameId('minesweeper'); setShowGames(true); }}
                className="bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60 flex flex-col items-center gap-1.5 hover:border-blue-500/60 hover:bg-neutral-900/80 cursor-pointer text-center group transition-all"
              >
                <span className="text-xl group-hover:scale-110 transition duration-150">🧩</span>
                <span className="text-[9px] font-bold text-slate-300">Logic Gate</span>
              </button>
              <button 
                onClick={() => { setInitialLaunchGameId('connect4'); setShowGames(true); }}
                className="bg-neutral-900/40 p-2.5 rounded-xl border border-neutral-800/60 flex flex-col items-center gap-1.5 hover:border-blue-500/60 hover:bg-neutral-900/80 cursor-pointer text-center group transition-all"
              >
                <span className="text-xl group-hover:scale-110 transition duration-150">🃏</span>
                <span className="text-[9px] font-bold text-slate-300">Konnect 4</span>
              </button>
            </div>
            
            {/* Quick QR Display at bottom of Games list */}
            <div className="mt-auto pt-4 border-t border-neutral-800/60 flex flex-col items-center">
              <div className="bg-white p-2 rounded-xl flex items-center justify-center mb-1.5 shadow-md">
                <div className="w-20 h-20 bg-[#0A0B0D] p-1.5">
                  <div className="grid grid-cols-4 grid-rows-4 gap-1 w-full h-full">
                    <div className="bg-white"></div><div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div>
                    <div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div><div className="bg-white"></div>
                    <div className="bg-white"></div><div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div>
                    <div className="bg-black"></div><div className="bg-white"></div><div className="bg-black"></div><div className="bg-white"></div>
                  </div>
                </div>
              </div>
              <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-wider font-mono">Scan QR to Konnect</p>
            </div>
          </div>
        </div>

        {/* OVERLAY MODAL: STORIES PANEL */}
        {showStories && (
          <Stories 
            profile={profile}
            friendIds={partnerUids}
            onClose={() => setShowStories(false)}
          />
        )}

        {/* OVERLAY MODAL: ARCADE PORTAL */}
        {showGames && (
          <div className="absolute inset-0 z-40 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md h-[540px] bg-[#0c1017] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
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
