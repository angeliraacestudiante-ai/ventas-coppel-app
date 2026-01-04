import React, { useState, useRef } from 'react';
import { Plus, Camera, Loader2, Save, X, Sparkles, AlertCircle, Trash2, Smartphone, CloudUpload } from 'lucide-react';
import { Brand, Sale } from '../types';
import { BRAND_CONFIGS } from '../constants';
import { analyzeTicketImage } from '../services/geminiService';
import { uploadTicketImage } from '../services/supabaseClient';

interface SalesFormProps {
  onAddSale: (sale: Omit<Sale, 'id'>) => void;
  onCancel: () => void;
}

interface SaleItem {
  tempId: number;
  brand: Brand;
  price: string;
  error?: string;
}

const SalesForm: React.FC<SalesFormProps> = ({ onAddSale, onCancel }) => {
  // Construct local YYYY-MM-DD for default date to avoid UTC issues
  const localDate = new Date();
  const defaultDateStr = localDate.getFullYear() + '-' + 
                         String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(localDate.getDate()).padStart(2, '0');

  // Common fields for the whole ticket
  const [commonData, setCommonData] = useState({
    invoiceNumber: '',
    customerName: '',
    date: defaultDateStr,
  });

  // List of devices in this ticket
  const [items, setItems] = useState<SaleItem[]>([
    { tempId: Date.now(), brand: Brand.SAMSUNG, price: '' }
  ]);

  const [ticketImage, setTicketImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const val = parseFloat(item.price);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  };

  const validatePrice = (value: string): { isValid: boolean, error?: string } => {
    if (!value) return { isValid: false, error: "Requerido" };
    const validFormat = /^\d+(\.\d{1,2})?$/;
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue <= 0) return { isValid: false, error: "> 0" };
    if (!validFormat.test(value)) return { isValid: false, error: "Formato inválido" };
    return { isValid: true };
  };

  const handleCommonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Validación estricta: Solo números para el número de factura
    if (name === 'invoiceNumber') {
      const numericValue = value.replace(/\D/g, ''); // Elimina todo lo que no sea dígito
      setCommonData(prev => ({ ...prev, [name]: numericValue }));
      return;
    }

    setCommonData(prev => ({ ...prev, [name]: value }));
  };

  // Item management
  const handleAddItem = () => {
    setItems(prev => [
      ...prev, 
      { tempId: Date.now(), brand: Brand.SAMSUNG, price: '' }
    ]);
  };

  const handleRemoveItem = (tempId: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(i => i.tempId !== tempId));
    }
  };

  const handleItemChange = (tempId: number, field: keyof SaleItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      
      const updated = { ...item, [field]: value };
      
      // Clear error if typing price
      if (field === 'price' && item.error) {
        updated.error = undefined;
      }
      return updated;
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Guardar el archivo real para subirlo después
      setSelectedFile(file);

      // Crear preview para la UI y la IA
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setTicketImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeTicket = async () => {
    if (!ticketImage) return;

    setIsAnalyzing(true);
    try {
      const result = await analyzeTicketImage(ticketImage);
      
      setCommonData(prev => ({
        ...prev,
        // Limpiamos invoiceNumber si viene de la IA para asegurar que solo sean números si es necesario, 
        // o dejamos que el usuario lo corrija. Por ahora aplicamos replace.
        invoiceNumber: (result.invoiceNumber || prev.invoiceNumber).replace(/\D/g, ''),
        date: result.date || prev.date,
      }));

      // Update the first item with analyzed data
      setItems(prev => {
        const newItems = [...prev];
        if (newItems.length > 0) {
          const firstItem = { ...newItems[0] };
          if (result.price) firstItem.price = result.price.toString();
          if (result.brand) firstItem.brand = result.brand;
          newItems[0] = firstItem;
        }
        return newItems;
      });

    } catch (error) {
      alert("No se pudo analizar el ticket automáticamente. Por favor ingrese los datos manualmente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Common Fields
    if (!commonData.invoiceNumber.trim() || !commonData.customerName.trim()) {
      alert("Por favor complete los campos obligatorios: Número de Factura y Nombre del Cliente.");
      return;
    }

    // Validate Items
    let allValid = true;
    const validatedItems = items.map(item => {
      const validation = validatePrice(item.price);
      if (!validation.isValid) {
        allValid = false;
        return { ...item, error: validation.error };
      }
      return item;
    });

    if (!allValid) {
      setItems(validatedItems);
      alert("Por favor ingrese un precio válido para todos los equipos.");
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl: string | undefined = undefined;

    // Upload Image logic
    if (selectedFile) {
       try {
         const uploadedUrl = await uploadTicketImage(selectedFile);
         if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
         } else {
            alert("Advertencia: No se pudo subir la imagen a la nube. Se guardará sin foto.");
         }
       } catch (error) {
         console.error("Error uploading:", error);
         alert("Error al subir la imagen. Intenta de nuevo.");
         setIsSubmitting(false);
         return;
       }
    } else if (ticketImage) {
       // Fallback for when we have base64 but no file object (rare, but good for safety if using camera API differently)
       finalImageUrl = ticketImage; // This will likely be too large for DB, but acts as fallback
    }

    // Submit all items as separate sales sharing common data
    try {
      // We process sequentially or parallel. Parallel is fine.
      await Promise.all(validatedItems.map(item => {
        return onAddSale({
          invoiceNumber: commonData.invoiceNumber,
          customerName: commonData.customerName,
          date: commonData.date,
          price: parseFloat(item.price),
          brand: item.brand,
          ticketImage: finalImageUrl
        });
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-3xl mx-auto border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-6 h-6 text-blue-600" />
          Nueva Venta
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: COMMON DATA */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Datos Generales del Ticket
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Número de Factura <span className="text-red-500">*</span>
              </label>
              <input
                type="text" 
                inputMode="numeric"
                name="invoiceNumber"
                value={commonData.invoiceNumber}
                onChange={handleCommonChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                placeholder="Solo números (Ej. 123456)"
                required
              />
            </div>
            
             <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Nombre del Cliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={commonData.customerName}
                onChange={handleCommonChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={commonData.date}
                onChange={handleCommonChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ITEMS LIST */}
        <div>
          <div className="flex justify-between items-end mb-2">
             <label className="block text-sm font-bold text-slate-700">Equipos Vendidos ({items.length})</label>
             <div className="text-sm text-slate-500 font-medium bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Total Factura: <span className="text-slate-900 font-bold">${calculateTotal().toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {items.map((item, index) => (
              <div 
                key={item.tempId} 
                className={`p-4 flex flex-col md:flex-row gap-4 items-start md:items-center bg-white animate-in fade-in slide-in-from-left-2 duration-300 ${index !== 0 ? 'border-t border-slate-100' : ''}`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-sm font-bold shrink-0">
                  {index + 1}
                </div>

                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brand Selector */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 md:hidden">Marca</label>
                    <select
                      value={item.brand}
                      onChange={(e) => handleItemChange(item.tempId, 'brand', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900 cursor-pointer text-sm"
                    >
                      {Object.values(Brand).map((brand) => (
                        <option key={brand} value={brand}>
                          {BRAND_CONFIGS[brand].label}
                        </option>
                      ))}
                    </select>
                    {/* Brand Color Indicator */}
                    <div 
                      className={`absolute right-8 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${BRAND_CONFIGS[item.brand].colorClass.split(' ')[0]} md:mt-0 mt-3`}
                      style={{ backgroundColor: BRAND_CONFIGS[item.brand].hex }}
                    />
                  </div>

                  {/* Price Input */}
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 mb-1 md:hidden">
                      Precio <span className="text-red-500">*</span>
                    </label>
                    <span className="absolute left-3 top-2 md:top-2 text-slate-500 text-sm hidden md:block">$</span>
                    <span className="absolute left-3 top-8 text-slate-500 text-sm md:hidden">$</span>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(item.tempId, 'price', e.target.value)}
                      className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm transition-all bg-white text-slate-900 placeholder:text-slate-400 ${
                        item.error 
                          ? 'border-red-500 bg-red-50 focus:ring-red-200' 
                          : 'border-slate-300 focus:ring-blue-500'
                      }`}
                      placeholder="0.00"
                      step="0.01"
                      required
                    />
                    {item.error && (
                      <span className="absolute right-3 top-2 text-red-500 text-xs font-bold md:block hidden">{item.error}</span>
                    )}
                    {item.error && (
                      <span className="text-red-500 text-xs font-bold md:hidden block mt-1">{item.error}</span>
                    )}
                  </div>
                </div>

                {/* Remove Button */}
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.tempId)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end md:self-auto"
                    title="Quitar equipo"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="mt-4 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors border border-dashed border-blue-200 w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Agregar otro equipo al ticket
          </button>
        </div>

        {/* SECTION 3: TICKET IMAGE */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <label className="block text-sm font-medium text-slate-700">Foto del Ticket (Opcional)</label>
          <div className="flex items-start gap-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors bg-white shrink-0 overflow-hidden
                ${ticketImage ? 'border-blue-500' : 'border-slate-300 hover:bg-slate-50'}
              `}
            >
              {ticketImage ? (
                <img src={ticketImage} alt="Ticket preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500 text-center px-1">Tomar Foto</span>
                </>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>

            <div className="flex flex-col gap-2">
               <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                 Toma una foto clara del ticket. La imagen se guardará de forma segura en la nube.
               </p>
               {ticketImage && (
                <button
                  type="button"
                  onClick={handleAnalyzeTicket}
                  disabled={isAnalyzing || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 text-sm font-medium w-fit"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isAnalyzing ? "Analizando..." : "Autocompletar datos"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors bg-white border border-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all flex items-center gap-2 shadow-md shadow-blue-200 disabled:opacity-70 disabled:cursor-wait"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSubmitting ? (selectedFile ? "Subiendo imagen..." : "Guardando...") : `Guardar Venta (${items.length})`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SalesForm;