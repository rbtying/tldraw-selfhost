import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { CONNECTION_STRING } from "./config";
import { getOrCreateDocAndToken } from "@y-sweet/sdk";
import { DirectoryProvider } from "./DirectoryProvider";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TLDraw",
  description: "TLDraw playground",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const directoryClientToken = await getOrCreateDocAndToken(
    CONNECTION_STRING,
    "dirtree"
  );
  return (
    <html lang="en">
      <body className={inter.className}>
        <DirectoryProvider directoryClientToken={directoryClientToken}>
          {children}
        </DirectoryProvider>
      </body>
    </html>
  );
}
