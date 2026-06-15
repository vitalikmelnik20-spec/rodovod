export default function FamilyGroupNode({ data }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        border: `2px solid ${data.color}`,
        borderRadius: 16,
        backgroundColor: data.bg,
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -22,
          left: 12,
          color: data.color,
          fontSize: 13,
          fontWeight: 'bold',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {data.label}
      </span>
    </div>
  );
}
