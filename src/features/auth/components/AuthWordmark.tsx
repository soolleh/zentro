interface AuthWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<AuthWordmarkProps['size']>, string> = {
  sm: 'text-lg font-bold tracking-tight text-foreground',
  md: 'text-xl font-bold tracking-tight text-foreground',
  lg: 'text-2xl font-bold tracking-tight text-foreground',
};

export function AuthWordmark({ size = 'md' }: AuthWordmarkProps) {
  return (
    <span className={`flex items-center gap-1 ${sizeClasses[size]}`}>
      Zentro
      <span
        className="inline-block w-1.5 h-1.5 rounded-sm bg-primary"
        aria-hidden="true"
      />
    </span>
  );
}
