"use client";

import { useEffect, useState } from "react";
import styles from "./SuccessConfetti.module.css";

const CONFETTI_HIDE_DELAY_MS = 2200;
const CONFETTI_PIECES = [
  { color: "#00d9ff", delay: "0ms", duration: "1500ms", left: "6%", rotation: "-18deg", size: "10px" },
  { color: "#ff4fd8", delay: "80ms", duration: "1620ms", left: "12%", rotation: "22deg", size: "14px" },
  { color: "#ffd166", delay: "40ms", duration: "1700ms", left: "18%", rotation: "-28deg", size: "12px" },
  { color: "#8b5cf6", delay: "140ms", duration: "1580ms", left: "24%", rotation: "16deg", size: "11px" },
  { color: "#22c55e", delay: "30ms", duration: "1740ms", left: "31%", rotation: "-12deg", size: "13px" },
  { color: "#38bdf8", delay: "120ms", duration: "1640ms", left: "37%", rotation: "25deg", size: "9px" },
  { color: "#f97316", delay: "10ms", duration: "1550ms", left: "44%", rotation: "-22deg", size: "12px" },
  { color: "#f43f5e", delay: "160ms", duration: "1780ms", left: "49%", rotation: "20deg", size: "10px" },
  { color: "#14b8a6", delay: "60ms", duration: "1680ms", left: "54%", rotation: "-26deg", size: "15px" },
  { color: "#a855f7", delay: "130ms", duration: "1510ms", left: "60%", rotation: "18deg", size: "11px" },
  { color: "#facc15", delay: "20ms", duration: "1760ms", left: "66%", rotation: "-20deg", size: "13px" },
  { color: "#06b6d4", delay: "100ms", duration: "1590ms", left: "72%", rotation: "24deg", size: "10px" },
  { color: "#fb7185", delay: "55ms", duration: "1710ms", left: "78%", rotation: "-16deg", size: "12px" },
  { color: "#22c55e", delay: "180ms", duration: "1660ms", left: "84%", rotation: "21deg", size: "10px" },
  { color: "#60a5fa", delay: "90ms", duration: "1730ms", left: "91%", rotation: "-24deg", size: "14px" },
];

/**
 * Displays a lightweight celebratory confetti overlay when an order succeeds.
 *
 * @param {{ activeKey?: string }} props
 * @returns {JSX.Element | null}
 */
export default function SuccessConfetti({ activeKey = "" }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!activeKey) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
    }, CONFETTI_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeKey]);

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.overlay} aria-hidden="true">
      <span className={styles.burst} />
      <span className={`${styles.burst} ${styles.burstAlt}`} />
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          key={`${activeKey}-${index}`}
          className={index % 3 === 0 ? styles.pieceDot : styles.piece}
          style={{
            "--confetti-color": piece.color,
            "--confetti-delay": piece.delay,
            "--confetti-duration": piece.duration,
            "--confetti-left": piece.left,
            "--confetti-rotation": piece.rotation,
            "--confetti-size": piece.size,
          }}
        />
      ))}
    </div>
  );
}
