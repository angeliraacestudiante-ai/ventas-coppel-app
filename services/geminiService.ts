import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  // DEBUG: Verificar si la clave se está leyendo correctamente
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  console.log("[DEBUG] VITE_GEMINI_API_KEY presente:", !!envKey);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ ERROR CRÍTICO: No se encontró la API Key.");
    console.log("Variables de entorno disponibles:", import.meta.env); // Ayuda a ver qué variables sí cargaron
    throw new Error("Falta la API Key de Gemini. Configura VITE_GEMINI_API_KEY en tu archivo .env (Local) o en Settings > Environment Variables (Vercel).");
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

  const prompt = `You are an expert data extractor for Coppel store sales tickets. Analyze this image and extract the following in JSON format:

  - invoiceNumber: The unique sales folio. Look for labels like "Factura No.", "Folio", "Docto", or "Ticket".
    * INSTRUCTION: specifically look for the pattern "1053 [DIGITS]" (e.g., "1053 801190" or "1053-801190"). Extract ONLY the unique suffix (e.g., "801190"). Ignore the "1053" part. Return strict numeric digits only.
  - price: The final total amount paid (numeric). Look for "Total", "Neto", or "Venta".
  - date: The purchase date (YYYY-MM-DD). Look for "Fecha".
  - brand: The specific mobile device brand purchased.
    * Options: SAMSUNG, APPLE, OPPO, ZTE, MOTOROLA, REALME, VIVO, XIAOMI, HONOR, HUAWEI, SENWA, NUBIA, OTRO.
    * If the receipt mentions a model (e.g., 'iPhone'), map it to the brand (APPLE). If unsure, use OTRO.
  - customerName: The customer's name. Look for "Cliente", "Nombre", or handwriting. Return formatted as "Title Case".`;

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