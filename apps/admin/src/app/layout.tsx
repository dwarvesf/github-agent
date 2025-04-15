import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Admin",
  description: "Admin panel for the app",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <Header />
        <TRPCReactProvider>
          <main className="container mx-auto max-w-2xl p-6">{children}</main>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
