export class DownstreamError extends Error {
  public readonly transient: boolean;
  public readonly details?: Record<string, unknown>;

  public constructor(message: string, transient: boolean, details?: Record<string, unknown>) {
    super(message);
    this.name = "DownstreamError";
    this.transient = transient;
    this.details = details;
  }
}
