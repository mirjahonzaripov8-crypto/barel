import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      containerRef.current.style.setProperty('--mx', `${x * 30 - 15}px`);
      containerRef.current.style.setProperty('--my', `${y * 30 - 15}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="animated-bg-container">
      {/* Layer 1: Gradient */}
      <div className="animated-bg-gradient" />
      {/* Layer 2: Blobs */}
      <div className="animated-bg-blob blob-1" />
      <div className="animated-bg-blob blob-2" />
      <div className="animated-bg-blob blob-3" />
      <div className="animated-bg-blob blob-4" />
      {/* Layer 3: Particles */}
      <div className="animated-bg-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 15}s`,
              animationDuration: `${12 + Math.random() * 18}s`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              opacity: 0.2 + Math.random() * 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
