import { GoogleGenAI, Type } from "@google/genai";
import { VerificationResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We use the flash model for fast multimodal analysis
const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Compares a live photo against a stored reference photo description or directly.
 * Since we can't easily perform strict 1:1 biometric matching without specialized APIs,
 * we will use Gemini to verify that the person in the live photo looks like the same person
 * in the reference photo.
 */
export const verifyFace = async (
  referencePhotoBase64: string,
  livePhotoBase64: string,
  employeeName: string
): Promise<VerificationResult> => {
  try {
    // Strip headers if present
    const cleanRef = referencePhotoBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const cleanLive = livePhotoBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const prompt = `
      You are a security officer verifying identity.
      I have provided two images. 
      Image 1 is the Reference Photo of employee: ${employeeName}.
      Image 2 is the Live Photo taken just now.
      
      Task:
      1. Verify if Image 2 contains a real human face (not a photo of a photo/screen).
      2. Analyze if the person in Image 2 appears to be the same person as in Image 1.
      
      Strictly output JSON.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: cleanRef } },
            { inlineData: { mimeType: 'image/jpeg', data: cleanLive } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN, description: "True if the persons look like the same individual." },
            isLiveHuman: { type: Type.BOOLEAN, description: "True if a real human face is detected in the live photo." },
            confidence: { type: Type.STRING, description: "High, Medium, or Low" }
          },
          required: ["isMatch", "isLiveHuman", "confidence"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from AI");
    }

    const analysis = JSON.parse(resultText);

    if (analysis.isLiveHuman && analysis.isMatch) {
      return { verified: true, message: "Reconhecimento facial confirmado." };
    } else if (!analysis.isLiveHuman) {
      return { verified: false, message: "Rosto não detectado claramente." };
    } else {
      return { verified: false, message: "Rosto não confere com o cadastro." };
    }

  } catch (error) {
    console.error("Gemini verification error:", error);
    // Fallback for demo purposes if API fails (e.g., quota) or key is missing
    return { verified: false, message: "Erro de conexão com o servidor de validação." };
  }
};