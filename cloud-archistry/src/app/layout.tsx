import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { FloatingHelpButton } from "@/components/floating-help-button";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Cloud Archistry - Master Cloud Architecture",
  description: "The world's first AI-powered cloud architecture training simulator. Learn AWS, GCP, and Azure through real-world scenarios.",
  keywords: ["AWS", "cloud", "training", "solutions architect", "certification", "learning", "simulator"],
  icons: {
    icon: [
      { url: "/favicon.png?v=3", type: "image/png" },
      { url: "/favicon.ico?v=3", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <FloatingHelpButton />
        </Providers>
      </body>
    </html>
  );
}
