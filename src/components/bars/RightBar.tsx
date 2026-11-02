import { useTheme } from "@/context/ThemeContext";

interface RightBarProps {
  overlays?: React.ReactNode;
  title?: string;
  subTitle?: string;
  children?: React.ReactNode;
}

function RightBar({
  overlays,
  title = "Título por defecto",
  subTitle = "Subtítulo por defecto",
  children,
}: RightBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`animate-slide-in-right w-full flex flex-col overflow-hidden ${
        isDark ? "bg-bg-200 text-text-100 border-s border-s-border" : "bg-slate-100 text-slate-800 border-s border-slate-200 shadow-[0_0_0_1px_rgba(148,163,184,0.15)]"
      }`}
      style={{ height: 'calc(100vh - 110px)' }}
    >
      <div className={`p-5 rounded-xl shrink-0 ${isDark ? "bg-bg-100" : "surface-card-2"}`}>
        <h3 className={isDark ? "" : "text-slate-900"}>{title}</h3>
        <h5 className={isDark ? "" : "text-slate-600"}>{subTitle}</h5>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {overlays}
        <div className={`p-3 ${isDark ? "" : "surface-card-1"}`}>{children}</div>
      </div>
    </div>
  );
}

export default RightBar;
