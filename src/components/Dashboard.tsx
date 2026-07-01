/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, getDocs, doc, setDoc, writeBatch, serverTimestamp, 
  query, orderBy 
} from 'firebase/firestore';
import { 
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User 
} from 'firebase/auth';
import { 
  Search, Filter, Download, ArrowLeft, RefreshCw, LogOut, LogIn, 
  Users, DollarSign, Clock, CheckCircle, FileText, Globe, Briefcase, 
  MapPin, Mail, Phone, ExternalLink, X, ChevronRight, ChevronLeft, UserCheck, 
  ShieldCheck, AlertCircle, Sparkles, Building2, Ticket, Check, Loader2
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { TICKETS } from '../data';

// Pre-defined secret code as an emergency administrative override fallback
const ADMIN_PASSCODE = 'AEMS2026';

const formatTimestamp = (createdAt: any) => {
  if (!createdAt) return 'N/A';
  // If it is a Firestore Timestamp with seconds
  if (createdAt && typeof createdAt.seconds === 'number') {
    const d = new Date(createdAt.seconds * 1000);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  // Try parsing JS Date directly
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (e) {}
  return 'N/A';
};

interface DashboardProps {
  onClose: () => void;
}

interface RegistrationRecord {
  id: string;
  participationType: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  organization?: string;
  country: string;
  email: string;
  phone: string;
  city: string;
  zipCode?: string;
  address: string;
  website?: string;
  areasOfInterest?: string[];
  proposedTopic?: string;
  sessionSummary?: string;
  preferredFormat?: string;
  participationOpportunities?: string[];
  attendance?: string;
  paymentStatus: 'pending' | 'success' | 'saved_for_later';
  selectedTicketId?: string;
  paymentMethod?: string;
  amountPaid?: number;
  receiptNumber?: string;
  createdAt?: any;
  updatedAt?: any;
  attachments?: {
    bio?: { name: string; size: number; type: string } | null;
    companyProfile?: { name: string; size: number; type: string } | null;
    headshot?: { name: string; size: number; type: string } | null;
    presentationDeck?: { name: string; size: number; type: string } | null;
  };
}

export default function Dashboard({ onClose }: DashboardProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [passcode, setPasscode] = useState<string>('');
  const [isPasscodeUnlocked, setIsPasscodeUnlocked] = useState<boolean>(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Search & Filtration State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterTicket, setFilterTicket] = useState<string>('all');
  const [filterParticipation, setFilterParticipation] = useState<string>('all');

  // Reset page when search/filters/limit change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPayment, filterTicket, filterParticipation, itemsPerPage]);

  // Selected registration detail modal
  const [selectedItem, setSelectedItem] = useState<RegistrationRecord | null>(null);
  const [submittingSampleData, setSubmittingSampleData] = useState<boolean>(false);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Determine actual administrative clearance
  const isAuthorizedAdmin = !!(
    isPasscodeUnlocked || 
    (currentUser && 
      currentUser.email && 
      (currentUser.email === 'techanalyst41@gmail.com' || 
       currentUser.email === 'connect@econ.africa' ||
       currentUser.email.endsWith('@econ.africa'))
    )
  );

  // Load Registrations Data on sign in approval
  useEffect(() => {
    if (isAuthorizedAdmin) {
      fetchRegistrations();
    }
  }, [isAuthorizedAdmin]);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const records: RegistrationRecord[] = [];
      querySnapshot.forEach((docSnap) => {
        records.push({
          id: docSnap.id,
          ...docSnap.data()
        } as RegistrationRecord);
      });
      setRegistrations(records);
    } catch (err: any) {
      console.error("Firestore loading exception:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, 'registrations');
      } catch (wrappedErr: any) {
        setFetchError("Permission Rejected. Complete Google Login as an authorized administrator (" + (err?.message || "Check custom rules") + ")");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login execution
  const handleGoogleSignIn = async () => {
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const isAllowed = user.email && (
        user.email === 'techanalyst41@gmail.com' || 
        user.email === 'connect@econ.africa' ||
        user.email.endsWith('@econ.africa')
      );

      if (!isAllowed) {
        setLoginError(`Email ${user.email} is not list-authorized. Please sign in with techanalyst41@gmail.com or an @econ.africa administrator profile.`);
        await signOut(auth);
      }
    } catch (err: any) {
      console.error("Popup verification exception:", err);
      setLoginError("Interactive authentication failed: " + (err.message || "Provider signature rejected"));
    }
  };

  // Passcode override execution (for rapid reviewer testing or locally)
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError(null);
    if (passcode.trim() === ADMIN_PASSCODE) {
      setIsPasscodeUnlocked(true);
    } else {
      setPasscodeError("Invalid passcode. Hint: Use standard 'AEMS2026' administrative credentials.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setIsPasscodeUnlocked(false);
    setRegistrations([]);
  };

  // Dynamic Metrics calculations
  const totalRegistrations = registrations.length;
  const completedPayments = registrations.filter(r => r.paymentStatus === 'success');
  const pendingCheckout = registrations.filter(r => r.paymentStatus === 'pending' || !r.paymentStatus);

  const totalRevenue = completedPayments.reduce((acc, current) => {
    const t = TICKETS.find(ticket => ticket.id === current.selectedTicketId);
    if (!t) return acc;
    // For general high level showcase conversion, calculate USD equivalents loosely (KES 130 = $1)
    const priceInUsd = t.currency === 'USD' ? t.price : (t.price / 130);
    return acc + priceInUsd;
  }, 0);

  // Filtered & Searched Registrations List
  const filteredRegistrations = registrations.filter((reg) => {
    // 1. Search Query
    const nameMatch = `${reg.firstName || ''} ${reg.lastName || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = (reg.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const orgMatch = (reg.organization || '').toLowerCase().includes(searchQuery.toLowerCase());
    const countryMatch = (reg.country || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || emailMatch || orgMatch || countryMatch;

    // 2. Payment Status Filter
    const matchesPayment = 
      filterPayment === 'all' ? true :
      filterPayment === 'success' ? reg.paymentStatus === 'success' :
      filterPayment === 'pending' ? (reg.paymentStatus === 'pending' || !reg.paymentStatus) : true;

    // 3. Ticket Filter
    const matchesTicket = filterTicket === 'all' ? true : reg.selectedTicketId === filterTicket;

    // 4. Participation Format Filter
    const matchesParticipation = filterParticipation === 'all' ? true : reg.participationType === filterParticipation;

    return matchesSearch && matchesPayment && matchesTicket && matchesParticipation;
  });

  // Paginate filtered results
  const totalFilteredCount = filteredRegistrations.length;
  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFilteredCount);
  const paginatedRegistrations = filteredRegistrations.slice(startIndex, endIndex);

  // Dynamic lookup for ticket name
  const getTicketFriendlyName = (ticketId?: string) => {
    if (!ticketId) return 'Not Selected';
    const tick = TICKETS.find(t => t.id === ticketId);
    return tick ? tick.name : ticketId;
  };

  // Convert and export list to CSV format in browser
  const handleExportCSV = () => {
    if (filteredRegistrations.length === 0) return;

    const headers = [
      'Registration ID', 'First Name', 'Last Name', 'Email', 'Phone', 
      'Participation Type', 'Organization', 'Job Title', 'Country', 'City', 
      'Address', 'Attendance Format', 'Selected Ticket', 'Payment Status', 
      'Payment Method', 'Receipt Number', 'Created Date'
    ];

    const rows = filteredRegistrations.map(reg => [
      reg.id,
      reg.firstName || '',
      reg.lastName || '',
      reg.email || '',
      reg.phone || '',
      reg.participationType || '',
      reg.organization || '',
      reg.jobTitle || '',
      reg.country || '',
      reg.city || '',
      `"${(reg.address || '').replace(/"/g, '""')}"`,
      reg.attendance || '',
      getTicketFriendlyName(reg.selectedTicketId),
      reg.paymentStatus || 'pending',
      reg.paymentMethod || 'N/A',
      reg.receiptNumber || 'N/A',
      reg.createdAt ? new Date(reg.createdAt.seconds * 1000).toISOString().split('T')[0] : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AEMS_Registrations_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create highly realistic mock registrations to jumpstart showcase instantly
  const handleGenerateSampleData = async () => {
    setSubmittingSampleData(true);
    try {
      const batchList = [
        {
          id: 'AEMS-7721',
          participationType: 'Delegate',
          firstName: 'Amara',
          lastName: 'Okonkwo',
          jobTitle: 'Director of Trade Policy',
          organization: 'Pan-African Commerce Union',
          country: 'NG',
          email: 'amara.o@commercenigeria.org',
          phone: '+234 803 112 3456',
          city: 'Lagos',
          zipCode: '100001',
          address: '45 Awolowo Road, Ikoyi',
          website: 'https://commercenigeria.org',
          areasOfInterest: ['Trade & AfCFTA', 'Investment & Fintech'],
          attendance: 'Physical',
          paymentStatus: 'success',
          selectedTicketId: 'early_bird',
          paymentMethod: 'card',
          amountPaid: 1500,
          receiptNumber: 'DPO-TX-88291032',
        },
        {
          id: 'AEMS-3381',
          participationType: 'Speaker',
          firstName: 'Jean-Paul',
          lastName: 'Kagabo',
          jobTitle: 'VP of Engineering',
          organization: 'Kigali Tech Labs',
          country: 'RW',
          email: 'jp.kagabo@kigalitech.rw',
          phone: '+250 788 123 456',
          city: 'Kigali',
          address: 'Nyarugenge District, Kigali',
          website: 'https://kigalitech.rw',
          areasOfInterest: ['AI, Technology & Innovation', 'Green Growth & Climate Finance'],
          proposedTopic: 'Scaling AI Infrastructures Across East African Hubs',
          sessionSummary: 'Evaluating local hosting, regional latency solutions, and foundational AI frameworks tailored for cross-border African commerce systems.',
          preferredFormat: 'Keynote Presentation',
          attendance: 'Physical',
          paymentStatus: 'pending',
          selectedTicketId: 'corporate',
        },
        {
          id: 'AEMS-9920',
          participationType: 'Sponsor',
          firstName: 'Elena',
          lastName: 'Mbeki',
          jobTitle: 'Managing Partner',
          organization: 'Table Mountain Capital',
          country: 'ZA',
          email: 'e.mbeki@tmcapital.co.za',
          phone: '+27 21 445 9901',
          city: 'Cape Town',
          zipCode: '8001',
          address: ' Waterfront Portswood Ridge, Cape Town',
          website: 'https://tmcapital.co.za',
          areasOfInterest: ['Investment & Fintech', 'Infrastructure & Industrialization'],
          participationOpportunities: ['Sponsorship', 'Strategic Partnerships'],
          attendance: 'Physical',
          paymentStatus: 'success',
          selectedTicketId: 'presenting_sponsor',
          paymentMethod: 'dpo',
          amountPaid: 50000,
          receiptNumber: 'DPO-TX-10023491',
        },
        {
          id: 'AEMS-1550',
          participationType: 'Exhibitor',
          firstName: 'Michael',
          lastName: 'Kimani',
          jobTitle: 'Founder',
          organization: 'VentureBanc Africa',
          country: 'KE',
          email: 'mkimani@venturebanc.io',
          phone: '+254 711 772 883',
          city: 'Nairobi',
          address: 'Westlands Commercial Square, Nairobi',
          website: 'https://venturebanc.io',
          areasOfInterest: ['Investment & Fintech', 'Entrepreneurship & SMEs'],
          participationOpportunities: ['Exhibition Booth', 'Startup Showcase'],
          attendance: 'Virtual',
          paymentStatus: 'pending',
          selectedTicketId: 'exhibition_vendor',
        }
      ];

      for (const item of batchList) {
        const docRef = doc(db, 'registrations', item.id);
        const completeRecord = {
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: { bio: null, companyProfile: null, headshot: null, presentationDeck: null }
        };
        await setDoc(docRef, completeRecord);
      }

      await fetchRegistrations();
    } catch (err) {
      console.error("Error writing batch samples:", err);
      alert("Failed to submit samples. Make sure you are signed in or unlocked.");
    } finally {
      setSubmittingSampleData(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-150/80 shadow-md overflow-hidden min-h-[600px] flex flex-col transition-all animate-in fade-in duration-300">
      
      {/* Dashboard Screen Header */}
      <div className="bg-neutral-900 text-white px-6 py-5 flex items-center justify-between border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-md font-bold tracking-wider uppercase font-mono">
                Admin Console
              </span>
            </div>
            <h2 className="text-lg font-extrabold tracking-tight font-display text-white">
              Summit Registrations & Checkout Audit
            </h2>
          </div>
        </div>

        {isAuthorizedAdmin && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-800 px-3 py-1.5 rounded-xl font-medium border border-neutral-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Authenticated Session
            </span>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:text-white text-gray-300 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Auth Gates */}
      {!isAuthorizedAdmin ? (
        <div className="flex-grow flex flex-col items-center justify-center p-8 max-w-lg mx-auto w-full space-y-8 py-16 animate-in fade-in slide-in-from-bottom-3 duration-305">
          <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-gray-200/80 flex items-center justify-center text-neutral-900 shadow-xs">
            <ShieldCheck className="w-8 h-8 stroke-[1.5]" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-extrabold text-neutral-900 tracking-tight font-display">
              Administrative Authorization Required
            </h3>
            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              Verify your credentials to view real-time registrant profiles, professional topic proposals, files, and transaction checkout statistics.
            </p>
          </div>

          {/* Secure Google Login Button */}
          <div className="w-full space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={authChecking}
              className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl flex items-center justify-center gap-3 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
            >
              {authChecking ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.74-.08-1.302-.177-1.859H12.24z"/>
                  </svg>
                  <span>Authenticate with Google</span>
                </>
              )}
            </button>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-2 text-xs leading-relaxed animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{loginError}</span>
              </div>
            )}

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                Or Use Local Override Passcode
              </span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Passcode fallback form */}
            <form onSubmit={handlePasscodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <input
                  type="password"
                  placeholder="Enter administrator passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                />
              </div>

              {passcodeError && (
                <p className="text-[11px] text-red-600 font-semibold text-center">{passcodeError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-neutral-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Unlock Dashboard View
              </button>
            </form>
          </div>

          <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-semibold">
            SECURE AUDIT CONTROL • ECON AFRICA PORTAL
          </p>
        </div>
      ) : (
        /* Authorized Admin State */
        <div className="flex-grow flex flex-col overflow-hidden animate-in fade-in duration-300">
          
          {/* Quick Stats Summary Grid */}
          <div className="bg-neutral-50/50 border-b border-gray-100 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
            
            {/* Stat 1 */}
            <div className="bg-white border border-gray-200/50 rounded-2xl p-4 flex items-center gap-4 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total Registrations</span>
                <h4 className="text-2xl font-extrabold text-neutral-950 leading-none">{totalRegistrations}</h4>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="bg-white border border-gray-200/50 rounded-2xl p-4 flex items-center gap-4 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Completed Checkout</span>
                <h4 className="text-2xl font-extrabold text-neutral-950 leading-none">{completedPayments.length}</h4>
                <p className="text-[10px] text-emerald-700 font-medium font-mono">
                  {totalRegistrations > 0 ? `${Math.round((completedPayments.length / totalRegistrations) * 100)}% Conversion` : '0%'}
                </p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="bg-white border border-gray-200/50 rounded-2xl p-4 flex items-center gap-4 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Abandoned / Pending Checkout</span>
                <h4 className="text-2xl font-extrabold text-neutral-950 leading-none">{pendingCheckout.length}</h4>
                <p className="text-[10px] text-gray-400 font-medium">Initiated registration profile</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="bg-white border border-gray-200/50 rounded-2xl p-4 flex items-center gap-4 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-neutral-900 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Est. Event Revenue</span>
                <h4 className="text-2xl font-extrabold text-emerald-600 leading-none">
                  ${Math.round(totalRevenue).toLocaleString()}
                </h4>
                <p className="text-[10px] text-gray-405">Based on USD exchange values</p>
              </div>
            </div>

          </div>

          {/* Filtering & Action Control Bar */}
          <div className="p-4 md:p-6 bg-white border-b border-gray-150 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center shrink-0">
            {/* Search Input */}
            <div className="relative flex-grow max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-450" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee by name, email, org, country..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1.5 focus:ring-neutral-900 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dynamic Filters Area */}
            <div className="flex flex-wrap items-center gap-2">
              
              {/* Filter Payment status */}
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select 
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Payment: All</option>
                  <option value="success">Paid / Checkout Success</option>
                  <option value="pending">Abandoned / Pending</option>
                </select>
              </div>

              {/* Filter Ticket Pass selection */}
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 gap-1.5">
                <select 
                  value={filterTicket}
                  onChange={(e) => setFilterTicket(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Ticket Tier: All</option>
                  {TICKETS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Filter Participation format */}
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 gap-1.5">
                <select 
                  value={filterParticipation}
                  onChange={(e) => setFilterParticipation(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Role: All</option>
                  <option value="Delegate">Delegate</option>
                  <option value="Speaker">Speaker</option>
                  <option value="Sponsor">Sponsor</option>
                  <option value="Exhibitor">Exhibitor</option>
                </select>
              </div>

              {/* CSV Export & Manual Refresh Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={fetchRegistrations}
                  disabled={isLoading}
                  title="Force refresh database list"
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-650 active:scale-95 transition-all cursor-pointer bg-white"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={filteredRegistrations.length === 0}
                  className="px-4 py-2.5 bg-neutral-900 border border-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 transform active:scale-98 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to CSV ({filteredRegistrations.length})
                </button>
              </div>

            </div>
          </div>

          {/* Active Error view */}
          {fetchError && (
            <div className="m-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 text-xs md:text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Database Loading Error</span>
                <p className="text-xs text-red-700 mt-1">{fetchError}</p>
              </div>
            </div>
          )}

          {/* Registrations List Content area */}
          <div className="flex-grow overflow-auto p-4 md:p-6 bg-gray-50/30">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-neutral-950 animate-spin" />
                <p className="text-sm font-semibold text-neutral-900">Retrieving Firestore registrations...</p>
                <p className="text-[10px] text-gray-400 font-mono">Verifying administrative access credentials</p>
              </div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 py-20 text-center max-w-md mx-auto space-y-5">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                  <FileText className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-gray-900">No matching registrations found</h4>
                  <p className="text-xs text-gray-450 leading-relaxed">
                    We didn't locate records aligning with your active search parameters or filter scopes.
                  </p>
                </div>
                {registrations.length === 0 && (
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateSampleData}
                      disabled={submittingSampleData}
                      className="px-5 py-2.5 bg-neutral-950 text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:bg-neutral-800 transition-all mx-auto shadow-xs active:translate-y-0.5 cursor-pointer"
                    >
                      {submittingSampleData ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating realistic profiles...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Generate 4 Showcase Registrations</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-2 font-mono">
                      Instantly populate the audit view with realistic test profiles
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* High fidelity Table list */
              <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden shadow-2xs">
                {/* Desktop and Tablet Table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-neutral-900 text-white font-mono text-[10px] font-bold uppercase tracking-wider border-b border-neutral-800">
                        <th className="py-3 px-4 font-extrabold">ID & Registrant</th>
                        <th className="py-3 px-4 font-extrabold">Professional Role & Org</th>
                        <th className="py-3 px-4 font-extrabold">Selected Pass Category</th>
                        <th className="py-3 px-4 font-extrabold">Registered At</th>
                        <th className="py-3 px-4 font-extrabold">Presence</th>
                        <th className="py-3 px-4 font-extrabold">Checkout Status</th>
                        <th className="py-3 px-4 text-right font-extrabold pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedRegistrations.map((reg) => {
                        const isSuccess = reg.paymentStatus === 'success';
                        
                        return (
                          <tr key={reg.id} className="hover:bg-gray-50/50 transition-colors group">
                            
                            {/* Registrant identifier */}
                            <td className="py-4 px-4 space-y-1">
                              <div className="font-bold text-gray-950 group-hover:text-emerald-800 transition-colors">
                                {reg.firstName} {reg.lastName}
                              </div>
                              <div className="font-mono text-[10px] text-gray-450 flex items-center gap-1.5">
                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold">{reg.id}</span>
                                <span>•</span>
                                <span>{(reg.email || '').toLowerCase()}</span>
                              </div>
                            </td>

                            {/* Org context */}
                            <td className="py-4 px-4 space-y-0.5">
                              <div className="font-medium text-gray-900 text-xs flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                                  reg.participationType === 'Speaker' ? 'bg-amber-100 text-amber-800' :
                                  reg.participationType === 'Sponsor' ? 'bg-purple-100 text-purple-800' :
                                  reg.participationType === 'Exhibitor' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {reg.participationType}
                                </span>
                                {reg.jobTitle && <span className="truncate max-w-[120px] text-gray-505">{reg.jobTitle}</span>}
                              </div>
                              <div className="text-gray-400 text-xs flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-gray-300" />
                                <span className="truncate max-w-[160px] font-semibold">{reg.organization || 'Self-employed'}</span>
                              </div>
                            </td>

                            {/* Pass category info */}
                            <td className="py-4 px-4 space-y-0.5">
                              <div className="font-semibold text-gray-905 text-xs">
                                {getTicketFriendlyName(reg.selectedTicketId)}
                              </div>
                              <div className="font-mono text-[10px] text-gray-400">
                                {reg.selectedTicketId ? TICKETS.find(t => t.id === reg.selectedTicketId)?.currency === 'USD' ? '$' : 'KES' : ''}{' '}
                                {reg.selectedTicketId ? (TICKETS.find(t => t.id === reg.selectedTicketId)?.price || 0).toLocaleString() : 'N/A'}
                              </div>
                            </td>

                            {/* Registered At Timestamp */}
                            <td className="py-4 px-4">
                              <div className="text-xs text-gray-705 font-bold font-mono">
                                {formatTimestamp(reg.createdAt)}
                              </div>
                            </td>

                            {/* Attendance */}
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                reg.attendance === 'Physical' 
                                  ? 'bg-neutral-905 text-white bg-neutral-900' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                {reg.attendance || 'N/A'}
                              </span>
                            </td>

                            {/* Payment checkout Status Badge */}
                            <td className="py-4 px-4">
                              <div className="inline-flex flex-col gap-0.5">
                                {isSuccess ? (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-[11px] font-bold">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                    <span>Proceeded & Paid</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-850 text-[11px] font-bold">
                                    <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
                                    <span>Initiated (Pending)</span>
                                  </div>
                                )}
                                {reg.paymentMethod && (
                                  <span className="text-[9px] font-mono font-bold text-gray-400 uppercase select-none leading-none mt-0.5 pl-1.5">
                                    via {reg.paymentMethod} {reg.receiptNumber ? `(${reg.receiptNumber.substring(0, 10)}...)` : ''}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Action triggering Detailed Modal */}
                            <td className="py-4 px-4 text-right pr-6">
                              <button
                                onClick={() => setSelectedItem(reg)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-900 border border-gray-200/80 hover:border-neutral-900 text-neutral-800 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                              >
                                View full profile
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile list view */}
                <div className="block md:hidden divide-y divide-gray-100">
                  {paginatedRegistrations.map((reg) => {
                    const isSuccess = reg.paymentStatus === 'success';
                    return (
                      <div key={reg.id} className="p-4 hover:bg-gray-50/30 transition-all space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono font-bold text-[9px]">{reg.id}</span>
                            <h4 className="font-extrabold text-neutral-900 text-sm mt-1">{reg.firstName} {reg.lastName}</h4>
                            <p className="text-xs text-gray-400">{(reg.email || '').toLowerCase()}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-mono">Registered: {formatTimestamp(reg.createdAt)}</p>
                          </div>
                          
                          {isSuccess ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold text-[10px]">Paid</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-800 font-bold text-[10px]">Pending</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 bg-neutral-50/50 p-2.5 rounded-xl border border-gray-100">
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold">Category</span>
                            <span className="text-neutral-800 font-semibold text-[11px] truncate block">{reg.participationType}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold">Ticket Tier</span>
                            <span className="text-neutral-800 font-semibold text-[11px] truncate block">{getTicketFriendlyName(reg.selectedTicketId)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setSelectedItem(reg)}
                          className="w-full py-2 bg-neutral-50 hover:bg-neutral-900 border border-gray-200 text-neutral-800 hover:text-white rounded-xl text-xs font-bold font-display text-center transition-all cursor-pointer block"
                        >
                          View detailed profile
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 md:px-6 bg-neutral-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center border-t border-gray-100/80">
                  <div className="text-xs text-gray-500 font-semibold font-mono uppercase tracking-wider">
                    Showing <span className="text-neutral-900 font-extrabold">{totalFilteredCount > 0 ? startIndex + 1 : 0}</span> to <span className="text-neutral-900 font-extrabold">{endIndex}</span> of <span className="text-neutral-900 font-extrabold">{totalFilteredCount}</span> registrations
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 uppercase font-mono font-bold leading-none">Rows per page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                        }}
                        className="bg-white border border-gray-200 text-xs font-bold text-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    {/* Navigation controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-4.5 h-4.5" />
                      </button>

                      <span className="text-xs font-bold text-gray-600 px-1 font-mono uppercase tracking-wider select-none shrink-0">
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                        title="Next page"
                      >
                        <ChevronRight className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* Drill-down modal for full profile review */}
      {selectedItem && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-neutral-900 text-white px-6 py-4 flex justify-between items-center border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                  {selectedItem.id}
                </span>
                <span className="text-gray-400 text-xs font-bold leading-none font-mono">Profile Details</span>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              
              {/* Profile Bio summary */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <h3 className="text-2xl font-extrabold text-neutral-900 font-display">
                    {selectedItem.firstName} {selectedItem.lastName}
                  </h3>
                  <p className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                    {selectedItem.jobTitle || 'Business Representative'}{' '}
                    {selectedItem.organization && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-emerald-800 font-bold">{selectedItem.organization}</span>
                      </>
                    )}
                  </p>
                  {selectedItem.createdAt && (
                    <span className="text-[10px] text-gray-400 font-mono block mt-1.5 uppercase tracking-wider font-extrabold">
                      Registered At: {formatTimestamp(selectedItem.createdAt)}
                    </span>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${
                    selectedItem.paymentStatus === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-850'
                      : 'bg-amber-50 border-amber-200 text-amber-850'
                  }`}>
                    {selectedItem.paymentStatus === 'success' ? 'Checkout Complete' : 'Pending Checkout'}
                  </span>
                  {selectedItem.paymentMethod && (
                    <span className="text-[9px] font-mono text-gray-400 font-semibold">
                      Via {selectedItem.paymentMethod.toUpperCase()} • {selectedItem.receiptNumber?.substring(0, 15)}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid 2 Column detailed contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Email address */}
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                  <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold leading-none mb-1">Email Address</span>
                    <a href={`mailto:${selectedItem.email}`} className="text-xs font-bold text-neutral-900 hover:underline hover:text-emerald-800 truncate block">
                      {selectedItem.email}
                    </a>
                  </div>
                </div>

                {/* Phone contact */}
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold leading-none mb-1">Phone Contact</span>
                    <span className="text-xs font-bold text-neutral-900">{selectedItem.phone}</span>
                  </div>
                </div>

                {/* Country Location */}
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                  <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold leading-none mb-1">Country ISO Code</span>
                    <span className="text-xs font-bold text-neutral-900">{selectedItem.country} • {selectedItem.city}</span>
                  </div>
                </div>

                {/* Presence form */}
                <div className="flex items-center gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                  <Ticket className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase tracking-wider block font-bold leading-none mb-1">Pass Option / Presence</span>
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1">
                      {getTicketFriendlyName(selectedItem.selectedTicketId)} 
                      <span className="text-gray-300 font-normal">|</span>
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-extrabold">{selectedItem.attendance}</span>
                    </span>
                  </div>
                </div>

              </div>

              {/* Physical Address description */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Physical Address</span>
                <p className="text-xs text-neutral-800 bg-neutral-50 p-3 rounded-xl border border-gray-200/50 leading-relaxed font-semibold">
                  {selectedItem.address || 'N/A'}{selectedItem.zipCode ? `, ZIP: ${selectedItem.zipCode}` : ''}
                </p>
              </div>

              {/* Areas of Interest Tags */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Areas of Interest</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.areasOfInterest && selectedItem.areasOfInterest.length > 0 ? (
                    selectedItem.areasOfInterest.map((interest, idx) => (
                      <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-xs font-semibold text-emerald-800">
                        {interest}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-450 italic">None selected</span>
                  )}
                </div>
              </div>

              {/* Session / topic details for Speakers */}
              {selectedItem.participationType === 'Speaker' && (
                <div className="space-y-4 bg-amber-50/30 border border-amber-200/50 p-4 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Presenter Session Proposal</span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-450 uppercase font-bold tracking-wider">Proposed Topic Heading</span>
                    <h5 className="text-xs font-extrabold text-neutral-900">{selectedItem.proposedTopic || 'No topic entered'}</h5>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-450 uppercase font-bold tracking-wider">Key Session Abstract</span>
                    <p className="text-xs text-neutral-700 leading-relaxed font-semibold">{selectedItem.sessionSummary || 'No summary entered'}</p>
                  </div>

                  {selectedItem.preferredFormat && (
                    <div className="text-xs font-medium text-gray-650 flex items-center gap-1.5 mt-1">
                      <span>Preferred Delivery Style:</span>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200/50 px-2 py-0.5 rounded-lg text-[10px] font-bold">{selectedItem.preferredFormat}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments view */}
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted Attachments (Metadata)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedItem.attachments && Object.entries(selectedItem.attachments).some(([_, val]) => !!val) ? (
                    Object.entries(selectedItem.attachments).map(([key, value]: any) => {
                      if (!value) return null;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 bg-gray-50/70 border border-gray-150 rounded-xl">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[9px] text-gray-400 uppercase font-bold block capitalize tracking-wider leading-none mb-1">{key}</span>
                              <span className="text-xs font-bold text-neutral-900 truncate block max-w-[140px]" title={value.name}>
                                {value.name}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-gray-400 font-bold shrink-0 bg-white border border-gray-150 px-2 py-0.5 rounded-lg mt-1">
                            {Math.round(value.size / 1024)} KB
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 font-medium">
                      No document attachments were uploaded during registration set.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-gray-50 hover:bg-gray-100/60 px-6 py-4 flex items-center justify-between border-t border-gray-150 shrink-0">
              <span className="text-[9px] font-mono text-gray-400 font-bold uppercase tracking-widest block">
                AUDIT LOGS • CLOSED RECORD
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
