import React, { useState, useEffect } from 'react';
import { 
  X, Shield, Palette, Volume2, User, EyeOff, Check, Ban, AlertCircle, 
  Upload, Sparkles, UserCheck, Smartphone, Eye, LogOut, ArrowLeft
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, updateDoc, getDocs, collection, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, THEMES, NOTIFICATION_SOUNDS } from '../types';

interface SettingsProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onClose: () => void;
}

export default function Settings({ profile, onUpdateProfile, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'privacy' | 'sounds'>('profile');
  
  const activeThemeObj = THEMES.find(t => t.id === (profile.theme || 'deep-dark')) || THEMES[0];
  const isLight = activeThemeObj.id === 'blue-white';
  
  // Profile form states
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio || '');
  const [pfp, setPfp] = useState(profile.photoURL || '');
  const [banner, setBanner] = useState(profile.bannerURL || '');
  
  // Privacy states
  const [stealthMode, setStealthMode] = useState(profile.stealthMode);
  const [readReceipts, setReadReceipts] = useState(profile.readReceipts);
  const [blockedProfiles, setBlockedProfiles] = useState<UserProfile[]>([]);
  const [closeFriendsProfiles, setCloseFriendsProfiles] = useState<UserProfile[]>([]);
  
  // Custom sound list contact selection state
  const [soundContacts, setSoundContacts] = useState<{ id: string; name: string; sound: string }[]>([]);
  const [selectedContactForSound, setSelectedContactForSound] = useState<string>('');
  const [selectedSoundId, setSelectedSoundId] = useState<string>('default');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Fetch blocked users and close friends details
  useEffect(() => {
    fetchPrivacyData();
  }, [profile]);

  const fetchPrivacyData = async () => {
    try {
      // Load Blocked
      if (profile.blockedUsers && profile.blockedUsers.length > 0) {
        const list: UserProfile[] = [];
        for (const uid of profile.blockedUsers) {
          const d = await getDoc(doc(db, 'profiles', uid));
          if (d.exists()) list.push(d.data() as UserProfile);
        }
        setBlockedProfiles(list);
      } else {
        setBlockedProfiles([]);
      }

      // Load Close Friends
      if (profile.closeFriends && profile.closeFriends.length > 0) {
        const list: UserProfile[] = [];
        for (const uid of profile.closeFriends) {
          const d = await getDoc(doc(db, 'profiles', uid));
          if (d.exists()) list.push(d.data() as UserProfile);
        }
        setCloseFriendsProfiles(list);
      } else {
        setCloseFriendsProfiles([]);
      }

      // Load contact names for Custom Sounds (e.g., let's read profiles that are friend status in chats)
      // For this simple mock/query, we fetch profiles of users they have interacted with
      const qSnap = await getDocs(collection(db, 'profiles'));
      const activeContacts: { id: string; name: string; sound: string }[] = [];
      qSnap.forEach((d) => {
        const p = d.data() as UserProfile;
        if (p.uid !== profile.uid && !profile.blockedUsers?.includes(p.uid)) {
          const assignedSound = profile.notificationSounds?.[p.uid] || 'default';
          activeContacts.push({ id: p.uid, name: p.displayName, sound: assignedSound });
        }
      });
      setSoundContacts(activeContacts);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    try {
      // Check username availability if changed
      if (cleanUsername !== profile.username) {
        const q = query(collection(db, 'profiles'), where('username', '==', cleanUsername));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          throw new Error('Username already taken. Please choose another.');
        }
      }

      const updated = {
        ...profile,
        displayName: displayName.trim(),
        username: cleanUsername,
        bio: bio.trim(),
        photoURL: pfp,
        bannerURL: banner
      };

      await updateDoc(doc(db, 'profiles', profile.uid), {
        displayName: updated.displayName,
        username: updated.username,
        bio: updated.bio,
        photoURL: updated.photoURL,
        bannerURL: updated.bannerURL
      });

      onUpdateProfile(updated);
      setMessage('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const selectTheme = async (themeId: string) => {
    const updated = { ...profile, theme: themeId };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { theme: themeId });
      onUpdateProfile(updated);
      setMessage(`Theme swapped to ${THEMES.find(t => t.id === themeId)?.name}!`);
    } catch (e) {
      setError('Failed to update theme');
    }
  };

  const updateCustomBackground = async (bgUrl: string | null) => {
    const updated = { ...profile, customBackground: bgUrl || '' };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { customBackground: bgUrl || '' });
      onUpdateProfile(updated);
      setMessage(bgUrl ? 'Custom background wallpaper applied!' : 'Wallpaper reset to standard preset.');
    } catch (e) {
      setError('Failed to update background wallpaper');
    }
  };

  const toggleStealth = async () => {
    const next = !stealthMode;
    setStealthMode(next);
    const updated = { ...profile, stealthMode: next };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { stealthMode: next });
      onUpdateProfile(updated);
    } catch (e) {
      setStealthMode(!next);
    }
  };

  const toggleReadReceipts = async () => {
    const next = !readReceipts;
    setReadReceipts(next);
    const updated = { ...profile, readReceipts: next };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { readReceipts: next });
      onUpdateProfile(updated);
    } catch (e) {
      setReadReceipts(!next);
    }
  };

  const unblockUser = async (uid: string) => {
    const nextBlocked = profile.blockedUsers.filter(id => id !== uid);
    const updated = { ...profile, blockedUsers: nextBlocked };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { blockedUsers: nextBlocked });
      onUpdateProfile(updated);
      setBlockedProfiles(prev => prev.filter(p => p.uid !== uid));
      setMessage('User unblocked!');
    } catch (e) {
      setError('Failed to unblock user');
    }
  };

  const removeCloseFriend = async (uid: string) => {
    const nextFriends = profile.closeFriends.filter(id => id !== uid);
    const updated = { ...profile, closeFriends: nextFriends };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { closeFriends: nextFriends });
      onUpdateProfile(updated);
      setCloseFriendsProfiles(prev => prev.filter(p => p.uid !== uid));
    } catch (e) {
      setError('Failed to update Close Friends');
    }
  };

  const saveCustomSound = async () => {
    if (!selectedContactForSound) return;
    const currentSounds = { ...(profile.notificationSounds || {}) };
    currentSounds[selectedContactForSound] = selectedSoundId;

    const updated = { ...profile, notificationSounds: currentSounds };
    try {
      await updateDoc(doc(db, 'profiles', profile.uid), { notificationSounds: currentSounds });
      onUpdateProfile(updated);
      setMessage('Custom notification sound bound!');
      
      // Play brief synthesized demo sound
      playDemoSound(selectedSoundId);
      
      // Refresh list
      fetchPrivacyData();
    } catch (e) {
      setError('Failed to save sound settings');
    }
  };

  const playDemoSound = (soundId: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      if (soundId === 'chime') {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (soundId === 'glass') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (soundId === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (soundId === 'retro') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (soundId === 'synth') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // default ping
        osc.frequency.setValueAtTime(440, now); // A4
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (err) {
      console.warn('Audio synthesis not supported or gesture missing', err);
    }
  };

  const handlePfpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPfp(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBanner(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#07090e]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-full max-w-2xl h-[560px] ${activeThemeObj.card} border ${activeThemeObj.border} rounded-2xl overflow-hidden flex shadow-2xl ${activeThemeObj.text} transition-all`}>
        
        {/* SIDEBAR TABS */}
        <div className={`w-52 bg-black/10 border-r ${activeThemeObj.border} p-4 flex flex-col justify-between`}>
          <div className="space-y-1.5">
            <h4 className={`text-[10px] uppercase font-bold tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'} mb-4 px-2`}>Konnect Settings</h4>
            
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${activeTab === 'profile' ? (isLight ? 'bg-blue-500/10 text-blue-600 border border-blue-200' : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400') : (isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}`}
            >
              <User className="w-4 h-4" /> Personalize
            </button>

            <button 
              onClick={() => setActiveTab('theme')}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${activeTab === 'theme' ? (isLight ? 'bg-blue-500/10 text-blue-600 border border-blue-200' : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400') : (isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}`}
            >
              <Palette className="w-4 h-4" /> Space Themes
            </button>

            <button 
              onClick={() => setActiveTab('privacy')}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${activeTab === 'privacy' ? (isLight ? 'bg-blue-500/10 text-blue-600 border border-blue-200' : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400') : (isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}`}
            >
              <Shield className="w-4 h-4" /> Stealth & Block list
            </button>

            <button 
              onClick={() => setActiveTab('sounds')}
              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition ${activeTab === 'sounds' ? (isLight ? 'bg-blue-500/10 text-blue-600 border border-blue-200' : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400') : (isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}`}
            >
              <Volume2 className="w-4 h-4" /> Custom Sounds
            </button>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => {
                if (window.confirm('Are you sure you want to log out?')) {
                  signOut(auth);
                  window.location.reload();
                }
              }}
              type="button"
              className="w-full py-2.5 bg-rose-950/20 hover:bg-rose-600 border border-rose-900/40 text-rose-400 hover:text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" /> Log Out
            </button>

            <div className={`text-[9px] ${isLight ? 'text-slate-400' : 'text-slate-500'} font-mono text-center`}>
              Konnect v2.4.0<br/>By Oxa LLC
            </div>
          </div>
        </div>

        {/* DETAILS SECTION */}
        <div className="flex-1 flex flex-col overflow-hidden bg-black/5">
          
          {/* HEADER */}
          <div className={`flex justify-between items-center px-6 py-4 border-b ${activeThemeObj.border} bg-black/5`}>
            <div className="flex items-center gap-4 min-w-0">
              <button 
                onClick={onClose}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'} text-xs font-bold rounded-xl border transition active:scale-95 flex-shrink-0`}
                title="Go back to chat"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="min-w-0">
                <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'} leading-tight truncate`}>
                  {activeTab === 'profile' && 'Personal Profile ID'}
                  {activeTab === 'theme' && 'Visual Spaces'}
                  {activeTab === 'privacy' && 'Advanced Stealth Space'}
                  {activeTab === 'sounds' && 'Acoustic Notification Mapping'}
                </h3>
                <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'} line-clamp-1`}>
                  {activeTab === 'profile' && 'Change your name, custom username bio or banner.'}
                  {activeTab === 'theme' && 'Swap styles between AMOLED obsidian and vibrant cyber neon.'}
                  {activeTab === 'privacy' && 'Stealth state control, block list editing and stories list.'}
                  {activeTab === 'sounds' && 'Assign custom auditory signatures to individual contacts.'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={`p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'} transition`} title="Close Settings">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* INTERNAL CONTENT */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {message && (
              <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{message}</span>
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                {/* Banner Banner */}
                <div className="relative group rounded-xl overflow-hidden h-24 bg-slate-800">
                  <img src={banner} alt="Banner" className="w-full h-full object-cover opacity-80" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer text-xs font-semibold gap-1.5 text-white">
                    <Upload className="w-3.5 h-3.5" /> Upload Banner
                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                  </label>
                  
                  {/* Pfp overlay */}
                  <div className="absolute bottom-2 left-4">
                    <div className="relative w-12 h-12 rounded-full border border-[#0c1017] overflow-hidden group bg-slate-700 shadow-md">
                      <img src={pfp} alt="Avatar" className="w-full h-full object-cover" />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={handlePfpUpload} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Display Name</label>
                    <input 
                      type="text" 
                      required
                      value={displayName} 
                      onChange={e => setDisplayName(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Username Handle</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 text-xs">@</span>
                      <input 
                        type="text" 
                        required
                        value={username} 
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} 
                        className="w-full pl-6 pr-3 py-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Self Biography</label>
                  <textarea 
                    value={bio} 
                    onChange={e => setBio(e.target.value)} 
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition"
                >
                  {loading ? 'Saving ID parameters...' : 'Lock profile parameters'}
                </button>
              </form>
            )}

            {/* TAB: THEMES */}
            {activeTab === 'theme' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2.5 font-mono">Select Theme Preset</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => selectTheme(th.id)}
                        className={`p-4 rounded-2xl text-left border relative overflow-hidden transition-all duration-200 hover:scale-[1.02] ${th.bg} ${profile.theme === th.id ? 'border-indigo-500 ring-2 ring-indigo-500/40' : 'border-slate-800/80 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-bold text-xs ${th.id === 'blue-white' ? 'text-slate-800' : 'text-slate-200'}`}>{th.name}</span>
                          {profile.theme === th.id && (
                            <span className="p-0.5 bg-indigo-500 text-white rounded-full flex items-center justify-center w-4 h-4"><Check className="w-2.5 h-2.5" /></span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded bg-slate-900 border border-slate-800" />
                          <div className={`w-4 h-4 rounded ${th.primary}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-4">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1 font-mono">Custom Background Wallpaper</h4>
                  <p className="text-[10px] text-slate-500 mb-3.5 leading-relaxed">Choose an background image or upload your own to personalize your Konnect app background.</p>
                  
                  {/* Preset Wallpaper Options */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { name: 'Sleek Silk', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000' },
                      { name: 'Abstract Blue', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1000' },
                      { name: 'Pastel Marble', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1000' },
                      { name: 'Cosmic Nebula', url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1000' }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => updateCustomBackground(preset.url)}
                        className={`group relative h-14 rounded-xl overflow-hidden border transition ${profile.customBackground === preset.url ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800/80 hover:border-slate-700'}`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white uppercase text-center font-mono leading-tight px-1">{preset.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Upload Custom & Reset buttons */}
                  <div className="flex gap-2.5">
                    <label className="flex-1 py-2 px-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Upload Wallpaper</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              if (reader.result) {
                                updateCustomBackground(reader.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>

                    {profile.customBackground && (
                      <button
                        type="button"
                        onClick={() => updateCustomBackground(null)}
                        className="py-2 px-4 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/40 text-rose-400 hover:text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                      >
                        Reset Background
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRIVACY */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                {/* Toggles */}
                <div className="space-y-3.5 bg-slate-950/30 border border-slate-900 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> Stealth Mode
                      </h4>
                      <p className="text-[10px] text-slate-400">Mask last seen activity parameter and hide online status from all users.</p>
                    </div>
                    <button 
                      onClick={toggleStealth}
                      className={`w-9 h-5 rounded-full p-0.5 transition ${stealthMode ? 'bg-indigo-500' : 'bg-slate-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${stealthMode ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="border-t border-slate-900 my-2" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-indigo-400" /> Read Receipts (Blue ticks)
                      </h4>
                      <p className="text-[10px] text-slate-400">If disabled, you will not send or view read receipts for standard chats.</p>
                    </div>
                    <button 
                      onClick={toggleReadReceipts}
                      className={`w-9 h-5 rounded-full p-0.5 transition ${readReceipts ? 'bg-indigo-500' : 'bg-slate-800'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-all ${readReceipts ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Blocked Users */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-red-400" /> Blocked Friends Grid ({blockedProfiles.length})
                  </h4>
                  {blockedProfiles.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic bg-slate-950/20 p-3 rounded-xl border border-slate-900/60">No blocked users.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {blockedProfiles.map((b) => (
                        <div key={b.uid} className="flex items-center justify-between p-2 bg-slate-950/20 border border-slate-900 rounded-xl">
                          <div className="flex items-center gap-2">
                            <img src={b.photoURL} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                            <span className="text-xs font-semibold text-slate-300">{b.displayName} (@{b.username})</span>
                          </div>
                          <button 
                            onClick={() => unblockUser(b.uid)}
                            className="text-[10px] bg-indigo-950 hover:bg-indigo-900 border border-indigo-900 hover:border-indigo-800 text-indigo-400 px-2 py-1 rounded-lg font-medium transition"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close Friends */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Close Friends Stories Circle ({closeFriendsProfiles.length})
                  </h4>
                  {closeFriendsProfiles.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic bg-slate-950/20 p-3 rounded-xl border border-slate-900/60">No close friends listed. (Add friends to close list in sidebar profiles to limit story views).</p>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                      {closeFriendsProfiles.map((f) => (
                        <div key={f.uid} className="flex items-center justify-between p-2 bg-slate-950/20 border border-slate-900 rounded-xl">
                          <div className="flex items-center gap-2">
                            <img src={f.photoURL} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                            <span className="text-xs font-semibold text-slate-300">{f.displayName}</span>
                          </div>
                          <button 
                            onClick={() => removeCloseFriend(f.uid)}
                            className="text-[10px] bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 px-2 py-1 rounded-lg font-medium transition"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: SOUNDS */}
            {activeTab === 'sounds' && (
              <div className="space-y-5">
                <div className="bg-slate-950/30 border border-slate-900 p-4 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">Select Contact Mapping</label>
                    <select 
                      value={selectedContactForSound} 
                      onChange={e => {
                        setSelectedContactForSound(e.target.value);
                        const cont = soundContacts.find(sc => sc.id === e.target.value);
                        if (cont) setSelectedSoundId(cont.sound);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Contact --</option>
                      {soundContacts.map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.name} ({sc.sound})</option>
                      ))}
                    </select>
                  </div>

                  {selectedContactForSound && (
                    <div>
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5">Assign Custom Sound Effect</label>
                      <div className="grid grid-cols-2 gap-2">
                        {NOTIFICATION_SOUNDS.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSoundId(s.id);
                              playDemoSound(s.id);
                            }}
                            className={`p-2.5 rounded-xl border text-xs font-semibold text-left flex items-center justify-between transition ${selectedSoundId === s.id ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-slate-900 border-slate-800/80 hover:bg-slate-800 text-slate-300'}`}
                          >
                            <span>{s.name}</span>
                            <span className="text-[10px] opacity-60">▶</span>
                          </button>
                        ))}
                      </div>

                      <button 
                        onClick={saveCustomSound}
                        className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl shadow transition"
                      >
                        Confirm Custom Sound Allocation
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-indigo-950/30 border border-indigo-900/60 rounded-xl text-[11px] text-indigo-300 flex items-start gap-2 leading-relaxed">
                  <Volume2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>These audio mapping specifications use local synthesizer components to alert you when chosen contacts post messages or trigger real-time games.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
