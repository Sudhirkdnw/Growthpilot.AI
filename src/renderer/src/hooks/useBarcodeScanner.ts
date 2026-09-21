import { useEffect, useRef } from 'react';

export interface BarcodeScannerConfig {
  enabled?: boolean;
  minBarcodeLength?: number;
  interCharTimingThresholdMs?: number;
  bufferTimeoutMs?: number;
  duplicateScanDelayMs?: number;
}

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void | Promise<void>;
  onError?: (error: string) => void;
  config?: BarcodeScannerConfig;
}

/**
 * Universal USB HID Barcode Scanner Hook
 * Listens for rapid hardware keystrokes followed by an Enter terminator.
 * Strictly respects input element focus so typing in customer names, addresses,
 * prices, search bars, etc. is NEVER interrupted or captured as a barcode.
 */
export function useBarcodeScanner({
  onScan,
  onError,
  config = {},
}: UseBarcodeScannerOptions) {
  const {
    enabled = true,
    minBarcodeLength = 3,
    interCharTimingThresholdMs = 60, // Scanners fire chars in <20-50ms; humans take >100ms
    bufferTimeoutMs = 300,
    duplicateScanDelayMs = 1000,
  } = config;

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const bufferResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScannedBarcodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. SAFE TYPING ISOLATION:
      // If user is focused on an HTML input, textarea, or contentEditable element,
      // allow normal typing and do NOT intercept unless the input specifically opted in with data-scanner-target="true"
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const isScannerTarget = target?.getAttribute('data-scanner-target') === 'true';

      if (isTextInput && !isScannerTarget) {
        // User is typing in a form field (customer name, address, settings, search, etc.)
        // Clear buffer so stray scanner keystrokes don't contaminate
        bufferRef.current = '';
        return;
      }

      // 2. Ignore modifier keys and functional keys (except Enter which acts as terminator)
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.key === 'Shift' ||
        event.key === 'Tab' ||
        event.key === 'Escape'
      ) {
        return;
      }

      const now = Date.now();
      const timeDelta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Reset timer for clearing buffer if keystrokes stall
      if (bufferResetTimerRef.current) {
        clearTimeout(bufferResetTimerRef.current);
      }
      bufferResetTimerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, bufferTimeoutMs);

      // 3. Scanner Terminator Detection (Enter Key)
      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= minBarcodeLength) {
          // Check for duplicate rapid scan protection
          if (
            barcode === lastScannedBarcodeRef.current &&
            now - lastScanTimeRef.current < duplicateScanDelayMs
          ) {
            console.log(`[Scanner] Ignored duplicate rapid scan of "${barcode}"`);
            return;
          }

          // Valid barcode captured by hardware scanner!
          event.preventDefault();
          event.stopPropagation();
          lastScannedBarcodeRef.current = barcode;
          lastScanTimeRef.current = now;

          try {
            onScan(barcode);
          } catch (err: any) {
            onError?.(err?.message || 'Barcode scan failed');
          }
        }
        return;
      }

      // 4. Inter-character timing evaluation
      // If delay between printable characters is too long, it might be manual slow typing.
      // We keep collecting if timing is fast enough or buffer is just starting.
      if (event.key.length === 1) {
        if (bufferRef.current.length > 0 && timeDelta > interCharTimingThresholdMs) {
          // Break in sequence - reset buffer to current character
          bufferRef.current = event.key;
        } else {
          bufferRef.current += event.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (bufferResetTimerRef.current) {
        clearTimeout(bufferResetTimerRef.current);
      }
    };
  }, [
    enabled,
    minBarcodeLength,
    interCharTimingThresholdMs,
    bufferTimeoutMs,
    duplicateScanDelayMs,
    onScan,
    onError,
  ]);
}
