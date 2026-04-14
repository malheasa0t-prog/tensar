"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { PUBLIC_ANALYTICS_CONFIG } from "@/lib/publicAnalyticsConfig";
import { trackPageView } from "@/lib/analyticsModel";

/**
 * Loads the configured analytics providers and tracks route changes.
 *
 * @returns {JSX.Element | null}
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView({
      config: PUBLIC_ANALYTICS_CONFIG,
      pathname,
      search: typeof window === "undefined" ? "" : window.location.search,
    });
  }, [pathname]);

  if (!PUBLIC_ANALYTICS_CONFIG.hasAnyProvider) {
    return null;
  }

  return (
    <>
      {PUBLIC_ANALYTICS_CONFIG.gaMeasurementId ? (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${PUBLIC_ANALYTICS_CONFIG.gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-inline" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              window.gtag = window.gtag || gtag;
              window.gtag('js', new Date());
              window.gtag('config', '${PUBLIC_ANALYTICS_CONFIG.gaMeasurementId}', {
                send_page_view: false
              });
            `}
          </Script>
        </>
      ) : null}

      {PUBLIC_ANALYTICS_CONFIG.facebookPixelId ? (
        <Script id="meta-pixel-inline" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){
              if(f.fbq){return;}
              n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq){f._fbq=n;}
              n.push=n;
              n.loaded=!0;
              n.version='2.0';
              n.queue=[];
              t=b.createElement(e);
              t.async=!0;
              t.src=v;
              s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s);
            }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            window.fbq('init', '${PUBLIC_ANALYTICS_CONFIG.facebookPixelId}');
          `}
        </Script>
      ) : null}

      {PUBLIC_ANALYTICS_CONFIG.hotjarId ? (
        <Script id="hotjar-inline" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${JSON.stringify(PUBLIC_ANALYTICS_CONFIG.hotjarId)},hjsv:${JSON.stringify(PUBLIC_ANALYTICS_CONFIG.hotjarVersion)}};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');
              r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      ) : null}
    </>
  );
}
