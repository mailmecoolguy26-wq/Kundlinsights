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

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) => _request<T>(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, String>? headers,
    Duration? receiveTimeout,
  }) => _request<T>(
    path,
    data: data,
    method: 'POST',
    headers: headers,
    receiveTimeout: receiveTimeout,
  );

  Future<Response<T>> patch<T>(String path, {Object? data}) =>
      _request<T>(path, data: data, method: 'PATCH');

  Future<Response<T>> delete<T>(String path) =>
      _request<T>(path, method: 'DELETE');

  Future<Response<T>> _request<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Object? data,
    String method = 'GET',
    Map<String, String>? headers,
    Duration? receiveTimeout,
    bool retried = false,
  }) async {
    try {
      final token = await tokens.accessToken();
      if (token == null) {
        throw const ApiFailure(ApiFailureKind.unauthenticated);
      }
      final options = Options(
        method: method,
        headers: {'Authorization': 'Bearer $token', ...?headers},
      );
      if (receiveTimeout != null) {
        options.receiveTimeout = receiveTimeout;
      }
      return await _dio.request<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 && !retried) {
        final refreshedToken = await tokens.refreshAccessToken();
        if (refreshedToken != null) {
          return _request<T>(
            path,
            queryParameters: queryParameters,
            data: data,
            method: method,
            headers: headers,
            receiveTimeout: receiveTimeout,
            retried: true,
          );
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
    final errorBody = data is Map ? data['error'] : null;
    final code = errorBody is Map ? errorBody['code'] as String? : null;
    if (status == 400) {
      return ApiFailure(
        ApiFailureKind.validation,
        requestId: requestId,
        code: code,
      );
    }
    if (status == 401) {
      return ApiFailure(
        ApiFailureKind.unauthenticated,
        requestId: requestId,
        code: code,
      );
    }
    if (status == 403) {
      return ApiFailure(
        ApiFailureKind.forbidden,
        requestId: requestId,
        code: code,
      );
    }
    if (status == 404) {
      return ApiFailure(
        ApiFailureKind.notFound,
        requestId: requestId,
        code: code,
      );
    }
    if (status == 413) {
      return ApiFailure(
        ApiFailureKind.payloadTooLarge,
        requestId: requestId,
        code: code,
      );
    }
    if (status != null && status >= 500) {
      return ApiFailure(
        ApiFailureKind.server,
        requestId: requestId,
        code: code,
      );
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
