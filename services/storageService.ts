import { Employee, TimeRecord } from '../types';
import { STORAGE_KEY_EMPLOYEES, STORAGE_KEY_RECORDS } from '../constants';

export const getEmployees = (): Employee[] => {
  const data = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
  return data ? JSON.parse(data) : [];
};

export const saveEmployee = (employee: Employee): void => {
  const employees = getEmployees();
  employees.push(employee);
  localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
};

export const getTimeRecords = (): TimeRecord[] => {
  const data = localStorage.getItem(STORAGE_KEY_RECORDS);
  return data ? JSON.parse(data) : [];
};

export const saveTimeRecord = (record: TimeRecord): void => {
  const records = getTimeRecords();
  records.push(record);
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
};

export const getEmployeeById = (id: string): Employee | undefined => {
  const employees = getEmployees();
  return employees.find(e => e.id === id);
};

// Helper to resize image to prevent LocalStorage quota exceeded
export const resizeImage = (base64Str: string, maxWidth = 400, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      const width = maxWidth;
      const height = img.height * scale;
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};