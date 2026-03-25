"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import AppIcon from "./AppIcon";

function isFocusable(element) {
  return !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true";
}

export default function MobileMenu({ links, open, onClose }) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  function getFocusableElements() {
    if (!panelRef.current) return [];

    return Array.from(
      panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(isFocusable);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function" &&
        document.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus();
      }

      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frameId = window.requestAnimationFrame(() => {
      const focusableElements = getFocusableElements();

      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        return;
      }

      panelRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handleDocumentKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [open, onClose]);

  function handleKeyDown(event) {
    if (!open) return;

    if (event.key !== "Tab") return;

    const focusableElements = getFocusableElements();

    if (focusableElements.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const isInsidePanel =
      activeElement instanceof Node ? panelRef.current?.contains(activeElement) : false;

    if (!isInsidePanel) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
      return;
    }

    if (event.shiftKey && (activeElement === firstElement || activeElement === panelRef.current)) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div
      className={`mobile-overlay${open ? " open" : ""}`}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        tabIndex={-1}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
          >
            {link.label}
          </Link>
        ))}

        <Link
          href="/services"
          className="btn btn-orange"
          onClick={onClose}
          tabIndex={open ? 0 : -1}
          style={{ marginTop: "1rem" }}
        >
          <AppIcon name="zap" size={16} />
          احجز صيانة الآن
        </Link>
      </div>
    </div>
  );
}
