type MotivationQuoteCardProps = {
  text: string;
  className?: string;
  placeholder?: string;
};

export function MotivationQuoteCard({
  text,
  className,
  placeholder = "Write your motivation…"
}: MotivationQuoteCardProps) {
  const display = text.trim() || placeholder;
  const isPlaceholder = !text.trim();

  return (
    <div
      className={`feed-post-quote motivation-quote-card${
        className ? ` ${className}` : ""
      }${isPlaceholder ? " is-placeholder" : ""}`}
    >
      <span className="feed-post-quote-mark" aria-hidden>
        “
      </span>
      <p>{display}</p>
    </div>
  );
}
