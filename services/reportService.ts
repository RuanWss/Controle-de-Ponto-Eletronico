import { Employee, TimeRecord } from '../types';

export const generateCSV = (employees: Employee[], records: TimeRecord[]): string => {
  // Headers
  let csv = "Nome do Funcionário,Cargo,Data,Entrada 1,Saída 1,Entrada 2,Saída 2\n";

  // Group records by Date (YYYY-MM-DD) and Employee
  const groupedData: Record<string, Record<string, TimeRecord[]>> = {};

  records.forEach(record => {
    const date = new Date(record.timestamp).toLocaleDateString('pt-BR');
    if (!groupedData[date]) groupedData[date] = {};
    if (!groupedData[date][record.employeeId]) groupedData[date][record.employeeId] = [];
    groupedData[date][record.employeeId].push(record);
  });

  // Sort records by time for each group
  Object.keys(groupedData).forEach(date => {
    Object.keys(groupedData[date]).forEach(empId => {
      groupedData[date][empId].sort((a, b) => a.timestamp - b.timestamp);
    });
  });

  // Iterate to build rows
  // We iterate through all employees to ensure even those without records show up (optional)
  // or just iterate through dates. Let's iterate through dates found in records for simplicity of the "sheet".
  
  const dates = Object.keys(groupedData).sort((a,b) => {
     // simple date sort expecting DD/MM/YYYY
     const [da, ma, ya] = a.split('/').map(Number);
     const [db, mb, yb] = b.split('/').map(Number);
     return new Date(ya, ma-1, da).getTime() - new Date(yb, mb-1, db).getTime();
  });

  dates.forEach(date => {
    const empIdsOnDate = Object.keys(groupedData[date]);
    
    empIdsOnDate.forEach(empId => {
      const employee = employees.find(e => e.id === empId);
      if (!employee) return;

      const dailyRecords = groupedData[date][empId];
      
      // Basic logic to slot times. This assumes a sequence of In -> Out -> In -> Out
      // A more complex system would pair them by ID or strict sequence logic.
      const entry1 = dailyRecords[0]?.type === 'ENTRADA' ? formatTime(dailyRecords[0].timestamp) : '';
      let exit1 = '';
      let entry2 = '';
      let exit2 = '';
      
      let nextIdx = 1;
      if (entry1 && dailyRecords[1]?.type === 'SAIDA') {
          exit1 = formatTime(dailyRecords[1].timestamp);
          nextIdx = 2;
      }
      
      if (dailyRecords[nextIdx]?.type === 'ENTRADA') {
          entry2 = formatTime(dailyRecords[nextIdx].timestamp);
          if (dailyRecords[nextIdx+1]?.type === 'SAIDA') {
              exit2 = formatTime(dailyRecords[nextIdx+1].timestamp);
          }
      } else if (!exit1 && dailyRecords[nextIdx]?.type === 'SAIDA') {
         // Fallback if sequence is messed up
         exit1 = formatTime(dailyRecords[nextIdx].timestamp);
      }

      csv += `"${employee.firstName} ${employee.lastName}","${employee.role}","${date}","${entry1}","${exit1}","${entry2}","${exit2}"\n`;
    });
  });

  return csv;
};

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};