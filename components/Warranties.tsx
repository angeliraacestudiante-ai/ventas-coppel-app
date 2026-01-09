import React, { useState } from 'react';
import {
    ShieldAlert,
    Plus,
    Search,
    Smartphone,
    Calendar,
    User,
    FileText,
    Thermometer,
    Phone,
    Truck,
    CheckCircle2,
    PackageCheck,
    X,
    Camera,
    Share2,
    Image as ImageIcon,
    Loader2,
    ExternalLink
} from 'lucide-react';
import { Warranty, Brand, BrandConfig } from '../types';
import { uploadImageToDriveScript } from '../services/googleAppsScriptService';

interface WarrantiesProps {
    warranties: Warranty[];
    onAddWarranty: (warranty: Omit<Warranty, 'id'>) => Promise<void>;
    onUpdateStatus: (id: string, status: Warranty['status']) => Promise<void>;
    brandConfigs: Record<Brand, BrandConfig>;
}

const Warranties: React.FC<WarrantiesProps> = ({
    warranties,
    onAddWarranty,
    onUpdateStatus,
    brandConfigs
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | Warranty['status']>('all');

    // Form State
    const [formData, setFormData] = useState<Omit<Warranty, 'id' | 'status'>>({
        receptionDate: new Date().toISOString().split('T')[0],
        invoiceNumber: '',
        possibleEntryDate: '', // Nuevo estado
        brand: Brand.SAMSUNG,
        model: '',
        imei: '',
        issueDescription: '',
        accessories: '',
        physicalCondition: '',
        contactNumber: '',
        ticketImage: ''
    });

    const [ticketPreview, setTicketPreview] = useState<string | null>(null);

    // --- HANDLERS ---

    const handleNumericInput = (field: keyof typeof formData, value: string, maxLength: number) => {
        const numericValue = value.replace(/\D/g, '').slice(0, maxLength);
        setFormData(prev => ({ ...prev, [field]: numericValue }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (ev) => {
                // Compress Image Logic (Simple version)
                const img = new Image();
                img.src = ev.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const maxDimension = 1000;

                    if (width > height) {
                        if (width > maxDimension) { height = Math.round((height * maxDimension) / width); width = maxDimension; }
                    } else {
                        if (height > maxDimension) { width = Math.round((width * maxDimension) / height); height = maxDimension; }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.7);
                    setTicketPreview(compressed);
                    setFormData(prev => ({ ...prev, ticketImage: compressed }));
                };
            };
        }
    };

    const validateForm = () => {
        if (!formData.brand || !formData.model || !formData.issueDescription || !formData.physicalCondition) {
            alert("⚠️ Todos los campos de texto son obligatorios.");
            return false;
        }

        if (formData.imei && formData.imei.length !== 15) {
            alert("⚠️ El IMEI debe tener exactamente 15 dígitos.");
            return false;
        }

        if (formData.contactNumber.length !== 10) {
            alert("⚠️ El número de contacto debe tener 10 dígitos.");
            return false;
        }

        // if (!formData.ticketImage) {
        //     alert("⚠️ Debes adjuntar una foto del ticket o del equipo.");
        //     return false;
        // }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
            let finalImageUrl = formData.ticketImage;

            // Upload to Drive if it looks like base64
            if (formData.ticketImage && formData.ticketImage.startsWith('data:')) {
                const filename = `Garantia_${formData.model}_${formData.receptionDate}`;
                try {
                    // We reuse the service. assuming date parameter is meant for folder structure if needed
                    const url = await uploadImageToDriveScript(formData.ticketImage, filename, formData.receptionDate, 'warranties');
                    finalImageUrl = url;
                } catch (error) {
                    console.error("Upload failed", error);
                    alert("Error al subir imagen a Drive. Se guardará sin imagen remota.");
                    // Proceed even if upload fails now? Or keep restricting?
                    // User requested making it optional, so if upload fails, we can either stop or proceed without image.
                    // Given previous strictness, let's keep the error behavior for *attempted* upload, but allow *no upload* if empty.
                    // If we are here, image was provided. If it fails, maybe we should still fail or ask user.
                    // Let's stick to fail safely:
                    alert("No se pudo subir la imagen. Intenta de nuevo.");
                    setIsSubmitting(false);
                    return;
                }
            }

            await onAddWarranty({
                ...formData,
                ticketImage: finalImageUrl,
                status: 'received'
            });

            setIsAdding(false);
            setFormData({
                receptionDate: new Date().toISOString().split('T')[0],
                invoiceNumber: '',
                possibleEntryDate: '',
                brand: Brand.SAMSUNG,
                model: '',
                imei: '',
                issueDescription: '',
                accessories: '',
                physicalCondition: '',
                contactNumber: '',
                ticketImage: ''
            });
            setTicketPreview(null);

        } catch (error) {
            console.error(error);
            alert("Error al guardar garantía.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShareWhatsApp = (warranty: Warranty) => {
        const statusTexts: Record<string, string> = {
            'received': 'Recibido en Tienda',
            'sent_to_provider': 'Enviado a Taller/Proveedor',
            'in_store': 'Listo en Tienda para Entrega',
            'delivered': 'Entregado al Cliente'
        };

        const text = `
*📋 REPORTE DE GARANTÍA - TELCEL*
--------------------------------
*📅 Fecha de Recepción:* ${warranty.receptionDate}
*🏷️ Marca:* ${brandConfigs[warranty.brand]?.label || warranty.brand}
*📱 Modelo:* ${warranty.model}
*🔢 IMEI:* ${warranty.imei || 'N/A'}
*🔧 Falla Reportada:* ${warranty.issueDescription}
*🔌 Accesorios:* ${warranty.accessories || 'Ninguno'}
*🔍 Estado Físico:* ${warranty.physicalCondition}
${warranty.ticketImage ? `*📷 Foto:* ${warranty.ticketImage}` : ''}
*📢 Estado Actual:* ${statusTexts[warranty.status]}

_Para más información, contacte a sucursal._
`.trim();

        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // --- FILTERING ---
    const filteredWarranties = warranties.filter(w => {
        const matchesSearch =
            w.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
            w.contactNumber.includes(searchTerm) ||
            (w.imei && w.imei.includes(searchTerm));

        const matchesFilter = filterStatus === 'all' || w.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const getStatusBadge = (status: Warranty['status']) => {
        switch (status) {
            case 'received':
                return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-yellow-200 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Recibido</span>;
            case 'sent_to_provider':
                return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-blue-200 flex items-center gap-1"><Truck className="w-3 h-3" /> Enviado</span>;
            case 'in_store':
                return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-purple-200 flex items-center gap-1"><PackageCheck className="w-3 h-3" /> En Tienda</span>;
            case 'delivered':
                return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-200 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Entregado</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por modelo, IMEI o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="flex-1 md:flex-none px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="received">Recibidos</option>
                        <option value="sent_to_provider">Enviados</option>
                        <option value="in_store">En Tienda</option>
                        <option value="delivered">Entregados</option>
                    </select>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold shadow-sm transition-all hover:shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">Nueva Garantía</span>
                        <span className="md:hidden">Nueva</span>
                    </button>
                </div>
            </div>

            {/* Add Modal */}
            {isAdding && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                                    Registrar Garantía
                                </h2>
                                <p className="text-slate-500 text-sm">Todos los campos son obligatorios.</p>
                            </div>
                            {!isSubmitting && (
                                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Invoice Number - First Field requested */}
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">No. Factura</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej. 123456"
                                            value={formData.invoiceNumber}
                                            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha Recepción</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="date"
                                            required
                                            value={formData.receptionDate}
                                            onChange={(e) => setFormData({ ...formData, receptionDate: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Número de Contacto (10 Dígitos)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            required
                                            placeholder="Ej. 6671234567"
                                            value={formData.contactNumber}
                                            onChange={(e) => handleNumericInput('contactNumber', e.target.value, 10)}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <p className="text-[10px] text-right text-slate-400">{formData.contactNumber.length}/10</p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Posible Fecha Ingreso (Opcional)</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="date"
                                            value={formData.possibleEntryDate || ''}
                                            onChange={(e) => setFormData({ ...formData, possibleEntryDate: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Marca</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select
                                            required
                                            value={formData.brand}
                                            onChange={(e) => setFormData({ ...formData, brand: e.target.value as Brand })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                                        >
                                            {Object.keys(brandConfigs).map((b) => (
                                                <option key={b} value={b}>{brandConfigs[b as Brand].label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Modelo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej. Galaxy A54"
                                        value={formData.model}
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm uppercase"
                                    />
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">IMEI / Serie (15 Dígitos)</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={15}
                                        placeholder="Ingrese los 15 dígitos del IMEI"
                                        value={formData.imei}
                                        onChange={(e) => handleNumericInput('imei', e.target.value, 15)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
                                    <p className="text-[10px] text-right text-slate-400">{formData.imei?.length || 0}/15</p>
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Falla Reportada</label>
                                    <div className="relative">
                                        <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <textarea
                                            required
                                            rows={2}
                                            placeholder="Describe el problema del equipo..."
                                            value={formData.issueDescription}
                                            onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Accesorios (Cargador, caja, funda...)</label>
                                    <div className="relative">
                                        <PackageCheck className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <textarea
                                            required
                                            rows={2}
                                            placeholder="Detalla qué accesorios se reciben..."
                                            value={formData.accessories}
                                            onChange={(e) => setFormData({ ...formData, accessories: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Estado Físico</label>
                                    <div className="relative">
                                        <Thermometer className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <textarea
                                            required
                                            rows={2}
                                            placeholder="Rayones, golpes, accesorios incluidos..."
                                            value={formData.physicalCondition}
                                            onChange={(e) => setFormData({ ...formData, physicalCondition: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Ticket Image Input */}
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Evidencia (Ticket/Equipo)</label>
                                    <div className="flex gap-4 items-start">
                                        {ticketPreview ? (
                                            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                                                <img src={ticketPreview} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => { setTicketPreview(null); setFormData(p => ({ ...p, ticketImage: '' })); }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="w-full cursor-pointer group">
                                                <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-400 transition-colors">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <Camera className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-2" />
                                                        <p className="text-xs text-slate-500">Tocar para tomar foto</p>
                                                    </div>
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                    {isSubmitting ? "Guardando..." : "Registrar Equipo"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Warranties List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWarranties.map(warranty => (
                    <div key={warranty.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden flex flex-col h-full">
                        {/* Brand Stripe */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${brandConfigs[warranty.brand]?.colorClass?.replace('text-', 'bg-') || 'bg-slate-500'}`}></div>

                        <div className="pl-4 flex-1 flex flex-col">
                            {/* Header: Date & Status */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recibido</span>
                                    <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {warranty.receptionDate}
                                    </span>
                                    {warranty.possibleEntryDate && (
                                        <span className="text-[10px] text-slate-400 mt-1">
                                            Ingreso: {warranty.possibleEntryDate}
                                        </span>
                                    )}
                                </div>
                                {getStatusBadge(warranty.status)}
                            </div>

                            {/* Device Info */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wide ${brandConfigs[warranty.brand].colorClass}`}
                                        style={brandConfigs[warranty.brand].colorClass.includes('text-black') ? { color: 'black' } : {}}
                                    >
                                        {brandConfigs[warranty.brand].label}
                                    </span>
                                    <h3 className="font-bold text-slate-900 text-lg">{warranty.model}</h3>
                                </div>
                                {warranty.imei && <p className="text-xs font-mono text-slate-400 break-all">IMEI: {warranty.imei}</p>}
                            </div>

                            {/* Invoice Number on Card */}
                            <div className="mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Factura</span>
                                <span className="text-sm font-medium text-slate-800">{warranty.invoiceNumber}</span>
                            </div>

                            {/* Contact */}
                            <div className="mb-4 flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Phone className="w-4 h-4 text-blue-500" />
                                    <span className="font-medium">{warranty.contactNumber}</span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 gap-2 mb-4 flex-1">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Falla:</p>
                                    <p className="text-xs text-slate-700 bg-red-50 p-2 rounded border border-red-100 leading-snug">{warranty.issueDescription}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Estado:</p>
                                    <p className="text-xs text-slate-600 leading-snug truncate">{warranty.physicalCondition}</p>
                                </div>
                                <div className="md:col-span-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Accesorios:</p>
                                    <p className="text-xs text-slate-600 leading-snug truncate">{warranty.accessories}</p>
                                </div>
                            </div>

                            {/* Actions & Evidence */}
                            <div className="pt-3 border-t border-slate-100 space-y-3 mt-auto">
                                {/* View Evidence Link if exists */}
                                {warranty.ticketImage && (
                                    <a
                                        href={warranty.ticketImage}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        Ver Evidencia
                                    </a>
                                )}

                                {/* Share Button (WhatsApp) */}
                                <button
                                    onClick={() => handleShareWhatsApp(warranty)}
                                    className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition-colors border border-slate-200"
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    Enviar Reporte por WhatsApp
                                </button>

                                {/* State Transitions */}
                                <div className="flex gap-2">
                                    {warranty.status === 'received' && (
                                        <button
                                            onClick={() => onUpdateStatus(warranty.id, 'sent_to_provider')}
                                            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Truck className="w-3.5 h-3.5" /> Enviar
                                        </button>
                                    )}
                                    {warranty.status === 'sent_to_provider' && (
                                        <button
                                            onClick={() => onUpdateStatus(warranty.id, 'in_store')}
                                            className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                        >
                                            <PackageCheck className="w-3.5 h-3.5" /> Recibir
                                        </button>
                                    )}
                                    {warranty.status === 'in_store' && (
                                        <button
                                            onClick={() => onUpdateStatus(warranty.id, 'delivered')}
                                            className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Entregar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredWarranties.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-500">No hay garantías registradas</p>
                </div>
            )}
        </div>
    );
};

export default Warranties;
