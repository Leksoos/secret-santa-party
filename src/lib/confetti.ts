import confetti from 'canvas-confetti';

export function triggerConfetti() {
  // Center blast
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#ef4444', '#10b981', '#f59e0b', '#ffffff', '#3b82f6'],
  });

  // Left & Right canons
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#ef4444', '#f59e0b', '#10b981'],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#10b981', '#ffffff', '#f59e0b'],
    });
  }, 200);
}

export function triggerSnowBurst() {
  confetti({
    particleCount: 40,
    spread: 90,
    origin: { y: 0.3 },
    shapes: ['circle'],
    colors: ['#ffffff', '#e0f2fe', '#bae6fd'],
    scalar: 1.2,
  });
}
