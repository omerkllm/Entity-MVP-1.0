export default function MapKeyMissing() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black">
      <span className="text-[13px] tracking-[-0.03em] text-[#888]">
        Map requires <code className="text-[#2969FF]">NEXT_PUBLIC_MAPTILER_KEY</code> in <code>.env.local</code>
      </span>
      <a
        href="https://cloud.maptiler.com/account/keys/"
        target="_blank"
        rel="noreferrer"
        className="text-[12px] tracking-[-0.03em] text-[#2969FF] underline"
      >
        Get a free Maptiler key (100k loads/month)
      </a>
    </div>
  )
}
