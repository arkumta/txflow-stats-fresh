"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  speed: number;
  length: number;
  drift: number;
  alpha: number;
};

export default function DataRainBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(max-width: 640px)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let pointerX = -1000;
    let pointerY = -1000;
    let lastTime = 0;
    const particles: Particle[] = [];
    const particleCount = motionQuery.matches ? 95 : 210;
    const random = (min: number, max: number) => min + Math.random() * (max - min);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: random(0, width),
          y: random(0, height),
          speed: random(12, 42),
          length: random(8, 28),
          drift: random(-5, 5),
          alpha: random(0.10, 0.36),
        });
      }
      if (reducedMotion) drawStatic();
    };

    const drawStatic = () => {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      for (const p of particles) {
        context.strokeStyle = `rgba(197,246,107,${p.alpha * 0.65})`;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x + p.drift * 0.25, p.y + p.length);
        context.stroke();
      }
    };

    const draw = (time: number) => {
      if (!visible) return;
      const delta = Math.min((time - (lastTime || time)) / 1000, 0.04);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.lineCap = "round";

      for (const p of particles) {
        const dx = p.x - pointerX;
        const dy = p.y - pointerY;
        const distance = Math.hypot(dx, dy);
        let pushX = 0;
        let pushY = 0;
        if (distance < 125 && distance > 0) {
          const force = (1 - distance / 125) * 15;
          pushX = (dx / distance) * force;
          pushY = (dy / distance) * force;
        }

        const x = p.x + pushX * 0.08;
        const y = p.y + pushY * 0.08;
        const glow = distance < 125 ? 1.7 : 1;
        context.strokeStyle = `rgba(197,246,107,${Math.min(0.48, p.alpha * glow)})`;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + p.drift * 0.22, y + p.length);
        context.stroke();

        p.x += (p.drift + pushX) * delta;
        p.y += (p.speed + pushY) * delta;
        if (p.y > height + p.length) {
          p.y = -p.length;
          p.x = random(0, width);
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
      }
      frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    };
    const onPointerLeave = () => {
      pointerX = -1000;
      pointerY = -1000;
    };
    const onVisibility = () => {
      visible = !document.hidden;
      if (!visible) {
        window.cancelAnimationFrame(frame);
      } else if (!reducedMotion) {
        lastTime = 0;
        frame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    canvas.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="txflow-data-rain"
    />
  );
}
