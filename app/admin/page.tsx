import type { Metadata } from "next";
import Studio from "@/components/Studio";

export const metadata: Metadata = {
  title: "Owner’s studio — Yudi Xu",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <Studio />;
}
