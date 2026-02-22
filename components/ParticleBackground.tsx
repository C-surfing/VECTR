import React, { useCallback, useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  vx: number;
  vy: number;
};

const prefersLiteEffects = (): boolean => {
  if (typeof window === 'undefined') return false;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const saveData = Boolean(connection?.saveData);
  return reducedMotion || saveData;
};

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((event: MouseEvent) => {
    mouseRef.current.x = event.clientX;
    mouseRef.current.y = event.clientY;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const liteEffects = prefersLiteEffects();
    const targetFps = liteEffects ? 20 : 30;
    const frameDuration = 1000 / targetFps;
    const particleCount = liteEffects ? 5 : 8;
    const imageAlpha = liteEffects ? 0.24 : 0.35;
    const imageBlur = liteEffects ? 8 : 12;

    let hasImageLoaded = false;
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    bgImage.src = 'https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/pexels-diva-32633935.jpg';
    bgImage.onload = () => {
      hasImageLoaded = true;
    };
    bgImage.onerror = () => {
      hasImageLoaded = false;
    };

    let particles: Particle[] = [];
    let animationId = 0;
    let lastFrameTime = 0;
    let time = 0;

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, liteEffects ? 1 : 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 100 + 50,
        opacity: Math.random() * 0.15 + 0.05,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
      }));
    };

    const draw = (timestamp: number) => {
      animationId = window.requestAnimationFrame(draw);

      if (document.hidden) return;
      if (timestamp - lastFrameTime < frameDuration) return;
      const delta = lastFrameTime ? (timestamp - lastFrameTime) / 16.67 : 1;
      lastFrameTime = timestamp;

      time += 0.01 * delta;
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      if (hasImageLoaded && bgImage.complete) {
        ctx.save();
        ctx.globalAlpha = imageAlpha;
        ctx.filter = `blur(${imageBlur}px)`;
        const scale = Math.max(window.innerWidth / bgImage.width, window.innerHeight / bgImage.height);
        const x = (window.innerWidth - bgImage.width * scale) / 2;
        const y = (window.innerHeight - bgImage.height * scale) / 2;
        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
        ctx.restore();
      }

      particles.forEach((particle) => {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        if (particle.x < -particle.radius * 2) particle.x = window.innerWidth + particle.radius;
        if (particle.x > window.innerWidth + particle.radius * 2) particle.x = -particle.radius;
        if (particle.y < -particle.radius * 2) particle.y = window.innerHeight + particle.radius;
        if (particle.y > window.innerHeight + particle.radius * 2) particle.y = -particle.radius;
      });

      particles.forEach((particle) => {
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius,
        );
        const hue = (particle.x / Math.max(window.innerWidth, 1)) * 60 + 240;
        gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, ${particle.opacity})`);
        gradient.addColorStop(0.5, `hsla(${hue}, 70%, 60%, ${particle.opacity * 0.3})`);
        gradient.addColorStop(1, `hsla(${hue}, 70%, 60%, 0)`);

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen';
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';

      const cornerGlow = (x: number, y: number, size: number, hue: number) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.08)`);
        gradient.addColorStop(0.5, `hsla(${hue}, 80%, 50%, 0.03)`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      };

      const pulse = Math.sin(time * 0.5) * 0.5 + 0.5;
      cornerGlow(0, 0, 300 + pulse * 100, 260);
      cornerGlow(window.innerWidth, 0, 300 + pulse * 100, 200);
      cornerGlow(0, window.innerHeight, 300 + pulse * 100, 280);
      cornerGlow(window.innerWidth, window.innerHeight, 300 + pulse * 100, 220);

      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const mouseGradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150);
      mouseGradient.addColorStop(0, 'rgba(120, 200, 255, 0.06)');
      mouseGradient.addColorStop(0.5, 'rgba(120, 200, 255, 0.02)');
      mouseGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = mouseGradient;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      const topGradient = ctx.createLinearGradient(0, 0, 0, 200);
      topGradient.addColorStop(0, 'rgba(120, 100, 255, 0.05)');
      topGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = topGradient;
      ctx.fillRect(0, 0, window.innerWidth, 200);

      ctx.fillStyle = 'rgba(2, 2, 8, 0.25)';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    };

    init();
    animationId = window.requestAnimationFrame(draw);

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />;
};

export default ParticleBackground;
