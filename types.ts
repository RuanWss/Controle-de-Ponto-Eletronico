export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  photoBase64: string; // Stored reference photo
  registeredAt: number;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  timestamp: number; // UTC timestamp
  type: 'ENTRADA' | 'SAIDA';
  verificationStatus: 'SUCCESS' | 'FAILED' | 'MANUAL';
  similarity?: number; // Armazena a porcentagem de similaridade de pixels
}

export enum Tab {
  HOME = 'HOME',
  CLOCK_IN = 'CLOCK_IN',
  HR_CONTROL = 'HR_CONTROL'
}

export interface VerificationResult {
  verified: boolean;
  message: string;
  similarity?: number;
}