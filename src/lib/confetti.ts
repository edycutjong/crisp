/**
 * Reusable, premium, and lightweight canvas-confetti generator.
 * Operates offline without external CDN dependencies.
 */
export function triggerConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);

  const colors = [
    "#06b6d4",
    "#22c55e",
    "#a855f7",
    "#f59e0b",
    "#ef4444",
    "#ffffff",
  ];
  const particles: Array<{
    x: number;
    y: number;
    size: number;
    color: string;
    speedX: number;
    speedY: number;
    rotation: number;
    rotationSpeed: number;
  }> = [];

  const numParticles = 120;
  for (let i = 0; i < numParticles; i++) {
    const fromLeft = i < numParticles / 2;
    particles.push({
      x: fromLeft ? 0 : width,
      y: height,
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: (fromLeft ? 1 : -1) * (Math.random() * 8 + 4),
      speedY: -(Math.random() * 12 + 10),
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5,
    });
  }

  const gravity = 0.3;
  const friction = 0.98;

  function update() {
    ctx!.clearRect(0, 0, width, height);

    let active = false;
    for (const p of particles) {
      p.speedY += gravity;
      p.speedX *= friction;
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;

      if (p.y < height + 50 && p.x > -50 && p.x < width + 50) {
        active = true;
      }

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rotation * Math.PI) / 180);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx!.restore();
    }

    if (active) {
      requestAnimationFrame(update);
    } else {
      window.removeEventListener("resize", handleResize);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    }
  }

  update();
}
