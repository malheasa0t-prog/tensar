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

  if (pathname && (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/admin"))) {
    return null;
  }

  const company = siteSettings.company;
  const contactItems = getContactMethods(siteSettings).slice(0, 4);
  const mobileContactItems = contactItems.slice(0, 2);
  const socialLinks = getSocialLinks(siteSettings);
  const navigation = siteSettings.navigation;
  const brandName = company.name || "TechZone";
  const brandMark = getBrandMark(brandName);

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="brand">
              <span className="brand-mark">{brandMark}</span>
              <span className="brand-text">{brandName}</span>
            </Link>

            <p>
              {company.slogan ||
                "متجرك التقني لشراء الأجهزة، الإكسسوارات، وخدمات الصيانة في الأردن بتجربة حديثة وواضحة من التصفح حتى الطلب."}
            </p>

            <div className="footer-payment">
              <span>دفع آمن ومريح</span>
              <div className="payment-icons">
                {siteSettings.paymentMethods.slice(0, 3).map((method) => (
                  <span key={method.value} className="footer-chip">
                    <AppIcon name={getPaymentIcon(method.value)} size={16} />
                    {method.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="footer-links-panel">
            <h4>تصفح سريع</h4>
            <div className="footer-link-columns">
              <div className="footer-link-group">
                <span className="footer-link-label">الأساسيات</span>
                <ul className="footer-links-list">
                  {navigation.footerQuick.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer-link-group">
                <span className="footer-link-label">الخدمات والمتابعة</span>
                <ul className="footer-links-list">
                  {navigation.footerSupport.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-contact-block">
            <div className="footer-contact-head">
              <h4>تواصل معنا</h4>
              <p>القنوات الأساسية في مكان واحد وبطريقة أخف بصريًا.</p>
            </div>

            <div className="footer-contact-stack">
              {contactItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="footer-contact-link"
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                >
                  <span className="footer-contact-icon">
                    <AppIcon name={item.icon} size={18} />
                  </span>
                  <span className="footer-contact-copy">
                    <span className="footer-contact-label">{item.label}</span>
                    <span className="footer-contact-value">{item.value}</span>
                  </span>
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
          <div className="footer-mobile-top">
            <Link href="/" className="brand">
              <span className="brand-mark">{brandMark}</span>
              <span className="brand-text">{brandName}</span>
            </Link>

            <p>
              {company.slogan ||
                "روابط أساسية وقنوات التواصل الأهم في نهاية سريعة وخفيفة تناسب الجوال."}
            </p>
          </div>

          <div className="footer-mobile-links">
            {navigation.mobilePrimary.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className="footer-mobile-link">
                <span>{item.label}</span>
                <AppIcon name="arrow-left" size={14} />
              </Link>
            ))}
          </div>

          {mobileContactItems.length > 0 ? (
            <div className="footer-mobile-contacts">
              {mobileContactItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="footer-mobile-contact"
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                >
                  <span className="footer-contact-icon">
                    <AppIcon name={item.icon} size={16} />
                  </span>
                  <span className="footer-mobile-contact-copy">
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </span>
                </a>
              ))}
            </div>
          ) : null}

          {socialLinks.length > 0 ? (
            <div className="footer-mobile-social">
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

        <div className="footer-bar">
          <p>&copy; {year} {brandName}. تجربة تقنية أوضح وأكثر احترافية.</p>
          <div className="footer-bar-links">
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
