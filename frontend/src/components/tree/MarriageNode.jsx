import { Handle, Position } from 'reactflow';

// Invisible connector node between two spouses.
// Children connect from here downward; spouses connect to here from above.
export default function MarriageNode() {
  const s = { background: 'transparent', border: 'none', width: 1, height: 1, opacity: 0 };
  return (
    <div style={{ width: 1, height: 1 }}>
      <Handle type="target" position={Position.Top} style={s} />
      <Handle type="source" position={Position.Bottom} style={s} />
    </div>
  );
}
