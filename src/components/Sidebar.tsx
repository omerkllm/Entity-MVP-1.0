'use client'

import Link from 'next/link'
import api from '@/lib/api'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

// Pages each role is allowed to see
const ROLE_ROUTES: Record<string, string[]> = {
  SA:  ['/supply-chain-dashboard', '/inventory', '/decision-making'],
  SCA: ['/supply-chain-dashboard'],
  SC:  ['/decision-making', '/inventory'],
  WO:  ['/inventory'],
}

function NavIcon({ src, alt, href, active, onClick }: { src: string; alt: string; href: string; active?: boolean; onClick?: () => void }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-center p-1.5 cursor-pointer transition-colors rounded-[3px] bg-[#151515] hover:bg-[#1e1e1e]`}
        aria-label={alt}
        title={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={18}
          height={18}
          style={{ width: 18, height: 18 }}
          className="invert"
        />
      </button>
    )
  }

  return (
    <Link
      href={href}
      className={`w-full flex items-center justify-center p-1.5 cursor-pointer transition-colors rounded-[3px]
        ${active
          ? 'bg-[#1e1e1e]'
          : 'bg-[#151515] hover:bg-[#1e1e1e]'
        }`}
      aria-label={alt}
      title={alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={18}
        height={18}
        style={{ width: 18, height: 18 }}
        className="invert"
      />
    </Link>
  )
}

function readRoleCookie(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)entity-role=([^;]*)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  // Start null on both server and client to avoid hydration mismatch,
  // then read the cookie in a layout effect so nav icons appear immediately.
  const [role, setRole] = useState<string | null>(null)

  // Read cookie after first client render (safe — no SSR mismatch)
  useEffect(() => {
    const r = readRoleCookie()
    if (r) setRole(r)
  }, [])

  // Keep in sync if cookie changes later (e.g. after refresh token rotation)
  useEffect(() => {
    const r = readRoleCookie()
    if (r && r !== role) setRole(r)
  }, [role])

  const canAccess = useCallback((prefix: string) => {
    if (!role) return false
    return (ROLE_ROUTES[role] ?? []).some(p => p === prefix || p.startsWith(prefix))
  }, [role])

  const handleLogout = useCallback(async () => {
    await api.post('/api/auth/logout')
    router.push('/login')
  }, [router])

  return (
    <aside className="w-[44px] shrink-0 flex flex-col border-r border-[#1e1e1e] bg-[#080808]">
      {/* Logo */}
      <div className="h-[38px] flex items-center justify-center border-b border-[#1e1e1e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.svg" alt="Entity" width={18} height={20} style={{ width: 18, height: 20 }} className="invert" />
      </div>

      {/* Top nav icons */}
      <div className="flex flex-col gap-1.5 px-1.5 pt-2 flex-1">
        {canAccess('/supply-chain-dashboard') && (
          <NavIcon src="/icons/nav-iw.svg"   alt="Supply Chain Dashboard"  href="/supply-chain-dashboard"  active={pathname === '/supply-chain-dashboard'} />
        )}
        {canAccess('/inventory') && (
          <NavIcon src="/icons/nav-code.svg" alt="Inventory / Warehousing" href="/inventory"                active={pathname.startsWith('/inventory')} />
        )}
        {canAccess('/decision-making') && (
          <NavIcon src="/icons/nav-ai.svg"   alt="Decision Making Portal"  href="/decision-making"          active={pathname.startsWith('/decision-making')} />
        )}
      </div>

      {/* Bottom nav icons */}
      <div className="flex flex-col gap-1.5 px-1.5 pb-2">
        <NavIcon src="/icons/nav-logout.svg"   alt="Logout"   href="#" onClick={handleLogout} />
        <NavIcon src="/icons/nav-settings.svg" alt="Settings" href="#" />
      </div>
    </aside>
  )
}
