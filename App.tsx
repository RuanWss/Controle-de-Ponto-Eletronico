import React, { useState, useEffect, useRef } from 'react';
import { User, Clock, Settings, FileText, PlusCircle, ArrowLeft, Camera, CheckCircle, AlertTriangle, ScanFace, Upload, Shield, Calendar } from 'lucide-react';
import { DigitalClock } from './components/DigitalClock';
import { WebcamCapture } from './components/WebcamCapture';
import { getEmployees, saveEmployee, getTimeRecords, saveTimeRecord, resizeImage } from './services/storageService';
import { loadModels, getFaceDescriptor, identifyFace } from './services/faceService';
import { generateAndDownloadPDF } from './services/reportService';
import { Employee, Tab, TimeRecord } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'REGISTER' | 'CLOCK_IN'>('REGISTER');
  const [modelsReady, setModelsReady] = useState(false);
  
  // Registration State
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpSurname, setNewEmpSurname] = useState('');
  const [newEmpRole, setNewEmpRole] = useState('');
  const [newEmpPhoto, setNewEmpPhoto] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Report State
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth());
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  // Clock In State (Auto Scanner)
  const [clockInStatus, setClockInStatus] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [successData, setSuccessData] = useState<{ name: string; time: string; msg?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerIntervalRef = useRef<number | null>(null);

  // Logo URL constant
  const LOGO_URL = "https://i.ibb.co/kgxf99k5/LOGOS-10-ANOS-BRANCA-E-VERMELHA.png";

  // Load data and models on mount
  useEffect(() => {
    setEmployees(getEmployees());
    
    // Inicia carregamento dos modelos
    loadModels()
      .then(() => setModelsReady(true))
      .catch(err => console.error("Erro ao carregar modelos:", err));
      
    return () => stopScanner();
  }, []);

  // Cleanup scanner on tab change
  useEffect(() => {
    if (activeTab !== Tab.CLOCK_IN) {
      stopScanner();
    } else if (activeTab === Tab.CLOCK_IN && modelsReady) {
      startScanner();
    }
  }, [activeTab, modelsReady]);

  const handleRegisterEmployee = async () => {
    if (!newEmpName || !newEmpSurname || !newEmpRole || !newEmpPhoto) {
      alert("Por favor, preencha todos os campos e tire a foto.");
      return;
    }

    if (!modelsReady) {
      alert("Aguarde o sistema de IA inicializar...");
      return;
    }

    setIsRegistering(true);

    try {
      // 1. Generate Biometric Descriptor
      const descriptorFloat32 = await getFaceDescriptor(newEmpPhoto);
      
      if (!descriptorFloat32) {
        alert("Não foi possível detectar um rosto nítido na foto. Tente novamente.");
        setIsRegistering(false);
        return;
      }

      // Convert Float32Array to regular array for JSON storage
      const descriptorArray = Array.from(descriptorFloat32);

      const id = Date.now().toString();
      const optimizedPhoto = await resizeImage(newEmpPhoto);
      
      const newEmployee: Employee = {
        id,
        firstName: newEmpName,
        lastName: newEmpSurname,
        role: newEmpRole,
        photoBase64: optimizedPhoto,
        faceDescriptor: descriptorArray, // Save biometrics
        registeredAt: Date.now(),
      };

      saveEmployee(newEmployee);
      setEmployees(getEmployees());
      
      // Reset Form
      setNewEmpName('');
      setNewEmpSurname('');
      setNewEmpRole('');
      setNewEmpPhoto(null);
      alert("Funcionário cadastrado com biometria facial!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar cadastro.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEmpPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AUTO SCANNER LOGIC ---

  const startScanner = async () => {
    setClockInStatus('SCANNING');
    setErrorMessage('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      
      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        // Wait for video to play before starting interval
        scannerVideoRef.current.onloadedmetadata = () => {
            scannerVideoRef.current?.play();
            // Start detection loop
            scannerIntervalRef.current = window.setInterval(performScan, 1000); // Check every 1s
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setClockInStatus('ERROR');
      setErrorMessage("Erro ao acessar câmera. Verifique permissões.");
    }
  };

  const stopScanner = () => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
    
    if (scannerVideoRef.current && scannerVideoRef.current.srcObject) {
      const stream = scannerVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      scannerVideoRef.current.srcObject = null;
    }
  };

  const performScan = async () => {
    if (!scannerVideoRef.current || scannerVideoRef.current.paused || scannerVideoRef.current.ended) return;

    // Se já estiver processando sucesso, pausa verificação
    if (clockInStatus === 'SUCCESS') return;

    try {
      const result = await identifyFace(scannerVideoRef.current, employees);

      if (result.verified && result.matchId) {
        // MATCH FOUND!
        stopScanner(); // Stop camera immediately
        processClockIn(result.matchId, result.similarity || 0);
      } else {
        // No match or unknown face, continue scanning...
        // Optional: Update UI to show "Searching..." or bounding box
      }
    } catch (err) {
      console.error("Scan error:", err);
    }
  };

  const processClockIn = (employeeId: string, similarity: number) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    const allRecords = getTimeRecords();
    const empRecords = allRecords
      .filter(r => r.employeeId === employee.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const lastRecord = empRecords[empRecords.length - 1];
    
    // Prevent double punch within 1 minute
    const now = Date.now();
    if (lastRecord && (now - lastRecord.timestamp < 60000)) {
        setClockInStatus('ERROR');
        setErrorMessage(`Aguarde 1 min para novo registro, ${employee.firstName}.`);
        return;
    }

    const type = lastRecord && lastRecord.type === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
    
    const newRecord: TimeRecord = {
      id: crypto.randomUUID(),
      employeeId: employee.id,
      timestamp: now,
      type: type,
      verificationStatus: 'SUCCESS',
      similarity: similarity
    };

    saveTimeRecord(newRecord);
    
    const timeFormatted = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(now);

    setSuccessData({
      name: `${employee.firstName} ${employee.lastName}`,
      time: `${type}: ${timeFormatted}`,
      msg: `Identidade confirmada (${similarity.toFixed(0)}%)`
    });
    setClockInStatus('SUCCESS');

    // Return to home after delay
    setTimeout(() => {
      setClockInStatus('IDLE');
      setSuccessData(null);
      setActiveTab(Tab.HOME);
    }, 4000);
  };

  const exportReport = async () => {
    const records = getTimeRecords();
    
    // Filtrar pelo Mês e Ano Selecionado
    const filteredRecords = records.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === reportMonth && d.getFullYear() === reportYear;
    });

    if (filteredRecords.length === 0) {
      alert("Não há registros de ponto para o período selecionado.");
      return;
    }

    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const periodString = `${months[reportMonth]}/${reportYear}`;

    try {
        await generateAndDownloadPDF(employees, filteredRecords, periodString, LOGO_URL);
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar PDF.");
    }
  };

  // --- Renders ---

  const renderHome = () => (
    <div className="flex flex-col items-center h-full relative z-10 w-full overflow-hidden">
      
      {/* Header / Logo Area */}
      <div className="pt-8 md:pt-12 pb-4 flex justify-center">
        <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="h-16 md:h-24 object-contain drop-shadow-[0_0_25px_rgba(220,38,38,0.5)]"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl px-6 gap-8 pb-20">
        
        <DigitalClock />
        
        {!modelsReady && (
            <div className="text-yellow-400 text-sm animate-pulse bg-yellow-900/20 px-4 py-2 rounded-full border border-yellow-500/30">
                Inicializando Sistema de IA...
            </div>
        )}
        
        {/* BIG Main Button */}
        <button
          onClick={() => modelsReady ? setActiveTab(Tab.CLOCK_IN) : alert("Aguarde o carregamento do sistema.")}
          className="w-full max-w-lg aspect-square md:aspect-auto md:h-48 bg-gradient-to-b from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 shadow-[0_0_60px_rgba(220,38,38,0.4)] border-4 border-red-500/30 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="bg-white/10 p-4 rounded-full group-hover:bg-white/20 transition shadow-[0_0_20px_rgba(0,0,0,0.2)]">
            <ScanFace className="w-10 h-10 md:w-14 md:h-14 text-white" />
          </div>
          <div className="text-center relative z-10">
            <span className="block text-xl md:text-3xl font-black tracking-tight drop-shadow-lg mb-1">BATER PONTO</span>
            <span className="block text-red-100 text-xs md:text-sm font-medium tracking-widest opacity-90 uppercase">Reconhecimento Facial</span>
          </div>
        </button>

      </div>

      {/* Discrete HR Button at Bottom */}
      <div className="absolute bottom-6 right-6 z-20">
         <button
          onClick={() => setActiveTab(Tab.HR_CONTROL)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm px-4 py-2 rounded-full hover:bg-white/5 group"
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium">Controle RH</span>
          <div className="p-2 bg-slate-900/50 rounded-full border border-slate-700 group-hover:border-red-500/50 transition-colors">
             <Settings className="w-5 h-5" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderClockIn = () => (
    <div className="flex flex-col items-center justify-center h-full p-0 md:p-6 animate-fade-in relative z-10 w-full bg-black/90">
       {/* Top Bar */}
       <div className="absolute top-4 left-4 z-20">
            <button 
                onClick={() => setActiveTab(Tab.HOME)}
                className="flex items-center gap-2 text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/10 transition"
            >
                <ArrowLeft className="w-5 h-5" /> Cancelar
            </button>
       </div>

        {/* Camera Area */}
        <div className="relative w-full h-full md:max-w-4xl md:h-auto md:aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] border border-red-900/30">
            {clockInStatus === 'SCANNING' && (
                <>
                    <video 
                        ref={scannerVideoRef} 
                        muted 
                        playsInline 
                        className="w-full h-full object-cover transform -scale-x-100 opacity-80"
                    />
                    
                    {/* Scanning Overlay UI */}
                    <div className="absolute inset-0 pointer-events-none">
                        {/* Corner Brackets */}
                        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-red-500/50 rounded-tl-xl"></div>
                        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-red-500/50 rounded-tr-xl"></div>
                        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-red-500/50 rounded-bl-xl"></div>
                        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-red-500/50 rounded-br-xl"></div>
                        
                        {/* Scanning Line Animation */}
                        <div className="absolute left-0 right-0 h-1 bg-red-500/50 shadow-[0_0_20px_rgba(220,38,38,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                        
                        {/* Status Text */}
                        <div className="absolute bottom-12 left-0 right-0 text-center">
                            <span className="bg-black/60 text-red-100 px-4 py-2 rounded-full text-sm font-mono backdrop-blur-md border border-red-500/30 animate-pulse">
                                PROCURANDO ROSTO...
                            </span>
                        </div>
                    </div>
                </>
            )}

            {clockInStatus === 'IDLE' && (
                <div className="flex items-center justify-center h-full text-white">
                    <p>Inicializando câmera...</p>
                </div>
            )}
        </div>

      {/* SUCCESS POPUP */}
      {clockInStatus === 'SUCCESS' && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-gradient-to-b from-white to-red-50 text-slate-900 p-8 md:p-12 rounded-[2rem] shadow-[0_0_100px_rgba(34,197,94,0.4)] flex flex-col items-center gap-6 max-w-md w-full transform transition-all scale-100 border-8 border-green-500 relative overflow-hidden">
            <div className="bg-green-100 p-6 rounded-full shadow-inner animate-[bounce_1s_infinite]">
               <CheckCircle className="w-20 h-20 text-green-600" />
            </div>
            <div className="text-center w-full space-y-2">
                <h3 className="text-3xl font-black text-green-800 tracking-tight">ACESSO LIBERADO</h3>
                <p className="text-2xl font-bold text-slate-800 truncate">{successData.name}</p>
                <div className="bg-slate-900 text-white font-mono text-xl px-4 py-2 rounded-lg inline-block mt-2">
                    {successData.time}
                </div>
                {successData.msg && <p className="text-sm text-green-700 font-medium">{successData.msg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ERROR POPUP */}
      {clockInStatus === 'ERROR' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
           <div className="bg-red-950 text-white p-8 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.3)] border-2 border-red-500 flex flex-col items-center gap-4 max-w-sm w-full">
             <AlertTriangle className="w-16 h-16 text-red-500" />
             <h3 className="text-2xl font-bold text-red-400 text-center">Atenção</h3>
             <p className="text-center text-red-100">{errorMessage}</p>
             <button 
                onClick={() => {
                    setClockInStatus('SCANNING');
                    startScanner();
                }}
                className="mt-4 px-8 py-3 bg-red-800 hover:bg-red-700 rounded-xl text-white font-bold w-full"
             >
               Tentar Novamente
             </button>
             <button onClick={() => setActiveTab(Tab.HOME)} className="text-sm text-red-400 hover:text-red-300">Cancelar</button>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes scan {
            0% { top: 10%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
        }
      `}</style>
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
            
            {!modelsReady && <p className="text-xs text-yellow-500 mb-2">Aguarde carregamento da IA...</p>}

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
                    <label className="text-xs md:text-sm text-red-200/80 font-medium mb-2 block">Foto de Rosto (Necessário para IA)</label>
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
                        <div className="flex gap-2 h-40 md:h-48">
                            <button
                                onClick={() => {
                                    setCameraMode('REGISTER');
                                    setIsCameraOpen(true);
                                }}
                                className="flex-1 bg-red-950/10 border-2 border-dashed border-red-500/30 rounded-xl flex flex-col items-center justify-center text-red-400/60 hover:border-red-500 hover:text-red-400 transition hover:bg-red-950/30 group"
                            >
                                <Camera className="w-6 h-6 md:w-8 md:h-8 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-xs md:text-sm text-center">Tirar Foto</span>
                            </button>

                            <label className="flex-1 bg-red-950/10 border-2 border-dashed border-red-500/30 rounded-xl flex flex-col items-center justify-center text-red-400/60 hover:border-red-500 hover:text-red-400 transition hover:bg-red-950/30 group cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Upload className="w-6 h-6 md:w-8 md:h-8 mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-xs md:text-sm text-center">Upload Foto</span>
                            </label>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleRegisterEmployee}
                    disabled={isRegistering || !modelsReady}
                    className={`w-full bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold py-3 md:py-4 rounded-xl mt-2 md:mt-4 shadow-lg shadow-red-900/20 active:scale-95 transition-all border border-red-500/20 ${isRegistering || !modelsReady ? 'opacity-50 cursor-wait' : ''}`}
                >
                    {isRegistering ? 'Processando IA...' : 'Salvar Cadastro'}
                </button>
            </div>
            </div>

            {/* List & Export */}
            <div className="space-y-6 md:space-y-8 flex flex-col">
                <div className="bg-black/60 backdrop-blur-xl p-5 md:p-8 rounded-3xl shadow-xl border border-red-500/20">
                    <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-white border-b border-red-500/20 pb-4">
                        <FileText className="text-red-400" /> 
                        Relatórios
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                             <label className="text-xs text-red-200/60 mb-1 block">Mês</label>
                             <select 
                                value={reportMonth} 
                                onChange={(e) => setReportMonth(Number(e.target.value))}
                                className="w-full bg-red-950/20 border border-red-500/30 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-red-500 outline-none"
                             >
                                <option value={0}>Janeiro</option>
                                <option value={1}>Fevereiro</option>
                                <option value={2}>Março</option>
                                <option value={3}>Abril</option>
                                <option value={4}>Maio</option>
                                <option value={5}>Junho</option>
                                <option value={6}>Julho</option>
                                <option value={7}>Agosto</option>
                                <option value={8}>Setembro</option>
                                <option value={9}>Outubro</option>
                                <option value={10}>Novembro</option>
                                <option value={11}>Dezembro</option>
                             </select>
                        </div>
                        <div>
                             <label className="text-xs text-red-200/60 mb-1 block">Ano</label>
                             <select 
                                value={reportYear} 
                                onChange={(e) => setReportYear(Number(e.target.value))}
                                className="w-full bg-red-950/20 border border-red-500/30 rounded-lg p-2 text-white text-sm focus:ring-1 focus:ring-red-500 outline-none"
                             >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                             </select>
                        </div>
                    </div>

                    <button 
                        onClick={exportReport}
                        className="w-full bg-red-800/80 hover:bg-red-700/90 border border-red-500/30 text-white font-bold py-3 md:py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <FileText className="w-5 h-5" />
                        Baixar Relatório (.pdf)
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
                                    {emp.faceDescriptor && <p className="text-[10px] text-green-500/70">Biometria Ativa</p>}
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
             // Só usado para cadastro agora
             setNewEmpPhoto(img);
             setIsCameraOpen(false);
          }}
          onCancel={() => setIsCameraOpen(false)}
          instruction="Mantenha o rosto neutro e bem iluminado"
        />
      )}
      
      <style>{`
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