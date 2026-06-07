/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect } from 'react';
import { 
  Sparkles, Calendar, MapPin, CheckCircle, Ticket, 
  UserCheck, ShieldAlert, Loader2 
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc, serverTimestamp, getDocFromServer, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { RegistrationData } from './types';
import RegistrationForm from './components/RegistrationForm';
import CheckoutPage from './components/CheckoutPage';

export default function App() {
  const [currentStep, setCurrentStep] = useState<'register' | 'checkout'>('register');
  const [hasPaid, setHasPaid] = useState<boolean>(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [copiedNgrok, setCopiedNgrok] = useState<boolean>(false);
  const [ngrokStatus, setNgrokStatus] = useState<{
    active: boolean;
    url: string | null;
    error: string | null;
    hasToken: boolean;
  } | null>(null);
  
  // Check active ngrok tunnel from full-stack backend
  useEffect(() => {
    async function checkNgrok() {
      try {
        const response = await fetch('/api/ngrok-status');
        const data = await response.json();
        setNgrokStatus(data);
      } catch (err) {
        console.warn("Failed to check active ngrok tunnel status:", err);
      }
    }
    checkNgrok();
    const interval = setInterval(checkNgrok, 11000);
    return () => clearInterval(interval);
  }, []);

  // Test Firestore Connection on Boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. Client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  // Check URL parameters for DPO payment callback actions on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get('paymentSuccess') === 'true';
    const paymentCancelled = params.get('paymentCancelled') === 'true';
    const regId = params.get('regId');
    const transToken = params.get('transToken') || params.get('ID');

    async function processDpoCallback() {
      if (paymentSuccess && regId && transToken) {
        setIsVerifyingPayment(true);
        setVerificationError(null);
        try {
          // 1. Verify token securely through the full-stack server
          const response = await fetch('/api/dpo/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transToken }),
          });
          const result = await response.json();

          if (result.success && result.verified) {
            // 2. Load the stored profile to populate active checkout success page
            const docRef = doc(db, 'registrations', regId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              const currentData = docSnap.data();
              const selectedTicketId = currentData.selectedTicketId || 'early_bird';
              
              // 3. Mark successful in database securely
              await updateDoc(docRef, {
                paymentStatus: 'success',
                paymentMethod: 'dpo',
                receiptNumber: transToken,
                updatedAt: serverTimestamp(),
              });

              setRegistrationId(regId);
              setRegistrationData({
                ...currentData as RegistrationData,
                selectedTicketId: selectedTicketId,
              });
              setHasPaid(true);
              setCurrentStep('checkout');
            } else {
              setVerificationError("Your registration record was not found, though your payment went through on DPO Group.");
            }
          } else {
            setVerificationError(`DPO secure gateway verification failed: ${result.resultExplanation || 'Transaction unverified'}`);
          }
        } catch (err) {
          console.error("DPO verification exception:", err);
          setVerificationError("Failed to verify transaction status securely with DPO gateway service.");
        } finally {
          setIsVerifyingPayment(false);
          // Clean parameters out of URL for session security
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (paymentCancelled && regId) {
        try {
          const docRef = doc(db, 'registrations', regId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRegistrationId(regId);
            setRegistrationData(docSnap.data() as RegistrationData);
            setCurrentStep('checkout');
            setVerificationError("The payment attempt via DPO Secure Gateway was cancelled or declined. You can select another pass or try checkout again.");
          }
        } catch (err) {
          console.error("Error setting up return session from cancelled DPO payment:", err);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    processDpoCallback();
  }, []);

  // High fidelity default structural state
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    participationType: 'Delegate',
    firstName: '',
    lastName: '',
    jobTitle: '',
    organization: '',
    country: '',
    email: '',
    phone: '',
    city: '',
    zipCode: '',
    address: '',
    website: '',
    areasOfInterest: [],
    proposedTopic: '',
    sessionSummary: '',
    preferredFormat: '',
    participationOpportunities: [],
    attendance: '',
    attachments: {
      bio: null,
      companyProfile: null,
      headshot: null,
      presentationDeck: null,
    },
  });

  const handleRegisterSubmit = async (data: RegistrationData) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      let docId = registrationId;
      const attachmentsPayload = {
        bio: data.attachments.bio ? { name: data.attachments.bio.name, size: data.attachments.bio.size, type: data.attachments.bio.type } : null,
        companyProfile: data.attachments.companyProfile ? { name: data.attachments.companyProfile.name, size: data.attachments.companyProfile.size, type: data.attachments.companyProfile.type } : null,
        headshot: data.attachments.headshot ? { name: data.attachments.headshot.name, size: data.attachments.headshot.size, type: data.attachments.headshot.type } : null,
        presentationDeck: data.attachments.presentationDeck ? { name: data.attachments.presentationDeck.name, size: data.attachments.presentationDeck.size, type: data.attachments.presentationDeck.type } : null,
      };

      if (!docId) {
        // Create new record with autogenerated ID
        const registrationsCollection = collection(db, 'registrations');
        const newDocRef = doc(registrationsCollection);
        docId = newDocRef.id;

        const payload = {
          participationType: data.participationType,
          firstName: data.firstName,
          lastName: data.lastName,
          jobTitle: data.jobTitle || '',
          organization: data.organization || '',
          country: data.country,
          email: data.email,
          phone: data.phone,
          city: data.city,
          zipCode: data.zipCode || '',
          address: data.address,
          website: data.website || '',
          areasOfInterest: data.areasOfInterest || [],
          proposedTopic: data.proposedTopic || '',
          sessionSummary: data.sessionSummary || '',
          preferredFormat: data.preferredFormat || '',
          participationOpportunities: data.participationOpportunities || [],
          attendance: data.attendance || '',
          attachments: attachmentsPayload,
          paymentStatus: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(newDocRef, payload);
        setRegistrationId(docId);
      } else {
        // Update existing record with refreshed values
        const docRef = doc(db, 'registrations', docId);
        await updateDoc(docRef, {
          participationType: data.participationType,
          firstName: data.firstName,
          lastName: data.lastName,
          jobTitle: data.jobTitle || '',
          organization: data.organization || '',
          country: data.country,
          email: data.email,
          phone: data.phone,
          city: data.city,
          zipCode: data.zipCode || '',
          address: data.address,
          website: data.website || '',
          areasOfInterest: data.areasOfInterest || [],
          proposedTopic: data.proposedTopic || '',
          sessionSummary: data.sessionSummary || '',
          preferredFormat: data.preferredFormat || '',
          participationOpportunities: data.participationOpportunities || [],
          attendance: data.attendance || '',
          attachments: attachmentsPayload,
          updatedAt: serverTimestamp(),
        });
      }

      // Dispatch non-blocking registration notification email via server-side endpoint
      const notifyAttachmentsPayload = {
        bio: data.attachments.bio ? { name: data.attachments.bio.name, size: data.attachments.bio.size, type: data.attachments.bio.type, dataUrl: data.attachments.bio.dataUrl } : null,
        companyProfile: data.attachments.companyProfile ? { name: data.attachments.companyProfile.name, size: data.attachments.companyProfile.size, type: data.attachments.companyProfile.type, dataUrl: data.attachments.companyProfile.dataUrl } : null,
        headshot: data.attachments.headshot ? { name: data.attachments.headshot.name, size: data.attachments.headshot.size, type: data.attachments.headshot.type, dataUrl: data.attachments.headshot.dataUrl } : null,
        presentationDeck: data.attachments.presentationDeck ? { name: data.attachments.presentationDeck.name, size: data.attachments.presentationDeck.size, type: data.attachments.presentationDeck.type, dataUrl: data.attachments.presentationDeck.dataUrl } : null,
      };

      const notifyPayload = {
        registrationId: docId,
        participationType: data.participationType,
        firstName: data.firstName,
        lastName: data.lastName,
        jobTitle: data.jobTitle || '',
        organization: data.organization || '',
        country: data.country,
        email: data.email,
        phone: data.phone,
        city: data.city,
        zipCode: data.zipCode || '',
        address: data.address,
        website: data.website || '',
        areasOfInterest: data.areasOfInterest || [],
        proposedTopic: data.proposedTopic || '',
        sessionSummary: data.sessionSummary || '',
        preferredFormat: data.preferredFormat || '',
        participationOpportunities: data.participationOpportunities || [],
        attendance: data.attendance || '',
        attachments: notifyAttachmentsPayload,
      };

      fetch('/api/registration/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifyPayload),
      })
        .then(res => res.json())
        .then(result => {
          console.log("[NOTIFICATION DISPATCH] Result:", result);
        })
        .catch(err => {
          console.error("[NOTIFICATION DISPATCH] Error:", err);
        });

      setRegistrationData(data);
      setCurrentStep('checkout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Error writing registration:", error);
      try {
        handleFirestoreError(error, OperationType.WRITE, `registrations/${registrationId || 'new'}`);
      } catch (wrappedErr) {
        if (wrappedErr instanceof Error) {
          setSaveError("Failed to save registration: " + wrappedErr.message);
        } else {
          setSaveError("An unexpected database error occurred.");
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentSuccess = () => {
    setHasPaid(true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans selection:bg-neutral-900 selection:text-white">
      {/* Dev utilities / Ngrok tunnel banner */}
      {ngrokStatus && (ngrokStatus.active || !ngrokStatus.hasToken) && (
        <div className="bg-neutral-900 border-b border-neutral-800 text-[11px] font-mono py-2 px-4 text-center flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-4 text-neutral-400 z-50">
          {ngrokStatus.active ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="font-extrabold text-neutral-200">ACTIVE NGROK TUNNEL:</span>
              </div>
              <a
                href={ngrokStatus.url || '#'}
                target="_blank"
                rel="noreferrer noopener"
                className="text-emerald-400 font-bold hover:underline select-all cursor-pointer transition-colors break-all"
              >
                {ngrokStatus.url}
              </a>
              <span className="hidden md:inline text-neutral-700">|</span>
              <button 
                type="button"
                onClick={async () => {
                  try {
                    if (ngrokStatus.url) {
                      await navigator.clipboard.writeText(ngrokStatus.url);
                      setCopiedNgrok(true);
                      setTimeout(() => setCopiedNgrok(false), 2000);
                    }
                  } catch (e: any) {
                    console.warn("Failed to copy ngrok URL:", e);
                  }
                }}
                className="hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer shrink-0 min-w-[70px] select-none text-center"
              >
                {copiedNgrok ? "Copied!" : "Copy URL"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>Ngrok Tunnel ready for deployment</span>
              </div>
              <span className="text-neutral-500 text-[10px]">
                To expose this dev environment publicly, add your <code className="bg-neutral-800 border border-neutral-700 text-neutral-350 px-1 py-0.5 rounded text-[10px]">NGROK_AUTHTOKEN</code> inside your App Settings/Secrets.
              </span>
            </>
          )}
        </div>
      )}

      {/* Immersive Event Hero Banner Area */}
      <header className="bg-neutral-950 text-white relative overflow-hidden py-10 md:py-14 border-b border-neutral-900 shadow-sm">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            “Unlocking Africa’s Next Growth Frontier”
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-display max-w-3xl mx-auto leading-tight">
            Africa Emerging Markets Summit 2026
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-neutral-400 font-mono">
            <span className="flex items-center gap-1.5 justify-center">
              <Calendar className="w-4 h-4 text-emerald-400" />
              7TH - 9TH October, 2026
            </span>
            <span className="hidden md:inline text-neutral-600">|</span>
            <span className="flex items-center gap-1.5 justify-center">
              <MapPin className="w-4 h-4 text-emerald-400" />
              KIGALI, RWANDA
            </span>
          </div>
        </div>
      </header>

      {/* Main Structural Body */}
      <main className="flex-grow max-w-5xl w-full mx-auto px-4 md:px-6 py-10">
        
        {/* Step Progress indicators */}
        {!hasPaid && (
          <div className="max-w-2xl mx-auto mb-10">
            <div className="grid grid-cols-2 gap-4 relative">
              
              {/* Step 1 Indicator */}
              <button
                onClick={() => currentStep === 'checkout' && setCurrentStep('register')}
                disabled={currentStep === 'register'}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  currentStep === 'register'
                    ? 'border-neutral-900 bg-white shadow-xs ring-1 ring-neutral-900'
                    : 'border-gray-200 bg-gray-50/50 hover:bg-white text-gray-500/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold leading-none ${
                    currentStep === 'register' ? 'bg-neutral-900 text-white' : 'bg-gray-200 text-neutral-700'
                  }`}>
                    1
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${currentStep === 'register' ? 'text-neutral-950' : 'text-neutral-500'}`}>
                      Attendee Register
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium">Add basic details & focus</p>
                  </div>
                </div>
              </button>

              {/* Step 2 Indicator */}
              <div
                className={`p-4 rounded-xl border text-left transition-all ${
                  currentStep === 'checkout'
                    ? 'border-neutral-900 bg-white shadow-xs ring-1 ring-neutral-900'
                    : 'border-gray-200 bg-gray-50/30 text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold leading-none ${
                    currentStep === 'checkout' ? 'bg-neutral-900 text-white' : 'bg-gray-150 text-gray-400'
                  }`}>
                    2
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold ${currentStep === 'checkout' ? 'text-neutral-950' : 'text-neutral-400'}`}>
                      Checkout Ticket
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium">Select tier & pass security DPO</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Save Error Alert Banner */}
        {saveError && (
          <div className="max-w-2xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 text-sm animate-in fade-in duration-200">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Database Synchronization Error</span>
              <p className="text-xs text-red-600 font-medium leading-relaxed">{saveError}</p>
            </div>
          </div>
        )}

        {/* Verification Alert Banner */}
        {verificationError && (
          <div className="max-w-2xl mx-auto mb-6 bg-neutral-900/5 hover:bg-neutral-900/10 border border-gray-250 rounded-xl p-4 flex items-start gap-3 text-neutral-900 text-sm animate-in fade-in duration-200">
            <ShieldAlert className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-xs uppercase tracking-wider text-gray-500">Notice</span>
              <p className="text-xs text-neutral-800 font-semibold leading-relaxed">{verificationError}</p>
            </div>
          </div>
        )}

        {/* Dynamic Route View rendering */}
        <div className="focus-target animate-in fade-in slide-in-from-bottom-2 duration-305 ease-out rounded-2xl relative">
          {/* Glassmorphic blocking saving overlay */}
          {isSaving && (
            <div className="absolute inset-0 z-50 bg-white/70 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-3 border border-gray-100 min-h-[400px]">
              <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
              <p className="text-sm font-bold text-neutral-900">Synchronizing attendee database...</p>
              <p className="text-[10px] text-gray-500 font-mono">Securing profile on Cloud Firestore</p>
            </div>
          )}

          {isVerifyingPayment && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-3 border border-gray-100 min-h-[400px]">
              <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
              <p className="text-sm font-semibold text-neutral-950">Verifying secure payload with DPO Group...</p>
              <p className="text-[10px] text-gray-500 font-mono">Securing real-time transaction approval records</p>
            </div>
          )}

          {currentStep === 'register' ? (
            <RegistrationForm 
              initialData={registrationData} 
              onSubmit={handleRegisterSubmit} 
            />
          ) : (
            <CheckoutPage 
              registrationData={registrationData} 
              registrationId={registrationId}
              onBack={() => {
                setCurrentStep('register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }} 
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}
        </div>
      </main>

      {/* Footer Credentials Info */}
      <footer className="bg-white border-t border-gray-100 py-8 text-center text-xs text-gray-400 space-y-2">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Continental Trade & Innovation Conference. All Rights Reserved.</p>
          <div className="flex items-center gap-2 font-semibold text-gray-500">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              Verified Profile
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Ticket className="w-3.5 h-3.5" />
              Secure Checkout ID
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
