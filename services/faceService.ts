import { VerificationResult } from '../types';

/**
 * SERVIÇO DE COMPARAÇÃO DE IMAGENS SEM IA
 * 
 * Utiliza algoritmos de visão computacional clássica (comparação de pixels)
 * para determinar se duas imagens são similares.
 */

// Função auxiliar para carregar imagem em um elemento HTML Image
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
};

/**
 * Compara duas imagens pixel a pixel.
 * Reduz as imagens para uma resolução baixa (ex: 64x64) para ignorar ruídos
 * e focar na estrutura geral de luminosidade e cor.
 */
export const compareImagesWithoutAI = async (
  referenceBase64: string,
  liveBase64: string
): Promise<VerificationResult> => {
  try {
    const size = 64; // Resolução de comparação (quanto menor, mais tolerante)
    
    const img1 = await loadImage(referenceBase64);
    const img2 = await loadImage(liveBase64);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error("Canvas context error");

    // 1. Processar Imagem Referência
    ctx.drawImage(img1, 0, 0, size, size);
    const data1 = ctx.getImageData(0, 0, size, size).data;

    // 2. Processar Imagem Ao Vivo
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img2, 0, 0, size, size);
    const data2 = ctx.getImageData(0, 0, size, size).data;

    // 3. Calcular Diferença Absoluta Média dos Pixels
    let diffSum = 0;
    // O array data contém [R, G, B, A, R, G, B, A...]
    // Iteramos de 4 em 4 para pegar cada pixel
    for (let i = 0; i < data1.length; i += 4) {
      // Grayscale simples: (R+G+B)/3
      const gray1 = (data1[i] + data1[i+1] + data1[i+2]) / 3;
      const gray2 = (data2[i] + data2[i+1] + data2[i+2]) / 3;
      
      diffSum += Math.abs(gray1 - gray2);
    }

    const totalPixels = size * size;
    const avgDiff = diffSum / totalPixels; // Diferença média por pixel (0 a 255)
    
    // Converter diferença (0-255) para porcentagem de similaridade (0-100%)
    // Se avgDiff for 0, similaridade é 100%. Se for 255, é 0%.
    const similarity = 100 - ((avgDiff / 255) * 100);

    console.log(`Diferença média: ${avgDiff.toFixed(2)} | Similaridade: ${similarity.toFixed(2)}%`);

    // Threshold (Limite de Aceitação)
    // Sem IA, a comparação é rígida. 85% requer iluminação e posição bem parecidas.
    const THRESHOLD = 75; 

    if (similarity >= THRESHOLD) {
      return { 
        verified: true, 
        message: `Validação visual confirmada (${similarity.toFixed(0)}%)`,
        similarity: similarity
      };
    } else {
      return { 
        verified: false, 
        message: `Imagem diferente da referência. Tente mesma luz e posição.`,
        similarity: similarity 
      };
    }

  } catch (error) {
    console.error("Erro na comparação visual:", error);
    return { verified: false, message: "Erro ao processar imagem." };
  }
};