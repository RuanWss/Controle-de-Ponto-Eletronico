import { VerificationResult } from '../types';

// Declaração global pois estamos importando via CDN no index.html
declare const faceapi: any;

// URL pública para os modelos do face-api.js
const MODELS_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

export const loadModels = async (): Promise<void> => {
  try {
    console.log("Carregando modelos de reconhecimento facial...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL)
    ]);
    console.log("Modelos carregados com sucesso!");
  } catch (error) {
    console.error("Erro ao carregar modelos:", error);
    throw new Error("Falha ao carregar inteligência artificial local.");
  }
};

/**
 * Detecta um rosto na imagem e retorna o descritor biométrico (array de 128 números).
 */
export const getFaceDescriptor = async (imageSrc: string): Promise<Float32Array | null> => {
  const img = await faceapi.fetchImage(imageSrc);
  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
  
  if (!detection) {
    return null;
  }
  return detection.descriptor;
};

/**
 * Compara dois rostos calculando a Distância Euclidiana entre seus descritores.
 * Similar a: face_recognition.face_distance([encodeElon], encodeElonTest)
 */
export const compareFaces = async (
  referenceDescriptor: number[] | Float32Array,
  liveImageSrc: string
): Promise<VerificationResult> => {
  try {
    // 1. Obter descritor da imagem ao vivo
    const liveDescriptor = await getFaceDescriptor(liveImageSrc);

    if (!liveDescriptor) {
      return { verified: false, message: "Nenhum rosto detectado na câmera." };
    }

    // 2. Calcular Distância Euclidiana
    // O face-api.js já possui essa utilidade, mas podemos fazer manual para ficar igual ao Python se quisermos
    const distance = faceapi.euclideanDistance(referenceDescriptor, liveDescriptor);
    
    // Threshold (Limiar):
    // < 0.6 é considerado a mesma pessoa (padrão de mercado/dlib)
    // < 0.4 é muito similar
    const threshold = 0.55; 

    console.log(`Distância calculada: ${distance}`);

    if (distance < threshold) {
      // Cálculo de % de similaridade para exibir na UI (apenas cosmético)
      const similarity = Math.max(0, 100 - (distance * 100)); 
      return { 
        verified: true, 
        message: `Identidade confirmada (${similarity.toFixed(1)}%)`,
        distance: distance
      };
    } else {
      return { 
        verified: false, 
        message: "Rosto não confere com o cadastro.", 
        distance: distance 
      };
    }

  } catch (error) {
    console.error("Erro na comparação facial:", error);
    return { verified: false, message: "Erro no processamento da imagem." };
  }
};