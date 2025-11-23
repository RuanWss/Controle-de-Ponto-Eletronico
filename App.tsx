import React, { useState, useEffect } from 'react';
import { User, Clock, Settings, FileSpreadsheet, PlusCircle, ArrowLeft, Camera, CheckCircle, AlertTriangle, Cpu } from 'lucide-react';
import { DigitalClock } from './components/DigitalClock';
import { WebcamCapture } from './components/WebcamCapture';
import { getEmployees, saveEmployee, getTimeRecords, saveTimeRecord, resizeImage } from './services/storageService';
// Substituindo geminiService por faceService
import { loadModels, getFaceDescriptor, compareFaces } from './services/faceService';
import { generateCSV, downloadCSV } from './services/reportService';
import { Employee, Tab, TimeRecord } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'REGISTER' | 'CLOCK_IN'>('REGISTER');
  
  // Model Loading State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Iniciando sistema...');

  // Registration State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpSurname, setNewEmpSurname] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [newEmpPhoto, setNewEmpPhoto] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Clock In State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [clockInStatus, setClockInStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [successData, setSuccessData] = useState<{ name: string; time: string; msg?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Load data and models on mount
  useEffect(() => {
    setEmployees(getEmployees());
    
    const initAI = async () => {
      try {
        setLoadingMessage('Carregando redes neurais...');
        await loadModels();
        setModelsLoaded(true);
      } catch (e) {
        setLoadingMessage('Erro ao carregar IA. Verifique sua conexão.');
      }
    };
    initAI();
  }, []);

  const handleRegisterEmployee = async () => {
    if (!newEmpName || !newEmpSurname || !newEmpRole || !newEmpPhoto) {
      alert("Por favor, preencha todos os campos e tire a foto.");
      return;
    }

    if (!modelsLoaded) {
      alert("Aguarde o carregamento do sistema de reconhecimento.");
      return;
    }

    setIsRegistering(true);

    try {
      const id = Date.now().toString();
      // Resize photo to save storage space
      const optimizedPhoto = await resizeImage(newEmpPhoto);
      
      // Compute biometric descriptor
      const descriptor = await getFaceDescriptor(optimizedPhoto);

      if (!descriptor) {
        alert("Não foi possível detectar um rosto nítido na foto. Tente novamente.");
        setIsRegistering(false);
        return;
      }
      
      const newEmployee: Employee = {
        id,
        firstName: newEmpName,
        lastName: newEmpSurname,
        role: newEmpRole,
        photoBase64: optimizedPhoto,
        // Convert Float32Array to standard array for JSON storage
        faceDescriptor: Array.from(descriptor),
        registeredAt: Date.now(),
      };

      saveEmployee(newEmployee);
      setEmployees(getEmployees());
      
      // Reset Form
      setNewEmpName('');
      setNewEmpSurname('');
      setNewEmpRole('');
      setNewEmpPhoto(null);
      alert("Funcionário cadastrado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao processar biometria.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleClockInCapture = async (livePhoto: string) => {
    setIsCameraOpen(false);
    setClockInStatus('PROCESSING');
    
    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) {
      setClockInStatus('ERROR');
      setErrorMessage("Funcionário não encontrado.");
      return;
    }

    if (!employee.faceDescriptor) {
      setClockInStatus('ERROR');
      setErrorMessage("Este funcionário não possui biometria cadastrada. Recadastre a foto no RH.");
      return;
    }

    try {
      // 1. Verify Face Locally (Euclidean Distance)
      const result = await compareFaces(employee.faceDescriptor, livePhoto);
      
      if (!result.verified) {
        setClockInStatus('ERROR');
        setErrorMessage(result.message);
        return;
      }

      // 2. Determine Entry or Exit
      const allRecords = getTimeRecords();
      const empRecords = allRecords
        .filter(r => r.employeeId === employee.id)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      const lastRecord = empRecords[empRecords.length - 1];
      const type = lastRecord && lastRecord.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
      
      const now = Date.now();
      const newRecord: TimeRecord = {
        id: crypto.randomUUID(),
        employeeId: employee.id,
        timestamp: now,
        type: type,
        verificationStatus: 'SUCCESS',
        similarity: result.distance
      };

      saveTimeRecord(newRecord);
      
      const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
      }).format(now);

      setSuccessData({
        name: `${employee.firstName} ${employee.lastName}`,
        time: `${type}: ${timeFormatted}`,
        msg: result.message
      });
      setClockInStatus('SUCCESS');

      setTimeout(() => {
        setClockInStatus('IDLE');
        setSuccessData(null);
        setSelectedEmployeeId('');
        setActiveTab(Tab.HOME);
      }, 3000);

    } catch (err) {
      console.error(err);
      setClockInStatus('ERROR');
      setErrorMessage("Erro interno ao processar ponto.");
    }
  };

  const exportReport = () => {
    const records = getTimeRecords();
    if (records.length === 0) {
      alert("Não há registros de ponto para exportar.");
      return;
    }
    const csvContent = generateCSV(employees, records);
    const filename = `relatorio_ponto_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  // --- Initial Loading Screen ---
  if (!modelsLoaded) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-red-500">
        <div className="relative mb-8">
            <div className="w-24 h-24 border-4 border-red-900 rounded-full"></div>
            <div className="w-24 h-24 border-4 border-red-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            <Cpu className="w-10 h-10 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500 animate-pulse" />
        </div>
        <p className="text-lg font-mono animate-pulse">{loadingMessage}</p>
        <p className="text-xs text-red-900 mt-2">Carregando modelos SSD Mobilenet V1...</p>
      </div>
    );
  }

  // --- Renders ---

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4 md:gap-12 animate-fade-in relative z-10 w-full overflow-y-auto py-6">
      
      <img 
        src="https://i.ibb.co/kgxf99k5/LOGOS-10-ANOS-BRANCA-E-VERMELHA.png" 
        alt="Logo" 
        className="h-16 md:h-40 object-contain drop-shadow-[0_0_25px_rgba(220,38,38,0.5)] hover:scale-105 transition-transform duration-500"
      />

      <DigitalClock />
      
      <div className="flex flex-col md:flex-row gap-3 md:gap-6 w-full max-w-4xl px-4 md:px-6">
        <button
          onClick={() => setActiveTab(Tab.CLOCK_IN)}
          className="flex-1 bg-gradient-to-br from-red-800/80 to-red-900/90 hover:from-red-700 hover:to-red-800 backdrop-blur-md border border-red-500/40 text-white rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col items-center gap-2 md:gap-4 transition-all hover:scale-105 shadow-[0_0_25px_rgba(220,38,38,0.3)] group"
        >
          <div className="bg-red-500/20 p-3 md:p-5 rounded-full group-hover:bg-red-500/40 transition shadow-[0_0_15px_rgba(239,68,68,0.4)] border border-red-500/30">
            <Clock className="w-8 h-8 md:w-16 md:h-16 text-red-50" />
          </div>
          <span className="text-lg md:text-2xl font-bold text-white tracking-wide drop-shadow-md">Bater Ponto</span>
          <span className="text-red-200 text-center text-xs md:text-sm">Registrar entrada ou saída</span>
        </button>

        <button
          onClick={() => setActiveTab(Tab.HR_CONTROL)}
          className="flex-1 bg-gradient-to-br from-black/60 to-red-950/40 hover:from-black/70 hover:to-red-900/50 backdrop-blur-md border border-red-500/20 text-white rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col items-center gap-2 md:gap-4 transition-all hover:scale-105 shadow-2xl group"
        >
           <div className="bg-white/5 p-3 md:p-5 rounded-full group-hover:bg-white/10 transition border border-white/5">
            <Settings className="w-8 h-8 md:w-16 md:h-16 text-white group-hover:text-red-100" />
          </div>
          <span className="text-lg md:text-2xl font-bold text-white tracking-wide">Controle de RH</span>
          <span className="text-slate-400 text-center text-xs md:text-sm group-hover:text-red-200 transition-colors">Administração e Relatórios</span>
        </button>
      </div>
    </div>
  );

  const renderClockIn = () => (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-6 animate-fade-in relative z-10 w-full">
      <div className="w-full max-w-md relative">
        <button 
            onClick={() => setActiveTab(Tab.HOME)}
            className="absolute -top-12 md:-top-14 left-0 flex items-center gap-2 text-red-200/70 hover:text-white transition bg-red-950/30 px-3 py-1.5 md:px-4 md:py-2 text-sm rounded-full backdrop-blur-sm border border-red-500/20 hover:border-red-500/50"
        >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Voltar
        </button>

        <div className="bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-red-500/30 w-full relative overflow-hidden mt-4 md:mt-0">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>
            
            <h2 className="text-xl md:text-3xl font-bold text-center mb-4 md:mb-8 text-white drop-shadow-lg flex justify-center items-center gap-2">
                <Clock className="w-6 h-6 md:w-8 md:h-8 text-red-500" /> 
                Registro de Ponto
            </h2>
            
            {employees.length === 0 ? (
            <div className="text-center text-slate-300">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p>Nenhum funcionário cadastrado.</p>
                <button onClick={() => setActiveTab(Tab.HR_CONTROL)} className="mt-4 text-red-400 underline hover:text-red-300">Ir para RH</button>
            </div>
            ) : (
            <div className="space-y-4 md:space-y-6">
                <div>
                <label className="block text-sm font-medium text-red-200 mb-2">Quem é você?</label>
                <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-red-950/20 border border-red-500/30 text-white rounded-xl p-2.5 md:p-4 focus:ring-2 focus:ring-red-500 outline-none transition-all hover:border-red-500/60"
                >
                    <option value="" className="text-black">-- Selecione seu nome --</option>
                    {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="text-black">{emp.firstName} {emp.lastName}</option>
                    ))}
                </select>
                </div>

                <button
                disabled={!selectedEmployeeId}
                onClick={() => {
                    setCameraMode('CLOCK_IN');
                    setIsCameraOpen(true);
                }}
                className={`w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg flex items-center justify-center gap-2 transition-all border ${
                    selectedEmployeeId 
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] border-red-500' 
                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                }`}
                >
                <Camera className="w-5 h-5 md:w-6 md:h-6" />
                Iniciar Validação
                </button>
            </div>
            )}
        </div>
      </div>

      {/* SUCCESS POPUP */}
      {clockInStatus === 'SUCCESS' && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-gradient-to-b from-white to-red-50 text-slate-900 p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.2)] flex flex-col items-center gap-4 max-w-sm w-full transform transition-all scale-100 border-4 border-green-500 relative overflow-hidden">
            <div className="bg-green-100 p-4 rounded-full shadow-inner">
               <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-green-600" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-green-800 text-center">Acesso Permitido</h3>
            <div className="text-center w-full">
              <p className="text-lg md:text-xl font-bold text-slate-800 truncate">{successData.name}</p>
              <p className="text-base md:text-lg text-slate-600 mt-1 font-mono bg-slate-100 px-3 py-1 rounded inline-block">{successData.time}</p>
              {successData.msg && <p className="text-xs text-green-600 mt-2">{successData.msg}</p>}
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-green-500 animate-[width_3s_linear_forwards] w-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR POPUP */}
      {clockInStatus === 'ERROR' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
           <div className="bg-red-950 text-white p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] border-2 border-red-500 flex flex-col items-center gap-4 max-w-sm w-full">
             <div className="bg-red-900/50 p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 md:w-16 md:h-16 text-red-500" />
             </div>
             <h3 className="text-xl md:text-2xl font-bold text-red-400 text-center">Acesso Negado</h3>
             <p className="text-center text-red-100 text-sm md:text-base">{errorMessage}</p>
             <button 
                onClick={() => setClockInStatus('IDLE')}
                className="mt-4 px-8 py-3 bg-red-800 hover:bg-red-700 rounded-xl text-white font-bold w-full"
             >
               Tentar Novamente
             </button>
           </div>
        </div>
      )}
      
       {/* LOADING POPUP */}
       {clockInStatus === 'PROCESSING' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
           <div className="flex flex-col items-center gap-6 bg-black/80 p-8 md:p-10 rounded-3xl border border-red-500/30 shadow-[0_0_30px_rgba(220,38,38,0.1)]">
             <div className="relative">
                 <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-red-900 rounded-full"></div>
                 <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-red-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
             </div>
             <p className="text-red-100 font-medium tracking-wide animate-pulse text-sm md:text-base">Comparando Biometria...</p>
           </div>
        </div>
      )}
    </div>
  );

  const renderHR = () => (
    <div className="flex flex-col h-full p-4 md:p-6 overflow-y-auto custom-scrollbar relative z-10">
       <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 pb-6">
        <button 
            onClick={() => setActiveTab(Tab.HOME)}
            className="self-start flex items-center gap-2 text-red-200/70 hover:text-white transition bg-red-950/30 px-3 py-1.5 md:px-4 md:py-2 text-sm rounded-full backdrop-blur-sm border border-red-500/20 hover:border-red-500/50"
        >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Menu Principal
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            {/* Registration Form */}
            <div className="bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-xl border border-red-500/20 h-fit">
            <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-white border-b border-red-500/20 pb-4">
                <PlusCircle className="text-red-500" /> 
                Cadastrar Funcionário
            </h2>
            
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                        <label className="text-xs md:text-sm text-red-200/80 font-medium">Nome</label>
                        <input 
                            type="text" 
                            value={newEmpName}
                            onChange={(e) => setNewEmpName(e.target.value)}
                            className="w-full bg-red-950/20 border border-red-500/30 rounded-xl p-2.5 md:p-3 mt-1 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder-red-900/50 text-sm"
                            placeholder="Ex: João"
                        />
                    </div>
                    <div>
                        <label className="text-xs md:text-sm text-red-200/80 font-medium">Sobrenome</label>
                        <input 
                            type="text" 
                            value={newEmpSurname}
                            onChange={(e) => setNewEmpSurname(e.target.value)}
                            className="w-full bg-red-950/20 border border-red-500/30 rounded-xl p-2.5 md:p-3 mt-1 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder-red-900/50 text-sm"
                            placeholder="Ex: Silva"
                        />
                    </div>
                </div>
                
                <div>
                    <label className="text-xs md:text-sm text-red-200/80 font-medium">Cargo</label>
                    <input 
                        type="text" 
                        value={newEmpRole}
                        onChange={(e) => setNewEmpRole(e.target.value)}
                        className="w-full bg-red-950/20 border border-red-500/30 rounded-xl p-2.5 md:p-3 mt-1 text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder-red-900/50 text-sm"
                        placeholder="Ex: Desenvolvedor"
                    />
                </div>

                <div className="pt-2">
                    <label className="text-xs md:text-sm text-red-200/80 font-medium mb-2 block">Foto de Referência (Rosto)</label>
                    {newEmpPhoto ? (
                        <div className="relative w-full h-40 md:h-48 bg-black/50 rounded-xl overflow-hidden group border border-red-500/30">
                            <img src={newEmpPhoto} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                                <button 
                                    onClick={() => setNewEmpPhoto(null)} 
                                    className="text-white bg-red-600 px-6 py-2 rounded-full text-sm hover:bg-red-500 transition shadow-lg"
                                >
                                    Remover
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => {
                                setCameraMode('REGISTER');
                                setIsCameraOpen(true);
                            }}
                            className="w-full h-40 md:h-48 bg-red-950/10 border-2 border-dashed border-red-500/30 rounded-xl flex flex-col items-center justify-center text-red-400/60 hover:border-red-500 hover:text-red-400 transition hover:bg-red-950/30 group"
                        >
                            <Camera className="w-8 h-8 md:w-10 md:h-10 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="text-sm">Tirar Foto</span>
                        </button>
                    )}
                </div>

                <button 
                    onClick={handleRegisterEmployee}
                    disabled={isRegistering}
                    className={`w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold py-3 md:py-4 rounded-xl mt-2 md:mt-4 shadow-lg shadow-red-900/20 active:scale-95 transition-all border border-red-500/20 ${isRegistering ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isRegistering ? 'Processando Biometria...' : 'Salvar Cadastro'}
                </button>
            </div>
            </div>

            {/* List & Export */}
            <div className="space-y-6 md:space-y-8 flex flex-col">
                <div className="bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-xl border border-red-500/20">
                    <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-white border-b border-red-500/20 pb-4">
                        <FileSpreadsheet className="text-red-400" /> 
                        Relatórios
                    </h2>
                    <p className="text-red-200/70 mb-6 text-sm">
                        Gere uma planilha compatível com Google Sheets contendo todos os registros.
                    </p>
                    <button 
                        onClick={exportReport}
                        className="w-full bg-emerald-700/80 hover:bg-emerald-600/90 border border-emerald-500/30 text-white font-bold py-3 md:py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                        Baixar Planilha (.csv)
                    </button>
                </div>

                <div className="bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-xl border border-red-500/20 flex-1 min-h-[300px] flex flex-col">
                    <h2 className="text-lg md:text-2xl font-bold mb-4 flex items-center gap-2 text-white border-b border-red-500/20 pb-4">
                        <User className="text-red-500" /> 
                        Funcionários ({employees.length})
                    </h2>
                    <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1">
                        {employees.length === 0 && <p className="text-slate-500 italic text-center mt-10">Nenhum funcionário.</p>}
                        {employees.map(emp => (
                            <div key={emp.id} className="bg-red-950/20 p-3 rounded-xl flex items-center gap-4 border border-red-500/10 hover:bg-red-900/30 transition hover:border-red-500/30 group">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-900 border border-red-500/30 flex-shrink-0">
                                    <img src={emp.photoBase64} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-red-50 truncate">{emp.firstName} {emp.lastName}</p>
                                    <p className="text-xs text-red-300/70 uppercase tracking-wider truncate">{emp.role}</p>
                                    {emp.faceDescriptor && <p className="text-[10px] text-green-500 mt-1">Biometria Ativa</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-transparent text-slate-100">
      {activeTab === Tab.HOME && renderHome()}
      {activeTab === Tab.CLOCK_IN && renderClockIn()}
      {activeTab === Tab.HR_CONTROL && renderHR()}

      {isCameraOpen && (
        <WebcamCapture 
          onCapture={(img) => {
            if (cameraMode === 'REGISTER') {
                setNewEmpPhoto(img);
                setIsCameraOpen(false);
            } else {
                handleClockInCapture(img);
            }
          }}
          onCancel={() => setIsCameraOpen(false)}
          instruction={cameraMode === 'REGISTER' ? "Mantenha o rosto neutro para cadastro" : "Olhe para a câmera para confirmar identidade"}
        />
      )}
      
      <style>{`
        @keyframes width {
            from { width: 0%; }
            to { width: 100%; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2); 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(220, 38, 38, 0.3); 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.5); 
        }
      `}</style>
    </div>
  );
}

export default App;