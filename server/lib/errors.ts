export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Please sign in as a chef to continue.") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "You can only open your own recipes.") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "Not found.") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message: string) {
    return new ApiError(409, "conflict", message);
  }
  static tooLarge(message: string) {
    return new ApiError(413, "too_large", message);
  }
  static upstream(message: string, details?: unknown) {
    return new ApiError(502, "upstream_failed", message, details);
  }
}
