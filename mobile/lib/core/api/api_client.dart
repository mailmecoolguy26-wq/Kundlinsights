import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../errors/api_failure.dart';

abstract interface class AccessTokenSource {
  Future<String?> accessToken();
  Future<String?> refreshAccessToken();
  Future<void> invalidate();
}

class ApiClient {
  ApiClient({required AppConfig config, required this.tokens, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: config.apiBaseUrl,
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 20),
              sendTimeout: const Duration(seconds: 20),
            ),
          );

  final Dio _dio;
  final AccessTokenSource tokens;

  Future<Response<T>> get<T>(String path) => _request<T>(path);

  Future<Response<T>> _request<T>(String path, {bool retried = false}) async {
    try {
      final token = await tokens.accessToken();
      if (token == null) {
        throw const ApiFailure(ApiFailureKind.unauthenticated);
      }
      return await _dio.get<T>(
        path,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 && !retried) {
        final refreshedToken = await tokens.refreshAccessToken();
        if (refreshedToken != null) {
          return _request<T>(path, retried: true);
        }
      }
      if (error.response?.statusCode == 401) {
        await tokens.invalidate();
      }
      throw _map(error);
    }
  }

  ApiFailure _map(DioException error) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    final requestId = data is Map ? data['requestId'] as String? : null;
    if (status == 400) {
      return ApiFailure(ApiFailureKind.validation, requestId: requestId);
    }
    if (status == 401) {
      return ApiFailure(ApiFailureKind.unauthenticated, requestId: requestId);
    }
    if (status == 403) {
      return ApiFailure(ApiFailureKind.forbidden, requestId: requestId);
    }
    if (status == 404) {
      return ApiFailure(ApiFailureKind.notFound, requestId: requestId);
    }
    if (status == 413) {
      return ApiFailure(ApiFailureKind.payloadTooLarge, requestId: requestId);
    }
    if (status != null && status >= 500) {
      return ApiFailure(ApiFailureKind.server, requestId: requestId);
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const ApiFailure(ApiFailureKind.timeout);
    }
    if (error.type == DioExceptionType.cancel) {
      return const ApiFailure(ApiFailureKind.cancelled);
    }
    if (error.type == DioExceptionType.connectionError) {
      return const ApiFailure(ApiFailureKind.network);
    }
    return const ApiFailure(ApiFailureKind.unknown);
  }
}
