"use client";

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import { formatCurrency } from "@/lib/formatCurrency";

const QuickDepositModal = lazy(() => import("@/components/QuickDepositModal"));

/**
 * Starts loading the quick-deposit modal before it is opened.
 *
 * @returns {void}
 */
function prefetchQuickDepositModal() {
  void import("@/components/QuickDepositModal");
}

/**
 * Displays the user's wallet balance with a quick-deposit action in the header.
 *
 * @param {{ balance: number, user: object | null }} props
 * @returns {JSX.Element | null}
 */
export default function HeaderWalletBadge({ balance = 0, user }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="header-wallet-badge">
        <Link href="/dashboard/wallet" className="header-wallet-amount" title="المحفظة">
          <AppIcon name="wallet" size={15} />
          <span>{formatCurrency(balance)}</span>
        </Link>
        <button
          type="button"
          className="header-wallet-add"
          onClick={() => setModalOpen(true)}
          onFocus={prefetchQuickDepositModal}
          onMouseEnter={prefetchQuickDepositModal}
          onTouchStart={prefetchQuickDepositModal}
          aria-label="إيداع رصيد"
          title="إيداع رصيد"
        >
          <AppIcon name="plus" size={14} />
        </button>
      </div>

      {modalOpen ? (
        <Suspense fallback={null}>
          <QuickDepositModal onClose={() => setModalOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
