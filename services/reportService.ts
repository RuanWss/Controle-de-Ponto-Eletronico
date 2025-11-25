import { Employee, TimeRecord } from '../types';

declare const jspdf: any;

export const generateAndDownloadPDF = async (
  employees: Employee[], 
  records: TimeRecord[], 
  periodTitle: string,
  logoUrl: string
) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF();

  // --- Adicionar Logo ---
  try {
    const logoBase64 = await getBase64FromUrl(logoUrl);
    // Adiciona imagem (x: 14, y: 10, largura: 30, altura: proporção)
    doc.addImage(logoBase64, 'PNG', 14, 10, 40, 15);
  } catch (err) {
    console.error("Erro ao carregar logo para o PDF:", err);
  }

  // --- Cabeçalho ---
  doc.setFontSize(16);
  doc.setTextColor(0); // Preto
  // Ajusta posição do título baseado na logo
  doc.text("Relatório de Ponto Eletrônico", 14, 35);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Período: ${periodTitle}`, 14, 42);
  
  const dateStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Gerado em: ${dateStr}`, 14, 48);

  // --- Processamento dos Dados ---
  const tableData: any[] = [];
  
  // Agrupar registros por Data e Funcionário
  const groupedData: Record<string, Record<string, TimeRecord[]>> = {};

  records.forEach(record => {
    const date = new Date(record.timestamp).toLocaleDateString('pt-BR');
    if (!groupedData[date]) groupedData[date] = {};
    if (!groupedData[date][record.employeeId]) groupedData[date][record.employeeId] = [];
    groupedData[date][record.employeeId].push(record);
  });

  // Ordenar registros internamente por horário
  Object.keys(groupedData).forEach(date => {
    Object.keys(groupedData[date]).forEach(empId => {
      groupedData[date][empId].sort((a, b) => a.timestamp - b.timestamp);
    });
  });

  // Ordenar datas cronologicamente
  const dates = Object.keys(groupedData).sort((a,b) => {
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
      
      // Obter dia da semana usando o timestamp do primeiro registro do dia
      const firstRecTimestamp = dailyRecords[0]?.timestamp;
      let dateDisplay = date;
      if (firstRecTimestamp) {
        const weekDay = new Date(firstRecTimestamp).toLocaleDateString('pt-BR', { weekday: 'long' });
        // Capitalizar primeira letra
        const weekDayCapitalized = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
        dateDisplay = `${date} - ${weekDayCapitalized}`;
      }
      
      const entry1 = dailyRecords[0]?.type === 'ENTRADA' ? formatTime(dailyRecords[0].timestamp) : '-';
      let exit1 = '-';
      let entry2 = '-';
      let exit2 = '-';
      
      let nextIdx = 1;
      if (entry1 !== '-' && dailyRecords[1]?.type === 'SAIDA') {
          exit1 = formatTime(dailyRecords[1].timestamp);
          nextIdx = 2;
      }
      
      if (dailyRecords[nextIdx]?.type === 'ENTRADA') {
          entry2 = formatTime(dailyRecords[nextIdx].timestamp);
          if (dailyRecords[nextIdx+1]?.type === 'SAIDA') {
              exit2 = formatTime(dailyRecords[nextIdx+1].timestamp);
          }
      } else if (exit1 === '-' && dailyRecords[nextIdx]?.type === 'SAIDA') {
         exit1 = formatTime(dailyRecords[nextIdx].timestamp);
      }

      tableData.push([
        dateDisplay,
        `${employee.firstName} ${employee.lastName}`,
        employee.role,
        entry1,
        exit1,
        entry2,
        exit2
      ]);
    });
  });

  // --- Gerar Tabela ---
  doc.autoTable({
    startY: 55,
    head: [['Data / Dia', 'Funcionário', 'Cargo', 'Ent. 1', 'Saída 1', 'Ent. 2', 'Saída 2']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28] }, // Vermelho do tema
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
        0: { cellWidth: 35 }, // Coluna Data mais larga para caber o dia da semana
    },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Download
  const periodSlug = periodTitle.replace('/', '-');
  doc.save(`relatorio_${periodSlug}_${new Date().getTime()}.pdf`);
};

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

// Helper para converter URL de imagem para Base64
const getBase64FromUrl = async (url: string): Promise<string> => {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data);
    };
  });
};