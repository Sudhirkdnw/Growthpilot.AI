import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Barcode Scanner Simulator Engine
 * Implements the core logic of the hardware scanner detector for headless testing
 */
class BarcodeScannerSimulator {
  private buffer = '';
  private lastKeyTime = 0;
  private lastScannedBarcode = '';
  private lastScanTime = 0;
  private config: {
    enabled: boolean;
    minBarcodeLength: number;
    interCharTimingThresholdMs: number;
    bufferTimeoutMs: number;
    duplicateScanDelayMs: number;
  };
  private onScan: (barcode: string) => void;
  private onError: (err: string) => void;

  constructor(
    onScan: (barcode: string) => void,
    onError: (err: string) => void,
    config: Partial<typeof BarcodeScannerSimulator.prototype.config> = {}
  ) {
    this.onScan = onScan;
    this.onError = onError;
    this.config = {
      enabled: true,
      minBarcodeLength: 3,
      interCharTimingThresholdMs: 60,
      bufferTimeoutMs: 300,
      duplicateScanDelayMs: 1000,
      ...config,
    };
  }

  handleKeyPress(
    key: string,
    targetInfo: { isTextInput: boolean; isScannerTarget?: boolean },
    mockTimestamp?: number
  ) {
    if (!this.config.enabled) return;

    // Safe typing isolation: do not capture keystrokes from text inputs unless designated
    if (targetInfo.isTextInput && !targetInfo.isScannerTarget) {
      this.buffer = '';
      return;
    }

    const now = mockTimestamp !== undefined ? mockTimestamp : Date.now();
    const timeDelta = now - this.lastKeyTime;
    this.lastKeyTime = now;

    // Buffer timeout reset
    if (timeDelta > this.config.bufferTimeoutMs && this.buffer.length > 0) {
      this.buffer = '';
    }

    // Terminator (Enter)
    if (key === 'Enter') {
      const barcode = this.buffer.trim();
      this.buffer = '';

      if (barcode.length >= this.config.minBarcodeLength) {
        // Duplicate scan protection
        if (
          barcode === this.lastScannedBarcode &&
          now - this.lastScanTime < this.config.duplicateScanDelayMs
        ) {
          this.onError('Duplicate rapid scan ignored');
          return;
        }

        this.lastScannedBarcode = barcode;
        this.lastScanTime = now;
        this.onScan(barcode);
      } else if (barcode.length > 0) {
        this.onError(`Barcode too short (min ${this.config.minBarcodeLength})`);
      }
      return;
    }

    // Inter-character timing check
    if (key.length === 1) {
      if (this.buffer.length > 0 && timeDelta > this.config.interCharTimingThresholdMs) {
        // Slow manual typing - reset buffer to current char
        this.buffer = key;
      } else {
        this.buffer += key;
      }
    }
  }
}

describe('Barcode Scanner Detector Test Suite', () => {
  let scannedBarcodes: string[] = [];
  let scannerErrors: string[] = [];
  let scanner: BarcodeScannerSimulator;

  beforeEach(() => {
    scannedBarcodes = [];
    scannerErrors = [];
    scanner = new BarcodeScannerSimulator(
      (barcode) => scannedBarcodes.push(barcode),
      (error) => scannerErrors.push(error),
      {
        minBarcodeLength: 4,
        interCharTimingThresholdMs: 50,
        bufferTimeoutMs: 300,
        duplicateScanDelayMs: 800,
      }
    );
  });

  it('Scenario 1: Rapid Hardware Barcode Scan Detection (<50ms per key)', () => {
    // Simulate USB HID scanner transmitting "890123" with 15ms between keystrokes
    const barcodeChars = ['8', '9', '0', '1', '2', '3', 'Enter'];
    let time = 1000;

    for (const char of barcodeChars) {
      scanner.handleKeyPress(char, { isTextInput: false }, time);
      time += 15; // 15ms delta = typical scanner speed
    }

    expect(scannedBarcodes).toHaveLength(1);
    expect(scannedBarcodes[0]).toBe('890123');
  });

  it('Scenario 2: Manual Slow Typing Does Not Trigger False Scanner Scans', () => {
    // Simulate human cashier typing "8901" slowly (e.g. 200ms between keystrokes)
    const chars = ['8', '9', '0', '1', 'Enter'];
    let time = 1000;

    for (const char of chars) {
      scanner.handleKeyPress(char, { isTextInput: false }, time);
      time += 200; // 200ms delta > 50ms threshold -> resets buffer
    }

    // Because each slow char reset the buffer, when Enter fires only "1" was in buffer (< min length 4)
    expect(scannedBarcodes).toHaveLength(0);
  });

  it('Scenario 3: Invalid Barcode (Under Minimum Length)', () => {
    // Scanner sends "12" (< min 4)
    const chars = ['1', '2', 'Enter'];
    let time = 1000;

    for (const char of chars) {
      scanner.handleKeyPress(char, { isTextInput: false }, time);
      time += 20;
    }

    expect(scannedBarcodes).toHaveLength(0);
    expect(scannerErrors).toContain('Barcode too short (min 4)');
  });

  it('Scenario 4: Duplicate Barcode Scan Debouncing', () => {
    // Scan 1: "890123" at t=1000
    for (const char of ['8', '9', '0', '1', '2', '3', 'Enter']) {
      scanner.handleKeyPress(char, { isTextInput: false }, 1000);
    }
    expect(scannedBarcodes).toHaveLength(1);

    // Immediate duplicate scan at t=1200 (< 800ms debounce delay)
    for (const char of ['8', '9', '0', '1', '2', '3', 'Enter']) {
      scanner.handleKeyPress(char, { isTextInput: false }, 1200);
    }
    expect(scannedBarcodes).toHaveLength(1); // Blocked duplicate
    expect(scannerErrors).toContain('Duplicate rapid scan ignored');

    // Valid subsequent scan after 900ms (> 800ms debounce delay)
    for (const char of ['8', '9', '0', '1', '2', '3', 'Enter']) {
      scanner.handleKeyPress(char, { isTextInput: false }, 2200);
    }
    expect(scannedBarcodes).toHaveLength(2); // Accepted
  });

  it('Scenario 5: Scanner Buffer Timeout & Auto-Reset', () => {
    // Cashier accidentally taps 2 digits, then stops for 500ms
    scanner.handleKeyPress('8', { isTextInput: false }, 1000);
    scanner.handleKeyPress('9', { isTextInput: false }, 1020);

    // 500ms delay (> 300ms bufferTimeout)
    // Then scanner fires "7777"
    for (const char of ['7', '7', '7', '7', 'Enter']) {
      scanner.handleKeyPress(char, { isTextInput: false }, 1600);
    }

    expect(scannedBarcodes).toHaveLength(1);
    expect(scannedBarcodes[0]).toBe('7777'); // "89" was purged
  });

  it('Scenario 6: Safe Typing Isolation When Another Input Field Has Focus', () => {
    // User is focused on Customer Name input field
    const typingInCustomerField = ['J', 'o', 'h', 'n', 'Enter'];
    let time = 1000;

    for (const char of typingInCustomerField) {
      scanner.handleKeyPress(char, { isTextInput: true, isScannerTarget: false }, time);
      time += 25; // Even if typed quickly, it MUST be ignored by global scanner
    }

    expect(scannedBarcodes).toHaveLength(0); // Zero barcodes fired from text input!
  });
});
