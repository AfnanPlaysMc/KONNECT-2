import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { googleProvider } from './firebase';

// In-memory cache for the access token as mandated by safety guidelines
let cachedAccessToken: string | null = null;

export function setGoogleAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export interface GoogleContact {
  resourceName: string;
  name: string;
  phoneNumber: string;
  email: string;
  photoUrl?: string;
}

/**
 * Handles the Google Sign-in to fetch or refresh the Google OAuth Access Token
 */
export async function authenticateGoogleForContacts(): Promise<string> {
  const auth = getAuth();
  
  // Configure Google Auth Provider with contacts scopes
  googleProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  googleProvider.addScope('https://www.googleapis.com/auth/contacts.other.readonly');
  googleProvider.addScope('https://www.googleapis.com/auth/user.phonenumbers.read');
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;
    if (!token) {
      throw new Error('Could not retrieve access token from Google authentication.');
    }
    setGoogleAccessToken(token);
    return token;
  } catch (error) {
    console.error('Google contacts authentication failed:', error);
    throw error;
  }
}

/**
 * Fetches connections (contacts) from the Google People API
 */
export async function fetchGoogleContacts(token: string): Promise<GoogleContact[]> {
  try {
    // Fetch regular connections
    const url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses,photos&pageSize=1000';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        setGoogleAccessToken(null);
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(`Failed to fetch contacts: ${response.statusText}`);
    }

    const data = await response.json();
    const connections = data.connections || [];
    
    const formattedContacts: GoogleContact[] = connections.map((conn: any) => {
      const names = conn.names || [];
      const phoneNumbers = conn.phoneNumbers || [];
      const emailAddresses = conn.emailAddresses || [];
      const photos = conn.photos || [];

      const name = names[0]?.displayName || 'Unnamed Contact';
      const phoneNumber = phoneNumbers[0]?.value || '';
      const email = emailAddresses[0]?.value || '';
      const photoUrl = photos[0]?.url || '';

      return {
        resourceName: conn.resourceName,
        name,
        phoneNumber,
        email,
        photoUrl,
      };
    });

    // Also fetch other contacts automatically saved to capture all possible contacts requested by the user
    try {
      const otherUrl = 'https://people.googleapis.com/v1/otherContacts?readMask=names,phoneNumbers,emailAddresses,photos&pageSize=100';
      const otherRes = await fetch(otherUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (otherRes.ok) {
        const otherData = await otherRes.json();
        const otherContactsList = otherData.otherContacts || [];
        otherContactsList.forEach((conn: any) => {
          // Only add if we don't have it already and it has a name/phone/email
          const names = conn.names || [];
          const phoneNumbers = conn.phoneNumbers || [];
          const emailAddresses = conn.emailAddresses || [];
          const photos = conn.photos || [];

          const name = names[0]?.displayName || '';
          const phoneNumber = phoneNumbers[0]?.value || '';
          const email = emailAddresses[0]?.value || '';
          const photoUrl = photos[0]?.url || '';

          if (name && !formattedContacts.some(c => c.name === name || (phoneNumber && c.phoneNumber === phoneNumber))) {
            formattedContacts.push({
              resourceName: conn.resourceName,
              name,
              phoneNumber,
              email,
              photoUrl,
            });
          }
        });
      }
    } catch (e) {
      console.warn('Failed to fetch other contacts, falling back to connections only:', e);
    }

    return formattedContacts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('fetchGoogleContacts error:', error);
    throw error;
  }
}
