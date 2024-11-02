// components/ui/loading-spinner.tsx

export function LoadingSpinner({
    size = 'default',
    className = ''
  }: {
    size?: 'small' | 'default' | 'large'
    className?: string
  }) {
    const sizeClasses = {
      small: 'w-4 h-4 border-2',
      default: 'w-8 h-8 border-3',
      large: 'w-12 h-12 border-4'
    };
  
    return (
      <div
        className={`inline-block animate-spin rounded-full border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] ${sizeClasses[size]} ${className}`}
        role="status"
      >
        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
          Loading...
        </span>
      </div>
    );
  }