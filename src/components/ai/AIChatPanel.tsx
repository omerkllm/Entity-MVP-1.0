'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { AIAgentConfig } from '@/lib/data/types'

/* ─── Icon paths (public/icons/ai/) ─────────────────────────────── */
const ICON_SEND     = '/icons/ai/send-arrow.svg'

/* ─── Constants ─────────────────────────────────────────────────── */
const MAX_VISIBLE_LINES = 5
const LINE_HEIGHT_PX    = 20
const PADDING_PX        = 24
const MAX_INPUT_HEIGHT  = MAX_VISIBLE_LINES * LINE_HEIGHT_PX + PADDING_PX

/* ─── Props ─────────────────────────────────────────────────────── */
// ISP: only the three fields actually consumed are required, so callers don't
// have to construct (or fetch) the full AIAgentConfig just to render the panel.
export type AIChatPanelConfig = Pick<AIAgentConfig, 'agentName' | 'greeting' | 'inputPlaceholder'>

export interface AIChatPanelProps {
  config: AIChatPanelConfig
}

/* ═══════════════════════════════════════════════════════════════════
   AI Chat Panel
   ═══════════════════════════════════════════════════════════════════ */
export default function AIChatPanel({ config }: AIChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [messages] = useState<import('@/lib/data/types').AgentMessage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* ── Auto-resize textarea ────────────────────────────────────── */
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const scrollH = el.scrollHeight
    if (scrollH > MAX_INPUT_HEIGHT) {
      el.style.height = `${MAX_INPUT_HEIGHT}px`
      el.style.overflowY = 'auto'
    } else {
      el.style.height = `${scrollH}px`
      el.style.overflowY = 'hidden'
    }
  }, [inputValue])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }, [])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">

      {/* ── Chat message body ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col relative min-h-0">
        {!hasMessages ? (
          /* ── Empty state — absolutely centered so it doesn't shift when input grows ── */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 pointer-events-none">
            <svg viewBox="0 0 22.3325 17.6874" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 22 }} className="text-[#444]">
              <path d="M15.2679 0C15.2679 1.84064 14.8322 3.65514 13.9966 5.29516C13.161 6.93518 11.9491 8.35415 10.4599 9.43605C8.97084 10.518 7.24682 11.2321 5.42884 11.52C3.61086 11.8079 1.75055 11.6615 0 11.0927L1.80213 5.54637C2.6774 5.83077 3.60756 5.90397 4.51655 5.76C5.42553 5.61603 6.28754 5.25898 7.0321 4.71803C7.77665 4.17708 8.38261 3.46759 8.80042 2.64758C9.21824 1.82757 9.43605 0.920319 9.43605 0H15.2679Z"/>
              <path d="M7.06467 17.6874C7.06467 15.8468 7.50029 14.0323 8.33592 12.3923C9.17155 10.7522 10.3835 9.33328 11.8726 8.25138C13.3617 7.16948 15.0857 6.45537 16.9037 6.16743C18.7217 5.87949 20.582 6.0259 22.3325 6.59469L20.5304 12.1411C19.6551 11.8567 18.725 11.7835 17.816 11.9274C16.907 12.0714 16.045 12.4285 15.3004 12.9694C14.5559 13.5104 13.9499 14.2198 13.5321 15.0399C13.1143 15.8599 12.8965 16.7671 12.8965 17.6874H7.06467Z"/>
            </svg>
            <p className="text-[12px] tracking-[-0.02em] text-[#555] text-center leading-relaxed">
              Ask the Parser Agent about disruptions, simulations, or procurement.
            </p>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="flex flex-col gap-4 px-4 py-4">
            {messages.map((msg, msgIdx) => (
              <div key={msgIdx} className="flex flex-col gap-2.5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] tracking-[-0.03em] font-medium text-[#2969FF]">
                    {msg.role === 'agent' ? config.agentName : 'You'}
                  </span>
                  <span className="text-[11px] tracking-[-0.03em] text-[#F38686] bg-[#2e1414] px-1.5 py-0.5 rounded-[3px]">
                    {msg.label}
                  </span>
                </div>

                {/* User message */}
                {msg.role === 'user' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[13px] tracking-[-0.03em] text-[#888] leading-relaxed">
                      {config.greeting}
                    </p>
                    {msg.branch && (
                      <div className="rounded-[4px] bg-[#1a1600] border-l-[3px] border-[#f9a825] px-3 py-2">
                        <span className="text-[12px] tracking-[-0.03em] text-[#f9c74f] font-medium">
                          @{msg.branch.name} {`{${msg.branch.type}}`}
                        </span>
                      </div>
                    )}
                    <p className="text-[13px] tracking-[-0.03em] text-[#999] leading-relaxed whitespace-pre-line">
                      {msg.content}
                    </p>
                  </div>
                )}

                {/* Agent response */}
                {msg.role === 'agent' && (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[13px] tracking-[-0.03em] text-[#999] leading-relaxed whitespace-pre-line">
                      {msg.summary}
                    </p>
                    {msg.options?.map((option) => (
                      <div
                        key={option.id}
                        className="rounded-[4px] border-l-[3px] px-3 py-2.5 flex flex-col gap-2"
                        style={{
                          borderColor: option.color,
                          backgroundColor: `color-mix(in srgb, ${option.color} 8%, transparent)`,
                        }}
                      >
                        <span className="text-[12px] tracking-[-0.03em] font-medium" style={{ color: option.color }}>
                          {option.title}
                        </span>
                        <ul className="flex flex-col gap-1">
                          {option.points.map((point, pIdx) => (
                            <li key={pIdx} className="text-[12px] tracking-[-0.03em] text-[#999] leading-relaxed flex gap-1.5">
                              <span className="shrink-0 mt-[2px] text-[8px]">●</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {typeof msg.progress === 'number' && (
                      <div className="w-full h-[3px] bg-[#1e1e1e] rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-[#2969FF] rounded-full transition-all" style={{ width: `${msg.progress * 100}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div />
          </div>
        )}
      </div>

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="shrink-0 p-3 pt-0">
<div className="flex flex-col border border-[#2a2a2a] bg-[#141414] rounded-[12px] shadow-[0_-1px_6px_rgba(0,0,0,0.2)] overflow-hidden">

          {/* Textarea */}
          <div className="px-3.5 pt-3 pb-1.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              placeholder={config.inputPlaceholder}
              className="w-full bg-transparent text-[12px] tracking-[-0.02em] text-[#999] outline-none placeholder:text-[#555] resize-none leading-[20px] scrollbar-hide"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{ minHeight: `${LINE_HEIGHT_PX}px`, maxHeight: `${MAX_INPUT_HEIGHT}px` }}
            />
          </div>

          {/* Toolbar — separator + actions */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[#222]">
            <div className="flex items-center gap-2">

              {/* @ mention */}
              <button className="flex items-center justify-center w-6 h-6 rounded-[5px] hover:bg-[#1f1f1f] transition-colors cursor-pointer text-[#888]" title="Mention">
                <svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 13, height: 13 }}>
                  <path d="M10.5 14C12.433 14 14 12.433 14 10.5C14 8.567 12.433 7 10.5 7C8.567 7 7 8.567 7 10.5C7 12.433 8.567 14 10.5 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 10.5V11.75C14 12.413 14.2634 13.0489 14.7322 13.5178C15.2011 13.9866 15.837 14.25 16.5 14.25C17.163 14.25 17.7989 13.9866 18.2678 13.5178C18.7366 13.0489 19 12.413 19 11.75V10.5C19 8.31196 18.1308 6.21354 16.5836 4.66637C15.0365 3.11919 12.938 2.25 10.75 2.25C8.56196 2.25 6.46354 3.11919 4.91637 4.66637C3.36919 6.21354 2.5 8.31196 2.5 10.5C2.5 12.688 3.36919 14.7865 4.91637 16.3336C6.46354 17.8808 8.56196 18.75 10.75 18.75C12.1 18.75 13.4 18.4 14.55 17.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Agent selector */}
              <button className="flex items-center gap-[4px] h-6 px-1 rounded-[5px] hover:bg-[#1f1f1f] transition-colors cursor-pointer text-[#888]" title="Select Agent">
                <svg viewBox="0 0 22.3325 17.6874" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ width: 13, height: 10 }}>
                  <path d="M15.2679 0C15.2679 1.84064 14.8322 3.65514 13.9966 5.29516C13.161 6.93518 11.9491 8.35415 10.4599 9.43605C8.97084 10.518 7.24682 11.2321 5.42884 11.52C3.61086 11.8079 1.75055 11.6615 0 11.0927L1.80213 5.54637C2.6774 5.83077 3.60756 5.90397 4.51655 5.76C5.42553 5.61603 6.28754 5.25898 7.0321 4.71803C7.77665 4.17708 8.38261 3.46759 8.80042 2.64758C9.21824 1.82757 9.43605 0.920319 9.43605 0H15.2679Z"/>
                  <path d="M7.06467 17.6874C7.06467 15.8468 7.50029 14.0323 8.33592 12.3923C9.17155 10.7522 10.3835 9.33328 11.8726 8.25138C13.3617 7.16948 15.0857 6.45537 16.9037 6.16743C18.7217 5.87949 20.582 6.0259 22.3325 6.59469L20.5304 12.1411C19.6551 11.8567 18.725 11.7835 17.816 11.9274C16.907 12.0714 16.045 12.4285 15.3004 12.9694C14.5559 13.5104 13.9499 14.2198 13.5321 15.0399C13.1143 15.8599 12.8965 16.7671 12.8965 17.6874H7.06467Z"/>
                </svg>
                <span className="text-[11px] tracking-[-0.01em] font-medium whitespace-nowrap">Agent</span>
                <svg viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 7, height: 4 }}>
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Simulation selector */}
              <button className="flex items-center gap-[4px] h-6 px-1 rounded-[5px] hover:bg-[#1f1f1f] transition-colors cursor-pointer text-[#888]" title="Select Simulation">
                <span className="text-[11px] tracking-[-0.01em] font-medium whitespace-nowrap">Parser 1.0</span>
                <svg viewBox="0 0 12 7" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 7, height: 4 }}>
                  <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Send */}
            <button
              className={`flex items-center justify-center w-6 h-6 rounded-[5px] transition-colors cursor-pointer ${
                inputValue.trim()
                  ? 'bg-white'
                  : 'bg-[#2a2a2a]'
              }`}
              title="Send"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ICON_SEND}
                alt="Send"
                className={`${inputValue.trim() ? 'invert-0' : 'opacity-40 invert'}`}
                style={{ width: 10, height: 12 }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
