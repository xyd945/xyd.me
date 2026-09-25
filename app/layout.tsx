import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xyd.me"),
  title: "Yudi Xu — A little curious. Always building.",
  description:
    "An open notebook of things I build, places I go, and people I meet. Entrepreneur, tinkerer, and lifelong beginner.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Yudi Xu — A little curious. Always building.",
    description: "Things I build. Places I go. People I meet.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
