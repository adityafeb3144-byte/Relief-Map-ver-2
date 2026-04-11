import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Send, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { analyzeEmergency } from '../lib/gemini';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserLocation } from '../types';

interface Props {
  userLocation: UserLocation;
}

export default function RequestHelpButton({ userLocation }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || isSubmitting) return;

    if (!auth.currentUser) {
      alert('You must be signed in to request help.');
      return;
    }

    // Check image size (Firestore limit is 1MB per document)
    if (image && image.length > 800000) { // ~800KB limit to be safe
      alert('The image is too large. Please use a smaller photo (under 800KB).');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Analyze with Gemini
      const base64Image = image?.split(',')[1];
      const analysis = await analyzeEmergency(message, base64Image);
      
      console.log('Gemini Analysis:', analysis);

      // 2. Save to Firestore
      const allowedCategories = ['Food', 'Medical', 'Rescue', 'Other'];
      const finalCategory = allowedCategories.includes(analysis.category) ? analysis.category : 'Other';
      const finalUrgency = typeof analysis.urgency === 'number' ? Math.min(Math.max(analysis.urgency, 1), 10) : 5;

      try {
        await addDoc(collection(db, 'requests'), {
          userId: auth.currentUser.uid,
          userName: auth.currentUser.displayName || 'Anonymous',
          userPhoto: auth.currentUser.photoURL || '',
          message,
          imageUrl: image || null,
          location: userLocation,
          category: finalCategory,
          urgency: finalUrgency,
          status: 'pending',
          recommendedTools: analysis.recommendedTools || [],
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'requests');
      }

      // 3. Reset and Close
      setMessage('');
      setImage(null);
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error submitting request:', error);
      let errorMsg = 'Failed to submit request. Please try again.';
      
      if (error.message?.includes('permission-denied')) {
        errorMsg = 'Permission denied. This might be due to a large image or invalid data. Try removing the photo or shortening the message.';
      } else if (error.message?.includes('Gemini') || error.message?.includes('API key')) {
        errorMsg = 'AI analysis failed. Please ensure your Gemini API key is correctly set in Vercel.';
      } else if (error.code) {
        errorMsg = `Error (${error.code}): ${error.message}`;
      }
      
      alert(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-50"
      >
        <Plus className="w-8 h-8" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface text-on-surface rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">Request Help</h2>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-surface-variant rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your emergency..."
                  className="w-full h-32 bg-surface-variant text-on-surface-variant rounded-2xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary mb-4"
                />

                {image && (
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden mb-4 group">
                    <img src={image} alt="Upload preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setImage(null)}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:bg-opacity-80 transition-all font-medium"
                  >
                    <ImageIcon className="w-5 h-5" />
                    Add Photo
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full hover:bg-opacity-90 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Dispatch Help
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
