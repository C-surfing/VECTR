import React, { useEffect, useRef, useState, useCallback } from 'react';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 背景图片 - 预加载
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    bgImage.src = 'https://ocfbitiofnrjdudakqcf.supabase.co/storage/v1/object/public/media/pexels-diva-32633935.jpg';
    
    bgImage.onload = () => {
      setImageLoaded(true);
    };
    bgImage.onerror = () => {
      setImageLoaded(true);
    };

    // 简化的粒子系统
    let particles: Array<{
      x: number;
      y: number;
      radius: number;
      opacity: number;
      vx: number;
      vy: number;
    }> = [];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];

      for (let i = 0; i < 8; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 100 + 50,
          opacity: Math.random() * 0.15 + 0.05,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
        });
      }
    };

    let animationId: number;
    let frameCount = 0;
    let time = 0;

    const draw = () => {
      if (!ctx) return;
      time += 0.01;
      
      // 基础深色背景
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制背景图片 - 降低模糊度，提高可见度
      if (imageLoaded && bgImage.complete) {
        ctx.save();
        ctx.globalAlpha = 0.35; // 提高透明度
        ctx.filter = 'blur(12px)'; // 降低模糊度
        const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height);
        const x = (canvas.width - bgImage.width * scale) / 2;
        const y = (canvas.height - bgImage.height * scale) / 2;
        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
        ctx.restore();
      }

      // 粒子动画 - 每3帧更新一次位置
      frameCount++;
      if (frameCount % 3 === 0) {
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -p.radius * 2) p.x = canvas.width + p.radius;
          if (p.x > canvas.width + p.radius * 2) p.x = -p.radius;
          if (p.y < -p.radius * 2) p.y = canvas.height + p.radius;
          if (p.y > canvas.height + p.radius * 2) p.y = -p.radius;
        });
      }

      // 绘制粒子
      particles.forEach(p => {
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        const hue = (p.x / canvas.width) * 60 + 240;
        gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, ${p.opacity})`);
        gradient.addColorStop(0.5, `hsla(${hue}, 70%, 60%, ${p.opacity * 0.3})`);
        gradient.addColorStop(1, `hsla(${hue}, 70%, 60%, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen';
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';

      // ===== 添加简单高效的光效 =====
      
      // 1. 角落光晕效果 (4个角落)
      const cornerGlow = (x: number, y: number, size: number, hue: number) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.08)`);
        gradient.addColorStop(0.5, `hsla(${hue}, 80%, 50%, 0.03)`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };
      
      // 动态角落光晕 - 缓慢脉动
      const pulse = Math.sin(time * 0.5) * 0.5 + 0.5;
      cornerGlow(0, 0, 300 + pulse * 100, 260); // 左上 - 紫色
      cornerGlow(canvas.width, 0, 300 + pulse * 100, 200); // 右上 - 青色
      cornerGlow(0, canvas.height, 300 + pulse * 100, 280); // 左下 - 品红
      cornerGlow(canvas.width, canvas.height, 300 + pulse * 100, 220); // 右下 - 蓝色

      // 2. 鼠标跟随光效 (简单圆形光晕)
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;
      const mouseGradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150);
      mouseGradient.addColorStop(0, 'rgba(120, 200, 255, 0.06)');
      mouseGradient.addColorStop(0.5, 'rgba(120, 200, 255, 0.02)');
      mouseGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = mouseGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. 顶部细微渐变光
      const topGradient = ctx.createLinearGradient(0, 0, 0, 200);
      topGradient.addColorStop(0, 'rgba(120, 100, 255, 0.05)');
      topGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = topGradient;
      ctx.fillRect(0, 0, canvas.width, 200);

      // 暗色遮罩 - 降低不透明度让背景更明显
      ctx.fillStyle = 'rgba(2, 2, 8, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationId = requestAnimationFrame(draw);
    };

    init();
    draw();

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [imageLoaded]);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 pointer-events-none" />;
};

export default ParticleBackground;
