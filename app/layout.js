import { Cairo } from "next/font/google";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPageMetadata } from "@/lib/siteMetadata";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export async function generateMetadata() {
  return getPageMetadata({
    title: "بيع وصيانة أجهزة الكمبيوتر",
    description:
      "وجهتك الأولى لشراء وصيانة الأجهزة التقنية مع المنتجات والصيانة والخدمات في واجهة ديناميكية وواضحة.",
  });
}

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={cairo.variable}>
        <ClientProviders>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </ClientProviders>
      </body>
    </html>
  );
}
