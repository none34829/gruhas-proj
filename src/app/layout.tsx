import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from './providers';
import GoogleScripts from './components/GoogleScripts';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Email Attachment Manager",
  description: "Manage and organize email attachments automatically",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <GoogleScripts />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
