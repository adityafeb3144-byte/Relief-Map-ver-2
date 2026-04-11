import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import MapComponent from './components/MapComponent';
import RequestHelpButton from './components/RequestHelpButton';
import { UserLocation } from './types';
import { LogIn, MapPin, Loader2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Get user location only after login
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Please enable location access to use Relief-Map.");
          // Fallback location (e.g., San Francisco)
          setLocation({ lat: 37.7749, lng: -122.4194 });
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  }, [user]);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError("This domain is not authorized in Firebase. Please add " + window.location.hostname + " to your Firebase Authorized Domains.");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("Sign-in popup was blocked. Please allow popups for this site.");
      } else {
        setLoginError(error.message || "An unexpected error occurred during sign-in.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-on-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="font-display text-xl animate-pulse">Initializing Relief-Map...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background p-6">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-24 h-24 bg-primary-container rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
            <ShieldAlert className="w-12 h-12 text-on-primary-container" />
          </div>
          <h1 className="text-5xl font-bold mb-4 tracking-tight">Relief-Map</h1>
          <p className="text-on-surface-variant text-lg mb-8">
            Real-time emergency response network. Connect with help when every second counts.
          </p>

          {loginError && (
            <div className="mb-8 p-4 bg-error-container text-on-error-container rounded-2xl text-sm border border-error/20">
              {loginError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loginLoading}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-primary text-on-primary rounded-full text-xl font-bold shadow-lg hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loginLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
            {loginLoading ? "Signing in..." : "Sign in with Google"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background overflow-hidden relative">
      <AnimatePresence>
        {locationError && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-error-container text-on-error-container px-6 py-3 rounded-full shadow-lg flex items-center gap-3 border border-error/20"
          >
            <MapPin className="w-5 h-5" />
            <span className="font-medium">{locationError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {location ? (
        <>
          <MapComponent userLocation={location} />
          <RequestHelpButton userLocation={location} />
          
          {/* Header Overlay */}
          <div className="absolute top-6 left-6 z-10 flex items-center gap-4 pointer-events-none">
            <div className="bg-surface/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-outline/20 pointer-events-auto">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-primary" />
                Relief-Map
              </h1>
            </div>
          </div>

          {/* User Profile Overlay */}
          <div className="absolute top-6 right-6 z-10 pointer-events-auto">
            <div className="bg-surface/80 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-outline/20 flex items-center gap-3 pr-4">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-primary"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">{user.displayName}</span>
                <span className="text-[10px] text-on-surface-variant">Active Responder</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-background">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="font-display text-xl">Accessing GPS coordinates...</p>
        </div>
      )}
    </div>
  );
}
