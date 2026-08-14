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
  const ApiFailure(this.kind, {this.requestId});
  final ApiFailureKind kind;
  final String? requestId;
}
