import React, { useState } from 'react';
import { Printer, Copy, Check, X } from 'lucide-react';
import { Sale, DigitalTransaction, ServiceSoftwareOrder } from '../types/index.ts';

export type ReceiptType = 'sale' | 'digital' | 'service';

interface ThermalReceiptProps {
  type: ReceiptType;
  saleData?: Sale | null;
  digitalData?: DigitalTransaction | null;
  serviceData?: ServiceSoftwareOrder | null;
  onClose: () => void;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  type,
  saleData,
  digitalData,
  serviceData,
  onClose,
  storeName = 'KONTER NUSANTARA CELL & SERVICE',
  storeAddress = 'Jl. Pemuda No. 88, Pusat Niaga Handphone',
  storePhone = 'WA: 0812-3456-7890',
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [copied, setCopied] = useState(false);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Number(val || 0).toLocaleString('id-ID');
  };

  const isPrintingRef = React.useRef(false);

  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    try {
      window.print();
    } catch (err) {
      console.error('Print execution notice:', err);
    } finally {
      setTimeout(() => {
        isPrintingRef.current = false;
      }, 1000);
    }
  };

  const getPlainTextReceipt = (): string => {
    let text = `================================\n`;
    text += `${storeName}\n${storeAddress}\n${storePhone}\n`;
    text += `================================\n`;

    if (type === 'sale' && saleData) {
      text += `NOTA PENJUALAN\n`;
      text += `No. Faktur : ${saleData.invoiceNumber}\n`;
      text += `Tanggal    : ${new Date(saleData.createdAt).toLocaleString('id-ID')}\n`;
      text += `Pelanggan  : ${saleData.customerName}\n`;
      text += `--------------------------------\n`;
      saleData.items?.forEach((item) => {
        text += `${item.productName}\n`;
        if (item.imeiOrSerial) {
          text += `  [${item.imeiOrSerial}]\n`;
        }
        text += `  ${item.quantity} x ${formatRupiah(item.sellingPrice)} = ${formatRupiah(item.subtotal)}\n`;
      });
      text += `--------------------------------\n`;
      text += `Subtotal   : ${formatRupiah(saleData.subtotal)}\n`;
      if (saleData.discount > 0) {
        text += `Diskon     : -${formatRupiah(saleData.discount)}\n`;
      }
      text += `TOTAL      : ${formatRupiah(saleData.grandTotal)}\n`;
      const pMethod = (saleData.paymentMethod || 'cash').toUpperCase();
      text += `Bayar (${pMethod}): ${formatRupiah(saleData.amountPaid)}\n`;
      if (saleData.notes) {
        text += `Ket/Reff   : ${saleData.notes}\n`;
      }
      text += `Kembali    : ${formatRupiah(saleData.changeAmount)}\n`;
      text += `================================\n`;
      text += `* Barang bergaransi wajib sertakan nota\n`;
      text += `* HP garansi resmi cek service center\n`;
      text += `Terima Kasih Atas Kunjungan Anda!\n`;
    } else if (type === 'digital' && digitalData) {
      text += `BUKTI TRANSAKSI AGEN / DIGITAL\n`;
      text += `Reff/SN    : ${digitalData.referenceNumber}\n`;
      text += `Waktu      : ${new Date(digitalData.createdAt).toLocaleString('id-ID')}\n`;
      text += `Layanan    : ${digitalData.type.toUpperCase().replace('_', ' ')}\n`;
      text += `Penyedia   : ${digitalData.provider}\n`;
      text += `No Tujuan  : ${digitalData.targetAccount}\n`;
      text += `Nama       : ${digitalData.customerName || '-'}\n`;
      text += `--------------------------------\n`;
      text += `Nominal    : ${formatRupiah(digitalData.nominal)}\n`;
      text += `Biaya Admin: ${formatRupiah(digitalData.adminStoreFee)}\n`;
      text += `TOTAL BAYAR: ${formatRupiah(digitalData.totalCustomerPaid)}\n`;
      text += `Status     : SUKSES / BERHASIL\n`;
      text += `================================\n`;
      text += `Simpan bukti ini sebagai tanda terima sah.\n`;
    } else if (type === 'service' && serviceData) {
      text += `TANDA TERIMA SERVIS SOFTWARE HP\n`;
      text += `No. Servis : ${serviceData.orderNumber}\n`;
      text += `Tanggal    : ${new Date(serviceData.receivedAt).toLocaleDateString('id-ID')}\n`;
      text += `Pelanggan  : ${serviceData.customerName} (${serviceData.customerPhone})\n`;
      text += `--------------------------------\n`;
      text += `Tipe Unit  : ${serviceData.deviceModel}\n`;
      if (serviceData.deviceImei) text += `IMEI / SN  : ${serviceData.deviceImei}\n`;
      text += `Keluhan    : ${serviceData.issueType}\n`;
      if (serviceData.issueDetails) text += `Rincian    : ${serviceData.issueDetails}\n`;
      if (serviceData.toolsUsed) text += `Tool/Kredit: ${serviceData.toolsUsed}\n`;
      text += `--------------------------------\n`;
      text += `Estimasi   : ${formatRupiah(serviceData.estimatedCost)}\n`;
      text += `Uang Muka  : ${formatRupiah(serviceData.downPayment)}\n`;
      text += `Sisa Tagih : ${formatRupiah(serviceData.balanceDue)}\n`;
      text += `Status     : ${serviceData.status.toUpperCase()}\n`;
      text += `================================\n`;
      text += `* Pengambilan unit wajib membawa nota ini\n`;
      text += `* Garansi software 7 hari setelah selesai\n`;
    }

    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getPlainTextReceipt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="receipt-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
    >
      <div className="receipt-modal-container bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden my-auto border border-slate-200">
        {/* Modal Controls Header - Eye-Friendly Light Theme */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200 text-slate-800 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-slate-900">Cetak Struk Thermal</span>
              <p className="text-[11px] text-slate-500">Pratinjau format cetak nota kasir</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-bold border border-slate-200">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer ${
                  paperWidth === '58mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-3 py-1 rounded-lg transition-all duration-150 cursor-pointer ${
                  paperWidth === '80mm' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Buttons Toolbar - Responsive for mobile & tablet */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-3.5 sm:px-5 py-2.5 bg-slate-50 border-b border-slate-200 no-print">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Kertas:{' '}
            <strong className="text-slate-700">
              {paperWidth === '58mm' ? '58mm (Standar Konter)' : '80mm (Lebar POS Kasir)'}
            </strong>
          </span>
          <div className="flex items-center gap-2 justify-center sm:justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Tersalin' : 'Salin Teks (WA)'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Sekarang
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="receipt-preview-wrapper p-6 bg-slate-100 flex justify-center overflow-y-auto max-h-[70vh]">
          <div
            id="thermal-receipt-area"
            style={{ width: paperWidth === '58mm' ? '58mm' : '80mm' }}
            className="bg-white p-4 shadow-md rounded border border-slate-300 font-mono-receipt text-slate-900 leading-tight transition-all"
          >
            {/* Header Toko */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400 mb-2">
              <div className="font-bold text-sm uppercase tracking-wide">{storeName}</div>
              <div className="text-[10px] text-slate-700 mt-0.5">{storeAddress}</div>
              <div className="text-[10px] text-slate-700">{storePhone}</div>
            </div>

            {/* Content: POS Sale Receipt */}
            {type === 'sale' && saleData && (
              <div>
                <div className="text-center font-bold text-xs uppercase mb-1.5 py-0.5 bg-slate-100 rounded">
                  NOTA PENJUALAN
                </div>
                <div className="text-[10px] flex justify-between">
                  <span>No: {saleData.invoiceNumber}</span>
                  <span>{new Date(saleData.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="text-[10px] flex justify-between mb-2">
                  <span>Plg: {saleData.customerName}</span>
                  <span>{new Date(saleData.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-1.5 my-1.5 space-y-1.5">
                  {saleData.items && saleData.items.map((item, idx) => (
                    <div key={idx} className="text-[11px]">
                      <div className="font-semibold text-slate-900">{item.productName}</div>
                      {item.imeiOrSerial && (
                        <div className="text-[9px] text-indigo-700 font-medium">
                          IMEI: {item.imeiOrSerial}
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] text-slate-700">
                        <span>
                          {item.quantity} x {formatRupiah(item.sellingPrice)}
                        </span>
                        <span className="font-medium text-slate-900">{formatRupiah(item.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-0.5 text-[11px] pt-1 border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatRupiah(saleData.subtotal)}</span>
                  </div>
                  {saleData.discount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Diskon</span>
                      <span>-{formatRupiah(saleData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                    <span>TOTAL</span>
                    <span>{formatRupiah(saleData.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] pt-0.5">
                    <span>Bayar ({(saleData.paymentMethod || 'cash').toUpperCase()})</span>
                    <span>{formatRupiah(saleData.amountPaid)}</span>
                  </div>
                  {saleData.notes && (
                    <div className="text-[9px] text-slate-600 bg-slate-50 p-1 rounded border border-dashed border-slate-300 mt-1">
                      <span className="font-semibold text-slate-800">Catatan/Reff: </span>
                      {saleData.notes}
                    </div>
                  )}
                  <div className="flex justify-between text-[10px]">
                    <span>Kembali</span>
                    <span>{formatRupiah(saleData.changeAmount)}</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-600 mt-2 space-y-0.5">
                  <div>* Nota ini sebagai bukti transaksi resmi *</div>
                  <div>* HP Bergaransi Resmi bawa unit + nota ke SC *</div>
                  <div className="font-semibold mt-1">Terima Kasih Atas Kunjungan Anda</div>
                </div>
              </div>
            )}

            {/* Content: Digital Transaction Receipt */}
            {type === 'digital' && digitalData && (
              <div>
                <div className="text-center font-bold text-xs uppercase mb-1.5 py-0.5 bg-slate-100 rounded">
                  STRUK AGEN & DIGITAL
                </div>
                <div className="text-[10px] space-y-0.5 mb-2">
                  <div className="flex justify-between">
                    <span>Reff/SN:</span>
                    <span className="font-semibold">{digitalData.referenceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu:</span>
                    <span>{new Date(digitalData.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layanan:</span>
                    <span className="font-semibold uppercase">{digitalData.type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penyedia:</span>
                    <span className="font-semibold">{digitalData.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No. Tujuan:</span>
                    <span className="font-bold">{digitalData.targetAccount}</span>
                  </div>
                  {digitalData.customerName && (
                    <div className="flex justify-between">
                      <span>Pelanggan:</span>
                      <span>{digitalData.customerName}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-1.5 my-1.5 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>Nominal</span>
                    <span className="font-medium">{formatRupiah(digitalData.nominal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya Admin Toko</span>
                    <span>{formatRupiah(digitalData.adminStoreFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                    <span>TOTAL DIBAYAR</span>
                    <span>{formatRupiah(digitalData.totalCustomerPaid)}</span>
                  </div>
                </div>

                <div className="text-center text-[10px] font-bold text-emerald-700 bg-emerald-50 py-1 rounded my-1.5 border border-emerald-200">
                  STATUS: BERHASIL / SUKSES
                </div>

                <div className="text-center text-[9px] text-slate-600 mt-2 space-y-0.5">
                  <div>* Simpan struk ini sebagai bukti pembayaran sah *</div>
                  <div>Layanan Resmi Agen & Keuangan Digital</div>
                </div>
              </div>
            )}

            {/* Content: Service Software Receipt */}
            {type === 'service' && serviceData && (
              <div>
                <div className="text-center font-bold text-xs uppercase mb-1.5 py-0.5 bg-slate-100 rounded">
                  TANDA TERIMA SERVIS SOFTWARE
                </div>
                <div className="text-[10px] space-y-0.5 mb-2">
                  <div className="flex justify-between">
                    <span>No. Servis:</span>
                    <span className="font-bold">{serviceData.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tgl Masuk:</span>
                    <span>{new Date(serviceData.receivedAt).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pelanggan:</span>
                    <span className="font-semibold">{serviceData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No. HP/WA:</span>
                    <span>{serviceData.customerPhone}</span>
                  </div>
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-1.5 my-1.5 text-[10px] space-y-1">
                  <div>
                    <span className="text-slate-600">Unit: </span>
                    <span className="font-bold text-slate-900">{serviceData.deviceModel}</span>
                    {serviceData.deviceColor && <span> ({serviceData.deviceColor})</span>}
                  </div>
                  {serviceData.deviceImei && (
                    <div>
                      <span className="text-slate-600">IMEI/SN: </span>
                      <span className="font-mono text-[9px]">{serviceData.deviceImei}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-600">Keluhan: </span>
                    <span className="font-semibold text-rose-700">{serviceData.issueType}</span>
                  </div>
                  {serviceData.toolsUsed && (
                    <div className="text-[9px] text-slate-600">
                      Tool: {serviceData.toolsUsed}
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span>Biaya Servis</span>
                    <span>{formatRupiah(serviceData.finalCost || serviceData.estimatedCost)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Uang Muka (DP)</span>
                    <span>-{formatRupiah(serviceData.downPayment)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                    <span>SISA PELUNASAN</span>
                    <span className="text-indigo-900">{formatRupiah(serviceData.balanceDue)}</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-600 mt-2 space-y-0.5">
                  <div className="font-semibold">* Syarat Pengambilan Unit: *</div>
                  <div>1. Wajib menunjukkan nota/tanda terima ini.</div>
                  <div>2. Garansi software 7 hari (tidak termasuk kena air/jatuh).</div>
                  <div>3. Unit yang tidak diambil &gt; 30 hari di luar tanggung jawab.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
