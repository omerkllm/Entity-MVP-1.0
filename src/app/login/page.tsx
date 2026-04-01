'use client'

import { useState, Suspense } from 'react'
import axios, { AxiosError } from 'axios'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginContent() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/login', { username, password })
      const from = searchParams.get('from')
      if (from) {
        router.push(from)
      } else {
        const roleDefaults: Record<string, string> = {
          SA:  '/supply-chain-dashboard',
          SCA: '/supply-chain-dashboard',
          SC:  '/decision-making',
          WO:  '/inventory/warehousing',
        }
        router.push(roleDefaults[data.role] ?? '/supply-chain-dashboard')
      }
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError('Network error. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex">

      {/* Left sidebar */}
      <aside className="hidden sm:flex flex-col items-center justify-end border-r border-[#262626] bg-[#0c0c0c] w-[56px] shrink-0 py-4 px-2.5" />

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[320px] flex flex-col items-center gap-6">

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Entity"
            width={52}
            height={56}
            style={{ width: 52, height: 56 }}
            className="invert"
          />

          {/* Fields */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-400 tracking-[-0.03em] text-center">
                {error}
              </p>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1">
              <label className="text-sm tracking-[-0.03em] text-white font-normal">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                required
                className="w-full h-10 bg-[#111111] px-3 text-sm text-white tracking-[-0.03em] placeholder:text-[#959292] outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm tracking-[-0.03em] text-white font-normal">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  required
                  className="w-full h-10 bg-[#111111] px-3 text-sm text-white tracking-[-0.03em] placeholder:text-[#959292] outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>

              {/* Remember Me â€” real checkbox */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`w-3.5 h-3.5 rounded-[1.5px] border shrink-0 flex items-center justify-center transition-colors ${
                    rememberMe
                      ? 'bg-white border-white'
                      : 'bg-[#1b1b1b] border-[#444]'
                  }`}
                >
                  {rememberMe && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-black"/>
                    </svg>
                  )}
                </span>
                <span className="text-sm text-[#959292] tracking-[-0.03em]">
                  Remember Me
                </span>
              </label>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-white text-black text-sm tracking-[-0.03em] cursor-pointer hover:bg-neutral-100 active:bg-neutral-200 transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>

          </form>
        </div>
      </div>

    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
