import { GoogleGenAI, Type } from "@google/genai";
import { TicketAnalysisResult, Brand } from "../types";

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Skipping analysis.");
    return {}; // Graceful degradation
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Remove header if present (e.g., "data:image/jpeg;base64,")
    const base64Data = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite-preview-02-05",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Data
            }
          },
          {
            text: `Analyze this sales receipt image. Extract the following information in JSON format:
            - invoiceNumber: The receipt or invoice number (string).
            - price: The total amount paid (number).
            - date: The date of purchase in YYYY-MM-DD format (string).
            - brand: The likely mobile phone brand purchased if visible (enum string: SAMSUNG, APPLE, OPPO, ZTE, MOTOROLA, REALME, VIVO, XIAOMI, HONOR, HUAWEI, SENWA, OTRO). If unsure or mixed, use OTRO.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceNumber: { type: Type.STRING },
            price: { type: Type.NUMBER },
            date: { type: Type.STRING },
            brand: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);

      // Validate brand match
      let matchedBrand = Brand.OTRO;
      if (data.brand && Object.values(Brand).includes(data.brand as Brand)) {
        matchedBrand = data.brand as Brand;
      }

      return {
        invoiceNumber: data.invoiceNumber,
        price: data.price,
        date: data.date,
        brand: matchedBrand
      };
    }

    return {};
  } catch (error) {
    console.error("Error analyzing ticket:", error);
    throw error;
  }
};