/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ParticipationType = 'Delegate' | 'Speaker' | 'Sponsor' | 'Exhibitor';

export type PreferredFormat = 'Keynote' | 'Panel' | 'Fireside Chat' | 'Workshop';

export type AttendanceType = 'Physical Attendance' | 'Virtual Participation';

export interface RegistrationData {
  participationType: ParticipationType;
  selectedTicketId?: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  organization: string;
  country: string; // 2-letter code input in checkout, selected in dropdown in register
  email: string;
  phone: string;
  city: string;
  zipCode: string;
  address: string;
  website: string; // Linkedin/Website
  areasOfInterest: string[]; // checkboxes
  // Speaker information (conditional)
  proposedTopic: string;
  sessionSummary: string;
  preferredFormat: PreferredFormat | '';
  participationOpportunities: string[]; // checkboxes
  attendance: AttendanceType | '';
  // Files mock storage (keys point to simulated upload file metadata)
  attachments: {
    bio: FileMock | null;
    companyProfile: FileMock | null;
    headshot: FileMock | null;
    presentationDeck: FileMock | null;
  };
}

export interface FileMock {
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
}

export interface Ticket {
  id: string;
  name: string;
  price: number;
  currency: 'KES' | 'USD';
  description: string;
  badgeType: ParticipationType[];
}
