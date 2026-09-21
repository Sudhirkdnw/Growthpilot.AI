import { getPrismaClient } from '../../database/client';
import { settingsService } from '../settings/settings.service';
import { amountToWords } from '../../../shared/utils/amountInWords';
import {
  InvoiceDocumentDTO,
  InvoiceDocumentType,
  InvoiceItemDTO,
  InvoicePartyDTO,
  InvoicePaymentInfoDTO,
} from '../../../shared/types';

export class InvoiceDataService {
  private get prisma() {
    return getPrismaClient();
  }

  /**
   * Retrieves an authoritative InvoiceDocumentDTO for any supported transaction type.
   * Pure projection with zero side effects: no sequence generation, no record modification.
   */
  async getDocument(
    documentType: InvoiceDocumentType,
    id: string
  ): Promise<InvoiceDocumentDTO> {
    switch (documentType) {
      case 'SALE':
        return await this.getSaleInvoiceDocument(id);
      case 'SALES_RETURN':
        return await this.getSalesReturnDocument(id);
      case 'PURCHASE':
        return await this.getPurchaseBillDocument(id);
      case 'PURCHASE_RETURN':
        return await this.getPurchaseReturnDocument(id);
      default:
        throw new Error(`Unsupported invoice document type: ${documentType}`);
    }
  }

  /**
   * Generates invoice document projection for a Sale.
   */
  async getSaleInvoiceDocument(saleId: string): Promise<InvoiceDocumentDTO> {
    const sale: any = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      throw new Error(`Sale with ID ${saleId} not found.`);
    }

    const settings = await settingsService.getAppSettings();

    const party: InvoicePartyDTO = sale.customer
      ? {
          name: sale.customer.name,
          phone: sale.customer.phone || null,
          address: sale.customer.address || null,
          email: sale.customer.email || null,
          gstin: sale.customer.gstin || null,
          isCashParty: false,
        }
      : {
          name: 'Cash Customer',
          phone: null,
          address: 'Walk-in Store Customer',
          email: null,
          gstin: null,
          isCashParty: true,
        };

