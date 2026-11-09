import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const sans = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-sans", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], style: ["italic"], axes: ["opsz"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://xyd.me"),
  title: "Yudi Xu — A little curious. Always building.",
  description:
    "An open notebook of things I build, places I go, and people I meet. Entrepreneur, tinkerer, and lifelong beginner.",
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
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
