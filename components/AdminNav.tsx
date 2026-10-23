import { Segmented } from "./Segmented";

const SECTIONS = [
  { value: "overview", label: "Overview", href: "/admin" },
  { value: "activities", label: "Activities", href: "/admin/activities" },
  { value: "members", label: "Members", href: "/admin/members" },
];

export function AdminNav({ current }: { current: "overview" | "activities" | "members" }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Segmented options={SECTIONS} value={current} label="Admin sections" />
    </div>
  );
}
