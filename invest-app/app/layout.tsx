import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invest Platform",
  description: "Gerenciamento inteligente de investimentos em ações",
};

import Navbar from "./components/Navbar";
import StockTicker from "./components/StockTicker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="mt-16">
            <StockTicker />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
