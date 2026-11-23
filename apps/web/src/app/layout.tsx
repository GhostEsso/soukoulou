import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Même police que l’app KABA client.
const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Soukoulou", template: "%s · Soukoulou" },
  description: "La gestion scolaire simple, pour chaque école.",
  // PWA iOS : plein écran une fois ajoutée à l'écran d'accueil.
  appleWebApp: { capable: true, title: "Soukoulou", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#2346c8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${urbanist.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        <SerwistProvider swUrl="/serwist/sw.js">
          <TooltipProvider>{children}</TooltipProvider>
        </SerwistProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
