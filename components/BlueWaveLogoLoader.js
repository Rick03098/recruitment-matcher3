export default function BlueWaveLogoLoader({ size = 64 }) {
  const barCount = 9;
  const barWidth = 10;
  const barGap = 5;
  const maxHeight = 60;
  const minHeight = 20;
  const svgWidth = barCount * barWidth + (barCount - 1) * barGap;
  const svgHeight = maxHeight;
  const animDur = 1.2;
  return (
    <svg width={size} height={size/2} viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: barCount }).map((_, i) => {
        const delay = (i * 0.1).toFixed(1);
        return (
          <rect
            key={i}
            x={i * (barWidth + barGap)}
            y={0}
            width={barWidth}
            height={maxHeight}
            fill="#1680FF"
          >
            <animate
              attributeName="height"
              values={`${maxHeight};${minHeight};${maxHeight}`}
              dur={`${animDur}s`}
              repeatCount="indefinite"
              begin={`${delay}s`}
            />
            <animate
              attributeName="y"
              values={`0;${maxHeight - minHeight};0`}
              dur={`${animDur}s`}
              repeatCount="indefinite"
              begin={`${delay}s`}
            />
          </rect>
        );
      })}
    </svg>
  );
} 