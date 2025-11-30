'use client'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        {/* Animated spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
          <div 
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-500 animate-spin"
            style={{
              animation: 'spin 1s linear infinite'
            }}
          ></div>
        </div>
        <p className="text-cyan-400 text-sm font-medium">Loading...</p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
