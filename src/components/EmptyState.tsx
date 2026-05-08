import { ReactNode } from "react";
import "./EmptyState.css";

interface EmptyStateProps {
  title: string;
  desc: string;
  action?: ReactNode;
}

export default function EmptyState({ title, desc, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-desc">{desc}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
