interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const s = (status ?? "unknown").toLowerCase();
  return (
    <span className={`badge ${s}`}>
      <span className="badge-dot" />
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}
