import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  // 1. Obtener todas las claves disponibles
  const apiKeys: string[] = [];

  // Agregar clave principal
  const mainKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (mainKey) apiKeys.push(mainKey);

  // Buscar claves adicionales de forma estática (necesario para Vite)
  if (import.meta.env.VITE_GEMINI_API_KEY_2) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_2);
  if (import.meta.env.VITE_GEMINI_API_KEY_3) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_3);
  if (import.meta.env.VITE_GEMINI_API_KEY_4) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_4);
  if (import.meta.env.VITE_GEMINI_API_KEY_5) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_5);
  if (import.meta.env.VITE_GEMINI_API_KEY_6) apiKeys.push(import.meta.env.VITE_GEMINI_API_KEY_6);

  // DEBUG TEMPORAL: Ver qué está pasando en el celular
  // alert(`DEBUG: El sistema detectó ${apiKeys.length} llaves API.`);

  if (apiKeys.length === 0) {
    console.error("❌ ERROR CRÍTICO: No se encontró la API Key.");
    throw new Error("Falta la API Key de Gemini. Configura VITE_GEMINI_API_KEY en tu archivo .env.");
  }

  console.log(`[DEBUG] Se encontraron ${apiKeys.length} claves API para rotación.`);

  const candidateModels = [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash"
  ];

  let lastError: any = null;
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
      * ERROR PREVENTION: IGNORE items that are NOT mobile phones. Do NOT include "CHIP", "RECARGA", "MICA", "FUNDA", "GARANTIA", or "SEGURO". Only include actual devices.
      * If multiple phones exist, return ALL of them in the list.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg",
    },
  };

  // 2. Rotación de Claves API
  const attemptLogs: string[] = [];

  for (const [keyIndex, currentApiKey] of apiKeys.entries()) {
    console.log(`🔄 Intentando con API Key #${keyIndex + 1}...`);
    const genAI = new GoogleGenerativeAI(currentApiKey);
    let keyFailed = false;

    // Intentar con cada modelo usando la clave actual
    for (const modelName of candidateModels) {
      if (keyFailed) break; // Si la llave falló con error crítico, saltar modelos

      try {
        console.log(`  ➡️ Modelo: ${modelName}`);
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
          console.log(`✅ ÉXITO con Key #${keyIndex + 1} y modelo ${modelName}`, data);
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
        console.warn(`  ⚠️ Falló ${modelName} con Key #${keyIndex + 1}:`, error.message);
        lastError = error;

        const msg = error.message || "Unknown error";

        // Si es 429, la llave está quemada
        if (msg.includes("429")) {
          attemptLogs.push(`Key #${keyIndex + 1}: ⏳ Cuota (429)`);
          keyFailed = true; // Marcar llave como fallida
          break; // Siguiente llave
        }

        // Si es API Key inválida
        if (msg.includes("API key")) {
          attemptLogs.push(`Key #${keyIndex + 1}: ❌ Key Inválida`);
          keyFailed = true;
          break; // Siguiente llave
        }

        // Otros errores (ej. modelo no encontrado), probamos siguiente modelo...
        // Si fue el último modelo y falló:
        if (modelName === candidateModels[candidateModels.length - 1]) {
          attemptLogs.push(`Key #${keyIndex + 1}: ⚠️ Error técnico (${msg.slice(0, 20)}...)`);
        }
      }
    }
  }

  // Si llegamos aquí, fallaron todas
  console.error("❌ Todas las claves y modelos fallaron.", lastError);

  // Mostrar reporte detallado al usuario
  throw new Error(`FALLO TOTAL:\n${attemptLogs.join('\n')}\n\nIntenta con otra imagen o revisa Vercel.`);
};

