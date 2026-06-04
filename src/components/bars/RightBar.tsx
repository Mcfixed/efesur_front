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
  return (
    <div className="animate-slide-in-right w-full bg-bg-200 text-text-100 border-s border-s-border flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 110px)' }}>
      <div className="p-5 bg-bg-100 rounded-xl shrink-0">
        <h3>{title}</h3>
        <h5>{subTitle}</h5>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {overlays}
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

export default RightBar;
