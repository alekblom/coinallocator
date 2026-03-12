const KEY_PREFIX = 'ca_labels_';

export function saveLabels(splitAddress: string, labels: Record<string, string>): void {
  try {
    localStorage.setItem(KEY_PREFIX + splitAddress, JSON.stringify(labels));
  } catch { /* quota exceeded — silently fail */ }
}

export function getLabels(splitAddress: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + splitAddress);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
