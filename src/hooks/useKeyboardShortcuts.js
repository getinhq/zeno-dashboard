import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Global keyboard shortcuts. Escape closes modals / goes back; "g" then "d/t/e/r" navigates.
 * Does not fire when typing in input, textarea, or contenteditable.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const gPendingRef = useRef(false);
  const gTimeoutRef = useRef(null);

  useEffect(() => {
    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      const role = el.getAttribute?.('role');
      const editable = el.isContentEditable;
      return tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'textbox' || editable;
    }

    function onKeyDown(e) {
      if (isInputFocused()) {
        if (e.key === 'Escape') document.activeElement?.blur?.();
        return;
      }

      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('zeno-close-shortcuts'));
        if (location.pathname === '/publish') {
          navigate(-1);
        } else if (document.activeElement?.blur) {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === '?') {
        window.dispatchEvent(new CustomEvent('zeno-show-shortcuts'));
        return;
      }

      if (e.key === 'g') {
        gPendingRef.current = true;
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = setTimeout(() => {
          gPendingRef.current = false;
        }, 600);
        return;
      }

      if (gPendingRef.current) {
        gPendingRef.current = false;
        if (gTimeoutRef.current) {
          clearTimeout(gTimeoutRef.current);
          gTimeoutRef.current = null;
        }
        if (e.key === 'd') {
          navigate('/dashboard');
        } else if (e.key === 't') {
          navigate('/tasks');
        } else if (e.key === 'e') {
          navigate('/entities');
        } else if (e.key === 'r') {
          navigate('/reviews');
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [navigate, location.pathname]);
}
