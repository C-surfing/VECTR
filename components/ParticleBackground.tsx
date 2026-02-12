
import React, { useEffect, useRef } from 'react';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Array<{ 
      x: number; 
      y: number; 
      size: number; 
      speedX: number; 
      speedY: number; 
      color: string;
      opacity: number;
      fadeSpeed: number;
      type: 'point' | 'bokeh';
    }> = [];
    
    const pointCount = 60;
    const bokehCount = 15;

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      
      // Point particles (sharp, small dots)
      for (let i = 0; i < pointCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.2,
          speedX: (Math.random() - 0.5) * 0.2,
          speedY: (Math.random() - 0.5) * 0.2,
          color: Math.random() > 0.5 ? 'rgba(34, 211, 238,' : 'rgba(139, 92, 246,',
          opacity: Math.random(),
          fadeSpeed: 0.002 + Math.random() * 0.005,
          type: 'point'
        });
      }

      // Bokeh particles (large, blurry glowing orbs)
      for (let i = 0; i < bokehCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 80 + 40,
          speedX: (Math.random() - 0.5) * 0.1,
          speedY: (Math.random() - 0.5) * 0.1,
          color: Math.random() > 0.5 ? 'rgba(147, 197, 253,' : 'rgba(196, 181, 253,',
          opacity: Math.random() * 0.3,
          fadeSpeed: 0.001 + Math.random() * 0.002,
          type: 'bokeh'
        });
      }
    };

    const drawParticles = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw bokeh first (background layer)
      particles.forEach(p => {
        if (p.type !== 'bokeh') return;
        
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.fadeSpeed;
        if (p.opacity > 0.3 || p.opacity < 0.05) p.fadeSpeed *= -1;

        if (p.x < -p.size) p.x = canvas.width + p.size;
        if (p.x > canvas.width + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = canvas.height + p.size;
        if (p.y > canvas.height + p.size) p.y = -p.size;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `${p.color} ${p.opacity * 0.4})`);
        gradient.addColorStop(1, `${p.color} 0)`);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // Draw points and connections
      particles.forEach((p, i) => {
        if (p.type !== 'point') return;

        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity += p.fadeSpeed;
        if (p.opacity > 0.8 || p.opacity < 0.2) p.fadeSpeed *= -1;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity * 0.6})`;
        ctx.shadowBlur = 10 * p.opacity;
        ctx.shadowColor = `${p.color} 0.8)`;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset for performance

        // Subtle connections
        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            if (p2.type !== 'point') continue;

            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 120) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(147, 197, 253, ${(1 - distance/120) * 0.08 * p.opacity})`;
                ctx.lineWidth = 0.5;
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
      });
      
      requestAnimationFrame(drawParticles);
    };

    init();
    drawParticles();
    
    const handleResize = () => init();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />;
};

export default ParticleBackground;
