import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { withBasePath } from "@/lib/config/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hello! My Paso!",
  description: "Local-first journal for places, visits, reviews, and XP.",
  applicationName: "Hello! My Paso!",
  manifest: withBasePath("/manifest.webmanifest"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isMobileBuild = process.env.MY_PASO_BUILD_TARGET === "mobile";
  const serviceWorkerPath = withBasePath("/sw.js");

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {!isMobileBuild ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `if("serviceWorker"in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register(${JSON.stringify(serviceWorkerPath)})})}`,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
