enum ApiFailureKind {
  validation,
  unauthenticated,
  forbidden,
  notFound,
  payloadTooLarge,
  server,
  network,
  timeout,
  cancelled,
  unknown,
}

class ApiFailure implements Exception {
  const ApiFailure(this.kind, {this.requestId, this.code});
  final ApiFailureKind kind;
  final String? requestId;
  final String? code;
}
