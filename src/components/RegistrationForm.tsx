import React, { useState, useRef } from 'react';
import { 
  User, Mail, Phone, Briefcase, Building, Globe, MapPin, 
  Sparkles, Upload, X, Check, FileText, AlertCircle, Bookmark 
} from 'lucide-react';
import { RegistrationData, ParticipationType, PreferredFormat, AttendanceType, FileMock } from '../types';
import { AREAS_OF_INTEREST, PARTICIPATION_OPPORTUNITIES, COUNTRIES, GLOBAL_COUNTRY_MAP } from '../data';

interface RegistrationFormProps {
  initialData: RegistrationData;
  onSubmit: (data: RegistrationData) => void;
}

export default function RegistrationForm({ initialData, onSubmit }: RegistrationFormProps) {
  const [formData, setFormData] = useState<RegistrationData>(initialData);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [dragActive, setDragActive] = useState<{ [key: string]: boolean }>({
    bio: false,
    companyProfile: false,
    headshot: false,
    presentationDeck: false
  });

  const [isOtherCountry, setIsOtherCountry] = useState(() => {
    if (initialData.country && !COUNTRIES.some(c => c.code === initialData.country)) {
      return true;
    }
    return false;
  });
  const [customCountryName, setCustomCountryName] = useState('');
  const [customCountryCode, setCustomCountryCode] = useState(() => {
    if (initialData.country && !COUNTRIES.some(c => c.code === initialData.country)) {
      return initialData.country;
    }
    return '';
  });

  const bioInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const deckInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'OTHER') {
      setIsOtherCountry(true);
      setFormData(prev => ({ ...prev, country: customCountryCode || '' }));
    } else {
      setIsOtherCountry(false);
      setFormData(prev => ({ ...prev, country: val }));
    }
    if (errors.country) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.country;
        return copy;
      });
    }
  };

  const [matchedLabel, setMatchedLabel] = useState('');

  const handleCustomCountryNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomCountryName(val);

    const normalized = val.trim().toLowerCase();
    let matchedCode = GLOBAL_COUNTRY_MAP[normalized];
    let matchedName = '';

    if (matchedCode) {
      matchedName = val.trim();
    } else if (normalized.length >= 3) {
      const allKeys = Object.keys(GLOBAL_COUNTRY_MAP);
      const foundKey = allKeys.find(k => k === normalized || k.startsWith(normalized) || k.includes(normalized));
      if (foundKey) {
        matchedCode = GLOBAL_COUNTRY_MAP[foundKey];
        matchedName = foundKey.replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    if (matchedCode) {
      setCustomCountryCode(matchedCode);
      setFormData(prev => ({ ...prev, country: matchedCode }));
      setMatchedLabel(`${matchedName} (${matchedCode})`);
      if (errors.customCountryCode) {
        setErrors(prev => {
          const copy = { ...prev };
          delete copy.customCountryCode;
          return copy;
        });
      }
    } else {
      setMatchedLabel('');
    }

    if (errors.customCountryName) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.customCountryName;
        return copy;
      });
    }
  };

  const handleCustomCountryCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    setCustomCountryCode(val);
    setFormData(prev => ({ ...prev, country: val }));
    if (errors.customCountryCode) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy.customCountryCode;
        return copy;
      });
    }
  };

  const handleParticipationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ParticipationType;
    setFormData(prev => {
      const updated = { ...prev, participationType: value };
      // If Speaker, pre-fill speaking or clean speaker fields if needed, but keep existing
      return updated;
    });
  };

  const handleCheckboxChange = (category: 'areasOfInterest' | 'participationOpportunities', item: string) => {
    setFormData(prev => {
      const current = prev[category] as string[];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return {
        ...prev,
        [category]: updated
      };
    });
  };

  const handleRadioChange = (name: 'preferredFormat' | 'attendance', value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Simulating uploads
  const simulateFileUpload = (field: keyof RegistrationData['attachments'], file: File) => {
    const formattedSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    const reader = new FileReader();
    reader.onloadend = () => {
      const mock: FileMock = {
        name: file.name,
        size: formattedSize,
        type: file.type,
        dataUrl: reader.result as string
      };

      setFormData(prev => ({
        ...prev,
        attachments: {
          ...prev.attachments,
          [field]: mock
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof RegistrationData['attachments']) => {
    if (e.target.files && e.target.files[0]) {
      simulateFileUpload(field, e.target.files[0]);
    }
  };

  const removeFile = (field: keyof RegistrationData['attachments']) => {
    setFormData(prev => ({
      ...prev,
      attachments: {
        ...prev.attachments,
        [field]: null
      }
    }));
  };

  const handleDrag = (e: React.DragEvent, field: string, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [field]: active }));
  };

  const handleDrop = (e: React.DragEvent, field: keyof RegistrationData['attachments']) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [field]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateFileUpload(field, e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = (field: keyof RegistrationData['attachments']) => {
    if (field === 'bio') bioInputRef.current?.click();
    if (field === 'companyProfile') companyInputRef.current?.click();
    if (field === 'headshot') headshotInputRef.current?.click();
    if (field === 'presentationDeck') deckInputRef.current?.click();
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (isOtherCountry) {
      if (!customCountryName.trim()) {
        newErrors.customCountryName = 'Country name is required';
      }
      if (!customCountryCode.trim() || customCountryCode.length !== 2) {
        newErrors.customCountryCode = 'A valid 2-letter Country Code is required';
      }
    } else {
      if (!formData.country) {
        newErrors.country = 'Please select a country';
      }
    }
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.zipCode.trim()) newErrors.zipCode = 'Zip / Postal code is required';
    
    // Email regex
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.attendance) {
      newErrors.attendance = 'Please select attendance mode';
    }

    // Specific validation if participation type is Speaker
    if (formData.participationType === 'Speaker') {
      if (!formData.proposedTopic.trim()) {
        newErrors.proposedTopic = 'Proposed topic is required for Speakers';
      }
      if (!formData.sessionSummary.trim()) {
        newErrors.sessionSummary = 'Session summary is required for Speakers';
      }
      if (!formData.preferredFormat) {
        newErrors.preferredFormat = 'Preferred format is required for Speakers';
      }
    }

    setErrors(newErrors);
    
    // Scroll to the first error
    if (Object.keys(newErrors).length > 0) {
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementsByName(firstErrorField)[0] || document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const isSpeaker = formData.participationType === 'Speaker';

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      {/* 1. Main Role Selection Section */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
            <Bookmark className="w-5 h-5" id="icon-bookmark" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Participation & Roles</h2>
            <p className="text-sm text-gray-500 font-sans mt-0.5">Define your role and category for the upcoming summit.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div id="field-participation-type" className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 tracking-tight" htmlFor="participationType">
              Participation Type *
            </label>
            <div className="relative">
              <select
                id="participationType"
                name="participationType"
                value={formData.participationType}
                onChange={handleParticipationChange}
                className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all appearance-none text-sm cursor-pointer"
              >
                <option value="Delegate">Delegate</option>
                <option value="Speaker">Speaker</option>
                <option value="Sponsor">Sponsor</option>
                <option value="Exhibitor">Exhibitor</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            {isSpeaker && (
              <p className="text-xs text-amber-700 bg-amber-50/60 p-2.5 rounded-lg flex items-center gap-1.5 mt-2 border border-amber-100 font-medium">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                Speaker Mode Active: This expands specific speaker summary fields below.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Personal & Professional Details */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
            <User className="w-5 h-5" id="icon-user" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Contact & Professional Account Profile</h2>
            <p className="text-sm text-gray-500 font-sans mt-0.5">Please provide your structural identifiers and business credentials.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="firstName">
              First Name *
            </label>
            <div className="relative">
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleTextChange}
                placeholder="e.g. John"
                className={`w-full bg-gray-50/50 border ${errors.firstName ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.firstName && <p className="text-xs text-red-600 font-medium mt-1">{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="lastName">
              Last Name *
            </label>
            <div className="relative">
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleTextChange}
                placeholder="e.g. Doe"
                className={`w-full bg-gray-50/50 border ${errors.lastName ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.lastName && <p className="text-xs text-red-600 font-medium mt-1">{errors.lastName}</p>}
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="jobTitle">
              Job Title
            </label>
            <div className="relative">
              <input
                id="jobTitle"
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleTextChange}
                placeholder="e.g. Executive Director"
                className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
              />
              <Briefcase className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="organization">
              Organization / Company
            </label>
            <div className="relative">
              <input
                id="organization"
                type="text"
                name="organization"
                value={formData.organization}
                onChange={handleTextChange}
                placeholder="e.g. Trade Alliance Group"
                className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
              />
              <Building className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="email">
              Email Address *
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleTextChange}
                placeholder="e.g. user@domain.com"
                className={`w-full bg-gray-50/50 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.email && <p className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="phone">
              Phone Number *
            </label>
            <div className="relative">
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleTextChange}
                placeholder="e.g. +254 700 000 000"
                className={`w-full bg-gray-50/50 border ${errors.phone ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.phone && <p className="text-xs text-red-600 font-medium mt-1">{errors.phone}</p>}
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="country">
              Country *
            </label>
            <div className="relative">
              <select
                id="country"
                name="country"
                value={isOtherCountry ? 'OTHER' : (formData.country || '')}
                onChange={handleCountryChange}
                className={`w-full bg-gray-50/50 border ${errors.country ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all appearance-none`}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
                <option value="OTHER">Other / Not Listed</option>
              </select>
              <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            {errors.country && <p className="text-xs text-red-600 font-medium mt-1">{errors.country}</p>}
          </div>

          {/* Conditional Custom Country Inputs */}
          {isOtherCountry && (
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 p-4 rounded-xl border border-dashed border-neutral-300 animate-in fade-in duration-205">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="customCountryName">
                  Specify Country Name *
                </label>
                <div className="relative">
                  <input
                    id="customCountryName"
                    type="text"
                    value={customCountryName}
                    onChange={handleCustomCountryNameChange}
                    placeholder="e.g. Norway"
                    className={`w-full bg-white border ${errors.customCountryName ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900`}
                  />
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
                {errors.customCountryName && <p className="text-xs text-red-600 font-medium mt-1">{errors.customCountryName}</p>}
                {matchedLabel && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 animate-in slide-in-from-top-1 duration-200 mt-2">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Auto-resolved ISO Code: <span className="font-bold underline">{matchedLabel}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="customCountryCode">
                  Specify 2-Letter Code *
                </label>
                <div className="relative">
                  <input
                    id="customCountryCode"
                    type="text"
                    value={customCountryCode}
                    onChange={handleCustomCountryCodeChange}
                    placeholder="e.g. NO"
                    maxLength={2}
                    className={`w-full bg-white border ${errors.customCountryCode ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase`}
                  />
                  <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                </div>
                <p className="text-[10px] text-gray-405 leading-relaxed">Used for transactional security checks (e.g. KE, US, NO, GB)</p>
                {errors.customCountryCode && <p className="text-xs text-red-600 font-medium mt-1">{errors.customCountryCode}</p>}
              </div>
            </div>
          )}

          {/* City */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="city">
              City *
            </label>
            <div className="relative">
              <input
                id="city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleTextChange}
                placeholder="e.g. Nairobi"
                className={`w-full bg-gray-50/50 border ${errors.city ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.city && <p className="text-xs text-red-600 font-medium mt-1">{errors.city}</p>}
          </div>

          {/* Zip / Postal Code */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="zipCode">
              Zip / Postal Code *
            </label>
            <div className="relative">
              <input
                id="zipCode"
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleTextChange}
                placeholder="e.g. 00100"
                className={`w-full bg-gray-50/50 border ${errors.zipCode ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
              />
              <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
            {errors.zipCode && <p className="text-xs text-red-600 font-medium mt-1">{errors.zipCode}</p>}
          </div>

          {/* Linkedin/Website */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="website">
              Linkedin / Website
            </label>
            <div className="relative">
              <input
                id="website"
                type="text"
                name="website"
                value={formData.website}
                onChange={handleTextChange}
                placeholder="e.g. linkedin.com/in/username"
                className="w-full bg-gray-50/50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
              />
              <Globe className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>
          </div>
        </div>

        {/* Full-width Address field */}
        <div className="mt-6 space-y-2">
          <label className="block text-sm font-semibold text-gray-700" htmlFor="address">
            Address *
          </label>
          <div className="relative">
            <input
              id="address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleTextChange}
              placeholder="e.g. Suite 4B, Merchant House, Kilimani"
              className={`w-full bg-gray-50/50 border ${errors.address ? 'border-red-500' : 'border-gray-200'} rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
            />
            <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 animate-pulse" />
          </div>
          {errors.address && <p className="text-xs text-red-600 font-medium mt-1">{errors.address}</p>}
        </div>
      </div>

      {/* 3. Areas of Interest & Attendance Type */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs space-y-8">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
            <Sparkles className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Interests & Attendance</h2>
            <p className="text-sm text-gray-500 font-sans mt-0.5">Please indicate your target focus streams and format preference.</p>
          </div>
        </div>

        {/* Areas of interest */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-800">
            Areas of Interest (Select all that check out)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {AREAS_OF_INTEREST.map(interest => {
              const checked = formData.areasOfInterest.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => handleCheckboxChange('areasOfInterest', interest)}
                  className={`flex items-start text-left gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                    checked 
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm' 
                      : 'border-gray-200 hover:border-gray-350 bg-gray-50/40 text-neutral-800'
                  }`}
                >
                  <div className={`mt-0.5 rounded-md flex items-center justify-center w-4 h-4 border-2 flex-shrink-0 transition-colors ${
                    checked ? 'bg-white border-white text-neutral-900' : 'border-gray-300'
                  }`}>
                    {checked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>
                  <span className="text-sm font-medium tracking-tight leading-snug">{interest}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendance (Radio Button) */}
        <div id="attendance-section" className="space-y-4 pt-4 border-t border-gray-100/70">
          <label className="block text-sm font-semibold text-gray-850">
            Attendance Mode *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['Physical Attendance', 'Virtual Participation'] as AttendanceType[]).map(mode => {
              const selected = formData.attendance === mode;
              return (
                <label
                  key={mode}
                  onClick={() => handleRadioChange('attendance', mode)}
                  className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all ${
                    selected 
                      ? 'border-neutral-900 bg-neutral-50 ring-2 ring-neutral-900/5' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selected ? 'border-neutral-900 bg-neutral-900' : 'border-gray-300'
                  }`}>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${selected ? 'text-neutral-900' : 'text-neutral-700'}`}>
                      {mode}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {mode === 'Physical Attendance' 
                        ? 'Join us live on-site at the premium convention venue.' 
                        : 'Access interactive live broadcasts, networking portals, & streams.'}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          {errors.attendance && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.attendance}
            </p>
          )}
        </div>
      </div>

      {/* 4. Speaker Information (Expandable / Prompt-based) */}
      <div className={`transition-all duration-300 rounded-2xl border ${
        isSpeaker 
          ? 'bg-amber-50/20 border-amber-200 p-6 md:p-8 outline-amber-400/25 ring-4 ring-amber-100' 
          : 'bg-white border-gray-100 p-6 md:p-8'
      }`}>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-5">
          <div className={`p-2.5 rounded-xl ${isSpeaker ? 'bg-amber-100 text-amber-900' : 'bg-neutral-100 text-neutral-800'}`}>
            <Sparkles className="w-5 h-5 text-current animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Speaker Session Proposals</h2>
              {!isSpeaker && (
                <span className="text-[10px] bg-gray-150 text-gray-600 font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Optional Choice
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-sans mt-0.5">Define your planned talking track, prefer formats, and support elements.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Proposed Topic */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="proposedTopic">
              Proposed Topic / Session Title {isSpeaker && '*'}
            </label>
            <input
              id="proposedTopic"
              type="text"
              name="proposedTopic"
              value={formData.proposedTopic}
              onChange={handleTextChange}
              placeholder="e.g. Scaling AfCFTA Hubs using Decentralized Technologies"
              className={`w-full bg-gray-50/50 border ${
                errors.proposedTopic ? 'border-red-500' : 'border-gray-200'
              } rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all`}
            />
            {errors.proposedTopic && <p className="text-xs text-red-600 font-medium mt-1">{errors.proposedTopic}</p>}
          </div>

          {/* Session Summary */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700" htmlFor="sessionSummary">
              Brief Session Summary {isSpeaker && '*'}
            </label>
            <textarea
              id="sessionSummary"
              name="sessionSummary"
              value={formData.sessionSummary}
              onChange={handleTextChange}
              rows={4}
              placeholder="Provide a concise abstract of the core keynotes, findings, or pane topics you will lead (max 300 words)."
              className={`w-full bg-gray-50/50 border ${
                errors.sessionSummary ? 'border-red-500' : 'border-gray-200'
              } rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all resize-y`}
            />
            {errors.sessionSummary && <p className="text-xs text-red-600 font-medium mt-1">{errors.sessionSummary}</p>}
          </div>

          {/* Preferred Format */}
          <div className="space-y-3 pt-2">
            <label className="block text-sm font-semibold text-gray-700">
              Preferred Session Format {isSpeaker && '*'}
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(['Keynote', 'Panel', 'Fireside Chat', 'Workshop'] as PreferredFormat[]).map(format => {
                const selected = formData.preferredFormat === format;
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => handleRadioChange('preferredFormat', format)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selected 
                        ? 'border-neutral-900 bg-neutral-950 text-white shadow-xs' 
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      selected ? 'border-white bg-white' : 'border-gray-300'
                    }`}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-neutral-950" />}
                    </div>
                    <span className="text-xs font-semibold">{format}</span>
                  </button>
                );
              })}
            </div>
            {errors.preferredFormat && <p className="text-xs text-red-600 font-medium mt-1">{errors.preferredFormat}</p>}
          </div>

          {/* Speaker Participation Opportunities */}
          <div className="space-y-3 pt-3">
            <label className="block text-sm font-semibold text-gray-700">
              Participation Opportunities (Check all that interests you)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PARTICIPATION_OPPORTUNITIES.map(opt => {
                const checked = formData.participationOpportunities.includes(opt.label);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCheckboxChange('participationOpportunities', opt.label)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      checked 
                        ? 'border-neutral-900 bg-white text-neutral-900 font-semibold shadow-xs ring-1 ring-neutral-900' 
                        : 'border-gray-250 hover:border-gray-300 bg-gray-50/30 text-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? 'bg-neutral-900 border-neutral-900 text-white' : 'border-gray-300'
                    }`}>
                      {checked && <Check className="w-3 h-3 stroke-[3px]" />}
                    </div>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Document & Artwork Attachments */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-5">
          <div className="p-2.5 bg-neutral-100 rounded-xl text-neutral-800">
            <Upload className="w-5 h-5" id="icon-upload" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-neutral-900 tracking-tight">System Attachments</h2>
            <p className="text-sm text-gray-500 font-sans mt-0.5">Upload document structures to support your profile status or sponsorship credentials.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Upload 1: Bio */}
          {renderUploadBox({
            id: 'bio',
            label: 'Professional Bio / Profile (PDF, DOCX)',
            acceptable: '.pdf,.doc,.docx',
            file: formData.attachments.bio,
            inputRef: bioInputRef,
            onChange: (e) => handleFileChange(e, 'bio'),
            onRemove: () => removeFile('bio'),
            dragActive: dragActive.bio,
            onDrag: (e, active) => handleDrag(e, 'bio', active),
            onDrop: (e) => handleDrop(e, 'bio')
          })}

          {/* File Upload 2: Company Profile */}
          {renderUploadBox({
            id: 'companyProfile',
            label: 'Company Profile / Portfolio (PDF)',
            acceptable: '.pdf',
            file: formData.attachments.companyProfile,
            inputRef: companyInputRef,
            onChange: (e) => handleFileChange(e, 'companyProfile'),
            onRemove: () => removeFile('companyProfile'),
            dragActive: dragActive.companyProfile,
            onDrag: (e, active) => handleDrag(e, 'companyProfile', active),
            onDrop: (e) => handleDrop(e, 'companyProfile')
          })}

          {/* File Upload 3: Headshot */}
          {renderUploadBox({
            id: 'headshot',
            label: 'High-Res Headshot Photograph (JPG, PNG)',
            acceptable: '.jpg,.jpeg,.png',
            file: formData.attachments.headshot,
            inputRef: headshotInputRef,
            onChange: (e) => handleFileChange(e, 'headshot'),
            onRemove: () => removeFile('headshot'),
            dragActive: dragActive.headshot,
            onDrag: (e, active) => handleDrag(e, 'headshot', active),
            onDrop: (e) => handleDrop(e, 'headshot')
          })}

          {/* File Upload 4: Presentation Deck */}
          {renderUploadBox({
            id: 'presentationDeck',
            label: 'Presentation Slide Deck (PPTX, PDF)',
            acceptable: '.pdf,.ppt,.pptx',
            file: formData.attachments.presentationDeck,
            inputRef: deckInputRef,
            onChange: (e) => handleFileChange(e, 'presentationDeck'),
            onRemove: () => removeFile('presentationDeck'),
            dragActive: dragActive.presentationDeck,
            onDrag: (e, active) => handleDrag(e, 'presentationDeck', active),
            onDrop: (e) => handleDrop(e, 'presentationDeck')
          })}
        </div>
      </div>

      {/* Checkout Transition Area */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-neutral-900 rounded-2xl text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <Check className="w-5 h-5 rounded-full" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Registration Profile Captured</p>
            <p className="text-xs text-neutral-400">Your professional details are saved immediately on submit. Ticket payment remains optional.</p>
          </div>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto bg-white text-neutral-900 hover:bg-neutral-100 font-bold px-8 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 font-sans"
        >
          Save Details & View Tickets
          <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </button>
      </div>
    </form>
  );

  // Helper method to draw file upload panels
  function renderUploadBox({
    id,
    label,
    acceptable,
    file,
    inputRef,
    onChange,
    onRemove,
    dragActive,
    onDrag,
    onDrop
  }: {
    id: keyof RegistrationData['attachments'];
    label: string;
    acceptable: string;
    file: FileMock | null;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
    dragActive: boolean;
    onDrag: (e: React.DragEvent, active: boolean) => void;
    onDrop: (e: React.DragEvent) => void;
  }) {
    return (
      <div className="space-y-2">
        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        
        <input
          id={`input-file-${id}`}
          type="file"
          ref={inputRef}
          onChange={onChange}
          accept={acceptable}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-900 bg-neutral-50/50">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-neutral-900 text-white rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-semibold text-neutral-900 truncate max-w-[180px] sm:max-w-[240px]">
                  {file.name}
                </p>
                <p className="text-[10px] text-gray-400 font-mono">{file.size}</p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDragEnter={(e) => onDrag(e, true)}
            onDragOver={(e) => onDrag(e, true)}
            onDragLeave={(e) => onDrag(e, false)}
            onDrop={onDrop}
            onClick={() => triggerFileInput(id)}
            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${
              dragActive 
                ? 'border-neutral-900 bg-neutral-50/60' 
                : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50/30'
            }`}
          >
            <Upload className={`w-6 h-6 mb-2 ${dragActive ? 'text-neutral-900' : 'text-gray-400 animate-pulse'}`} />
            <p className="text-xs font-sans text-neutral-800">
              <span className="font-semibold text-neutral-900">Drag & drop</span> or click to upload
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Accepts {acceptable.replace(/\./g, '').toUpperCase()}</p>
          </div>
        )}
      </div>
    );
  }
}
