"use client";

import ThemeProvider from "@/components/ThemeProvider";
import ToastProvider from "@/components/ToastProvider";
import CartProvider from "@/components/CartProvider";
import CartSidebar from "@/components/CartSidebar";

import BackToTop from "@/components/BackToTop";
import Preloader from "@/components/Preloader";

export default function ClientProviders({ children }) {
  return (
    <ThemeProvider>
      <CartProvider>
        <ToastProvider>
          <Preloader />
          {children}
          <CartSidebar />
          <BackToTop />
        </ToastProvider>
      </CartProvider>
    </ThemeProvider>
  );
}
