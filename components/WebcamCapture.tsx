import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RefreshCw } from 'lucide-react';

interface WebcamCaptureProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
  instruction?: string;
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, onCancel, instruction }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      // In mobile, browsers often default to front camera, but explicit 'user' helps
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      console.error("Camera error:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // Mirror effect correction for capture
        ctx.drawImage(videoRef.current, 0, 0);
        const imageSrc = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageSrc);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-0 md:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-red-950/20 backdrop-blur-xl md:rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.2)] border-y md:border border-red-500/30 flex flex-col h-full md:h-auto">
        <div className="p-3 md:p-4 bg-gradient-to-r from-black/60 to-red-950/60 flex justify-between items-center border-b border-red-500/20 shrink-0">
          <h3 className="text-base md:text-lg font-semibold text-red-50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            Captura de Rosto
          </h3>
          <button onClick={onCancel} className="text-red-300 hover:text-white transition px-2 py-1 text-sm md:text-base">Cancelar</button>
        </div>
        
        <div className="relative bg-black flex-1 flex items-center justify-center overflow-hidden">
            {error ? (
                <div className="text-red-400 text-center px-4">
                    <p className="text-sm md:text-base">{error}</p>
                    <button onClick={startCamera} className="mt-4 px-4 py-2 bg-red-900/50 border border-red-500/50 rounded hover:bg-red-800 text-sm">
                        Tentar Novamente
                    </button>
                </div>
            ) : (
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover transform -scale-x-100 opacity-90" 
                />
            )}
            
            {/* Scanline Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 background-size-[100%_2px,3px_100%]"></div>
            
            {/* Instruction Overlay */}
            {!error && (
                <div className="absolute top-4 left-0 right-0 text-center z-20 px-4">
                    <span className="bg-black/60 text-red-100 px-3 py-1.5 rounded-full text-[10px] md:text-sm backdrop-blur-md border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.3)] inline-block">
                        {instruction || "Posicione seu rosto no centro"}
                    </span>
                </div>
            )}
            
            {/* Target Reticle */}
            {!error && (
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-40">
                    <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-red-500/50 rounded-full border-dashed"></div>
                </div>
            )}
        </div>

        <div className="p-4 md:p-6 bg-black/60 flex justify-center gap-3 md:gap-4 border-t border-red-500/20 shrink-0">
            {!error && (
                <button 
                    onClick={capture}
                    className="flex items-center gap-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white px-5 py-2.5 md:px-8 md:py-4 rounded-full font-bold shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95 border border-red-400/20 text-sm md:text-base"
                >
                    <Camera className="w-4 h-4 md:w-6 md:h-6" />
                    <span>Capturar Foto</span>
                </button>
            )}
            <button 
                onClick={startCamera}
                className="p-2.5 md:p-4 rounded-full bg-slate-900/50 text-red-200 hover:bg-slate-800 hover:text-white border border-red-500/20 transition-colors"
                title="Reiniciar Câmera"
            >
                <RefreshCw className="w-4 h-4 md:w-6 md:h-6" />
            </button>
        </div>
      </div>
    </div>
  );
};