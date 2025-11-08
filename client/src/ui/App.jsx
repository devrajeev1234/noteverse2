import React, { useEffect, useState } from 'react';
import Notes from './Notes.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export default function App() {
  const [idToken, setIdToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved token and profile on mount
  useEffect(() => {
    console.log('Loading saved token...');
    const savedToken = localStorage.getItem('noterverse_idToken');
    const savedProfile = localStorage.getItem('noterverse_profile');
    
    if (savedToken) {
      // Check if token is expired (Google ID tokens expire after 1 hour)
      try {
        const parts = savedToken.split('.');
        if (parts.length !== 3) {
          console.error('Invalid token format - wrong number of parts');
          setIsLoading(false);
          return;
        }
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        // Add 5 minute buffer to account for clock skew
        if (exp > (now + 5 * 60 * 1000)) {
          // Token is still valid
          console.log('✅ Token is valid, restoring session');
          setIdToken(savedToken);
          if (savedProfile) {
            try {
              setProfile(JSON.parse(savedProfile));
            } catch {
              // Fallback to extracting from token
              setProfile({ name: payload.name || '', email: payload.email || '' });
            }
          } else {
            // Extract profile from token
            setProfile({ name: payload.name || '', email: payload.email || '' });
          }
        } else {
          // Token expired, clear it
          console.log('❌ Token expired, clearing localStorage');
          localStorage.removeItem('noterverse_idToken');
          localStorage.removeItem('noterverse_profile');
        }
      } catch (err) {
        console.error('Error parsing saved token:', err);
        // Don't clear on parse error - might be a temporary issue
      }
    } else {
      console.log('No saved token found');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Wait for token loading to complete
    if (isLoading) return;
    
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set in .env file');
      setGoogleReady(true); // Set ready so UI can render
      return;
    }

    // Check if we already have a token in state - if so, skip Google initialization
    if (idToken) {
      console.log('✅ Token already loaded, skipping Google initialization');
      setGoogleReady(true);
      return;
    }

    // Wait for Google script to load
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogle);
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
              if (resp.credential) {
                console.log('✅ New Google sign-in detected');
                const token = resp.credential;
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userProfile = { name: payload.name || '', email: payload.email || '' };
                
                console.log('✅ Saving token to localStorage');
                // Save to localStorage FIRST
                localStorage.setItem('noterverse_idToken', token);
                localStorage.setItem('noterverse_profile', JSON.stringify(userProfile));
                
                // Then update state
                setIdToken(token);
                setProfile(userProfile);
                console.log('✅ Token saved and state updated');
              } else if (resp.error) {
                console.error('Google Sign-In Error:', resp.error);
                // Only show alert for actual errors, not cancellations
                if (resp.error !== 'popup_closed_by_user' && resp.error !== 'access_denied') {
                  alert('Sign-In Error: ' + resp.error);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });
          console.log('Google Identity Services initialized');
          setGoogleReady(true);
        } catch (err) {
          console.error('Google initialization error:', err);
          setGoogleReady(true); // Set ready even on error so button can render
        }
      }
    }, 100);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkGoogle);
      setGoogleReady(true); // Set ready even if Google script fails
    }, 10000);

    return () => {
      clearInterval(checkGoogle);
      clearTimeout(timeout);
    };
  }, [isLoading, idToken]);

  useEffect(() => {
    // Only render button if we don't have a token and Google is ready
    if (idToken || !googleReady || !document.getElementById('googleButton')) return;
    try {
      window.google.accounts.id.renderButton(document.getElementById('googleButton'), {
        theme: 'outline',
        size: 'large',
        width: 250
      });
    } catch (err) {
      console.error('Button render error:', err);
    }
  }, [googleReady, idToken]);

  const handleLogout = () => {
    localStorage.removeItem('noterverse_idToken');
    localStorage.removeItem('noterverse_profile');
    setIdToken(null);
    setProfile(null);
    // Also revoke Google session if possible
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  // Show loading state while checking for token
  if (isLoading) {
    return (
      <div style={{ 
        display: 'grid', 
        placeItems: 'center', 
        minHeight: '100vh', 
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h1 style={{ marginBottom: 16, fontSize: '3rem', fontWeight: '700', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
            Noterverse
          </h1>
          <div style={{ fontSize: 24, marginTop: 20 }}>⏳</div>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1rem', marginTop: 12 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!idToken) {
    return (
      <div style={{ 
        display: 'grid', 
        placeItems: 'center', 
        minHeight: '100vh', 
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{ 
          textAlign: 'center', 
          backgroundColor: 'white',
          padding: '48px 40px',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: 500,
          width: '100%'
        }}>
          <h1 style={{ 
            marginBottom: 12, 
            fontSize: '3rem', 
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Noterverse
          </h1>
          <p style={{ 
            marginBottom: 32, 
            color: '#64748b', 
            fontSize: '1.1rem',
            lineHeight: 1.6
          }}>
            Secure notes with tags, search and OCR
          </p>
          <div id="googleButton" style={{ 
            minHeight: '50px', 
            display: 'inline-block',
            marginBottom: 16
          }} />
          {!googleReady && (
            <p style={{ 
              marginTop: 16, 
              color: '#94a3b8', 
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}>
              <span>⏳</span> Loading Google Sign-In...
            </p>
          )}
          <div style={{ 
            marginTop: 32, 
            paddingTop: 24, 
            borderTop: '1px solid #e2e8f0',
            color: '#64748b',
            fontSize: '0.875rem'
          }}>
            <p style={{ margin: 0 }}>🔒 Your notes are encrypted and secure</p>
          </div>
        </div>
      </div>
    );
  }

  return <Notes apiBase={API_BASE} idToken={idToken} profile={profile} onLogout={handleLogout} />;
}


