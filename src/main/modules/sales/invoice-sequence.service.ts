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

    const currentNumber = sequence.nextNumber;
    const formatted = `${sequence.prefix}${String(currentNumber).padStart(sequence.padLength, '0')}`;

    // Increment sequence atomically
    await tx.invoiceSequence.update({
      where: { id: sequence.id },
      data: { nextNumber: currentNumber + 1 },
    });

    return formatted;
  }
}

export const invoiceSequenceService = new InvoiceSequenceService();
