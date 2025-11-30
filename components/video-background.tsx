'use client'

export function VideoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 h-full w-full overflow-hidden" aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        poster="/9669050-hd_1920_1080_25fps.jpg"
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      >
        <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/git-blob/prj_TDwCNRq5OCm7JqknFlu0yKdTg8KX/PoecfVyPu6uuv93Ojgwm3V/public/9669050-hd_1920_1080_25fps.mp4" type="video/mp4" />
      </video>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/80 to-background/95"></div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl animate-pulse [animation-delay:1s]"></div>
    </div>
  )
}
