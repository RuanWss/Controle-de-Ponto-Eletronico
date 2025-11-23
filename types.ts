export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  photoBase64: string; // Stored reference photo
  faceDescriptor?: number[]; // Array de 128 floats representando a biometria facial
  registeredAt: number;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  timestamp: number; // UTC timestamp
  type: 'ENTRADA' | 'SAIDA';
  verificationStatus: 'SUCCESS' | 'FAILED' | 'MANUAL';
  similarity?: number; // Armazena a distância/similaridade calculada
}

export enum Tab {
  HOME = 'HOME',
  CLOCK_IN = 'CLOCK_IN',
  HR_CONTROL = 'HR_CONTROL'
}

export interface VerificationResult {
  verified: boolean;
  message: string;
  distance?: number;
}