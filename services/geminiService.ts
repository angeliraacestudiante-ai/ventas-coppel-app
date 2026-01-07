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
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash"
  ];

  let lastError: any = null;

  // Remove header if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64Image.split(',')[1] || base64Image;

  const prompt = `You are an expert data extractor for Coppel store sales tickets. Analyze this image and extract the following in JSON format:

  - invoiceNumber: The unique sales folio. Look for labels like "Factura No.", "Folio", "Docto", or "Ticket".
    * INSTRUCTION: specifically look for the pattern "1053 [DIGITS]" (e.g., "1053 801190" or "1053-801190"). Extract ONLY the unique suffix (e.g., "801190"). Ignore the "1053" part. Return strict numeric digits only.
  
  - date: The purchase date (YYYY-MM-DD). Look for "Fecha".
  - customerName: The customer's name. Look for "Cliente", "Nombre", or handwriting. Return formatted as "Title Case".

  - items: Detect EACH mobile phone sold in the ticket.
    * INSTRUCTION: Scan the ENTIRE ticket from top, to middle, to bottom. Do not stop after the first item.
    * Look for SKU numbers (6 digit codes like "222664") to identify distinct items.
    * For each phone found:
      1. Identify the Brand (SAMSUNG, APPLE, OPPO, ETC).
      2. Identify the BASE PRICE to the right (e.g., 9499.00).
      3. Look strictly BELOW that line for "DESCTO P/PAQUETE" or "DESCTO PROMOCION" and a negative amount (e.g. -2662.00).
      4. SUBTRACT the discount from the base price. (e.g. 9499 - 2662 = 6837).
      5. Return the calculated final price.
      * If multiple phones exist, return ALL of them in the list.`;

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
              customerName: { type: SchemaType.STRING },
              items: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    brand: { type: SchemaType.STRING },
                    price: { type: SchemaType.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      if (text) {
        const data = JSON.parse(text);

        console.log(`Success with model: ${modelName}`, data);

        return {
          invoiceNumber: data.invoiceNumber,
          price: data.price,
          date: data.date,
          items: data.items?.map((item: any) => {
            let b = Brand.OTRO;
            if (Object.values(Brand).includes(item.brand as Brand)) b = item.brand as Brand;
            return { brand: b, price: item.price };
          }),
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