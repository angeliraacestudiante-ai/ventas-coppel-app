import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    throw new Error("Falta la API Key de Gemini. Configura VITE_GEMINI_API_KEY en tu archivo .env");
  }

  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-2.5-flash"
  ];

  let lastError: any = null;

  // Remove header if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64Image.split(',')[1] || base64Image;

  const prompt = `Analyze this sales receipt image. Extract the following information in JSON format:
            - invoiceNumber: The receipt or invoice number (string). MIRA BIEN LA IMAGEN
            - price: The total amount paid (number).
            - date: The date of purchase in YYYY-MM-DD format (string).
            - brand: The likely mobile phone brand purchased if visible (enum string: SAMSUNG, APPLE, OPPO, ZTE, MOTOROLA, REALME, VIVO, XIAOMI, HONOR, HUAWEI, SENWA, OTRO). If unsure or mixed, use OTRO.
            - customerName: The customer's name if visible. Look for a pattern like "Nombre: [Name]" or similar indicators. Return only the name.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg",
    },
  };

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of candidateModels) {
    try {
      console.log(`Attempting analysis with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              invoiceNumber: { type: SchemaType.STRING },
              price: { type: SchemaType.NUMBER },
              date: { type: SchemaType.STRING },
              brand: { type: SchemaType.STRING },
              customerName: { type: SchemaType.STRING }
            }
          }
        }
      });

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      if (text) {
        const data = JSON.parse(text);

        // Validate brand match
        let matchedBrand = Brand.OTRO;
        if (data.brand && Object.values(Brand).includes(data.brand as Brand)) {
          matchedBrand = data.brand as Brand;
        }

        console.log(`Success with model: ${modelName}`);
        return {
          invoiceNumber: data.invoiceNumber,
          price: data.price,
          date: data.date,
          brand: matchedBrand,
          customerName: data.customerName
        };
      }
    } catch (error: any) {
      console.warn(`Failed with model ${modelName}:`, error.message);
      lastError = error;

      // If error is NOT 404 (Not Found) AND NOT 429 (Rate Limit) AND NOT 503 (Overloaded), 
      // it might be a parsing/request error we shouldn't retry? 
      // Actually, for safety, let's retry on almost everything except auth errors.
      if (error.message?.includes("API key")) {
        throw error; // Don't retry invalid key
      }

      // Continue to next model
    }
  }

  // If we get here, all models failed
  console.error("All models failed. Last error:", lastError);

  if (lastError?.message?.includes("429")) {
    throw new Error("Cuota excedida (Error 429). Has alcanzado el límite de peticiones gratuitas por hoy. Intenta más tarde o mañana.");
  }

  throw lastError || new Error("No se pudo analizar el ticket con ningún modelo disponible.");
};