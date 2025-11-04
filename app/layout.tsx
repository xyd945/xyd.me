import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XYD.me",
  description: "What important truth do very few people agree with you on?",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
