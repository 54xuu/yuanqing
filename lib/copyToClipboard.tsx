import { Modal, Input } from 'antd';

/**
 * Synchronous copy — call directly from click handlers (required for HTTP).
 * On failure, opens a modal with selectable text (works without clipboard API).
 */
function execCommandCopy(text: string): boolean {
  try {
    const input = document.createElement('input');
    input.value = text;
    input.readOnly = true;
    input.style.position = 'fixed';
    input.style.top = '0';
    input.style.left = '0';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.focus();
    input.select();
    input.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}

export function copyTextToClipboard(text: string): boolean {
  if (typeof window === 'undefined') return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return true;
  }

  return execCommandCopy(text);
}

/** Copy with modal fallback when clipboard is unavailable (HTTP / strict browsers). */
export function copyTextWithFallback(
  text: string,
  options?: { title?: string; onSuccess?: () => void; onFail?: () => void }
): boolean {
  const ok = copyTextToClipboard(text);
  if (ok) {
    options?.onSuccess?.();
    return true;
  }
  options?.onFail?.();
  Modal.info({
    title: options?.title ?? '复制失败，请手动复制以下内容',
    width: 560,
    content: (
      <Input.TextArea
        value={text}
        readOnly
        autoSize={{ minRows: 2, maxRows: 8 }}
        onFocus={(e) => e.target.select()}
      />
    ),
    okText: '关闭',
  });
  return false;
}
