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
    MoreVertical,
    X
} from 'lucide-react';
import { Warranty, Brand, BrandConfig } from '../types';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | Warranty['status']>('all');

    const [formData, setFormData] = useState<Omit<Warranty, 'id' | 'status'>>({
        receptionDate: new Date().toISOString().split('T')[0],
        brand: Brand.SAMSUNG,
        model: '',
        imei: '',
        issueDescription: '',
        physicalCondition: '',
        contactNumber: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onAddWarranty({
            ...formData,
            status: 'received'
        });
        setIsAdding(false);
        // Reset form mostly, keep date
        setFormData({
            ...formData,
            model: '',
            imei: '',
            issueDescription: '',
            physicalCondition: '',
            contactNumber: ''
        });
    };

    const filteredWarranties = warranties.filter(w => {
        const matchesSearch =
            w.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || // Wait, Warranty type doesn't have customerName explicitly in types.ts update? I missed it? 
            // Checking types.ts update: id, receptionDate, brand, model, imei, issueDescription, physicalCondition, contactNumber, status.
            // Ah, I missed 'customerName' in the user request? 
            // User said: "fecha de recepcion, marca, modelo, imei, falla, estado fisico y numero de contacto". No customer name explicitly, but implied?
            // "numero de contacto" implies reaching a person. I'll search by contact number, model, imei.
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
                                <p className="text-slate-500 text-sm">Ingresa los detalles del equipo recibido.</p>
                            </div>
                            <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <label className="text-xs font-bold text-slate-500 uppercase">Número de Contacto</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="tel"
                                            required
                                            placeholder="Ej. 6671234567"
                                            value={formData.contactNumber}
                                            onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                                            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
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
                                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    />
                                </div>

                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">IMEI / Serie</label>
                                    <input
                                        type="text"
                                        placeholder="Opcional"
                                        value={formData.imei}
                                        onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                    />
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
                            </div>

                            <div className="pt-4 flex gap-3 justify-end border-t border-slate-100 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all hover:shadow-lg"
                                >
                                    Registrar Equipo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Warranties List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWarranties.map(warranty => (
                    <div key={warranty.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        {/* Brand Stripe */}
                        <div className={`absolute top-0 left-0 w-1 h-full ${brandConfigs[warranty.brand]?.colorClass?.replace('text-', 'bg-') || 'bg-slate-500'}`}></div>

                        <div className="pl-4">
                            {/* Header: Date & Status */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recibido</span>
                                    <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {warranty.receptionDate}
                                    </span>
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

                            {/* Contact */}
                            <div className="mb-4 flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <Phone className="w-4 h-4 text-blue-500" />
                                <span className="font-medium">{warranty.contactNumber}</span>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 gap-2 mb-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Falla:</p>
                                    <p className="text-xs text-slate-700 bg-red-50 p-2 rounded border border-red-100 leading-snug">{warranty.issueDescription}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Estado:</p>
                                    <p className="text-xs text-slate-600 leading-snug truncate">{warranty.physicalCondition}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 mt-2 pt-3 border-t border-slate-100">
                                {/* State Transitions */}
                                {warranty.status === 'received' && (
                                    <button
                                        onClick={() => onUpdateStatus(warranty.id, 'sent_to_provider')}
                                        className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Truck className="w-3.5 h-3.5" /> Enviar a Taller
                                    </button>
                                )}
                                {warranty.status === 'sent_to_provider' && (
                                    <button
                                        onClick={() => onUpdateStatus(warranty.id, 'in_store')}
                                        className="flex-1 bg-purple-50 hover:bg-purple-100 text-purple-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <PackageCheck className="w-3.5 h-3.5" /> Recibir en Tienda
                                    </button>
                                )}
                                {warranty.status === 'in_store' && (
                                    <button
                                        onClick={() => onUpdateStatus(warranty.id, 'delivered')}
                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Entregar a Cliente
                                    </button>
                                )}
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
