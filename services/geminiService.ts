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

  - invoiceNumber: The unique sales folio. 
    * INSTRUCTION: Look for "Factura No.", "Folio", "Docto", "Ticket" or "Caja". 
    * PATTERN RULE: If you see "1053" followed by digits (e.g., "1053 801190" or "1053-801190"), extract ONLY the last part (e.g. "801190"). Return ONLY the distinct suffix digits.

  - date: The purchase date (YYYY-MM-DD). Look for "Fecha".
  
  - customerName: The customer's name.
    * INSTRUCTION: Look specifically for the label "CLIENTE:" or "NOMBRE:". 
    * The name is usually printed in UPPERCASE immediately after or below this label.
    * Do NOT return "Coppel" or "Publico en General" unless no other name exists.
    * Return formatted as "Title Case" (e.g. "Juan Perez").

  - items: Detect EVERY SINGLE mobile phone sold in the ticket.
    * CRITICAL: Tickets often contain MULTIPLE phones. Extract ALL of them.
    * FILTERING RULES (Strict):
      1. IGNORE items named "CHIP", "SIM", "RECARGA", "MICA", "FUNDA".
      2. IGNORE any item with a Base Price of **1.00** or less. These are usually promo chips.
      3. Only extract actual mobile devices.

    * PRICING ALGORITHM for each phone:
      1. Find the Base Price on the right.
      2. Check the lines IMMEDIATELY BELOW for a discount (e.g. "DESCTO P/PAQUETE", "AHORRO", "PROMOCION").
      3. CRITICAL EXCEPTION: If the discount found is exactly **-1.00**, IGNORE IT. This indicates a "Free Chip" promo and does NOT apply to the phone price.
      4. Only subtract discounts that are significant (e.g. > 10 pesos).
      5. Subtract the valid discount from the Base Price to get the Final Price.
      6. Return the calculated numeric price.
      
    * BRANDS: Identify the brand (Samsung, Apple, Motorola, Xiaomi, Oppo, etc.) for each item found.`;

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