    const items: InvoiceItemDTO[] = (sale.items || []).map((it: any, idx: number) => ({
      rowNumber: idx + 1,
      productId: it.productId,
      name: it.product?.name || 'Unknown Product',
      sku: it.product?.sku || 'UNKNOWN',
      unitCode: it.product?.unit?.shortCode || 'PCS',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.sellingPrice || 0),
      discount: Number(it.discount || 0),
      taxRate: Number(it.taxRate || 0),
      taxAmount: Number(it.taxAmount || 0),
      lineTotal: Number(it.lineTotal || 0),
    }));

    const payments: InvoicePaymentInfoDTO[] = (sale.payments || []).map((p: any) => ({
      method: p.paymentMethod,
      amount: Number(p.amount || 0),
      reference: p.reference,
      date: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    }));

    const subtotal = Number(sale.subtotal || 0);
    const grandTotal = Number(sale.grandTotal || 0);
    const paidAmount = Number(sale.paidAmount || 0);
    const dueAmount = Number(sale.dueAmount || 0);
    const taxTotal = Number(sale.tax || 0);
    const totalDiscount = Number(sale.discount || 0);

    // Calculate item discounts vs global discount
    const itemDiscountTotal = items.reduce((acc, it) => acc + it.discount, 0);
    const globalDiscount = Math.max(0, Math.round((totalDiscount - itemDiscountTotal) * 100) / 100);

    const changeAmount =
      sale.paymentMethod === 'CASH' && paidAmount > grandTotal
        ? Math.round((paidAmount - grandTotal) * 100) / 100
        : 0;

    const currency = settings.company.currency || 'INR';
    const currencySymbol = settings.company.currencySymbol || '₹';
    const amountInWordsStr = amountToWords(
      grandTotal,
      currency === 'INR' ? 'Rupees' : currency,
      currency === 'INR' ? 'Paise' : 'Cents'
    );

    return {
      documentType: 'SALE',
      title: 'TAX INVOICE',
      documentNumber: sale.invoiceNumber,
      date: sale.saleDate ? new Date(sale.saleDate).toISOString() : new Date().toISOString(),
      status: sale.status,
      notes: sale.notes,
      company: settings.company,
      party,
      items,
      subtotal,
      itemDiscountTotal,
      globalDiscount,
      totalDiscount,
      taxTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      changeAmount,
      paymentMethod: sale.paymentMethod,
      payments,
      amountInWords: amountInWordsStr,
      currency,
      currencySymbol,
      footerNotes: settings.invoice?.footerNotes || 'Thank you for your business!',
      termsAndConditions:
        settings.invoice?.termsAndConditions ||
        'Goods once sold cannot be returned without original receipt.',
    };
  }

  /**
   * Generates invoice document projection for a Sales Return (Credit Note).
   */
  async getSalesReturnDocument(returnId: string): Promise<InvoiceDocumentDTO> {
    const salesReturn: any = await this.prisma.salesReturn.findUnique({
      where: { id: returnId },
      include: {
        sale: {
          include: {
            customer: true,
          },
        },
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
      },
    });

    if (!salesReturn) {
      throw new Error(`Sales return with ID ${returnId} not found.`);
    }

    const settings = await settingsService.getAppSettings();
    const customer = salesReturn.sale?.customer;

    const party: InvoicePartyDTO = customer
      ? {
          name: customer.name,
          phone: customer.phone || null,
          address: customer.address || null,
          email: customer.email || null,
          gstin: customer.gstin || null,
          isCashParty: false,
        }
      : {
          name: 'Cash Customer',
          phone: null,
          address: 'Walk-in Store Customer',
          email: null,
          gstin: null,
          isCashParty: true,
        };

    const items: InvoiceItemDTO[] = (salesReturn.items || []).map((it: any, idx: number) => ({
      rowNumber: idx + 1,
      productId: it.productId,
      name: it.product?.name || 'Unknown Product',
      sku: it.product?.sku || 'UNKNOWN',
      unitCode: it.product?.unit?.shortCode || 'PCS',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      discount: Number(it.discount || 0),
      taxRate: Number(it.taxRate || 0),
      taxAmount: Number(it.taxAmount || 0),
      lineTotal: Number(it.lineTotal || 0),
    }));

    const totalAmount = Number(salesReturn.totalAmount || 0);
    const subtotal = Number(salesReturn.subtotal || 0);
    const totalDiscount = Number(salesReturn.discount || 0);
    const taxTotal = Number(salesReturn.tax || 0);

    const currency = settings.company.currency || 'INR';
    const currencySymbol = settings.company.currencySymbol || '₹';
    const amountInWordsStr = amountToWords(
      totalAmount,
      currency === 'INR' ? 'Rupees' : currency,
      currency === 'INR' ? 'Paise' : 'Cents'
    );

    return {
      documentType: 'SALES_RETURN',
      title: 'CREDIT NOTE (SALES RETURN)',
      documentNumber: salesReturn.returnNumber,
      originalDocumentNumber: salesReturn.sale?.invoiceNumber || null,
      date: salesReturn.returnDate
        ? new Date(salesReturn.returnDate).toISOString()
        : new Date().toISOString(),
      status: salesReturn.status,
      notes: salesReturn.notes,
      company: settings.company,
      party,
      items,
      subtotal,
      itemDiscountTotal: totalDiscount,
      globalDiscount: 0,
      totalDiscount,
      taxTotal,
      grandTotal: totalAmount,
      paidAmount: totalAmount,
      dueAmount: 0,
      changeAmount: 0,
      paymentMethod: salesReturn.refundType,
      payments: [
        {
          method: salesReturn.refundType,
          amount: totalAmount,
          date: salesReturn.returnDate
            ? new Date(salesReturn.returnDate).toISOString()
            : new Date().toISOString(),
        },
      ],
      amountInWords: amountInWordsStr,
      currency,
      currencySymbol,
      footerNotes: 'Credit note issued against returned goods.',
      termsAndConditions:
        'Credit note may be adjusted against future purchases or refunded as permitted.',
    };
  }

  /**
   * Generates invoice document projection for a Purchase Bill (Inward).
   */
  async getPurchaseBillDocument(purchaseId: string): Promise<InvoiceDocumentDTO> {
    const purchase: any = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
        payments: true,
      },
    });

    if (!purchase) {
      throw new Error(`Purchase with ID ${purchaseId} not found.`);
    }

    const settings = await settingsService.getAppSettings();

    const party: InvoicePartyDTO = purchase.supplier
      ? {
          name: purchase.supplier.name,
          phone: purchase.supplier.phone || null,
          address: purchase.supplier.address || null,
          email: purchase.supplier.email || null,
          gstin: purchase.supplier.gstin || null,
          isCashParty: false,
        }
      : {
          name: 'Cash Supplier',
          phone: null,
          address: null,
          email: null,
          gstin: null,
          isCashParty: true,
        };

    const items: InvoiceItemDTO[] = (purchase.items || []).map((it: any, idx: number) => ({
      rowNumber: idx + 1,
      productId: it.productId,
      name: it.product?.name || 'Unknown Product',
      sku: it.product?.sku || 'UNKNOWN',
      unitCode: it.product?.unit?.shortCode || 'PCS',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.purchasePrice || 0),
      discount: Number(it.discount || 0),
      taxRate: Number(it.taxRate || 0),
      taxAmount: Number(it.taxAmount || 0),
      lineTotal: Number(it.lineTotal || 0),
    }));

    const payments: InvoicePaymentInfoDTO[] = (purchase.payments || []).map((p: any) => ({
      method: p.paymentMethod,
      amount: Number(p.amount || 0),
      date: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    }));

    const subtotal = Number(purchase.subtotal || 0);
    const grandTotal = Number(purchase.total || 0);
    const paidAmount = Number(purchase.paidAmount || 0);
    const dueAmount = Number(purchase.dueAmount || 0);
    const taxTotal = Number(purchase.tax || 0);
    const totalDiscount = Number(purchase.discount || 0);

    const currency = settings.company.currency || 'INR';
    const currencySymbol = settings.company.currencySymbol || '₹';
    const amountInWordsStr = amountToWords(
      grandTotal,
      currency === 'INR' ? 'Rupees' : currency,
      currency === 'INR' ? 'Paise' : 'Cents'
    );

    return {
      documentType: 'PURCHASE',
      title: 'PURCHASE INWARD BILL',
      documentNumber: purchase.purchaseNumber,
      date: purchase.purchaseDate
        ? new Date(purchase.purchaseDate).toISOString()
        : new Date().toISOString(),
      status: purchase.status,
      notes: purchase.notes,
      company: settings.company,
      party,
      items,
      subtotal,
      itemDiscountTotal: items.reduce((acc, it) => acc + it.discount, 0),
      globalDiscount: Math.max(0, totalDiscount - items.reduce((acc, it) => acc + it.discount, 0)),
      totalDiscount,
      taxTotal,
      grandTotal,
      paidAmount,
      dueAmount,
      changeAmount: 0,
      paymentMethod: purchase.paymentMethod,
      payments,
      amountInWords: amountInWordsStr,
      currency,
      currencySymbol,
      footerNotes: 'Inward goods received and verified.',
      termsAndConditions: 'Subject to commercial vendor agreement.',
    };
  }

  /**
   * Generates invoice document projection for a Purchase Return (Debit Note).
   */
  async getPurchaseReturnDocument(returnId: string): Promise<InvoiceDocumentDTO> {
    const purchaseReturn: any = await this.prisma.purchaseReturn.findUnique({
      where: { id: returnId },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            product: {
              include: { unit: true },
            },
          },
        },
      },
    });

    if (!purchaseReturn) {
      throw new Error(`Purchase return with ID ${returnId} not found.`);
    }

    const settings = await settingsService.getAppSettings();
    const supplier = purchaseReturn.purchase?.supplier;

    const party: InvoicePartyDTO = supplier
      ? {
          name: supplier.name,
          phone: supplier.phone || null,
          address: supplier.address || null,
          email: supplier.email || null,
          gstin: supplier.gstin || null,
          isCashParty: false,
        }
      : {
          name: 'Cash Supplier',
          phone: null,
          address: null,
          email: null,
          gstin: null,
          isCashParty: true,
        };

    const items: InvoiceItemDTO[] = (purchaseReturn.items || []).map((it: any, idx: number) => ({
      rowNumber: idx + 1,
      productId: it.productId,
      name: it.product?.name || 'Unknown Product',
      sku: it.product?.sku || 'UNKNOWN',
      unitCode: it.product?.unit?.shortCode || 'PCS',
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      discount: Number(it.discount || 0),
      taxRate: Number(it.taxRate || 0),
      taxAmount: Number(it.taxAmount || 0),
      lineTotal: Number(it.lineTotal || 0),
    }));

    const totalAmount = Number(purchaseReturn.totalAmount || 0);
    const subtotal = Number(purchaseReturn.subtotal || 0);
    const totalDiscount = Number(purchaseReturn.discount || 0);
    const taxTotal = Number(purchaseReturn.tax || 0);

    const currency = settings.company.currency || 'INR';
    const currencySymbol = settings.company.currencySymbol || '₹';
    const amountInWordsStr = amountToWords(
      totalAmount,
      currency === 'INR' ? 'Rupees' : currency,
      currency === 'INR' ? 'Paise' : 'Cents'
    );

    return {
      documentType: 'PURCHASE_RETURN',
      title: 'DEBIT NOTE (PURCHASE RETURN)',
      documentNumber: purchaseReturn.returnNumber,
      originalDocumentNumber: purchaseReturn.purchase?.purchaseNumber || null,
      date: purchaseReturn.returnDate
        ? new Date(purchaseReturn.returnDate).toISOString()
        : new Date().toISOString(),
      status: purchaseReturn.status,
      notes: purchaseReturn.notes,
      company: settings.company,
      party,
      items,
      subtotal,
      itemDiscountTotal: totalDiscount,
      globalDiscount: 0,
      totalDiscount,
      taxTotal,
      grandTotal: totalAmount,
      paidAmount: totalAmount,
      dueAmount: 0,
      changeAmount: 0,
      paymentMethod: purchaseReturn.refundType,
      payments: [
        {
          method: purchaseReturn.refundType,
          amount: totalAmount,
          date: purchaseReturn.returnDate
            ? new Date(purchaseReturn.returnDate).toISOString()
            : new Date().toISOString(),
        },
      ],
      amountInWords: amountInWordsStr,
      currency,
      currencySymbol,
      footerNotes: 'Debit note issued for goods returned to vendor.',
      termsAndConditions: 'Amount to be deducted from accounts payable ledger.',
    };
  }
}

export const invoiceDataService = new InvoiceDataService();
