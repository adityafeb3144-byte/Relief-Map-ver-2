import React, { useEffect, useState, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { EmergencyRequest, UserLocation } from '../types';
import { AlertCircle, Heart, Utensils, LifeBuoy, Bell, Navigation, CheckCircle, Briefcase, Loader2, XCircle, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

const MAP_ID = "relief_map_dark";

// Dark mode styles for Google Maps
const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

interface Props {
  userLocation: UserLocation;
}

const getDistance = (loc1: UserLocation, loc2: UserLocation) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
  const dLng = (loc2.lng - loc1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * (Math.PI / 180)) *
      Math.cos(loc2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'Food': return <Utensils className="w-4 h-4" />;
    case 'Medical': return <Heart className="w-4 h-4" />;
    case 'Rescue': return <LifeBuoy className="w-4 h-4" />;
    default: return <AlertCircle className="w-4 h-4" />;
  }
};

const CategoryColor = (category: string) => {
  switch (category) {
    case 'Food': return '#4CAF50';
    case 'Medical': return '#F44336';
    case 'Rescue': return '#2196F3';
    default: return '#FF9800';
  }
};

export default function MapComponent({ userLocation }: Props) {
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<EmergencyRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EmergencyRequest | null>(null);
  const [newRequestAlert, setNewRequestAlert] = useState<EmergencyRequest | null>(null);
  const [viewMode, setViewMode] = useState<'local' | 'global'>('local');
  const [isAccepting, setIsAccepting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmergencyRequest[];
      
      // Use docChanges to detect NEW additions specifically
      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const newReq = { id: change.doc.id, ...change.doc.data() } as EmergencyRequest;
            
            // Notify if it's not our own request
            if (newReq.userId !== auth.currentUser?.uid) {
              const distance = getDistance(userLocation, newReq.location);
              // STRICT PROTOCOL: Only notify if within 2km
              if (distance <= 2) {
                setNewRequestAlert(newReq);
                setTimeout(() => setNewRequestAlert(null), 8000); // Show for 8 seconds
              }
            }
          }
        });
      }
      
      const nearby = allRequests.filter(req => 
        getDistance(userLocation, req.location) <= 2 // STRICT PROTOCOL: 2km radius
      );
      
      setRequests(allRequests);
      setFilteredRequests(viewMode === 'local' ? nearby : allRequests);
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    return () => unsubscribe();
  }, [userLocation, viewMode]); // Removed 'requests' from dependencies to prevent resubscription

  const handleAcceptRequest = async (request: EmergencyRequest) => {
    if (!auth.currentUser || isAccepting) return;

    // STRICT PROTOCOL: Double check distance before allowing acceptance
    const distance = getDistance(userLocation, request.location);
    if (distance > 2) {
      alert(`You are too far away (${distance.toFixed(1)}km) to accept this request. You must be within 2km.`);
      return;
    }

    setIsAccepting(true);
    try {
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'accepted',
        acceptedBy: auth.currentUser.uid,
        acceptedByName: auth.currentUser.displayName || 'Anonymous Responder'
      });
      
      setSelectedRequest({
        ...request,
        status: 'accepted',
        acceptedBy: auth.currentUser.uid,
        acceptedByName: auth.currentUser.displayName || 'Anonymous Responder'
      });
    } catch (error) {
      console.error("Error accepting request:", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancelRequest = async (request: EmergencyRequest) => {
    if (!auth.currentUser || isAccepting) return;
    if (request.userId !== auth.currentUser.uid) return;

    if (!confirm("Are you sure you want to cancel this help request?")) return;

    setIsAccepting(true);
    try {
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'completed', // We use completed to hide it from active view
        message: `[CANCELLED] ${request.message}`
      });
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error cancelling request:", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCompleteRequest = async (request: EmergencyRequest) => {
    if (!auth.currentUser || isAccepting) return;
    
    // Only the requester or the responder can complete it
    if (request.userId !== auth.currentUser.uid && request.acceptedBy !== auth.currentUser.uid) return;

    setIsAccepting(true);
    try {
      const requestRef = doc(db, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'completed'
      });

      // Trigger Celebration
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4CAF50', '#2196F3', '#FFEB3B']
      });
      
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 5000);
      
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error completing request:", error);
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    } finally {
      setIsAccepting(false);
    }
  };

  const getDirections = (location: { lat: number, lng: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  };

  const googleMapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Google Maps Key Missing</h2>
        <p className="text-slate-400 max-w-md">
          Please set the VITE_GOOGLE_MAPS_API_KEY environment variable to enable the map view.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={googleMapsApiKey}>
      <div className="w-full h-screen relative">
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-2xl text-center border-4 border-green-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">Help Received!</h2>
                <p className="text-slate-600 font-bold">Another life helped by the community.</p>
              </div>
            </motion.div>
          )}

          {newRequestAlert && (
            <motion.div
              initial={{ y: -100, x: '-50%', opacity: 0 }}
              animate={{ y: 80, x: '-50%', opacity: 1 }}
              exit={{ y: -100, x: '-50%', opacity: 0 }}
              className="absolute top-0 left-1/2 z-50 bg-primary-container text-on-primary-container px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-primary/20 min-w-[300px]"
            >
              <div className="bg-primary text-on-primary p-2 rounded-full">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider opacity-70">New Emergency Nearby</div>
                <div className="font-bold">{newRequestAlert.category} Request</div>
              </div>
              <button 
                onClick={() => {
                  setSelectedRequest(newRequestAlert);
                  setNewRequestAlert(null);
                }}
                className="ml-auto text-xs bg-primary text-on-primary px-3 py-1.5 rounded-full font-bold hover:bg-opacity-80 transition-all"
              >
                View
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Mode Toggle */}
        <div className="absolute top-24 left-6 z-10 flex bg-surface/80 backdrop-blur-md p-1 rounded-full shadow-xl border border-outline/20">
          <button
            onClick={() => setViewMode('local')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
              viewMode === 'local' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant/50"
            )}
          >
            Nearby
          </button>
          <button
            onClick={() => setViewMode('global')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
              viewMode === 'global' ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-variant/50"
            )}
          >
            Global
          </button>
        </div>

        <Map
          defaultCenter={userLocation}
          defaultZoom={15}
          mapId={MAP_ID}
          styles={darkMapStyles}
          disableDefaultUI={true}
          className="w-full h-full"
        >
          {/* User Marker */}
          <AdvancedMarker position={userLocation}>
            <div className="relative">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
              <div className="absolute -inset-2 bg-blue-500/20 rounded-full animate-ping" />
            </div>
          </AdvancedMarker>

          {/* Emergency Markers */}
          {filteredRequests.filter(r => r.status !== 'completed').map((req) => (
            <AdvancedMarker
              key={req.id}
              position={req.location}
              onClick={() => setSelectedRequest(req)}
            >
              <div className="relative">
                <Pin 
                  background={req.status === 'accepted' ? '#9E9E9E' : CategoryColor(req.category)} 
                  borderColor="#fff" 
                  glyphColor="#fff"
                >
                  <div className="flex items-center justify-center text-white">
                    {req.status === 'accepted' ? <CheckCircle className="w-4 h-4" /> : <CategoryIcon category={req.category} />}
                  </div>
                </Pin>
                {req.status === 'accepted' && (
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white p-0.5 rounded-full border border-white">
                    <CheckCircle className="w-2 h-2" />
                  </div>
                )}
              </div>
            </AdvancedMarker>
          ))}

          {selectedRequest && (
            <InfoWindow
              position={selectedRequest.location}
              onCloseClick={() => setSelectedRequest(null)}
            >
              <div className="p-3 max-w-xs text-black overflow-y-auto max-h-[400px]">
                <div className="flex items-center gap-2 mb-3">
                  <div 
                    className="p-1.5 rounded-full text-white"
                    style={{ backgroundColor: selectedRequest.status === 'accepted' ? '#9E9E9E' : CategoryColor(selectedRequest.category) }}
                  >
                    {selectedRequest.status === 'accepted' ? <CheckCircle className="w-4 h-4" /> : <CategoryIcon category={selectedRequest.category} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-none">
                      {selectedRequest.status === 'accepted' ? 'Accepted' : selectedRequest.category}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {selectedRequest.status === 'accepted' ? `By ${selectedRequest.acceptedByName}` : 'Emergency Request'}
                    </span>
                  </div>
                  <span className="ml-auto text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-bold border border-red-200">
                    Urgency: {selectedRequest.urgency}
                  </span>
                </div>
                
                <p className="text-sm mb-3 font-medium leading-relaxed">{selectedRequest.message}</p>
                
                {selectedRequest.imageUrl && (
                  <img 
                    src={selectedRequest.imageUrl} 
                    alt="Emergency" 
                    className="w-full h-40 object-cover rounded-xl mb-3 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Recommended Tools Section */}
                {selectedRequest.recommendedTools && selectedRequest.recommendedTools.length > 0 && (
                  <div className="mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-2 text-blue-800">
                      <Briefcase className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Recommended Gear</span>
                    </div>
                    <ul className="space-y-1">
                      {selectedRequest.recommendedTools.map((tool, i) => (
                        <li key={i} className="text-xs text-blue-700 flex items-center gap-2">
                          <div className="w-1 h-1 bg-blue-400 rounded-full" />
                          {tool}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 mb-4">
                  {/* Requester can cancel */}
                  {selectedRequest.status === 'pending' && selectedRequest.userId === auth.currentUser?.uid && (
                    <button
                      onClick={() => handleCancelRequest(selectedRequest)}
                      disabled={isAccepting}
                      className="w-full py-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300 transition-all flex items-center justify-center gap-2"
                    >
                      {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Cancel My Request
                    </button>
                  )}

                  {/* Responder or Requester can complete */}
                  {selectedRequest.status === 'accepted' && (selectedRequest.userId === auth.currentUser?.uid || selectedRequest.acceptedBy === auth.currentUser?.uid) && (
                    <button
                      onClick={() => handleCompleteRequest(selectedRequest)}
                      disabled={isAccepting}
                      className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Help Received / Mission Complete
                    </button>
                  )}

                  {selectedRequest.status === 'pending' && selectedRequest.userId !== auth.currentUser?.uid && (
                    <>
                      {getDistance(userLocation, selectedRequest.location) <= 2 ? (
                        <button
                          onClick={() => handleAcceptRequest(selectedRequest)}
                          disabled={isAccepting}
                          className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                        >
                          {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Accept Request
                        </button>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-800 leading-tight">
                            <strong>Out of Range:</strong> You must be within 2km to accept this request. You are currently {getDistance(userLocation, selectedRequest.location).toFixed(1)}km away.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedRequest.status === 'accepted' && (
                    <button
                      onClick={() => getDirections(selectedRequest.location)}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-4 h-4" />
                      Get Directions
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <img 
                    src={selectedRequest.userPhoto || `https://ui-avatars.com/api/?name=${selectedRequest.userName}`} 
                    alt="User" 
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] font-bold text-gray-700">
                    {selectedRequest.userName || 'Anonymous'}
                  </div>
                  <div className="ml-auto text-[9px] text-gray-400">
                    {selectedRequest.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
