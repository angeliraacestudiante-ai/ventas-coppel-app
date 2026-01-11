import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";
import { analyzeTicketWithGroq } from "./groqService";

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  // 1. Obtener todas las claves disponibles
  const apiKeys: string[] = [];

  // Agregar clave principal
  const mainKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (mainKey) apiKeys.push(mainKey);



  // NOTA: Se ha deshabilitado la rotación de claves adicionales a petición del usuario.
  // Solo se usará la clave principal.

  if (apiKeys.length === 0) {
    console.warn("⚠️ ADVERTENCIA: No se encontró API Key de Gemini. Se intentará usar el respaldo (Groq).");
    // No lanzamos error aquí para permitir que intente con Groq
  } else {
    console.log(`[DEBUG] Se encontraron ${apiKeys.length} claves API de Gemini.`);
  }

  const candidateModels = [
    "gemini-2.0-flash", // PRIORIDAD 1: Nuevo modelo ultra rápido (Flash 2.0)
    "gemini-1.5-flash", // PRIORIDAD 2: El estándar anterior
    "gemini-1.5-pro",   // PRIORIDAD 3: Alta inteligencia
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
      * CRITICAL: Do NOT confuse phone numbers (10 digits starting often with 6, 55, 33 etc) with prices. Prices usually have decimals (.00). Phone numbers do not.
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

      const MAX_RETRIES = 2; // Reducido de 5 a 2 para velocidad
      const BASE_WAIT_SECONDS = 2; // Reducido de 10s a 2s para no hacer esperar al usuario

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          console.log(`  ➡️ Modelo: ${modelName} (Intento ${attempt + 1}/${MAX_RETRIES})`);
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
          // Si llegamos aquí con éxito, salimos del bucle de intentos (return arriba ya lo hizo)

        } catch (error: any) {
          const msg = (error.message || "Unknown error").toString();

          // Lógica de Reintento para 429 (Too Many Requests) o ResourceExhausted
          if (msg.includes("429") || msg.includes("ResourceExhausted") || msg.includes("quota")) {
            console.warn(`  ⚠️ Cuota excedida (429) en ${modelName} con Key #${keyIndex + 1}.`);

            if (attempt < MAX_RETRIES - 1) {
              // Backoff Exponencial
              const waitTime = BASE_WAIT_SECONDS * (Math.pow(2, attempt)) * 1000; // 10s, 20s, 40s...
              console.log(`  ⏳ Esperando ${waitTime / 1000}s antes de reintentar...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue; // Reintentar mismo modelo, misma key
            } else {
              console.error("  ❌ Se acabaron los intentos para esta configuración.");
              attemptLogs.push(`Key #${keyIndex + 1} [${modelName}]: ⏳ Agotado tras ${MAX_RETRIES} reintentos (429)`);

              // Importante: Si falla un modelo con 429, INTENTAR EL SIGUIENTE MODELO de la lista.
              // No marcamos keyFailed = true todavía, a menos que ya estemos en el modelo más básico.

              // Si falla el "flash" estándar, es probable que la cuota global esté muerta.
              if (modelName === "gemini-1.5-flash") {
                console.error("  ❌ Falló el modelo base (Flash). Probablemente cuota agotada globalmente.");
                keyFailed = true;
              } else {
                console.warn("  ⚠️ Falló este modelo. Intentando con el siguiente de la lista...");
              }

              break; // Salir del bucle de intentos y pasar al siguiente modelo 
            }
          }

          console.warn(`  ⚠️ Falló ${modelName} con Key #${keyIndex + 1}:`, error.message);
          lastError = error;

          // Si es API Key inválida
          if (msg.includes("API key")) {
            attemptLogs.push(`Key #${keyIndex + 1}: ❌ Key Inválida`);
            keyFailed = true;
            break; // Salir del bucle de intentos y cambiar llave
          }

          // Otros errores (ej. modelo no encontrado o error interno de Google)
          // No hacemos retries, probamos el siguiente modelo
          if (modelName === candidateModels[candidateModels.length - 1] && attempt === MAX_RETRIES - 1) {
            attemptLogs.push(`Key #${keyIndex + 1}: ⚠️ Error técnico (${msg.slice(0, 20)}...)`);
          }

          // Si es un error distinto a 429, salimos del retry loop y dejamos que el loop de modelos continúe
          break;
        }
      }
    }
  }

  // --- FALLBACK: INTENTAR CON GROQ (Llama 3.2 Vision) --
  console.warn("⚠️ Todos los intentos de Gemini fallaron. Activando protocolo de respaldo (GROQ)...");

  try {
    const groqResult = await analyzeTicketWithGroq(base64Image);
    if (groqResult) {
      console.log("🏆 RESCATADO POR GROQ!");
      return groqResult;
    }
  } catch (groqError: any) {
    console.error("❌ Falló también el respaldo de Groq:", groqError.message);
    attemptLogs.push(`GROQ Backup: ❌ Error (${groqError.message})`);
  }

  // Si llegamos aquí, fallaron todas (Gemini + Groq)
  console.error("❌ Muerte total del sistema de IA.", lastError);

  // Mostrar reporte detallado al usuario
  throw new Error(`FALLO TOTAL (Gemini + Groq):\n\nPosible causa: Faltan las llaves API (API KEYS) en la configuración del servidor.\n\nSi la app está en línea, revisa las "Environment Variables" en Vercel/Netlify.\n\nDetalles técnicos:\n${attemptLogs.join('\n')}`);
};

