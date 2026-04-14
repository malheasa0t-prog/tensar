import { Cairo, Inter } from "next/font/google";
import { Suspense } from "react";
import "./site.css";
import ClientProviders from "@/components/ClientProviders";
import PageTransitionShell from "@/components/PageTransitionShell";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getPublicSiteSnapshot } from "@/lib/publicSiteSnapshot";
import { getPageMetadata } from "@/lib/siteMetadata";
import AiChatbot from "@/components/AiChatbot";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata() {
  return getPageMetadata({
    title: "بيع وصيانة أجهزة الكمبيوتر",
    description:
      "وجهتك الأولى لشراء وصيانة الأجهزة التقنية مع المنتجات والصيانة والخدمات في واجهة ديناميكية وواضحة.",
    icons: {
      icon: "/favicon.svg",
    },
  });
}

export default async function RootLayout({ children }) {
  const { dynamicLinks, siteSettings } = await getPublicSiteSnapshot();

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${inter.variable}`}>
        <ClientProviders
          initialDynamicLinks={dynamicLinks}
          initialSiteSettings={siteSettings}
        >
          <a href="#main-content" className="skip-link">
            تجاوز إلى المحتوى
          </a>
          <SiteHeader />
          <Suspense fallback={<div id="main-content">{children}</div>}>
            <div id="main-content">
              <PageTransitionShell>{children}</PageTransitionShell>
            </div>
          </Suspense>
          <SiteFooter siteSettings={siteSettings} />
          <AiChatbot />
        </ClientProviders>
      </body>
    </html>
  );
}
