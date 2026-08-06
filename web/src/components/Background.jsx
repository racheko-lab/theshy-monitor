import { useEffect, useRef, useState } from 'react';

export default function Background({ showStars = true }) {
  const canvasRef = useRef(null);
  const [stars, setStars] = useState([]);
  const animRef = useRef();

  useEffect(() => {
    if (!showStars) return;
    const starList = [];
    for (let i = 0; i < 80; i++) {
      starList.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 3,
        duration: Math.random() * 2 + 2,
      });
    }
    setStars(starList);
  }, [showStars]);

  return (
    <div className="gradient-bg">
      <div
        className="gradient-orb"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(79,140,255,0.15) 0%, transparent 70%)',
          top: '-10%',
          left: '-5%',
          animationDelay: '0s',
        }}
      />
      <div
        className="gradient-orb"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255,77,79,0.08) 0%, transparent 70%)',
          top: '30%',
          right: '-10%',
          animationDelay: '2s',
        }}
      />
      <div
        className="gradient-orb"
        style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(74,222,128,0.06) 0%, transparent 70%)',
          bottom: '-5%',
          left: '30%',
          animationDelay: '4s',
        }}
      />
      {showStars && stars.map((star, i) => (
        <div
          key={i}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
            animationDuration: `${star.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
