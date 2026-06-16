export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <div className="font-medium">Daten nicht verfügbar</div>
      <div className="mt-0.5 text-xs">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs underline hover:no-underline">
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
