"use client";

import Image from "next/image";

export default function Navbar() {
  return (
    <nav className="w-full py-4 px-6 flex items-center justify-between bg-white shadow-sm">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Liberty Social logo" width={40} height={40} className="rounded-full" priority />
        <h1 className="text-2xl font-bold text-primary">Liberty Social</h1>
      </div>
    </nav>
  );
}
