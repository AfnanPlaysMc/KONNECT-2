import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Heart, ChevronLeft, ChevronRight, Image, Type, Send, Eye,
  Sparkles, Shield, User, Globe, ArrowLeft
} from 'lucide-react';
import { 
  collection, addDoc, query, where, getDocs, doc, updateDoc, 
  onSnapshot, arrayUnion, serverTimestamp, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Story, UserProfile } from '../types';

interface StoriesProps {
  profile: UserProfile;
  friendIds: string[]; // List of friends' uids
  onClose: () => void;
}

const GRADIENTS = [
  'from-indigo-900 via-slate-900 to-fuchsia-900',
  'from-rose-900 via-neutral-900 to-rose-950',
  'from-emerald-950 via-teal-950 to-emerald-900',
  'from-cyan-900 via-blue-900 to-indigo-950',
  'from-amber-900 via-stone-900 to-stone-950',
  'from-purple-950 via-violet-900 to-purple-950'
];

export default function Stories({ profile, friendIds, onClose }: StoriesProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [activeStoryFeed, setActiveStoryFeed] = useState<Story[]>([]);
  
  // Create story panel state
  const [isCreating, setIsCreating] = useState(false);
  const [mediaType, setMediaType] = useState<'text' | 'image'>('text');
  const [storyText, setStoryText] = useState('');
  const [storyImage, setStoryImage] = useState('');
  const [selectedGradIdx, setSelectedGradIdx] = useState(0);
  const [isCloseFriendsOnly, setIsCloseFriendsOnly] = useState(false);
  const [isCustomListOnly, setIsCustomListOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Viewers list modal
  const [viewerProfiles, setViewerProfiles] = useState<UserProfile[]>([]);
  const [showViewers, setShowViewers] = useState(false);

  useEffect(() => {
    // Read active stories from Firestore
    // Stories expire after 24h, let's query stories made in the last 24h
    const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(collection(db, 'stories'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const activeStories: Story[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Story;
        const sTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        if (sTime > timeLimit) {
          activeStories.push({ ...data, id: doc.id });
        }
      });

      // Filter stories according to privacy criteria:
      // 1. Stories cannot be seen by users who are blocked by the story poster.
      // 2. Poster must be either the current user, or an added friend (not random people).
      // 3. If story has closeFriendsOnly = true, only users in close friends list can see.
      // 4. If story has customListOnly = true, only users in custom list can see.
      const filteredStories: Story[] = [];
      for (const s of activeStories) {
        // Fetch poster profile to check blocked state and close friends list
        try {
          const posterSnap = await getDoc(doc(db, 'profiles', s.userId));
          if (posterSnap.exists()) {
            const posterProf = posterSnap.data() as UserProfile;
            
            // Check blocking
            const hasBlockedMe = posterProf.blockedUsers?.includes(profile.uid);
            const iHaveBlockedThem = profile.blockedUsers?.includes(s.userId);
            if (hasBlockedMe || iHaveBlockedThem) continue;

            // Must be current user or added friend (cannot be random)
            const isFriend = friendIds.includes(s.userId);
            const isMe = s.userId === profile.uid;
            if (!isMe && !isFriend) continue;

            // Check close friends constraint
            if (s.closeFriendsOnly && !isMe) {
              const inCloseFriends = posterProf.closeFriends?.includes(profile.uid);
              if (!inCloseFriends) continue;
            }

            // Check custom list constraint
            if (s.customListOnly && !isMe) {
              const inCustomList = posterProf.customList?.includes(profile.uid);
              if (!inCustomList) continue;
            }

            filteredStories.push(s);
          }
        } catch (e) {
          console.error(e);
        }
      }

      setStories(filteredStories);
    }, (error) => {
      console.warn("Stories onSnapshot handled error:", error);
    });

    return () => unsubscribe();
  }, [profile, friendIds]);

  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newStory = {
        userId: profile.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL || '',
        mediaType,
        mediaUrl: mediaType === 'image' ? storyImage : '',
        text: storyText.trim(),
        background: mediaType === 'text' ? GRADIENTS[selectedGradIdx] : '',
        timestamp: serverTimestamp() || new Date(),
        closeFriendsOnly: isCloseFriendsOnly,
        customListOnly: isCustomListOnly,
        viewers: []
      };

      await addDoc(collection(db, 'stories'), newStory);
      
      // Reset state
      setIsCreating(false);
      setStoryText('');
      setStoryImage('');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStoryImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const viewStory = async (index: number, feed: Story[]) => {
    setActiveStoryFeed(feed);
    setActiveStoryIdx(index);
    setShowViewers(false);

    // Register view if it's not our own story and we haven't viewed yet
    const targetStory = feed[index];
    if (targetStory.userId !== profile.uid && !targetStory.viewers?.includes(profile.uid)) {
      try {
        await updateDoc(doc(db, 'stories', targetStory.id), {
          viewers: arrayUnion(profile.uid)
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleNextStory = () => {
    if (activeStoryIdx !== null && activeStoryIdx < activeStoryFeed.length - 1) {
      viewStory(activeStoryIdx + 1, activeStoryFeed);
    } else {
      setActiveStoryIdx(null);
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIdx !== null && activeStoryIdx > 0) {
      viewStory(activeStoryIdx - 1, activeStoryFeed);
    }
  };

  const fetchViewerProfiles = async (uids: string[]) => {
    try {
      const list: UserProfile[] = [];
      for (const uid of uids) {
        const snap = await getDoc(doc(db, 'profiles', uid));
        if (snap.exists()) {
          list.push(snap.data() as UserProfile);
        }
      }
      setViewerProfiles(list);
      setShowViewers(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Group stories by user for a neat tray view
  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.userId]) {
      acc[story.userId] = [];
    }
    acc[story.userId].push(story);
    return acc;
  }, {} as Record<string, Story[]>);

  const ownGroup = groupedStories[profile.uid] || [];
  const friendsGroups = Object.keys(groupedStories)
    .filter(uid => uid !== profile.uid)
    .map(uid => groupedStories[uid]);

  return (
    <div className="absolute inset-0 z-40 bg-[#07090e]/95 backdrop-blur-md flex flex-col p-6 text-slate-100">
      
      {/* HEADER */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-900 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition active:scale-95"
            title="Go back to chat"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Chat</span>
          </button>
          
          <div className="w-px h-6 bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 text-white rounded-lg"><Sparkles className="w-5 h-5 animate-pulse" /></span>
            <div>
              <h3 className="font-bold text-lg text-white">Konnect Stories</h3>
              <p className="text-xs text-slate-400">Share snippets that vanish in 24 hours.</p>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-white transition" title="Close Stories">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* FEED PORTAL */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* ADD STORY OR TRAY HEADERS */}
        <div className="flex gap-4 items-center mb-6 overflow-x-auto pb-4 border-b border-slate-900/60">
          
          {/* Own Story Trigger */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer">
            <div 
              onClick={() => {
                if (ownGroup.length > 0) {
                  viewStory(0, ownGroup);
                } else {
                  setIsCreating(true);
                }
              }}
              className="relative w-14 h-14 rounded-full border-2 border-indigo-500/40 p-0.5"
            >
              <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              <button 
                onClick={(e) => { e.stopPropagation(); setIsCreating(true); }}
                className="absolute bottom-0 right-0 p-1 bg-indigo-600 rounded-full text-white border-2 border-[#07090e]"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <span className="text-[10px] font-semibold text-slate-300">Your Story</span>
          </div>

          {/* Separator */}
          <div className="w-px h-10 bg-slate-800" />

          {/* Friends Stories */}
          {friendsGroups.length === 0 && (
            <span className="text-xs text-slate-500 italic">No friend stories posted recently.</span>
          )}

          {friendsGroups.map((group, idx) => {
            const first = group[0];
            const hasUnviewed = group.some(s => !s.viewers?.includes(profile.uid));
            return (
              <div 
                key={idx}
                onClick={() => viewStory(0, group)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full p-0.5 border-2 transition ${hasUnviewed ? 'border-indigo-500 animate-pulse' : 'border-slate-800'}`}>
                  <img src={first.photoURL} alt={first.displayName} className="w-full h-full object-cover rounded-full" />
                </div>
                <span className="text-[10px] font-semibold text-slate-300">{first.displayName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        {/* RECENT VIEW GRID */}
        <div>
          <h4 className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-3 font-mono">Recent Snaps</h4>
          {stories.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/10 border border-slate-900/60 rounded-2xl">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
              <p className="text-xs text-slate-400">Your space is silent. Click '+' to make waves.</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {stories.map((story, i) => (
                <div 
                  key={story.id} 
                  onClick={() => {
                    const group = groupedStories[story.userId] || [story];
                    const idxInGroup = group.findIndex(s => s.id === story.id);
                    viewStory(idxInGroup >= 0 ? idxInGroup : 0, group);
                  }}
                  className={`aspect-[9/16] rounded-xl overflow-hidden relative border border-slate-900 cursor-pointer hover:scale-[1.02] transition shadow-lg ${story.mediaType === 'text' ? `bg-gradient-to-tr ${story.background}` : 'bg-slate-900'}`}
                >
                  {story.mediaType === 'image' && (
                    <img src={story.mediaUrl} alt="Story content" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5">
                      <img src={story.photoURL} alt={story.displayName} className="w-5 h-5 rounded-full object-cover border border-slate-700" />
                      <span className="text-[9px] font-bold text-white truncate">{story.displayName}</span>
                    </div>

                    <div className="text-center">
                      {story.mediaType === 'text' && (
                        <p className="text-[10px] font-bold text-white line-clamp-4 leading-relaxed px-1">{story.text}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[8px] text-slate-400 font-mono">
                      <span>{story.closeFriendsOnly ? '⭐️ Close' : '🌎 Added'}</span>
                      {story.userId === profile.uid && (
                        <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {story.viewers?.length || 0}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CREATE STORY */}
      {isCreating && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c1017] border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl h-[480px]">
            <div className="px-5 py-3.5 border-b border-slate-900 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-sm text-white">Create Story Snippet</h3>
              <button onClick={() => setIsCreating(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Selector */}
              <div className="flex bg-slate-950 p-1 rounded-xl">
                <button 
                  onClick={() => setMediaType('text')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${mediaType === 'text' ? 'bg-slate-900 text-white border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Type className="w-3.5 h-3.5" /> Text Story
                </button>
                <button 
                  onClick={() => setMediaType('image')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${mediaType === 'image' ? 'bg-slate-900 text-white border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Image className="w-3.5 h-3.5" /> Image Story
                </button>
              </div>

              {/* Input section */}
              {mediaType === 'text' ? (
                <div className="space-y-4">
                  {/* Preview container */}
                  <div className={`aspect-[9/16] max-h-[160px] rounded-xl flex items-center justify-center p-4 bg-gradient-to-tr ${GRADIENTS[selectedGradIdx]} border border-slate-800`}>
                    <p className="text-xs font-extrabold text-center text-white leading-relaxed line-clamp-3">{storyText || 'Snippet text preview'}</p>
                  </div>
                  {/* Select gradient */}
                  <div className="flex gap-2">
                    {GRADIENTS.map((g, idx) => (
                      <button 
                        key={idx} 
                        type="button" 
                        onClick={() => setSelectedGradIdx(idx)}
                        className={`w-8 h-8 rounded-full bg-gradient-to-tr ${g} border-2 ${selectedGradIdx === idx ? 'border-indigo-400' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                  <textarea
                    required
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    placeholder="Enter story text overlay..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="aspect-[9/16] max-h-[160px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                    {storyImage ? (
                      <img src={storyImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-600">No image uploaded</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-center cursor-pointer hover:bg-slate-800 text-slate-300">
                      Upload Story Image
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    placeholder="Enter short caption (optional)..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Privacy Circle select */}
              <div className="pt-3 border-t border-slate-900 space-y-2.5">
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono">Custom audience circle</label>
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={isCloseFriendsOnly} 
                      onChange={e => {
                        setIsCloseFriendsOnly(e.target.checked);
                        if (e.target.checked) setIsCustomListOnly(false);
                      }}
                      className="accent-indigo-500"
                    />
                    ⭐️ Close Friends
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={isCustomListOnly} 
                      onChange={e => {
                        setIsCustomListOnly(e.target.checked);
                        if (e.target.checked) setIsCloseFriendsOnly(false);
                      }}
                      className="accent-indigo-500"
                    />
                    🔒 Custom list Only
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-900 bg-slate-950/20 flex gap-3">
              <button onClick={() => setIsCreating(false)} className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-400 rounded-xl">Cancel</button>
              <button 
                onClick={handlePostStory} 
                disabled={loading || (mediaType === 'text' && !storyText) || (mediaType === 'image' && !storyImage)}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-xl disabled:opacity-40"
              >
                {loading ? 'Posting Snap...' : 'Share story'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STORY VIEWER FULLSCREEN PORTAL */}
      {activeStoryIdx !== null && (
        <div className="fixed inset-0 z-50 bg-[#000] flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 left-4 flex gap-2">
            <button 
              onClick={() => setActiveStoryIdx(null)}
              className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full max-w-sm aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Story display */}
            {activeStoryFeed[activeStoryIdx].mediaType === 'text' ? (
              <div className={`absolute inset-0 bg-gradient-to-tr ${activeStoryFeed[activeStoryIdx].background} flex items-center justify-center p-6 text-center`}>
                <p className="text-base font-extrabold text-white leading-relaxed">{activeStoryFeed[activeStoryIdx].text}</p>
              </div>
            ) : (
              <div className="absolute inset-0 bg-slate-950">
                <img src={activeStoryFeed[activeStoryIdx].mediaUrl} alt="Story" className="w-full h-full object-cover opacity-90" />
                {activeStoryFeed[activeStoryIdx].text && (
                  <div className="absolute bottom-16 left-0 right-0 p-4 text-center bg-black/40 backdrop-blur-sm">
                    <p className="text-xs font-semibold text-white leading-relaxed">{activeStoryFeed[activeStoryIdx].text}</p>
                  </div>
                )}
              </div>
            )}

            {/* Top Indicator lines */}
            <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
              {activeStoryFeed.map((_, i) => (
                <div key={i} className={`flex-1 h-1 rounded-full overflow-hidden ${i === activeStoryIdx ? 'bg-indigo-500' : i < activeStoryIdx ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>

            {/* Upper profile tray */}
            <div className="absolute top-6 left-4 right-4 flex justify-between items-center z-10 bg-black/20 p-2 rounded-xl backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <img src={activeStoryFeed[activeStoryIdx].photoURL} alt="Poster" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                <div>
                  <h4 className="text-xs font-bold text-white">{activeStoryFeed[activeStoryIdx].displayName}</h4>
                  <p className="text-[9px] text-slate-300 font-mono">
                    {activeStoryFeed[activeStoryIdx].closeFriendsOnly ? '⭐️ Close Friends' : '🌍 Public Added'}
                  </p>
                </div>
              </div>
            </div>

            {/* Left and Right navigation clicks */}
            <div className="absolute inset-0 flex">
              <div onClick={handlePrevStory} className="w-1/3 h-full cursor-left" />
              <div onClick={handleNextStory} className="w-2/3 h-full cursor-right" />
            </div>

            {/* Bottom Viewers count details (Only for own story) */}
            {activeStoryFeed[activeStoryIdx].userId === profile.uid && (
              <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
                <button 
                  onClick={() => fetchViewerProfiles(activeStoryFeed[activeStoryIdx].viewers || [])}
                  className="px-4 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur border border-slate-800/80 rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 shadow"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" /> Viewers: {activeStoryFeed[activeStoryIdx].viewers?.length || 0}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEWER MODAL DETAILED LIST */}
      {showViewers && (
        <div className="absolute inset-0 z-50 bg-[#07090e]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#0c1017] border border-slate-800 rounded-2xl p-4 flex flex-col shadow-2xl max-h-[300px]">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-xs text-white">Story Viewers List</h4>
              <button onClick={() => setShowViewers(false)} className="p-1 hover:bg-slate-800 rounded-full text-slate-400"><X className="w-3.5 h-3.5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {viewerProfiles.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic text-center py-6">No viewers registered yet.</p>
              ) : (
                viewerProfiles.map((p) => (
                  <div key={p.uid} className="flex items-center gap-2 p-1.5 bg-slate-950/20 border border-slate-900 rounded-xl">
                    <img src={p.photoURL} alt={p.displayName} className="w-6 h-6 rounded-full object-cover" />
                    <span className="text-[11px] font-semibold text-slate-300">{p.displayName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
