import React, { useEffect, useState, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin,
  InfoWindow,
  useMap
} from '@vis.gl/react-google-maps';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { EmergencyRequest, UserLocation } from '../types';
import { AlertCircle, Heart, Utensils, LifeBuoy, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmergencyRequest[];
      
      const nearby = allRequests.filter(req => 
        getDistance(userLocation, req.location) <= 2
      );
      
      // Check for new requests if not initial load
      if (!isInitialLoad.current) {
        const newOnes = nearby.filter(req => !requests.find(r => r.id === req.id));
        if (newOnes.length > 0) {
          setNewRequestAlert(newOnes[0]);
          setTimeout(() => setNewRequestAlert(null), 5000);
        }
      }
      
      setRequests(allRequests);
      setFilteredRequests(viewMode === 'local' ? nearby : allRequests);
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    return () => unsubscribe();
  }, [userLocation, requests, viewMode]);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

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
          {filteredRequests.map((req) => (
            <AdvancedMarker
              key={req.id}
              position={req.location}
              onClick={() => setSelectedRequest(req)}
            >
              <Pin 
                background={CategoryColor(req.category)} 
                borderColor="#fff" 
                glyphColor="#fff"
              >
                <div className="flex items-center justify-center text-white">
                  <CategoryIcon category={req.category} />
                </div>
              </Pin>
            </AdvancedMarker>
          ))}

          {selectedRequest && (
            <InfoWindow
              position={selectedRequest.location}
              onCloseClick={() => setSelectedRequest(null)}
            >
              <div className="p-3 max-w-xs text-black">
                <div className="flex items-center gap-2 mb-3">
                  <div 
                    className="p-1.5 rounded-full text-white"
                    style={{ backgroundColor: CategoryColor(selectedRequest.category) }}
                  >
                    <CategoryIcon category={selectedRequest.category} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm leading-none">{selectedRequest.category}</span>
                    <span className="text-[10px] text-gray-500">Emergency Request</span>
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
