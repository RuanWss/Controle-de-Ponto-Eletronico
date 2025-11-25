import { Employee, VerificationResult } from '../types';

// Access the global faceapi variable injected via script tag
declare const faceapi: any;

// URL to load models from (using a reliable GitHub Pages mirror for face-api models)
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

let modelsLoaded = false;

/**
 * Carrega os modelos neurais necessários para detecção e reconhecimento.
 */
export const loadModels = async (): Promise<void> => {
  if (modelsLoaded) return;
  
  console.log("Carregando modelos de IA...");
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    console.log("Modelos carregados com sucesso!");
  } catch (error) {
    console.error("Erro ao carregar modelos:", error);
    throw new Error("Falha ao carregar inteligência artificial.");
  }
};

/**
 * Gera o descritor facial (array de números) a partir de uma imagem Base64 ou HTMLImageElement.
 * Usado no cadastro.
 */
export const getFaceDescriptor = async (imageInput: string | HTMLImageElement | HTMLVideoElement): Promise<Float32Array | null> => {
  if (!modelsLoaded) await loadModels();

  let input = imageInput;
  if (typeof imageInput === 'string') {
    const img = await loadImage(imageInput);
    input = img;
  }

  // Detecta rosto único com landmarks e descritor
  const detection = await faceapi.detectSingleFace(input as any)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return null;
  }

  return detection.descriptor;
};

/**
 * Identifica o funcionário mais parecido com o rosto detectado.
 */
export const identifyFace = async (
  videoElement: HTMLVideoElement, 
  employees: Employee[]
): Promise<VerificationResult> => {
  if (!modelsLoaded) return { verified: false, message: "Modelos não carregados." };
  if (employees.length === 0) return { verified: false, message: "Sem funcionários cadastrados." };

  // 1. Detectar rosto no frame atual do vídeo
  const detection = await faceapi.detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return { verified: false, message: "Nenhum rosto detectado." };
  }

  // 2. Criar Matcher com os descritores dos funcionários
  // Convertemos os arrays salvos no JSON de volta para Float32Array e depois LabeledFaceDescriptors
  const labeledDescriptors = employees
    .filter(emp => emp.faceDescriptor && emp.faceDescriptor.length > 0)
    .map(emp => {
      return new faceapi.LabeledFaceDescriptors(
        emp.id,
        [new Float32Array(emp.faceDescriptor!)]
      );
    });

  if (labeledDescriptors.length === 0) {
    return { verified: false, message: "Funcionários sem biometria cadastrada." };
  }

  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); // Threshold de 0.55 (quanto menor, mais estrito)

  // 3. Comparar o rosto detectado com o banco de dados
  const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

  if (bestMatch.label !== 'unknown') {
    // Cálculo de confiança inversa à distância (0 dist = 100% conf)
    const confidence = Math.max(0, 100 - (bestMatch.distance * 100));
    return {
      verified: true,
      matchId: bestMatch.label,
      message: "Identificado",
      similarity: confidence
    };
  } else {
    return { verified: false, message: "Rosto desconhecido." };
  }
};

// Helper para carregar imagem string para elemento HTML
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};
