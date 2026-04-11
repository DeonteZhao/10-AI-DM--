import type { Metadata } from "next";
import { headers } from "next/headers";
import { VT323 } from "next/font/google";
import "./globals.css";
import { BetaAccessGate } from "@/components/BetaAccessGate";
import { Navbar } from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BETA_ACCESS_STATE_HEADER, isLocalBetaAccessBypassed } from "@/lib/beta-access";

const vt323 = VT323({ weight: '400', subsets: ["latin"], variable: '--font-vt323' });

export const metadata: Metadata = {
  title: "Dice Tales",
  description: "复古跑团记录",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAccessGranted = isLocalBetaAccessBypassed() || headers().get(BETA_ACCESS_STATE_HEADER) === "verified";

  return (
    <html lang="zh">
      <body className={`${vt323.variable} font-serif`} data-theme="hub">
        
        {/* SVG 滤镜定义区 (隐藏) */}
        <svg style={{ display: 'none' }}>
          <defs>
            <filter id="rough-edge">
              <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
            </filter>
            <filter id="print-effect">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.25" result="blur" />
            </filter>
          </defs>
        </svg>

        {/* 噪点遮罩 */}
        <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.12] mix-blend-multiply bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E')]" />
        
        <div className="relative z-10 print-effect-container">
          <ThemeProvider>
            <BetaAccessGate initialAccessGranted={initialAccessGranted}>
              <Navbar />
              {children}
            </BetaAccessGate>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
