export interface EmergencyRequest {
  id: string;
  userId: string;
  userName?: string;
  userPhoto?: string;
  message: string;
  imageUrl?: string;
  location: {
    lat: number;
    lng: number;
  };
  category: 'Food' | 'Medical' | 'Rescue' | 'Other';
  urgency: number;
  createdAt: any; // Firestore Timestamp
}

export interface UserLocation {
  lat: number;
  lng: number;
}
