"use client";

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Heart, User } from 'lucide-react'
import { cn } from 'cn'

const navItems = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/matches', label: 'Matches', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-50">
      <div className="max-w-2xl mx-auto flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const href = item.href
          const active = pathname === href || pathname?.startsWith(href + '/')
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-1 rounded-md text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}