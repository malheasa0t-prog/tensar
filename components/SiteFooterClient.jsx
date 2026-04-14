"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "./AppIcon";
import {
  getBrandMark,
  getContactMethods,
  getSocialLinks,
} from "@/lib/contactChannels";

function getPaymentIcon(value = "") {
  const key = String(value).toLowerCase();

  if (key.includes("wallet") || key.includes("apple")) {
    return "wallet";
  }

  if (key.includes("cod") || key.includes("pickup") || key.includes("cash")) {
    return "store";
  }

  return "credit-card";
}

export default function SiteFooterClient({ siteSettings }) {
  const year = new Date().getFullYear();
  const pathname = usePathname();

  if (pathname && pathname.startsWith("/admin")) {
    return null;
  }

  const company = siteSettings.company;
  const contactItems = getContactMethods(siteSettings).slice(0, 3);
  const socialLinks = getSocialLinks(siteSettings).slice(0, 5);
  const navigation = siteSettings.navigation;
  const brandName = company.name || "TechFix";
  const brandMark = getBrandMark(brandName);

  return (
    <footer className="site-footer">
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.75rem',
          marginTop: '0.5rem'
        }}>
          {socialLinks.filter((item) => item?.key !== "youtube" && item?.label !== "YouTube").map((item) => (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="contact-social-card"
              style={{
                minHeight: 'auto',
                padding: '0.75rem 1rem',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <span className="contact-social-icon" style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                <AppIcon name={item.icon} size={18} />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#f8f4ff' }}>{item.label}</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {item.description || 'تواصل لدعم أسرع ومعلومات أكثر.'}
                </p>
              </div>
            </a>
          ))}
        </div>

        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <span className="brand-mark">{brandMark}</span>
              <span className="brand-text">{brandName}</span>
            </Link>

            <p>
              {company.slogan ||
                "حلول تقنية متكاملة لشراء الأجهزة والإكسسوارات وخدمات الصيانة ضمن تجربة أكثر وضوحًا واحترافية."}
            </p>

            <div className="techfix-meta">
              {siteSettings.paymentMethods.slice(0, 3).map((method) => (
                <span key={method.value}>
                  <AppIcon name={getPaymentIcon(method.value)} size={14} />
                  {method.label}
                </span>
              ))}
            </div>
          </div>

          <div className="footer-links-panel">
            <h3>روابط سريعة</h3>
            <div className="footer-link-columns">
              <ul className="footer-links-list">
                {navigation.footerQuick.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>

              <ul className="footer-links-list">
                {navigation.footerSupport.map((item) => (
                  <li key={`${item.href}-${item.label}`}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="footer-contact-block">
            <h3>تواصل معنا</h3>
            <div className="footer-contact-stack">
              {contactItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="footer-contact-link"
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                >
                  <span className="contact-detail-icon">
                    <AppIcon name={item.icon} size={16} />
                  </span>
                  <span>{item.value}</span>
                </a>
              ))}
            </div>

            {socialLinks.length > 0 ? (
              <div className="footer-social-strip">
                <span>تابعنا</span>
                <div className="social-row">
                  {socialLinks.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="social-icon"
                      title={item.label}
                      aria-label={item.label}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <AppIcon name={item.icon} size={16} />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="footer-mobile-sheet">
          <Link href="/" className="brand">
            <span className="brand-mark">{brandMark}</span>
            <span className="brand-text">{brandName}</span>
          </Link>

          <div className="footer-mobile-links">
            {navigation.mobilePrimary.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className="footer-mobile-link">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="footer-bar">
          <p>&copy; {year} {brandName}. تجربة تقنية أوضح وأكثر احترافية.</p>
          <div className="social-row">
            {navigation.footerBar.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
