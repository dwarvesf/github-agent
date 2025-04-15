"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Organizations" },
  { href: "/members", label: "Members" },
];

export const Header = () => {
  const pathname = usePathname();

  return (
    <header className="border-b bg-white p-4">
      <nav className="flex justify-center gap-4 text-sm">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`hover:text-primary font-medium transition-colors ${
              pathname === link.href ? "text-primary" : "text-gray-500"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
};
