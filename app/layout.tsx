import type { Metadata } from "next";
import { Archivo, Big_Shoulders, Kaushan_Script } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
});

// Brush lettering for the statement section, like Phive's "push your limits" (Phive uses the paid Pure Heart).
const script = Kaushan_Script({
  variable: "--font-kaushan",
  subsets: ["latin"],
  weight: "400",
});

const body = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Golden Hour Fitness Planet | Gym in Saddar Cantt, Lahore",
  description:
    "House of Beasts. Free weights, personal training and women's sessions at 305 Sagar Road, Saddar Cantt, Lahore.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${script.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
