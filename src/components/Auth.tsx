import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { UserProfile, THEMES } from '../types';
import { MessageSquare, Shield, Key, Mail, Phone, ArrowRight, User, Check, Flame, Upload } from 'lucide-react';

interface AuthProps {
  onAuthSuccess: (profile: UserProfile) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone' | 'google'>('email');
  
  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Phone fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  
  // Profile onboarding fields
  const [onboarding, setOnboarding] = useState(false);
  const [tempProfile, setTempProfile] = useState<{ uid: string; email?: string; phoneNumber?: string }>({ uid: '' });
  const [username, setUsername] = useState('');
  const [profileName, setProfileName] = useState('');
  const [selectedPfp, setSelectedPfp] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150');
  const [selectedBanner, setSelectedBanner] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800');
  const [bio, setBio] = useState('Hey there! I am using Konnect.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Default avatar presets for sleek profiles
  const avatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'
  ];

  // Default banner presets
  const banners = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800',
    'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?w=800',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=800'
  ];

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        if (!email || !password || !displayName) {
          throw new Error('Please fill all fields');
        }
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Put in onboarding phase to choose username
        setTempProfile({ uid: userCred.user.uid, email: userCred.user.email || '' });
        setProfileName(displayName);
        // Pre-fill username based on display name
        setUsername(displayName.toLowerCase().replace(/[^a-z0-9]/g, ''));
        setOnboarding(true);
      } else {
        if (!email || !password) {
          throw new Error('Please enter email and password');
        }
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        await checkUserProfile(userCred.user.uid);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const checkUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'profiles', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        onAuthSuccess(data);
      } else {
        // Needs onboarding
        const user = auth.currentUser;
        setTempProfile({ uid, email: user?.email || '', phoneNumber: user?.phoneNumber || '' });
        setProfileName(user?.displayName || 'New User');
        setUsername((user?.email ? user.email.split('@')[0] : 'user_' + uid.substring(0, 5)).toLowerCase().replace(/[^a-z0-9]/g, ''));
        setOnboarding(true);
      }
    } catch (err: any) {
      setError('Failed to fetch profile: ' + err.message);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      // Direct sign-in attempt
      const result = await signInWithPopup(auth, googleProvider);
      await checkUserProfile(result.user.uid);
    } catch (err: any) {
      console.warn('Popup blocked or failed, offering standard fallback options.', err);
      setError('Google Sign-In popup could not complete. Providing quick bypass option for development / iframe testing.');
    } finally {
      setLoading(false);
    }
  };

  // Immediate developer/preview test login option (bypass iframe popup restriction block safely)
  const handleIframeBypassAuth = async () => {
    setError('');
    setLoading(true);
    try {
      // We can generate or login to a beautiful tester account using a stable custom test login
      // e.g. tester@konnect.com, which is brilliant for iframe previewers!
      const testEmail = `tester_${Math.floor(Math.random() * 1000)}@konnect.com`;
      const testPass = 'konnect123';
      
      // Let's sign up or sign in a tester
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, 'admin_tester@konnect.com', 'konnect123');
      } catch {
        userCred = await createUserWithEmailAndPassword(auth, 'admin_tester@konnect.com', 'konnect123');
      }
      await checkUserProfile(userCred.user.uid);
    } catch (err: any) {
      setError('Fallback login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (phoneStep === 1) {
        if (!phoneNumber.trim()) throw new Error('Enter a valid phone number');
        // Simulated / sandbox Phone Auth for robust iframe compatibility!
        // Standard SMS sends fail inside nested dev containers without custom captcha domains.
        // We will mock verify or simulate it with test codes.
        setPhoneStep(2);
      } else {
        if (!otpCode.trim()) throw new Error('Enter the 6-digit confirmation code');
        
        // Let's create a simulated test sign-in with phone UID for iframe
        const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
        const mockUid = 'phone_auth_' + cleanPhone.substring(cleanPhone.length - 8);
        
        // Save user details
        setTempProfile({ uid: mockUid, phoneNumber: cleanPhone });
        setProfileName('User ' + cleanPhone.substring(cleanPhone.length - 4));
        setUsername('user_' + cleanPhone.substring(cleanPhone.length - 4));
        
        await checkUserProfile(mockUid);
      }
    } catch (err: any) {
      setError(err.message || 'Phone verification failed');
    } finally {
      setLoading(false);
    }
  };

  const checkUsernameAvailability = async (uname: string): Promise<boolean> => {
    const q = query(collection(db, 'profiles'), where('username', '==', uname.trim().toLowerCase()));
    const querySnap = await getDocs(q);
    if (querySnap.empty) return true;
    
    // Available if it belongs to the current user
    let available = true;
    querySnap.forEach((doc) => {
      if (doc.id !== tempProfile.uid) {
        available = false;
      }
    });
    return available;
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    try {
      const isAvailable = await checkUsernameAvailability(cleanUsername);
      if (!isAvailable) {
        throw new Error('Username is already taken. Please choose another.');
      }

      const newProfile: UserProfile = {
        uid: tempProfile.uid,
        displayName: profileName.trim() || 'Anonymous User',
        username: cleanUsername,
        email: tempProfile.email || '',
        phoneNumber: tempProfile.phoneNumber || '',
        photoURL: selectedPfp,
        bannerURL: selectedBanner,
        bio: bio.trim(),
        blockedUsers: [],
        closeFriends: [],
        customList: [],
        theme: 'deep-dark',
        stealthMode: false,
        readReceipts: true,
        notificationSounds: {},
        status: 'online',
        lastSeen: new Date()
      };

      await setDoc(doc(db, 'profiles', tempProfile.uid), newProfile);
      onAuthSuccess(newProfile);
    } catch (err: any) {
      setError(err.message || 'Failed to complete profile onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handlePfpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPfp(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedBanner(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4 text-[#e2e8f0]">
      {/* Dynamic Background Elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-lg bg-[#0e121a] border border-slate-800/80 rounded-2xl p-8 shadow-2xl overflow-hidden">
        {/* Top Header Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-xl mb-3 shadow-lg shadow-indigo-500/20">
            <MessageSquare className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-slate-100 to-fuchsia-200">
            {onboarding ? 'Complete Your Profile' : 'Konnect'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {onboarding ? 'Set up your handle and identity' : 'Sleek. Secure. Realtime.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-sm flex items-start gap-3">
            <span className="font-semibold text-red-400 mt-0.5">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* ONBOARDING PANEL */}
        {onboarding ? (
          <form onSubmit={handleCompleteOnboarding} className="space-y-6">
            {/* Banner & Pfp edit */}
            <div className="relative mb-6">
              <div className="w-full h-24 rounded-lg overflow-hidden relative group bg-slate-800">
                <img src={selectedBanner} alt="Banner" className="w-full h-full object-cover opacity-80" />
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer text-xs font-semibold gap-1.5">
                  <Upload className="w-4 h-4" /> Change Banner
                  <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                </label>
              </div>

              {/* Presets of Banner */}
              <div className="flex gap-2 mt-2">
                {banners.map((b, i) => (
                  <button 
                    key={i} 
                    type="button" 
                    onClick={() => setSelectedBanner(b)}
                    className={`w-10 h-6 rounded-md overflow-hidden border ${selectedBanner === b ? 'border-indigo-400' : 'border-slate-800'}`}
                  >
                    <img src={b} alt="Preset banner" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              {/* Profile pic overlay */}
              <div className="absolute -bottom-8 left-6">
                <div className="relative w-16 h-16 rounded-full border-2 border-[#0e121a] overflow-hidden group bg-slate-700 shadow-md">
                  <img src={selectedPfp} alt="Avatar" className="w-full h-full object-cover" />
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                    <Upload className="w-3 h-3 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePfpUpload} />
                  </label>
                </div>
              </div>
            </div>

            {/* Avatar presets */}
            <div className="pt-6">
              <label className="block text-xs text-slate-400 mb-2 font-medium">Or select a high-fidelity preset avatar:</label>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {avatars.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPfp(av)}
                    className={`w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 transition-all ${selectedPfp === av ? 'border-fuchsia-400 scale-105' : 'border-slate-800'}`}
                  >
                    <img src={av} alt="Avatar preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Username (Unique handle)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-500 text-sm font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="john_doe"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Finalizing Profile...' : 'Launch Konnect Space'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* STANDARD SIGN-IN / SIGN-UP */
          <div>
            {/* Tab selection */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl mb-6">
              <button 
                onClick={() => { setAuthMethod('email'); setIsSignUp(false); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${authMethod === 'email' ? 'bg-[#0e121a] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button 
                onClick={() => { setAuthMethod('phone'); setPhoneStep(1); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${authMethod === 'phone' ? 'bg-[#0e121a] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Phone className="w-3.5 h-3.5" /> Phone
              </button>
              <button 
                onClick={() => { setAuthMethod('google'); handleGoogleAuth(); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${authMethod === 'google' ? 'bg-[#0e121a] text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Shield className="w-3.5 h-3.5" /> Google
              </button>
            </div>

            {/* EMAIL METHOD */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Secret Password</label>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : isSignUp ? 'Create Premium Account' : 'Sign In securely'}
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    {isSignUp ? 'Already registered? Login here' : 'New to Konnect? Create an account'}
                  </button>
                </div>
              </form>
            )}

            {/* PHONE METHOD */}
            {authMethod === 'phone' && (
              <form onSubmit={handlePhoneAuthSubmit} className="space-y-4">
                {phoneStep === 1 ? (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 019-2834"
                        className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Enter full mobile number including your country code. Note: SMS is simulated to bypass container/sandbox domain limitations.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wider">6-Digit Verification OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-[1em] py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-lg font-mono text-white focus:outline-none focus:border-indigo-500 transition-all"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[10px] text-slate-500">OTP code is simulated. Enter any digits to test!</p>
                      <button type="button" onClick={() => setPhoneStep(1)} className="text-xs text-indigo-400 font-medium hover:underline">Change number</button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all"
                >
                  {phoneStep === 1 ? 'Send Verification OTP' : 'Complete Verification'}
                </button>
              </form>
            )}

            {/* GOOGLE AND FALLBACK MOCK OPTIONS */}
            {authMethod === 'google' && (
              <div className="space-y-4 py-4 text-center">
                <p className="text-sm text-slate-400">
                  Google Account secure verification. Direct iframe logins can sometimes be blocked by sandbox iframe restrictions.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.97 1 12 1 7.35 1 3.39 3.65 1.5 7.5l3.8 2.95C6.2 7.37 8.9 5.04 12 5.04z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.97 3.38-4.87 3.38-8.51z"/>
                    <path fill="#FBBC05" d="M5.3 14.95c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.5 7.42C.54 9.34 0 11.48 0 13.73s.54 4.39 1.5 6.31l3.8-3.09z"/>
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.3 1.08-4.3 1.08-3.1 0-5.8-2.33-6.7-5.41L1.5 15.96C3.39 19.81 7.35 23 12 23z"/>
                  </svg>
                  Connect with Google Account
                </button>
              </div>
            )}

            {/* INSTANT IFRAME BYPASS OPTION */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <span className="relative px-3 text-[10px] uppercase text-slate-500 bg-[#0e121a]">Convenient Iframe Testing</span>
            </div>

            <button
              type="button"
              onClick={handleIframeBypassAuth}
              className="w-full py-2.5 bg-gradient-to-r from-[#111827] to-[#1f2937] hover:from-[#1f2937] hover:to-[#374151] border border-slate-800/80 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              Demo Direct Entry (Skip Popups/Captchas)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
