import React, { useState, useEffect } from 'react';
import { Search, Share2, Sparkles, Check, Phone, Mail, ArrowRight, Smartphone, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { 
  authenticateGoogleForContacts, 
  fetchGoogleContacts, 
  getGoogleAccessToken, 
  GoogleContact 
} from '../googleTokenStore';

interface GoogleContactsViewProps {
  isLight: boolean;
  activeThemeObj: any;
}

export default function GoogleContactsView({ isLight, activeThemeObj }: GoogleContactsViewProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [hasToken, setHasToken] = useState(!!getGoogleAccessToken());

  const inviteMessage = "Join KONNECT BY OXA LLC! It's very good. Join here: https://konnect-oxa.vercel.app";

  useEffect(() => {
    if (hasToken) {
      loadContacts();
    }
  }, [hasToken]);

  const loadContacts = async () => {
    const token = getGoogleAccessToken();
    if (!token) {
      setHasToken(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const list = await fetchGoogleContacts(token);
      setContacts(list);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'UNAUTHORIZED') {
        setHasToken(false);
        setError('Your Google session has expired. Please connect again.');
      } else {
        setError('Failed to load contacts. Please verify API configuration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      await authenticateGoogleForContacts();
      setHasToken(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to authenticate with Google Contacts.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = (contact: GoogleContact, index: number) => {
    const phone = contact.phoneNumber.replace(/[^0-9+]/g, '');
    
    // Copy link automatically for ease of sharing anywhere
    try {
      navigator.clipboard.writeText(inviteMessage);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 3000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }

    if (phone) {
      // Build SMS URL. Standard: sms:123456?body=text
      // iOS has some variations, but sms:123456?body=text is widely compatible.
      const smsUrl = `sms:${phone}?body=${encodeURIComponent(inviteMessage)}`;
      window.location.href = smsUrl;
    } else {
      // If no phone number, fallback to email or clipboard copy
      if (contact.email) {
        const mailUrl = `mailto:${contact.email}?subject=${encodeURIComponent("Join Konnect!")}&body=${encodeURIComponent(inviteMessage)}`;
        window.location.href = mailUrl;
      }
    }
  };

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      {!hasToken ? (
        <div className={`p-6 text-center border rounded-2xl ${
          isLight 
            ? 'bg-slate-50 border-slate-200' 
            : 'bg-[#0a0d14] border-slate-800'
        } flex flex-col items-center justify-center space-y-4`}>
          <div className="p-3.5 bg-indigo-500/10 text-indigo-400 rounded-full">
            <Smartphone className="w-8 h-8" />
          </div>
          <div className="max-w-md">
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Connect your Google Contacts</h4>
            <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Sync your Google contacts to quickly invite friends to **Konnect by Oxa LLC** and chat securely in real-time. Google Might say "NOT SAFE" but dont worry about your privacy!
            </p>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={loading}
            className={`px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl transition flex items-center gap-2 active:scale-95 disabled:opacity-50`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sync Google Contacts</span>
              </>
            )}
          </button>
          
          {error && (
            <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search synced contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 transition ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-800 focus:ring-blue-500/50 focus:border-blue-500' 
                    : 'bg-slate-950/60 border-slate-800/80 text-white focus:ring-indigo-500/50 focus:border-indigo-500'
                }`}
              />
            </div>
            
            <button 
              onClick={loadContacts} 
              disabled={loading}
              className={`px-3.5 py-2 border text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 ${
                isLight 
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700' 
                  : 'bg-slate-900/40 hover:bg-slate-900/80 border-slate-800/80 text-slate-300'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-rose-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Contact List */}
          {loading && contacts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs text-slate-500 font-mono">Fetching Google Contacts...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              {searchQuery ? 'No contacts matched your search' : 'No contacts found'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 max-h-[320px] md:max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredContacts.map((contact, idx) => {
                const initials = contact.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                const hasPhone = !!contact.phoneNumber;
                
                return (
                  <div 
                    key={contact.resourceName || idx}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isLight 
                        ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80' 
                        : 'bg-[#080b12] hover:bg-[#0d111b] border-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      {contact.photoUrl ? (
                        <img 
                          src={contact.photoUrl} 
                          alt={contact.name} 
                          className="w-9 h-9 rounded-full object-cover border border-slate-800"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isLight 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-indigo-950/40 border border-indigo-900/40 text-indigo-400'
                        }`}>
                          {initials || '?'}
                        </div>
                      )}

                      {/* Info */}
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{contact.name}</p>
                        <div className="flex flex-col gap-0.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                          {contact.phoneNumber && (
                            <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {contact.phoneNumber}</span>
                          )}
                          {contact.email && (
                            <span className="flex items-center gap-1 truncate"><Mail className="w-2.5 h-2.5" /> {contact.email}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Invite Trigger */}
                    <button
                      onClick={() => handleInvite(contact, idx)}
                      className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 ${
                        copiedIndex === idx
                          ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400'
                          : isLight
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white'
                      }`}
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied Link</span>
                        </>
                      ) : (
                        <>
                          {hasPhone ? <Smartphone className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                          <span>{hasPhone ? 'SMS Invite' : 'Invite'}</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className={`p-3 rounded-xl text-[10px] leading-relaxed font-mono ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-950/40 text-slate-400 border border-slate-900'
          }`}>
            <span className="font-bold text-indigo-400 mr-1">💡 Pro-Tip:</span>
            Clicking <span className="font-bold text-slate-300">Invite</span> opens your device's native SMS editor prefilled with the invitation to **konnect-oxa.vercel.app**, and copies the link to your clipboard so you can paste it easily.
          </div>
        </div>
      )}
    </div>
  );
}
