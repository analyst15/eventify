/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  CreditCard, Smartphone, Check, ArrowLeft, ShieldCheck, 
  MapPin, User, Mail, Phone, ExternalLink, RefreshCw, Printer, Download, Sparkles, X, Loader2 
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { RegistrationData, Ticket } from '../types';
import { TICKETS } from '../data';

interface CheckoutPageProps {
  registrationData: RegistrationData;
  registrationId: string | null;
  onBack: () => void;
  onPaymentSuccess: () => void;
}

export default function CheckoutPage({ registrationData, registrationId, onBack, onPaymentSuccess }: CheckoutPageProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string>('early_bird');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile_money' | 'dpo'>('card');
  const [phoneForMobileMoney, setPhoneForMobileMoney] = useState<string>(registrationData.phone);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [showExitConfirmation, setShowExitConfirmation] = useState<boolean>(false);

  const selectedTicket = TICKETS.find(t => t.id === selectedTicketId) || TICKETS[0];

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'KES') {
      return `KES ${price.toLocaleString()}`;
    }
    return `$${price.toLocaleString()}`;
  };

  const handleProceedPayment = () => {
    setShowPaymentModal(true);
  };

  const handleSimulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    const generatedReceipt = 'DPO-' + Math.floor(100000 + Math.random() * 900000);
    
    if (registrationId) {
      try {
        const docRef = doc(db, 'registrations', registrationId);
        await updateDoc(docRef, {
          paymentStatus: 'success',
          selectedTicketId: selectedTicketId,
          paymentMethod: paymentMethod,
          amountPaid: selectedTicket.price,
          receiptNumber: generatedReceipt,
          updatedAt: serverTimestamp(),
        });
        
        setIsProcessing(false);
        setReceiptNumber(generatedReceipt);
        setIsSuccess(true);
        onPaymentSuccess();
      } catch (dbErr) {
        console.error("Payment registration database update error:", dbErr);
        setIsProcessing(false);
        try {
          handleFirestoreError(dbErr, OperationType.WRITE, `registrations/${registrationId}`);
        } catch (wrappedErr) {
          alert(wrappedErr instanceof Error ? wrappedErr.message : String(wrappedErr));
        }
      }
    } else {
      // Fallback
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        setReceiptNumber(generatedReceipt);
        onPaymentSuccess();
      }, 2000);
    }
  };

  const handleKeepSavedAndExit = async () => {
    if (registrationId) {
      setIsExiting(true);
      try {
        const docRef = doc(db, 'registrations', registrationId);
        await updateDoc(docRef, {
          paymentStatus: 'saved_for_later',
          selectedTicketId: selectedTicketId,
          updatedAt: serverTimestamp(),
        });
        setShowExitConfirmation(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (dbErr) {
        console.error("Save & Exit registration update error:", dbErr);
        try {
          handleFirestoreError(dbErr, OperationType.WRITE, `registrations/${registrationId}`);
        } catch (wrappedErr) {
          alert(wrappedErr instanceof Error ? wrappedErr.message : String(wrappedErr));
        }
      } finally {
        setIsExiting(false);
      }
    } else {
      setShowExitConfirmation(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const nameValue = `${registrationData.firstName} ${registrationData.lastName}`;

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <button
        onClick={onBack}
        disabled={isSuccess || showExitConfirmation}
        className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-black hover:bg-neutral-100 px-3.5 py-1.5 rounded-lg border border-gray-150 bg-white transition-all w-fit cursor-pointer disabled:opacity-50"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Registration Form
      </button>

      {showExitConfirmation ? (
        /* Reassuring Exit / Saved for Later Screen */
        <div className="bg-white p-8 md:p-12 rounded-2xl border border-blue-105 shadow-md text-center max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">Registration Profile Saved!</h2>
            <p className="text-sm text-gray-500">
              Thank you, <span className="font-bold text-neutral-900">{registrationData.firstName}</span>. Your details for the Africa Emerging Markets Summit 2026 are captured.
            </p>
          </div>

          <div className="bg-neutral-50 rounded-xl p-5 border border-gray-150 text-left space-y-4">
            <div className="border-b border-gray-200 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">What happens next?</span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex gap-2.5 items-start">
                <span className="text-neutral-400 font-bold font-mono text-xs mt-0.5">01.</span>
                <p className="text-neutral-700 text-xs leading-relaxed">
                  Your profile is successfully queued on our summit roster in the attendee category: <span className="font-bold text-neutral-900 bg-gray-200/60 px-2 py-0.5 rounded-sm">{registrationData.participationType}</span>.
                </p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="text-neutral-400 font-bold font-mono text-xs mt-0.5">02.</span>
                <p className="text-neutral-700 text-xs leading-relaxed">
                  A regional relations advisor will reach out to you within 24 hours at <span className="font-bold underline text-neutral-950">{registrationData.email}</span> or via mobile at <span className="font-semibold text-neutral-950">{registrationData.phone}</span> to help organize custom group passes or finalize badge distribution.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
            You can safely close this browser window now. If you would like to proceed with instant digital payment checkout instead, you can return to the ticket area.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-3 justify-center">
            <button
              onClick={() => setShowExitConfirmation(false)}
              className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all cursor-pointer"
            >
              ← Back to Ticket Selection
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gray-50 border border-gray-200 text-neutral-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-all cursor-pointer"
            >
              Register Another Delegate
            </button>
          </div>
        </div>
      ) : isSuccess ? (
        /* Success Screen */
        <div className="bg-white p-8 md:p-12 rounded-2xl border border-emerald-100 shadow-md text-center max-w-2xl mx-auto space-y-6">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-950 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">Payment Completed Successfully!</h2>
            <p className="text-sm text-gray-500">Your registration is verified and secure. Welcome to the conference.</p>
          </div>

          <div className="bg-neutral-50 rounded-xl p-5 border border-gray-150 inline-block text-left w-full space-y-3.5">
            <div className="flex justify-between items-center text-xs pb-3 border-b border-gray-200">
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Transaction Status:</span>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">APPROVED BY DPO</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm font-sans pt-1">
              <div>
                <p className="text-xs text-gray-400">Attendee Name</p>
                <p className="font-semibold text-neutral-800">{nameValue}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Receipt / Reference</p>
                <p className="font-semibold text-neutral-800 font-mono">{receiptNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Selected Ticket</p>
                <p className="font-semibold text-neutral-800">{selectedTicket.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total Charged</p>
                <p className="font-semibold text-neutral-900 font-mono">{formatPrice(selectedTicket.price, selectedTicket.currency)}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            A confirmation receipt alongside digital admittance codes has been dispatched securely to <span className="font-semibold text-neutral-900">{registrationData.email}</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-3 justify-center">
            <button
              onClick={handlePrint}
              className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gray-50 border border-gray-200 text-neutral-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Register Another Delegate
            </button>
          </div>
        </div>
      ) : (
        /* Regular Checkout Screen */
        <div className="space-y-6">
          {/* Reassurance Detail-Saved Banner Header */}
          <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-5 text-left flex items-start gap-4 animate-in fade-in duration-200 shadow-3xs">
            <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 flex-shrink-0">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold text-emerald-950">Registration Details Saved!</h4>
              <p className="text-xs text-emerald-800 leading-relaxed font-semibold">
                Your delegate profile is now securely logged in our attendee roster. You may choose to select your ticket level and checkout instantly using our secure DPO platform now, or you can safely exit at any time—our summit coordinator will reach out to you within 24 hours at <span className="underline font-extrabold">{registrationData.email}</span> to help complete your registration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left panel: Selected Tickets Selection */}
            <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Step 2: Select Event Ticket Tier</h2>
                  <p className="text-sm text-gray-500 font-sans mt-0.5">Choose the appropriate entry pass or premium sponsorship module.</p>
                </div>
              </div>

              {/* Tickets Radio List */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                {TICKETS.map(ticket => {
                  const selected = selectedTicketId === ticket.id;
                  const isSponsorTier = ticket.currency === 'USD';
                  return (
                    <label
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`block p-4 rounded-xl border cursor-pointer text-left transition-all relative ${
                        selected 
                          ? 'border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900/5' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            selected ? 'border-neutral-900 bg-neutral-900' : 'border-gray-300'
                          }`}>
                            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-sm font-bold ${selected ? 'text-neutral-950' : 'text-neutral-900'}`}>
                                {ticket.name}
                              </span>
                              {isSponsorTier ? (
                                <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                  Sponsorship USD
                                </span>
                              ) : (
                                <span className="text-[9px] bg-neutral-150 text-neutral-700 border border-neutral-250 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                                  KES Standard
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              {ticket.description}
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-extrabold font-mono text-neutral-950">
                            {formatPrice(ticket.price, ticket.currency)}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel: Summary Details Card & Submit Button */}
          <div className="space-y-6">
            {/* Registered Attendee Summary Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider pb-3 border-b border-gray-100">
                Attendee Profile Summary
              </h3>

              <div className="space-y-4">
                {/* Name */}
                <div className="flex gap-3">
                  <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Full Name</p>
                    <p className="text-sm font-bold text-neutral-800">{nameValue}</p>
                    <p className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium w-fit mt-1">
                      {registrationData.participationType} Badge
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div className="flex gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" id="icon-mail" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-neutral-800 truncate select-all">{registrationData.email}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex gap-3">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" id="icon-phone" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phone Number</p>
                    <p className="text-sm font-semibold text-neutral-800 select-all">{registrationData.phone}</p>
                  </div>
                </div>

                {/* Location with prompt Country 2-letter code */}
                <div className="flex gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" id="icon-mappin" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Location Details (Country Code)</p>
                    <p className="text-sm font-medium text-neutral-800 leading-normal">
                      {registrationData.address}, {registrationData.city}, <span className="font-bold underline ring-1 ring-gray-150 bg-gray-50 px-1 py-0.5 rounded-sm">{registrationData.country}</span> - {registrationData.zipCode}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Order Summary & Button */}
            <div className="bg-neutral-900 text-white p-6 rounded-2xl shadow-sm space-y-6">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider pb-3 border-b border-neutral-800">
                Order Total Summary
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">{selectedTicket.name}</span>
                  <span className="font-medium font-mono">{formatPrice(selectedTicket.price, selectedTicket.currency)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Processing Fee</span>
                  <span className="font-medium text-emerald-400 font-mono">FREE</span>
                </div>

                <div className="pt-4 border-t border-neutral-800 flex justify-between items-baseline">
                  <span className="text-sm font-bold">Grand Total:</span>
                  <span className="text-xl font-extrabold text-neutral-100 font-mono">
                    {formatPrice(selectedTicket.price, selectedTicket.currency)}
                  </span>
                </div>
              </div>

              {/* Secure Payments DPO notice */}
              <div className="flex items-start gap-2.5 p-3.5 bg-neutral-800/80 rounded-xl border border-neutral-850">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0 self-center" />
                <p className="text-[11px] text-neutral-300 leading-snug">
                  Secured Direct Pay Online API. Secure payments integrated by <span className="font-extrabold text-white">DPO Group</span> (Credit Card, Mobile Money).
                </p>
              </div>

              <button
                onClick={handleProceedPayment}
                className="w-full bg-white hover:bg-neutral-100 text-neutral-950 font-bold py-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <CreditCard className="w-4 h-4 text-neutral-950" />
                Proceed to Secure Payment
              </button>

              <button
                onClick={handleKeepSavedAndExit}
                disabled={isExiting}
                type="button"
                className="w-full border border-neutral-700 hover:border-neutral-500 bg-transparent hover:bg-white/5 text-neutral-300 hover:text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer font-sans disabled:opacity-50"
              >
                {isExiting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-350" />
                    Saving to Attendee Roster...
                  </>
                ) : (
                  "Keep Details Saved & Exit (Pay Later)"
                )}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* DPO Gateway Payment Modal simulation */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in-50 duration-250">
            {/* Modal header */}
            <div className="bg-neutral-900 p-5 text-white flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] bg-emerald-500 text-neutral-950 font-extrabold px-1.5 py-0.5 rounded-sm tracking-wide uppercase">
                  DPO Group Secure Gateway
                </span>
                <h3 className="text-base font-bold">Secure Checkout Service</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isProcessing}
                className="p-1.5 hover:bg-neutral-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gateway Body content */}
            <form onSubmit={handleSimulatePayment} className="p-6 space-y-5">
              <div className="flex justify-between items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-150">
                <span className="text-xs font-semibold text-gray-500">Payable amount:</span>
                <span className="text-base font-bold font-mono text-neutral-900">
                  {formatPrice(selectedTicket.price, selectedTicket.currency)}
                </span>
              </div>

              {/* Payment selector */}
              <div className="grid grid-cols-3 gap-2 border border-gray-150 p-1 bg-gray-50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 text-center rounded-md font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                    paymentMethod === 'card' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-gray-500 hover:text-neutral-800'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`py-2 text-center rounded-md font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                    paymentMethod === 'mobile_money' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-gray-500 hover:text-neutral-800'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('dpo')}
                  className={`py-2 text-center rounded-md font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                    paymentMethod === 'dpo' ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-gray-500 hover:text-neutral-800'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  DPO Account
                </button>
              </div>

              {/* Conditional Inputs */}
              {paymentMethod === 'card' && (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      defaultValue={nameValue}
                      className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1.5 focus:ring-neutral-900 focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Card Number</label>
                    <input
                      type="text"
                      required
                      placeholder="4000 1234 5678 9010"
                      pattern="[0-9]{16,19}"
                      title="Please enter valid Card digits"
                      maxLength={19}
                      className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1.5 focus:ring-neutral-900 focus:bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Expiry MM/YY</label>
                      <input
                        type="text"
                        required
                        placeholder="12/28"
                        maxLength={5}
                        className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1.5 focus:ring-neutral-900 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">CVV Code</label>
                      <input
                        type="password"
                        required
                        placeholder="***"
                        maxLength={3}
                        className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1.5 focus:ring-neutral-900 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'mobile_money' && (
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide" htmlFor="dpo-phone">
                      Select Provider
                    </label>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        className="py-3 px-4 border border-rose-200 bg-rose-50/50 text-rose-800 rounded-xl text-center font-bold text-xs cursor-pointer flex items-center justify-center gap-2 ring-1 ring-rose-200"
                      >
                        <div className="w-3.5 h-3.5 rounded-full bg-rose-650 flex items-center justify-center text-white text-[8px] font-mono leading-none">A</div>
                        Airtel Money
                      </button>
                      <button
                        type="button"
                        className="py-3 px-4 border border-emerald-250 bg-emerald-50 text-emerald-800 rounded-xl text-center font-bold text-xs cursor-pointer flex items-center justify-center gap-2 ring-1 ring-emerald-200"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                        Safaricom M-Pesa
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide" htmlFor="dpo-phone">
                      Mobile Number for PIN Trigger
                    </label>
                    <input
                      id="dpo-phone"
                      type="tel"
                      required
                      value={phoneForMobileMoney}
                      onChange={(e) => setPhoneForMobileMoney(e.target.value)}
                      placeholder="e.g. +254 700 000 000"
                      className="w-full border border-gray-200 bg-gray-50/50 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1.5 focus:ring-neutral-900 focus:bg-white"
                    />
                    <p className="text-[10px] text-gray-500 leading-normal mt-1">
                      An STK push request will trigger automatically on your handset. Enter your SIM PIN code inside the prompt to confirm instantly.
                    </p>
                  </div>
                </div>
              )}

              {paymentMethod === 'dpo' && (
                <div className="space-y-3 p-4 bg-neutral-50 rounded-xl border border-gray-150">
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Direct redirection to your active <span className="font-extrabold text-neutral-900">DPO Account / Wallet</span> portal. Login utilizing credentials to deduct direct tokens.
                  </p>
                  <div className="space-y-2">
                    <input
                      type="email"
                      required={paymentMethod === 'dpo'}
                      placeholder="DPO registered Email address"
                      className="w-full border border-gray-200 bg-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1.5 focus:ring-neutral-900"
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    Transacting Direct via DPO...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                    Pay {formatPrice(selectedTicket.price, selectedTicket.currency)} Now
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">PCI-DSS Level 1 Encrypted</span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
