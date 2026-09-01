interface ResourceLoadErrorProps {
  resource: string;
  onRetry: () => void;
}

export default function ResourceLoadError({ resource, onRetry }: ResourceLoadErrorProps) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">Unable to load {resource}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your data has not been replaced or removed. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
