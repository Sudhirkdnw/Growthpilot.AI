export class InvoiceSequenceService {
  /**
   * Atomically generates the next invoice number inside a transaction.
   * Format: PREFIX + padded number (e.g. INV-000001)
   */
  async getNextInvoiceNumber(tx: any, type = 'SALE_INVOICE'): Promise<string> {
    let sequence = await tx.invoiceSequence.findUnique({
      where: { type },
    });

    if (!sequence) {
      let prefix = 'SEQ-';
      let padLength = 6;
      if (type === 'SALE_INVOICE') prefix = 'INV-';
      else if (type === 'SALES_RETURN') prefix = 'SR-';
      else if (type === 'PURCHASE_RETURN') prefix = 'PR-';
      else if (type === 'PURCHASE_ORDER') prefix = 'PO-';
      else if (type === 'EXPENSE') prefix = 'EXP-';
      else if (type === 'PRODUCT_SKU') {
        prefix = 'SKU-';
        padLength = 5;
      }

      sequence = await tx.invoiceSequence.create({
        data: {
          type,
          prefix,
          nextNumber: 1,
          padLength,
        },
      });
    }

    let currentNumber = sequence.nextNumber;
    let formatted = `${sequence.prefix}${String(currentNumber).padStart(sequence.padLength, '0')}`;

    // Ensure collision resistance if records were created out-of-band
    let isTaken = true;
    while (isTaken) {
      formatted = `${sequence.prefix}${String(currentNumber).padStart(sequence.padLength, '0')}`;
      let existingRecord: any = null;

      if (type === 'SALE_INVOICE') {
        existingRecord = await tx.sale.findUnique({ where: { invoiceNumber: formatted } });
      } else if (type === 'EXPENSE') {
        existingRecord = await tx.expense.findUnique({ where: { expenseNumber: formatted } });
      } else if (type === 'PURCHASE_BILL') {
        existingRecord = await tx.purchase.findUnique({ where: { purchaseNumber: formatted } });
      } else if (type === 'SALES_RETURN') {
        existingRecord = await tx.salesReturn.findUnique({ where: { returnNumber: formatted } });
      } else if (type === 'PURCHASE_RETURN') {
        existingRecord = await tx.purchaseReturn.findUnique({ where: { returnNumber: formatted } });
      }

      if (existingRecord) {
        currentNumber++;
      } else {
        isTaken = false;
      }
    }

    // Increment sequence atomically to next available number
    await tx.invoiceSequence.update({
      where: { id: sequence.id },
      data: { nextNumber: currentNumber + 1 },
    });

    return formatted;
  }
}

export const invoiceSequenceService = new InvoiceSequenceService();
