import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Convert a raw P-256 public key (65 bytes) to a Uint8Array suitable for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert ArrayBuffer to Base64URL
function arrayBufferToBase64Url(arrayBuffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate or retrieve the shared system VAPID keys from Firestore
export async function getOrCreateVapidKeys() {
  try {
    const docRef = doc(db, 'profiles', 'system_vapid');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }

    // Generate a fresh P-256 ECDSA Key Pair for VAPID
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
    
    // Export public key in raw format to use as applicationServerKey
    const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const applicationServerKeyBase64 = arrayBufferToBase64Url(publicKeyRaw);

    const vapidData = {
      privateKeyJwk,
      publicKeyJwk,
      applicationServerKeyBase64,
    };

    await setDoc(docRef, vapidData);
    return vapidData;
  } catch (error) {
    console.error('Failed to get or create VAPID keys:', error);
    return null;
  }
}

// Register Service Worker and Subscribe browser to Web Push Notifications
export async function subscribeUserToPush(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging or Service Worker is not supported in this browser.');
    return null;
  }

  try {
    // 1. Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully:', registration);

    // 2. Wait for Service Worker to be active and set user id
    if (registration.active) {
      registration.active.postMessage({ type: 'SET_USER_ID', userId });
    } else {
      registration.installing?.addEventListener('statechange', (e: any) => {
        if (e.target.state === 'activated') {
          registration.active?.postMessage({ type: 'SET_USER_ID', userId });
        }
      });
    }

    // 3. Get VAPID keys
    const vapidData = await getOrCreateVapidKeys();
    if (!vapidData) {
      console.error('Could not load VAPID keys');
      return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidData.applicationServerKeyBase64);

    // 4. Subscribe user
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });

    console.log('Web Push subscription created:', subscription);

    // 5. Store subscription on the user profile in Firestore
    const userRef = doc(db, 'profiles', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      const currentSubs = data.pushSubscriptions || [];
      
      // Prevent duplicates
      const subJsonString = JSON.stringify(subscription);
      const isAlreadySubscribed = currentSubs.some((s: any) => JSON.stringify(s) === subJsonString);

      if (!isAlreadySubscribed) {
        const updatedSubs = [...currentSubs, subscription.toJSON()];
        await updateDoc(userRef, { pushSubscriptions: updatedSubs });
        console.log('Saved subscription to profile.');
      }
    }

    return subscription;
  } catch (error) {
    console.warn('Web Push subscription failed (this is common if permissions are blocked):', error);
    return null;
  }
}

// Sign standard VAPID JWT inside the browser using Web Crypto
async function signVapidJwt(privateKeyJwk: any, endpoint: string, senderEmail: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.hostname}`;
  
  const header = {
    alg: 'ES256',
    typ: 'JWT',
  };
  
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600, // Expires in 12 hours
    sub: `mailto:${senderEmail || 'zestroboi@gmail.com'}`,
  };
  
  const encoder = new TextEncoder();
  const encodedHeader = arrayBufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = arrayBufferToBase64Url(encoder.encode(JSON.stringify(payload)));
  
  const tokenInput = `${encodedHeader}.${encodedPayload}`;
  
  // Import private key from JWK
  const privateKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );
  
  const signature = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    encoder.encode(tokenInput)
  );
  
  const encodedSignature = arrayBufferToBase64Url(signature);
  return `${tokenInput}.${encodedSignature}`;
}

// Send standard push notifications to a target recipient
export async function sendPushToUser(
  recipientId: string,
  title: string,
  body: string,
  senderEmail?: string
) {
  try {
    // 1. Read target user's profile to get their subscriptions
    const recipientRef = doc(db, 'profiles', recipientId);
    const recipientSnap = await getDoc(recipientRef);
    if (!recipientSnap.exists()) return;

    const recipientData = recipientSnap.data();
    const subscriptions = recipientData.pushSubscriptions || [];

    if (subscriptions.length === 0) {
      console.log(`No active push subscriptions registered for recipient: ${recipientId}`);
      return;
    }

    // 2. Fetch VAPID private key to sign the Web Push request
    const vapidData = await getOrCreateVapidKeys();
    if (!vapidData) {
      console.error('No VAPID keys found to sign web push');
      return;
    }

    // 3. Update the recipient profile document's public notification fields
    // This allows the recipient's service worker to query the REST API and show the precise text
    await updateDoc(recipientRef, {
      latestNotificationTitle: title,
      latestNotificationBody: body,
      latestNotificationTime: Date.now(),
    });

    // 4. Send a push to all registered subscriptions (desktop and mobile)
    for (const sub of subscriptions) {
      if (!sub.endpoint) continue;

      try {
        const jwt = await signVapidJwt(
          vapidData.privateKeyJwk,
          sub.endpoint,
          senderEmail || 'zestroboi@gmail.com'
        );

        // Make direct POST request to push service (Google, Apple, Mozilla)
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'TTL': '60',
            'Urgency': 'high',
            'Authorization': `WebPush ${jwt}`,
          },
        });

        console.log(`Web Push dispatched to ${sub.endpoint}. Status: ${response.status}`);
      } catch (err) {
        console.warn(`Web push delivery to subscription failed:`, err);
      }
    }
  } catch (error) {
    console.error('Failed to send push to recipient:', error);
  }
}
