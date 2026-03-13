// src/components/ImageModal.jsx
import { createPortal } from "react-dom";

/**
 * Full-screen image preview modal rendered via portal.
 *
 * Props:
 *  - open  {boolean}  Whether the modal is visible
 *  - src   {string}   Image URL to display
 *  - onClose {function} Called when the overlay is clicked to dismiss
 */
export default function ImageModal({ open, src, onClose }) {
  if (!open || !src) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Full"
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
      />
    </div>,
    document.body,
  );
}
